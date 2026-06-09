"""
BrewTrade AI - Customers router.

Endpoints:
    GET /api/customers                          - list all customers with traffic light
    GET /api/customers/{customer_id}            - full customer detail + counts
    GET /api/customers/{customer_id}/dashboard  - distributor dashboard payload
    GET /api/customers/{customer_id}/ar         - AR dashboard payload (invoices, aging)
"""
from datetime import datetime
from typing import Any, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Customer,
    CustomerProductAccess,
    Document,
    Invoice,
    Order,
)


router = APIRouter(prefix="/api/customers", tags=["Customers"])


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------

OPEN_ORDER_STATUSES = {
    "submitted",
    "pending_approval",
    "approved",
    "processing",
    "shipped",
}
PENDING_ORDER_STATUSES = {"submitted", "pending_approval"}


def _serialize_customer(c: Customer) -> Dict[str, Any]:
    """Convert a Customer ORM object to a plain dict for API responses."""
    return {
        "id": c.id,
        "name": c.name,
        "market": c.market,
        "credit_limit": float(c.credit_limit or 0.0),
        "outstanding_balance": float(c.outstanding_balance or 0.0),
        "credit_health": c.credit_health or "green",
        "contact_name": c.contact_name,
        "contact_email": c.contact_email,
        "contact_phone": c.contact_phone,
        "created_at": c.created_at.isoformat() if c.created_at else None,
    }


def _serialize_order_summary(o: Order) -> Dict[str, Any]:
    return {
        "id": o.id,
        "order_number": o.order_number,
        "status": o.status,
        "total_value": float(o.total_value or 0.0),
        "created_at": o.created_at.isoformat() if o.created_at else None,
        "expected_delivery": o.expected_delivery.isoformat() if o.expected_delivery else None,
        "ai_recommendation": o.ai_recommendation,
        "risk_score": o.risk_score,
    }


def _serialize_invoice(inv: Invoice) -> Dict[str, Any]:
    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "order_id": inv.order_id,
        "amount": float(inv.amount or 0.0),
        "balance": float(inv.balance or 0.0),
        "status": inv.status,
        "invoice_date": inv.invoice_date.isoformat() if inv.invoice_date else None,
        "due_date": inv.due_date.isoformat() if inv.due_date else None,
    }


def _count_open_orders(db: Session, customer_id: int) -> int:
    return (
        db.query(func.count(Order.id))
        .filter(Order.customer_id == customer_id)
        .filter(Order.status.in_(OPEN_ORDER_STATUSES))
        .scalar()
        or 0
    )


def _count_pending_orders(db: Session, customer_id: int) -> int:
    return (
        db.query(func.count(Order.id))
        .filter(Order.customer_id == customer_id)
        .filter(Order.status.in_(PENDING_ORDER_STATUSES))
        .scalar()
        or 0
    )


def _count_available_promotions(db: Session, customer_id: int) -> int:
    """Promotions are surfaced via CustomerProductAccess rows where promo_active=True."""
    return (
        db.query(func.count(CustomerProductAccess.id))
        .filter(CustomerProductAccess.customer_id == customer_id)
        .filter(CustomerProductAccess.promo_active.is_(True))
        .scalar()
        or 0
    )


def _count_documents(db: Session, customer_id: int) -> int:
    return (
        db.query(func.count(Document.id))
        .filter(Document.customer_id == customer_id)
        .scalar()
        or 0
    )


def _derive_credit_health(outstanding: float, credit_limit: float, stored: str) -> str:
    """
    Derive traffic-light credit health from utilisation when possible,
    falling back to the stored value when no credit limit is set.
    """
    if credit_limit and credit_limit > 0:
        utilisation = outstanding / credit_limit
        if utilisation >= 0.9:
            return "red"
        if utilisation >= 0.7:
            return "yellow"
        return "green"
    return stored or "green"


def _payment_position(outstanding: float, credit_limit: float) -> str:
    """Human-readable position relative to credit limit."""
    if credit_limit <= 0:
        return "No credit limit set"
    available = credit_limit - outstanding
    if available <= 0:
        return f"Over limit by {abs(available):.2f}"
    if outstanding / credit_limit >= 0.7:
        return f"Near limit - {available:.2f} available"
    return f"Healthy - {available:.2f} available"


# ----------------------------------------------------------------------
# Endpoints
# ----------------------------------------------------------------------

