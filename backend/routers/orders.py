"""
BrewTrade AI - Orders router.
Order creation, validation, tracking, approvals, status history.
"""
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import (
    Customer,
    CustomerProductAccess,
    Order,
    OrderItem,
    OrderStatusHistory,
    Product,
)
from schemas import OrderOut

router = APIRouter(prefix="/api/orders", tags=["Orders"])


# ============================================================
# Local request/response schemas
# ============================================================
class CartLineIn(BaseModel):
    product_id: int
    quantity: int


class CartValidateIn(BaseModel):
    customer_id: int
    items: List[CartLineIn]


class OrderCreateIn(BaseModel):
    customer_id: int
    items: List[CartLineIn]
    notes: Optional[str] = None


class ApproveItemIn(BaseModel):
    order_item_id: int
    quantity_approved: int


class ApproveIn(BaseModel):
    manager_id: int
    approved_items: List[ApproveItemIn] = []
    notes: Optional[str] = None


class RejectIn(BaseModel):
    manager_id: int
    reason: str


# ============================================================
# Helpers
# ============================================================
def _price_for(
    db: Session, customer_id: int, product: Product
) -> tuple[float, Optional[float], bool]:
    """Return (effective_price, customer_price, promo_active)."""
    access = (
        db.query(CustomerProductAccess)
        .filter(
            CustomerProductAccess.customer_id == customer_id,
            CustomerProductAccess.product_id == product.id,
        )
        .first()
    )
    if access:
        if access.promo_active and access.promotional_price is not None:
            return access.promotional_price, access.customer_price, True
        return access.customer_price, access.customer_price, False
    # Fallback to base price if no customer-specific pricing exists
    return product.base_price, None, False


def _confidence(requested: int, available: int) -> str:
    """High if fully covered, medium if 60-99%, low if < 60%."""
    if available >= requested and requested > 0:
        return "high"
    if requested <= 0:
        return "high"
    coverage = available / requested
    if coverage >= 0.6:
        return "medium"
    return "low"


def _financial_health(customer: Customer) -> Dict[str, Any]:
    available = max(customer.credit_limit - customer.outstanding_balance, 0.0)
    utilization = (
        customer.outstanding_balance / customer.credit_limit
        if customer.credit_limit and customer.credit_limit > 0
        else 0.0
    )
    return {
        "credit_limit": customer.credit_limit,
        "outstanding_balance": customer.outstanding_balance,
        "available_credit": available,
        "utilization": round(utilization, 3),
        "credit_health": customer.credit_health,
    }


def _risk_score(customer: Customer) -> float:
    if not customer.credit_limit or customer.credit_limit <= 0:
        return 0.0
    return round(customer.outstanding_balance / customer.credit_limit, 3)


def _risk_indicator_from(customer: Customer, lines_low: int) -> str:
    ratio = _risk_score(customer)
    if ratio > 0.8 or customer.credit_health == "red" or lines_low > 0:
        return "high"
    if ratio > 0.5 or customer.credit_health == "yellow":
        return "medium"
    return "low"


def _generate_order_number(db: Session) -> str:
    """Format: BT-YYYYMMDD-NNNN, NNNN is the per-day sequence."""
    today = datetime.utcnow()
    day_str = today.strftime("%Y%m%d")
    prefix = f"BT-{day_str}-"
    start_of_day = datetime(today.year, today.month, today.day)
    count_today = (
        db.query(func.count(Order.id))
        .filter(Order.created_at >= start_of_day)
        .scalar()
        or 0
    )
    return f"{prefix}{count_today + 1:04d}"


def _serialize_order(order: Order) -> Dict[str, Any]:
    return OrderOut.model_validate(order).model_dump()


def _serialize_order_summary(order: Order) -> Dict[str, Any]:
    """Lightweight order projection (scalar columns only).

    Skips the ``items`` and ``status_history`` relationships so callers that
    only need order-level aggregates avoid the per-order status_history
    lazy-load (an N+1 over potentially thousands of orders) and the large
    nested payload that comes with it.
    """
    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer_id": order.customer_id,
        "status": order.status,
        "total_value": order.total_value,
        "created_at": order.created_at,
        "expected_delivery": order.expected_delivery,
        "risk_score": order.risk_score,
        "ai_recommendation": order.ai_recommendation,
    }


# ============================================================
# Endpoints
# ============================================================
@router.get("/ping")
def ping():
    return {"status": "ok", "module": "orders"}


