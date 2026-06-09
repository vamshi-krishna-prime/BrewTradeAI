"""
BrewTrade AI - AI router.

Exposes Claude-powered intelligence endpoints:
  - POST /api/ai/order/{order_id}/recommendation
  - POST /api/ai/order/{order_id}/explain
  - POST /api/ai/assistant
  - GET  /api/ai/executive/summary
  - POST /api/ai/customer/{customer_id}/intel
  - POST /api/ai/order/{order_id}/approval-report

All endpoints are wrapped to never 500 on a Claude/network failure — the
underlying service layer falls back to a deterministic mock when needed.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from database import get_db
from models import (
    AIDecisionLog,
    Customer,
    CustomerProductAccess,
    Invoice,
    Order,
    OrderItem,
    Product,
)
from services import claude_ai, pdf_generator

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/ai", tags=["AI"])


# ---------------------------------------------------------------------------
# Request bodies
# ---------------------------------------------------------------------------


class ExplainRequest(BaseModel):
    question: str = Field(..., min_length=1, max_length=2000)


class AssistantRequest(BaseModel):
    customer_id: int
    prompt: str = Field(..., min_length=1, max_length=4000)


# ---------------------------------------------------------------------------
# Serialization helpers (DB model -> dict for Claude / mock layer)
# ---------------------------------------------------------------------------


def _customer_to_dict(c: Customer) -> Dict[str, Any]:
    return {
        "id": c.id,
        "name": c.name,
        "market": c.market,
        "credit_limit": c.credit_limit,
        "outstanding_balance": c.outstanding_balance,
        "credit_health": c.credit_health,
        "contact_name": c.contact_name,
        "contact_email": c.contact_email,
        "contact_phone": c.contact_phone,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _order_item_to_dict(item: OrderItem, db: Session) -> Dict[str, Any]:
    name = None
    sku = None
    if item.product_id:
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if prod:
            name = prod.name
            sku = prod.sku
    return {
        "id": item.id,
        "product_id": item.product_id,
        "merchandise_id": item.merchandise_id,
        "name": name or (f"Merchandise #{item.merchandise_id}" if item.merchandise_id else "Item"),
        "sku": sku,
        "quantity_requested": item.quantity_requested,
        "quantity_approved": item.quantity_approved,
        "unit_price": item.unit_price,
        "line_total": item.line_total,
    }


def _order_to_dict(order: Order, db: Session) -> Dict[str, Any]:
    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer_id": order.customer_id,
        "status": order.status,
        "total_value": order.total_value,
        "created_at": order.created_at.isoformat() if order.created_at else None,
        "expected_delivery": order.expected_delivery.isoformat() if order.expected_delivery else None,
        "approved_by": order.approved_by,
        "approval_notes": order.approval_notes,
        "risk_score": order.risk_score,
        "ai_recommendation": order.ai_recommendation,
        "notes": order.notes,
        "items": [_order_item_to_dict(i, db) for i in (order.items or [])],
    }


def _invoice_to_dict(inv: Invoice) -> Dict[str, Any]:
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "customer_id": inv.customer_id,
        "order_id": inv.order_id,
        "amount": inv.amount,
        "balance": inv.balance,
        "status": inv.status,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
    }


def _product_to_dict(prod: Product, access: Optional[CustomerProductAccess] = None) -> Dict[str, Any]:
    return {
        "id": prod.id,
        "sku": prod.sku,
        "name": prod.name,
        "category": prod.category,
        "base_price": prod.base_price,
        "moq": prod.moq,
        "available_quantity": prod.available_quantity,
        "approved_markets": prod.approved_markets or [],
        "customer_price": access.customer_price if access else prod.base_price,
        "promotional_price": access.promotional_price if access else None,
        "promo_active": bool(access.promo_active) if access else False,
    }


# ---------------------------------------------------------------------------
# Domain helpers
# ---------------------------------------------------------------------------


def _build_inventory_status(order: Order, db: Session) -> Dict[str, Any]:
    """Compare requested vs. available stock for each product in the order."""
    items_payload: List[Dict[str, Any]] = []
    total_shortage = 0
    for item in order.items or []:
        if not item.product_id:
            continue
        prod = db.query(Product).filter(Product.id == item.product_id).first()
        if not prod:
            continue
        requested = item.quantity_requested or 0
        available = prod.available_quantity or 0
        shortage = max(0, requested - available)
        total_shortage += shortage
        items_payload.append({
            "product_id": prod.id,
            "name": prod.name,
            "sku": prod.sku,
            "requested": requested,
            "available": available,
            "shortage": shortage,
            "market_approved": (order.customer.market in (prod.approved_markets or [])) if order.customer else None,
        })
    return {
        "items": items_payload,
        "total_shortage_units": total_shortage,
        "any_shortage": total_shortage > 0,
    }


def _build_financial_health(customer: Customer, db: Session) -> Dict[str, Any]:
    """Lightweight financial-health snapshot used for approval analysis."""
    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer.id)
        .order_by(Invoice.invoice_date.desc())
        .limit(50)
        .all()
    )

    total_open = sum((inv.balance or 0) for inv in invoices if (inv.status or "").lower() != "closed")
    overdue_count = sum(1 for inv in invoices if (inv.status or "").lower() == "overdue")
    overdue_balance = sum(
        (inv.balance or 0) for inv in invoices if (inv.status or "").lower() == "overdue"
    )

    # Approximate days-sales-outstanding from open invoice ages
    now = datetime.utcnow()
    dso_days_list: List[float] = []
    for inv in invoices:
        if not inv.invoice_date or (inv.status or "").lower() == "closed":
            continue
        age_days = max(0, (now - inv.invoice_date).days)
        dso_days_list.append(age_days)
    dso = round(sum(dso_days_list) / len(dso_days_list), 1) if dso_days_list else 0.0

    if overdue_count >= 3 or overdue_balance > 0.5 * max(customer.credit_limit, 1):
        rating = "poor"
    elif overdue_count > 0 or dso > 45:
        rating = "watch"
    else:
        rating = "healthy"

    return {
        "credit_limit": customer.credit_limit,
        "outstanding_balance": customer.outstanding_balance,
        "available_credit": max(0.0, (customer.credit_limit or 0) - (customer.outstanding_balance or 0)),
        "open_invoice_balance": total_open,
        "overdue_invoice_count": overdue_count,
        "overdue_balance": overdue_balance,
        "days_sales_outstanding": dso,
        "credit_health": customer.credit_health,
        "rating": rating,
    }


def _aggregate_kpis(db: Session) -> Dict[str, Any]:
    """Compute executive KPIs from the database."""
    orders = db.query(Order).all()
    total_orders = len(orders)
    total_revenue = sum((o.total_value or 0) for o in orders if (o.status or "").lower() in {"approved", "processing", "shipped", "delivered"})
    avg_order_value = (total_revenue / total_orders) if total_orders else 0.0

    pending = sum(1 for o in orders if (o.status or "").lower() in {"submitted", "pending_approval"})
    approved = sum(1 for o in orders if (o.status or "").lower() in {"approved", "processing", "shipped", "delivered"})
    rejected = sum(1 for o in orders if (o.status or "").lower() == "rejected")

    # Top products by revenue contribution
    product_revenue: Dict[int, float] = {}
    product_names: Dict[int, str] = {}
    for o in orders:
        if (o.status or "").lower() not in {"approved", "processing", "shipped", "delivered"}:
            continue
        for it in (o.items or []):
            if not it.product_id:
                continue
            product_revenue[it.product_id] = product_revenue.get(it.product_id, 0.0) + (it.line_total or 0)

    if product_revenue:
        prod_ids = list(product_revenue.keys())
        prods = db.query(Product).filter(Product.id.in_(prod_ids)).all()
        for p in prods:
            product_names[p.id] = p.name

    top_products = sorted(
        (
            {"product_id": pid, "name": product_names.get(pid, f"Product #{pid}"), "revenue": rev}
            for pid, rev in product_revenue.items()
        ),
        key=lambda x: x["revenue"],
        reverse=True,
    )[:5]

    # Top markets
    market_revenue: Dict[str, float] = {}
    customer_map: Dict[int, Customer] = {c.id: c for c in db.query(Customer).all()}
    for o in orders:
        if (o.status or "").lower() not in {"approved", "processing", "shipped", "delivered"}:
            continue
        cust = customer_map.get(o.customer_id)
        if not cust:
            continue
        market_revenue[cust.market] = market_revenue.get(cust.market, 0.0) + (o.total_value or 0)

    top_markets = sorted(
        ({"market": m, "revenue": r} for m, r in market_revenue.items()),
        key=lambda x: x["revenue"],
        reverse=True,
    )[:5]

    # Simple 30-day revenue trend (last 6 weeks, weekly buckets)
    now = datetime.utcnow()
    revenue_trend = []
    for weeks_ago in range(5, -1, -1):
        week_start = now - timedelta(weeks=weeks_ago + 1)
        week_end = now - timedelta(weeks=weeks_ago)
        rev = sum(
            (o.total_value or 0)
            for o in orders
            if o.created_at
            and week_start <= o.created_at < week_end
            and (o.status or "").lower() in {"approved", "processing", "shipped", "delivered"}
        )
        revenue_trend.append({
            "week_ending": week_end.strftime("%Y-%m-%d"),
            "revenue": round(rev, 2),
        })

    return {
        "total_revenue": round(total_revenue, 2),
        "total_orders": total_orders,
        "avg_order_value": round(avg_order_value, 2),
        "pending_approval_count": pending,
        "approved_count": approved,
        "rejected_count": rejected,
        "top_products": top_products,
        "top_markets": top_markets,
        "revenue_trend": revenue_trend,
    }


def _get_customer_products(customer_id: int, db: Session) -> List[Dict[str, Any]]:
    """Return the products available to a customer with per-customer pricing."""
    access_rows = (
        db.query(CustomerProductAccess)
        .filter(CustomerProductAccess.customer_id == customer_id)
        .all()
    )
    if access_rows:
        prod_ids = [a.product_id for a in access_rows]
        products = db.query(Product).filter(Product.id.in_(prod_ids)).all()
        prod_map = {p.id: p for p in products}
        return [
            _product_to_dict(prod_map[a.product_id], a)
            for a in access_rows
            if a.product_id in prod_map
        ]

    # Fallback: if no per-customer access rows exist, return all products
    # filtered by the customer's market (so the assistant has something to work with).
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        return []
    products = db.query(Product).all()
    out: List[Dict[str, Any]] = []
    for p in products:
        markets = p.approved_markets or []
        if markets and customer.market not in markets:
            continue
        out.append(_product_to_dict(p))
    return out


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/ping")
def ping() -> Dict[str, Any]:
    """Quick health check + Claude wiring status."""
    return {
        "status": "ok",
        "module": "ai",
        "claude_live": claude_ai.is_live(),
        "model": claude_ai.CLAUDE_MODEL,
    }


@router.post("/order/{order_id}/recommendation")
def order_recommendation(order_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Run AI approval analysis on an order and persist the result."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found")

    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {order.customer_id} for order {order_id} not found",
        )

    order_dict = _order_to_dict(order, db)
    customer_dict = _customer_to_dict(customer)
    inventory_status = _build_inventory_status(order, db)
    financial_health = _build_financial_health(customer, db)

    try:
        recommendation = claude_ai.analyze_order_for_approval(
            order_dict=order_dict,
            customer_dict=customer_dict,
            inventory_status=inventory_status,
            financial_health=financial_health,
        )
    except Exception as exc:  # noqa: BLE001 - belt-and-suspenders; service layer already guards
        logger.exception("Unexpected failure in analyze_order_for_approval; using minimal fallback")
        recommendation = {
            "decision": "approve_with_modification",
            "risk_score": 50,
            "reasoning": f"AI analysis encountered an internal error: {exc}. Manager review required.",
            "business_impact": "Indeterminate until analysis completes.",
            "suggested_action": "Manually review the order pending AI service recovery.",
            "key_factors": ["AI service exception"],
            "confidence": 0.3,
        }

    # Persist on the order (so manager UI sees risk_score / ai_recommendation)
    try:
        order.risk_score = float(recommendation.get("risk_score", 0))
        order.ai_recommendation = recommendation.get("decision")
        db.add(order)

        log_entry = AIDecisionLog(
            order_id=order.id,
            prompt=f"analyze_order_for_approval(order_id={order.id})",
            response=recommendation,
            decision=recommendation.get("decision"),
            risk_score=float(recommendation.get("risk_score", 0)),
        )
        db.add(log_entry)
        db.commit()
    except Exception as exc:  # noqa: BLE001
        db.rollback()
        logger.warning("Failed to persist AIDecisionLog for order %s: %s", order_id, exc)

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "recommendation": recommendation,
        "inventory_status": inventory_status,
        "financial_health": financial_health,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/order/{order_id}/explain")
def explain_order(order_id: int, body: ExplainRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Explain a decision/recommendation for an order."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found")

    order_dict = _order_to_dict(order, db)

    try:
        result = claude_ai.explain_decision(order_dict, body.question)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure in explain_decision; using fallback")
        result = {
            "explanation": (
                f"Unable to compute explanation due to an internal error: {exc}. "
                f"Order {order.order_number} currently has status '{order.status}' "
                f"and an AI recommendation of '{order.ai_recommendation}'."
            ),
            "supporting_data": [
                f"Order number: {order.order_number}",
                f"Status: {order.status}",
                f"Total value: ${order.total_value or 0:,.2f}",
            ],
        }

    return {
        "order_id": order.id,
        "question": body.question,
        **result,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/assistant")
def order_planning_assistant(body: AssistantRequest, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Order-planning copilot: recommend products & merch given a free-form prompt."""
    customer = db.query(Customer).filter(Customer.id == body.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {body.customer_id} not found",
        )

    customer_dict = _customer_to_dict(customer)
    available_products = _get_customer_products(customer.id, db)

    try:
        result = claude_ai.assist_order_planning(
            customer_dict=customer_dict,
            prompt=body.prompt,
            available_products=available_products,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure in assist_order_planning; using fallback")
        result = {
            "recommended_products": [],
            "merchandise_suggestions": [],
            "demand_forecast": f"Planning assistant unavailable due to internal error: {exc}.",
        }

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        "prompt": body.prompt,
        **result,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.get("/executive/summary")
def executive_summary(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Generate an executive narrative over current KPIs."""
    kpis = _aggregate_kpis(db)

    try:
        narrative = claude_ai.generate_executive_summary(kpis)
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure in generate_executive_summary; using fallback")
        narrative = {
            "summary": f"Executive summary unavailable due to internal error: {exc}.",
            "highlights": [],
            "concerns": [],
            "recommendations": [],
        }

    return {
        "kpis": kpis,
        "narrative": narrative,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/customer/{customer_id}/intel")
def customer_intel(customer_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Generate a customer intelligence brief."""
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {customer_id} not found",
        )

    orders = (
        db.query(Order)
        .filter(Order.customer_id == customer.id)
        .order_by(Order.created_at.desc())
        .limit(50)
        .all()
    )
    invoices = (
        db.query(Invoice)
        .filter(Invoice.customer_id == customer.id)
        .order_by(Invoice.invoice_date.desc())
        .limit(50)
        .all()
    )

    orders_dict = {
        "count": len(orders),
        "orders": [_order_to_dict(o, db) for o in orders],
    }
    invoices_dict = {
        "count": len(invoices),
        "invoices": [_invoice_to_dict(i) for i in invoices],
    }

    try:
        result = claude_ai.summarize_customer_intel(
            customer_dict=_customer_to_dict(customer),
            orders_dict=orders_dict,
            invoices_dict=invoices_dict,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure in summarize_customer_intel; using fallback")
        result = {
            "summary": (
                f"Intelligence brief temporarily unavailable due to internal error: {exc}. "
                f"{customer.name} operates in {customer.market} with credit health '{customer.credit_health}'."
            ),
            "risk_factors": [],
            "opportunities": [],
        }

    return {
        "customer_id": customer.id,
        "customer_name": customer.name,
        **result,
        "order_count": len(orders),
        "invoice_count": len(invoices),
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }


@router.post("/order/{order_id}/approval-report")
def approval_report(order_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Generate a printable approval report (PDF-style JSON payload + HTML body)."""
    order = db.query(Order).filter(Order.id == order_id).first()
    if not order:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Order {order_id} not found")

    customer = db.query(Customer).filter(Customer.id == order.customer_id).first()
    if not customer:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Customer {order.customer_id} for order {order_id} not found",
        )

    order_dict = _order_to_dict(order, db)
    customer_dict = _customer_to_dict(customer)
    inventory_status = _build_inventory_status(order, db)
    financial_health = _build_financial_health(customer, db)

    # Re-run analysis to ensure the report reflects the latest snapshot.
    try:
        recommendation = claude_ai.analyze_order_for_approval(
            order_dict=order_dict,
            customer_dict=customer_dict,
            inventory_status=inventory_status,
            financial_health=financial_health,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Unexpected failure in analyze_order_for_approval (report); using fallback")
        recommendation = {
            "decision": order.ai_recommendation or "approve_with_modification",
            "risk_score": int(order.risk_score or 50),
            "reasoning": f"AI analysis encountered an internal error: {exc}.",
            "business_impact": "Indeterminate.",
            "suggested_action": "Manual manager review required.",
            "key_factors": ["AI service exception"],
            "confidence": 0.3,
        }

    try:
        html_body = pdf_generator.generate_approval_report_html(
            order=order_dict,
            customer=customer_dict,
            ai_recommendation=recommendation,
            inventory_status=inventory_status,
        )
    except Exception as exc:  # noqa: BLE001
        logger.exception("Failed to render approval report HTML")
        html_body = (
            f"<html><body><h1>Approval Report Unavailable</h1>"
            f"<p>Internal error rendering report: {exc}</p></body></html>"
        )

    generated_at = datetime.utcnow().isoformat() + "Z"

    return {
        "order_id": order.id,
        "order_number": order.order_number,
        "customer_id": customer.id,
        "customer_name": customer.name,
        "generated_at": generated_at,
        "ai_recommendation": recommendation,
        "inventory_status": inventory_status,
        "financial_health": financial_health,
        "order": order_dict,
        "customer": customer_dict,
        "report_html": html_body,
        "report_format": "html",
        "filename_suggestion": f"approval_report_{order.order_number or order.id}.html",
    }
