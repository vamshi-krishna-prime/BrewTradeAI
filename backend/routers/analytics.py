"""
BrewTrade AI - Analytics router.
Executive Command Center: KPIs, revenue and order trends,
market comparison, inventory health, credit distribution.
"""
from collections import defaultdict
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Customer,
    Order,
    OrderStatusHistory,
    Product,
)


router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


APPROVED_STATUSES = ("approved", "processing", "shipped", "delivered")
FULFILLED_STATUSES = ("shipped", "delivered")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _credit_utilization(c: Customer) -> float:
    if not c.credit_limit or c.credit_limit <= 0:
        return 0.0
    return min(1.0, max(0.0, (c.outstanding_balance or 0.0) / c.credit_limit))


def _inventory_status(available: int, moq: int) -> str:
    if available <= moq:
        return "critical"
    if available > moq * 5:
        return "healthy"
    return "low"


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/ping")
def ping():
    return {"status": "ok", "module": "analytics"}


@router.get("/executive/kpis")
def executive_kpis(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Top-level KPIs for the Executive Command Center."""
    now = datetime.utcnow()
    month_start = datetime(now.year, now.month, 1)

    # Revenue = sum of total_value across approved+ orders
    revenue = (
        db.query(func.coalesce(func.sum(Order.total_value), 0.0))
        .filter(Order.status.in_(APPROVED_STATUSES))
        .scalar()
        or 0.0
    )

    orders_total = db.query(func.count(Order.id)).scalar() or 0
    orders_this_month = (
        db.query(func.count(Order.id))
        .filter(Order.created_at >= month_start)
        .scalar()
        or 0
    )

    # Inventory utilization = used / capacity across all products
    products: List[Product] = db.query(Product).all()
    total_capacity = 0
    total_used = 0
    for p in products:
        capacity = max(p.moq * 20, p.available_quantity, 100)
        used = max(0, min(p.available_quantity, capacity))
        total_capacity += capacity
        total_used += used
    inventory_utilization_pct = (
        round((total_used / total_capacity) * 100, 1) if total_capacity else 0.0
    )

    # Credit risk score = average credit utilization across all customers (0-100 scale)
    customers: List[Customer] = db.query(Customer).all()
    if customers:
        avg_util = sum(_credit_utilization(c) for c in customers) / len(customers)
    else:
        avg_util = 0.0
    credit_risk_score = round(avg_util * 100, 1)

    # Per-market performance
    market_rows = (
        db.query(
            Customer.market.label("market"),
            func.count(Order.id).label("orders"),
            func.coalesce(func.sum(Order.total_value), 0.0).label("revenue"),
        )
        .join(Order, Order.customer_id == Customer.id)
        .filter(Order.status.in_(APPROVED_STATUSES))
        .group_by(Customer.market)
        .all()
    )
    market_performance = [
        {
            "market": (row.market or "Unknown"),
            "orders": int(row.orders or 0),
            "revenue": float(row.revenue or 0.0),
        }
        for row in market_rows
    ]
    market_performance.sort(key=lambda m: m["revenue"], reverse=True)

    # Fulfillment rate = shipped+delivered / total orders
    fulfilled = (
        db.query(func.count(Order.id))
        .filter(Order.status.in_(FULFILLED_STATUSES))
        .scalar()
        or 0
    )
    fulfillment_rate = (
        round((fulfilled / orders_total) * 100, 1) if orders_total else 0.0
    )

    # Approval SLA = avg hours from order creation to first approval status
    approval_rows = (
        db.query(
            Order.created_at,
            func.min(OrderStatusHistory.timestamp).label("approved_at"),
        )
        .join(OrderStatusHistory, OrderStatusHistory.order_id == Order.id)
        .filter(OrderStatusHistory.status == "approved")
        .group_by(Order.id, Order.created_at)
        .all()
    )
    if approval_rows:
        deltas = [
            (approved_at - created_at).total_seconds() / 3600.0
            for created_at, approved_at in approval_rows
            if created_at and approved_at
        ]
        approval_sla_avg_hours = round(sum(deltas) / len(deltas), 2) if deltas else 0.0
    else:
        # Fallback: orders that ended in approved+ but no history rows
        approved_orders = (
            db.query(Order).filter(Order.status.in_(APPROVED_STATUSES)).all()
        )
        deltas = [
            (now - o.created_at).total_seconds() / 3600.0
            for o in approved_orders
            if o.created_at
        ]
        approval_sla_avg_hours = round(sum(deltas) / len(deltas), 2) if deltas else 0.0

    return {
        "revenue": float(revenue),
        "orders_total": int(orders_total),
        "orders_this_month": int(orders_this_month),
        "inventory_utilization_pct": inventory_utilization_pct,
        "credit_risk_score": credit_risk_score,
        "market_performance": market_performance,
        "fulfillment_rate": fulfillment_rate,
        "approval_sla_avg_hours": approval_sla_avg_hours,
    }


@router.get("/revenue/trend")
def revenue_trend(
    period: str = Query("monthly", pattern="^(monthly|weekly)$"),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Revenue time series for charts. period=monthly|weekly."""
    orders = (
        db.query(Order)
        .filter(Order.status.in_(APPROVED_STATUSES))
        .filter(Order.created_at.isnot(None))
        .all()
    )

    buckets: Dict[str, float] = defaultdict(float)
    counts: Dict[str, int] = defaultdict(int)

    for o in orders:
        if period == "monthly":
            key = o.created_at.strftime("%Y-%m")
        else:  # weekly - ISO year-week
            iso = o.created_at.isocalendar()
            key = f"{iso[0]}-W{iso[1]:02d}"
        buckets[key] += float(o.total_value or 0.0)
        counts[key] += 1

    series = [
        {
            "period": key,
            "revenue": round(buckets[key], 2),
            "orders": counts[key],
        }
        for key in sorted(buckets.keys())
    ]
    return series


@router.get("/orders/trend")
def orders_trend(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Daily order-count and order-value series."""
    orders = (
        db.query(Order)
        .filter(Order.created_at.isnot(None))
        .order_by(Order.created_at.asc())
        .all()
    )

    counts: Dict[str, int] = defaultdict(int)
    values: Dict[str, float] = defaultdict(float)
    for o in orders:
        key = o.created_at.strftime("%Y-%m-%d")
        counts[key] += 1
        values[key] += float(o.total_value or 0.0)

    return [
        {
            "date": key,
            "orders": counts[key],
            "value": round(values[key], 2),
        }
        for key in sorted(counts.keys())
    ]


@router.get("/market/comparison")
def market_comparison(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Per-market: revenue, orders, customers, average credit health score."""
    customers: List[Customer] = db.query(Customer).all()

    # Group customers by market
    by_market: Dict[str, List[Customer]] = defaultdict(list)
    for c in customers:
        by_market[c.market or "Unknown"].append(c)

    # Order aggregates per market via customer join
    order_rows = (
        db.query(
            Customer.market.label("market"),
            func.count(Order.id).label("orders"),
            func.coalesce(func.sum(Order.total_value), 0.0).label("revenue"),
        )
        .join(Order, Order.customer_id == Customer.id)
        .filter(Order.status.in_(APPROVED_STATUSES))
        .group_by(Customer.market)
        .all()
    )
    order_agg = {
        (row.market or "Unknown"): {
            "orders": int(row.orders or 0),
            "revenue": float(row.revenue or 0.0),
        }
        for row in order_rows
    }

    out: List[Dict[str, Any]] = []
    for market, cust_list in by_market.items():
        agg = order_agg.get(market, {"orders": 0, "revenue": 0.0})
        utilizations = [_credit_utilization(c) for c in cust_list]
        avg_util = sum(utilizations) / len(utilizations) if utilizations else 0.0
        # Higher utilization -> worse health, so health score = 100 - util%
        avg_credit_health = round(max(0.0, 100.0 - avg_util * 100.0), 1)

        # Most common credit_health label
        labels = [c.credit_health or "green" for c in cust_list]
        label_counts = {lbl: labels.count(lbl) for lbl in set(labels)}
        dominant_label = (
            max(label_counts.items(), key=lambda kv: kv[1])[0] if label_counts else "green"
        )

        out.append(
            {
                "market": market,
                "customers": len(cust_list),
                "orders": agg["orders"],
                "revenue": agg["revenue"],
                "avg_credit_health": avg_credit_health,
                "credit_health_label": dominant_label,
            }
        )

    out.sort(key=lambda m: m["revenue"], reverse=True)
    return out


@router.get("/inventory/health")
def inventory_health(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Category breakdown of stock health."""
    products: List[Product] = db.query(Product).all()

    by_cat: Dict[str, Dict[str, Any]] = {}
    for p in products:
        bucket = by_cat.setdefault(
            p.category or "uncategorized",
            {
                "category": p.category or "uncategorized",
                "product_count": 0,
                "total_units": 0,
                "healthy": 0,
                "low": 0,
                "critical": 0,
                "capacity": 0,
                "used": 0,
            },
        )
        status = _inventory_status(p.available_quantity or 0, p.moq or 1)
        capacity = max(p.moq * 20, p.available_quantity, 100)
        used = max(0, min(p.available_quantity, capacity))
        bucket["product_count"] += 1
        bucket["total_units"] += int(p.available_quantity or 0)
        bucket[status] += 1
        bucket["capacity"] += capacity
        bucket["used"] += used

    out: List[Dict[str, Any]] = []
    for bucket in by_cat.values():
        cap = bucket["capacity"] or 1
        bucket["utilization_pct"] = round((bucket["used"] / cap) * 100, 1)
        out.append(bucket)

    out.sort(key=lambda b: b["category"])
    return out


@router.get("/credit/distribution")
def credit_distribution(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Counts of customers bucketed into green / yellow / red credit health."""
    rows = (
        db.query(Customer.credit_health, func.count(Customer.id))
        .group_by(Customer.credit_health)
        .all()
    )
    counts = {"green": 0, "yellow": 0, "red": 0}
    for label, cnt in rows:
        key = (label or "green").lower()
        if key not in counts:
            counts[key] = 0
        counts[key] += int(cnt or 0)

    total = sum(counts.values())
    distribution = [
        {
            "bucket": k,
            "count": v,
            "percentage": round((v / total) * 100, 1) if total else 0.0,
        }
        for k, v in counts.items()
    ]

    # Total exposure (sum of outstanding balances per bucket)
    exposure_rows = (
        db.query(
            Customer.credit_health,
            func.coalesce(func.sum(Customer.outstanding_balance), 0.0),
            func.coalesce(func.sum(Customer.credit_limit), 0.0),
        )
        .group_by(Customer.credit_health)
        .all()
    )
    exposure = {
        (lbl or "green").lower(): {
            "outstanding": float(out or 0.0),
            "limit": float(lim or 0.0),
        }
        for lbl, out, lim in exposure_rows
    }

    return {
        "total_customers": total,
        "distribution": distribution,
        "exposure": exposure,
    }