@router.get("")
@router.get("/")
def list_customers(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """List all customers with a derived traffic-light. Used by manager views."""
    try:
        customers = db.query(Customer).order_by(Customer.name.asc()).all()
        result: List[Dict[str, Any]] = []
        for c in customers:
            outstanding = float(c.outstanding_balance or 0.0)
            credit_limit = float(c.credit_limit or 0.0)
            health = _derive_credit_health(outstanding, credit_limit, c.credit_health)
            open_orders = _count_open_orders(db, c.id)
            payload = _serialize_customer(c)
            payload["credit_health"] = health
            payload["traffic_light"] = health
            payload["open_orders"] = open_orders
            payload["available_credit"] = max(credit_limit - outstanding, 0.0)
            result.append(payload)
        return result
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to list customers: {exc}")


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Return full customer detail including aggregate counts."""
    try:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")

        outstanding = float(customer.outstanding_balance or 0.0)
        credit_limit = float(customer.credit_limit or 0.0)
        health = _derive_credit_health(outstanding, credit_limit, customer.credit_health)

        payload = _serialize_customer(customer)
        payload["credit_health"] = health
        payload["traffic_light"] = health
        payload["available_credit"] = max(credit_limit - outstanding, 0.0)
        payload["open_orders"] = _count_open_orders(db, customer_id)
        payload["pending_orders"] = _count_pending_orders(db, customer_id)
        payload["available_promotions"] = _count_available_promotions(db, customer_id)
        payload["documents"] = _count_documents(db, customer_id)
        return payload
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load customer: {exc}")


@router.get("/{customer_id}/dashboard")
def get_customer_dashboard(customer_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    Distributor dashboard payload:
        - customer: full customer record
        - kpis: open_orders, pending_orders, outstanding_balance, available_promotions, documents_count
        - credit_health
        - recent_orders: top 5 orders by created_at desc
    """
    try:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")

        outstanding = float(customer.outstanding_balance or 0.0)
        credit_limit = float(customer.credit_limit or 0.0)
        health = _derive_credit_health(outstanding, credit_limit, customer.credit_health)

        open_orders = _count_open_orders(db, customer_id)
        pending_orders = _count_pending_orders(db, customer_id)
        available_promotions = _count_available_promotions(db, customer_id)
        documents_count = _count_documents(db, customer_id)

        recent_orders = (
            db.query(Order)
            .filter(Order.customer_id == customer_id)
            .order_by(Order.created_at.desc())
            .limit(5)
            .all()
        )

        customer_payload = _serialize_customer(customer)
        customer_payload["credit_health"] = health
        customer_payload["available_credit"] = max(credit_limit - outstanding, 0.0)

        return {
            "customer": customer_payload,
            "kpis": {
                "open_orders": open_orders,
                "pending_orders": pending_orders,
                "outstanding_balance": outstanding,
                "available_promotions": available_promotions,
                "documents_count": documents_count,
            },
            "credit_health": health,
            "recent_orders": [_serialize_order_summary(o) for o in recent_orders],
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load dashboard: {exc}")


@router.get("/{customer_id}/ar")
def get_customer_ar(customer_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """
    AR dashboard payload:
        - outstanding_balance, credit_limit, credit_utilization_pct
        - open_invoices, closed_invoices
        - credit_health, payment_position
        - aging_buckets: current / 30 / 60 / 90+ (based on days past due of OPEN invoices)
    """
    try:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if customer is None:
            raise HTTPException(status_code=404, detail="Customer not found")

        outstanding = float(customer.outstanding_balance or 0.0)
        credit_limit = float(customer.credit_limit or 0.0)
        utilization_pct = (
            round((outstanding / credit_limit) * 100.0, 2) if credit_limit > 0 else 0.0
        )
        health = _derive_credit_health(outstanding, credit_limit, customer.credit_health)
        position = _payment_position(outstanding, credit_limit)

        invoices = (
            db.query(Invoice)
            .filter(Invoice.customer_id == customer_id)
            .order_by(Invoice.due_date.asc())
            .all()
        )

        open_invoices: List[Dict[str, Any]] = []
        closed_invoices: List[Dict[str, Any]] = []
        aging_buckets = {"current": 0.0, "30": 0.0, "60": 0.0, "90+": 0.0}

        now = datetime.utcnow()
        for inv in invoices:
            serialized = _serialize_invoice(inv)
            if (inv.status or "open").lower() == "closed":
                closed_invoices.append(serialized)
                continue

            open_invoices.append(serialized)

            balance = float(inv.balance or 0.0)
            due = inv.due_date or now
            days_past_due = (now - due).days

            if days_past_due <= 0:
                aging_buckets["current"] += balance
            elif days_past_due <= 30:
                aging_buckets["30"] += balance
            elif days_past_due <= 60:
                aging_buckets["60"] += balance
            else:
                aging_buckets["90+"] += balance

        # Round bucket values for cleaner display
        aging_buckets = {k: round(v, 2) for k, v in aging_buckets.items()}

        return {
            "customer_id": customer_id,
            "outstanding_balance": outstanding,
            "credit_limit": credit_limit,
            "available_credit": max(credit_limit - outstanding, 0.0),
            "credit_utilization_pct": utilization_pct,
            "credit_health": health,
            "payment_position": position,
            "open_invoices": open_invoices,
            "closed_invoices": closed_invoices,
            "aging_buckets": aging_buckets,
        }
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Failed to load AR data: {exc}")