# ----- Specific routes BEFORE parameterized ones -----
@router.get("/pending/approval")
def pending_approval(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Manager queue: orders awaiting approval, with customer + risk_score."""
    rows = (
        db.query(Order)
        .options(joinedload(Order.customer), joinedload(Order.items))
        .filter(Order.status.in_(["submitted", "pending_approval"]))
        .order_by(Order.created_at.desc())
        .all()
    )
    result: List[Dict[str, Any]] = []
    for o in rows:
        cust = o.customer
        risk = _risk_score(cust) if cust else 0.0
        risk_level = "high" if risk > 0.8 else ("medium" if risk > 0.5 else "low")
        result.append(
            {
                "id": o.id,
                "order_number": o.order_number,
                "status": o.status,
                "total_value": o.total_value,
                "created_at": o.created_at,
                "expected_delivery": o.expected_delivery,
                "item_count": len(o.items),
                "risk_score": risk,
                "risk_level": risk_level,
                "ai_recommendation": o.ai_recommendation,
                "customer": {
                    "id": cust.id if cust else None,
                    "name": cust.name if cust else None,
                    "market": cust.market if cust else None,
                    "credit_limit": cust.credit_limit if cust else 0.0,
                    "outstanding_balance": cust.outstanding_balance if cust else 0.0,
                    "credit_health": cust.credit_health if cust else None,
                },
            }
        )
    return result


@router.post("/cart/validate")
def validate_cart(payload: CartValidateIn, db: Session = Depends(get_db)) -> Dict[str, Any]:
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    lines: List[Dict[str, Any]] = []
    total_value = 0.0
    lines_low = 0

    for line in payload.items:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if not product:
            lines.append(
                {
                    "product_id": line.product_id,
                    "quantity_requested": line.quantity,
                    "available": 0,
                    "inventory_confidence": "low",
                    "unit_price": 0.0,
                    "line_total": 0.0,
                    "error": "Product not found",
                }
            )
            lines_low += 1
            continue

        price, customer_price, promo_active = _price_for(db, customer.id, product)
        line_total = price * line.quantity
        total_value += line_total
        confidence = _confidence(line.quantity, product.available_quantity)
        if confidence == "low":
            lines_low += 1

        market_ok = (not product.approved_markets) or (
            customer.market in product.approved_markets
        )
        moq_ok = line.quantity >= (product.moq or 1)

        lines.append(
            {
                "product_id": product.id,
                "sku": product.sku,
                "name": product.name,
                "quantity_requested": line.quantity,
                "available": product.available_quantity,
                "inventory_confidence": confidence,
                "unit_price": price,
                "customer_price": customer_price,
                "promo_active": promo_active,
                "line_total": line_total,
                "moq": product.moq,
                "moq_ok": moq_ok,
                "market_approved": market_ok,
            }
        )

    financial_health = _financial_health(customer)
    over_credit = total_value + customer.outstanding_balance > customer.credit_limit
    risk_indicator = _risk_indicator_from(customer, lines_low)
    if over_credit and risk_indicator != "high":
        risk_indicator = "high"

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "market": customer.market,
        "items": lines,
        "total_value": round(total_value, 2),
        "financial_health": financial_health,
        "risk_indicator": risk_indicator,
        "over_credit_limit": over_credit,
    }


@router.post("", response_model=OrderOut)
@router.post("/", response_model=OrderOut)
def create_order(payload: OrderCreateIn, db: Session = Depends(get_db)) -> OrderOut:
    customer = db.query(Customer).filter(Customer.id == payload.customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    if not payload.items:
        raise HTTPException(status_code=400, detail="Order must contain at least one item")

    now = datetime.utcnow()
    order = Order(
        order_number=_generate_order_number(db),
        customer_id=customer.id,
        status="submitted",
        total_value=0.0,
        created_at=now,
        expected_delivery=now + timedelta(days=14),
        notes=payload.notes,
    )
    db.add(order)
    db.flush()  # get order.id

    total_value = 0.0
    for line in payload.items:
        product = db.query(Product).filter(Product.id == line.product_id).first()
        if not product:
            db.rollback()
            raise HTTPException(
                status_code=404, detail=f"Product {line.product_id} not found"
            )
        price, _customer_price, _promo = _price_for(db, customer.id, product)
        line_total = price * line.quantity
        total_value += line_total

        db.add(
            OrderItem(
                order_id=order.id,
                product_id=product.id,
                quantity_requested=line.quantity,
                unit_price=price,
                line_total=line_total,
            )
        )

    order.total_value = round(total_value, 2)
    order.risk_score = _risk_score(customer)

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status="submitted",
            timestamp=now,
            actor="distributor",
            note="Order submitted by distributor",
        )
    )

    db.commit()
    db.refresh(order)
    return OrderOut.model_validate(order)


@router.get("")
@router.get("/")
def list_orders(
    customer_id: Optional[int] = Query(None),
    status: Optional[str] = Query(None),
    since_days: Optional[int] = Query(None, ge=1, le=3650),
    limit: Optional[int] = Query(None, ge=1, le=10000),
    summary: bool = Query(
        False,
        description="Return a lightweight, order-level projection (no items / "
        "status history). Avoids an N+1 lazy-load over large order sets.",
    ),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    q = db.query(Order)
    # Only eager-load the heavy relationships when the full payload is needed.
    if summary:
        q = q.options(joinedload(Order.customer))
    else:
        q = q.options(joinedload(Order.items), joinedload(Order.customer))
    if customer_id is not None:
        q = q.filter(Order.customer_id == customer_id)
    if status:
        q = q.filter(Order.status == status)
    if since_days:
        q = q.filter(Order.created_at >= datetime.utcnow() - timedelta(days=since_days))
    q = q.order_by(Order.created_at.desc())
    if limit:
        q = q.limit(limit)
    orders = q.all()
    if summary:
        return [_serialize_order_summary(o) for o in orders]
    return [_serialize_order(o) for o in orders]


@router.get("/{order_id}", response_model=OrderOut)
def get_order(order_id: int, db: Session = Depends(get_db)) -> OrderOut:
    order = (
        db.query(Order)
        .options(
            joinedload(Order.items),
            joinedload(Order.customer),
            joinedload(Order.status_history),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    return OrderOut.model_validate(order)


@router.get("/{order_id}/tracking")
def get_tracking(order_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    order = (
        db.query(Order)
        .options(joinedload(Order.status_history))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    canonical = [
        "submitted",
        "pending_approval",
        "approved",
        "processing",
        "shipped",
        "delivered",
    ]
    history_by_status: Dict[str, OrderStatusHistory] = {}
    for h in sorted(order.status_history, key=lambda x: x.timestamp):
        history_by_status[h.status] = h

    rejected = order.status == "rejected"
    current_index = (
        canonical.index(order.status) if order.status in canonical else -1
    )

    steps: List[Dict[str, Any]] = []
    for idx, label in enumerate(canonical):
        h = history_by_status.get(label)
        if h is not None:
            state = "complete"
        elif rejected:
            state = "skipped"
        elif idx < current_index:
            state = "complete"
        elif idx == current_index:
            state = "current"
        else:
            state = "pending"
        steps.append(
            {
                "key": label,
                "label": label.replace("_", " ").title(),
                "state": state,
                "timestamp": h.timestamp if h else None,
                "actor": h.actor if h else None,
                "note": h.note if h else None,
            }
        )

    if rejected:
        rej = next(
            (
                h
                for h in sorted(order.status_history, key=lambda x: x.timestamp)
                if h.status == "rejected"
            ),
            None,
        )
        steps.append(
            {
                "key": "rejected",
                "label": "Rejected",
                "state": "complete",
                "timestamp": rej.timestamp if rej else None,
                "actor": rej.actor if rej else None,
                "note": rej.note if rej else None,
            }
        )

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "status": order.status,
        "expected_delivery": order.expected_delivery,
        "created_at": order.created_at,
        "steps": steps,
    }


@router.post("/{order_id}/reorder", response_model=OrderOut)
def reorder(
    order_id: int,
    customer_id: int = Query(...),
    db: Session = Depends(get_db),
) -> OrderOut:
    original = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.id == order_id)
        .first()
    )
    if not original:
        raise HTTPException(status_code=404, detail="Original order not found")
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    items: List[CartLineIn] = []
    for it in original.items:
        if it.product_id is None:
            continue
        items.append(CartLineIn(product_id=it.product_id, quantity=it.quantity_requested))

    if not items:
        raise HTTPException(status_code=400, detail="Original order has no reorderable items")

    payload = OrderCreateIn(
        customer_id=customer.id,
        items=items,
        notes=f"Reorder of {original.order_number}",
    )
    return create_order(payload, db=db)


@router.post("/{order_id}/approve", response_model=OrderOut)
def approve_order(
    order_id: int, payload: ApproveIn, db: Session = Depends(get_db)
) -> OrderOut:
    order = (
        db.query(Order)
        .options(joinedload(Order.items))
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status not in ("submitted", "pending_approval"):
        raise HTTPException(
            status_code=400,
            detail=f"Order in status '{order.status}' cannot be approved",
        )

    approved_map = {a.order_item_id: a.quantity_approved for a in payload.approved_items}

    new_total = 0.0
    for item in order.items:
        if item.id in approved_map:
            qty = max(0, int(approved_map[item.id]))
        else:
            qty = item.quantity_requested
        item.quantity_approved = qty
        item.line_total = round(item.unit_price * qty, 2)
        new_total += item.line_total

    order.total_value = round(new_total, 2)
    order.approved_by = str(payload.manager_id)
    order.approval_notes = payload.notes
    now = datetime.utcnow()

    order.status = "approved"
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status="approved",
            timestamp=now,
            actor=f"manager:{payload.manager_id}",
            note=payload.notes or "Approved by manager",
        )
    )

    order.status = "processing"
    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status="processing",
            timestamp=datetime.utcnow(),
            actor="system",
            note="Order moved to processing",
        )
    )

    db.commit()
    db.refresh(order)
    return OrderOut.model_validate(order)


@router.post("/{order_id}/reject", response_model=OrderOut)
def reject_order(
    order_id: int, payload: RejectIn, db: Session = Depends(get_db)
) -> OrderOut:
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.status in ("delivered", "shipped", "rejected"):
        raise HTTPException(
            status_code=400,
            detail=f"Order in status '{order.status}' cannot be rejected",
        )

    order.status = "rejected"
    order.approved_by = str(payload.manager_id)
    order.approval_notes = payload.reason

    db.add(
        OrderStatusHistory(
            order_id=order.id,
            status="rejected",
            timestamp=datetime.utcnow(),
            actor=f"manager:{payload.manager_id}",
            note=payload.reason,
        )
    )

    db.commit()
    db.refresh(order)
    return OrderOut.model_validate(order)


@router.get("/{order_id}/review")
def review_order(order_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Enriched payload for the manager review workspace."""
    order = (
        db.query(Order)
        .options(
            joinedload(Order.items),
            joinedload(Order.customer),
            joinedload(Order.status_history),
        )
        .filter(Order.id == order_id)
        .first()
    )
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    customer = order.customer
    if not customer:
        raise HTTPException(status_code=404, detail="Customer for order not found")

    # Per-line product + availability
    items_enriched: List[Dict[str, Any]] = []
    for it in order.items:
        product = (
            db.query(Product).filter(Product.id == it.product_id).first()
            if it.product_id
            else None
        )
        available = product.available_quantity if product else 0
        requested = it.quantity_requested
        coverage_pct = (
            round(min(available / requested, 1.0) * 100, 1) if requested > 0 else 100.0
        )
        shortage_flag = available < requested
        items_enriched.append(
            {
                "order_item_id": it.id,
                "product_id": it.product_id,
                "sku": product.sku if product else None,
                "name": product.name if product else None,
                "category": product.category if product else None,
                "image_url": product.image_url if product else None,
                "quantity_requested": requested,
                "quantity_approved": it.quantity_approved,
                "available": available,
                "coverage_pct": coverage_pct,
                "shortage_flag": shortage_flag,
                "unit_price": it.unit_price,
                "line_total": it.line_total,
            }
        )

    # Historical orders (last 5, excluding current)
    historical = (
        db.query(Order)
        .filter(Order.customer_id == customer.id, Order.id != order.id)
        .order_by(Order.created_at.desc())
        .limit(5)
        .all()
    )
    historical_payload = [
        {
            "id": h.id,
            "order_number": h.order_number,
            "status": h.status,
            "total_value": h.total_value,
            "created_at": h.created_at,
        }
        for h in historical
    ]

    risk = _risk_score(customer)
    risk_level = "high" if risk > 0.8 else ("medium" if risk > 0.5 else "low")

    return {
        "order": {
            "id": order.id,
            "order_number": order.order_number,
            "status": order.status,
            "total_value": order.total_value,
            "created_at": order.created_at,
            "expected_delivery": order.expected_delivery,
            "notes": order.notes,
        },
        "customer": {
            "id": customer.id,
            "name": customer.name,
            "market": customer.market,
            "contact_name": customer.contact_name,
            "contact_email": customer.contact_email,
            "contact_phone": customer.contact_phone,
        },
        "financial_health": _financial_health(customer),
        "historical_orders": historical_payload,
        "items": items_enriched,
        "risk_score": risk,
        "risk_level": risk_level,
        "ai_recommendation": order.ai_recommendation,  # placeholder, filled by AI service later
        "status_history": [
            {
                "status": h.status,
                "timestamp": h.timestamp,
                "actor": h.actor,
                "note": h.note,
            }
            for h in sorted(order.status_history, key=lambda x: x.timestamp)
        ],
    }
