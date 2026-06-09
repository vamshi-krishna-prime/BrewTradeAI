"""
BrewTrade AI - Simulation router.

Exposes the SimulationEngine via HTTP so the frontend (and our APScheduler
background tick) can trigger scenario events and inspect the activity log.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session

from database import get_db
from models import (
    Customer,
    Order,
    Product,
    SimulationLog,
)
from services.simulation_engine import SimulationEngine


router = APIRouter(prefix="/api/simulation", tags=["Simulation"])

# A single shared engine instance is fine - it's stateless.
_engine = SimulationEngine()


# ===========================================================================
# Scenario triggers
# ===========================================================================
@router.post("/demand-spike")
def trigger_demand_spike(
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Trigger a demand spike for an optional specific product."""
    return _engine.simulate_demand_spike(db, product_id=product_id)


@router.post("/inventory-shortage")
def trigger_inventory_shortage(
    product_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Push 1-2 products below their MOQ."""
    return _engine.simulate_inventory_shortage(db, product_id=product_id)


@router.post("/credit-risk")
def trigger_credit_risk(
    customer_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Bump outstanding balances and recompute credit health."""
    return _engine.simulate_credit_risk(db, customer_id=customer_id)


@router.post("/new-promotion")
def trigger_new_promotion(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Spin up a 7-day promotion on a random product."""
    return _engine.simulate_new_promotion(db)


@router.post("/shipping-delay")
def trigger_shipping_delay(
    order_id: Optional[int] = None,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Add a shipping-delay note to a processing order."""
    return _engine.simulate_shipping_delay(db, order_id=order_id)


@router.post("/new-customer")
def trigger_new_customer(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Onboard a brand-new customer with product access rows."""
    return _engine.simulate_new_customer(db)


@router.post("/inventory-recovery")
def trigger_inventory_recovery(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Restock low/critical products."""
    return _engine.simulate_inventory_recovery(db)


@router.post("/auto-tick")
def trigger_auto_tick(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Advance non-terminal orders forward by one workflow state."""
    return _engine.simulate_auto_tick(db)


# ===========================================================================
# Read-only endpoints
# ===========================================================================
@router.get("/log")
def get_log(
    limit: int = Query(50, ge=1, le=500),
    db: Session = Depends(get_db),
) -> List[Dict[str, Any]]:
    """Return the most recent simulation log entries (newest first)."""
    rows = (
        db.query(SimulationLog)
        .order_by(SimulationLog.timestamp.desc(), SimulationLog.id.desc())
        .limit(limit)
        .all()
    )
    return [
        {
            "id": row.id,
            "event_type": row.event_type,
            "timestamp": row.timestamp.isoformat() + "Z" if row.timestamp else None,
            "payload": row.payload or {},
        }
        for row in rows
    ]


@router.get("/status")
def get_status(db: Session = Depends(get_db)) -> Dict[str, int]:
    """
    Roll-up counts the frontend dashboard polls for live KPIs:

        products_low              -> below 2x MOQ but at/above MOQ
        products_critical         -> strictly below MOQ
        customers_red             -> credit_health == 'red'
        orders_pending_approval   -> status == 'pending_approval'
        orders_processing         -> status == 'processing'
        orders_shipped            -> status == 'shipped'
    """
    products = db.query(Product).all()
    products_low = 0
    products_critical = 0
    for p in products:
        moq = int(p.moq or 1)
        qty = int(p.available_quantity or 0)
        if qty < moq:
            products_critical += 1
        elif qty < moq * 2:
            products_low += 1

    customers_red = (
        db.query(Customer).filter(Customer.credit_health == "red").count()
    )
    orders_pending_approval = (
        db.query(Order).filter(Order.status == "pending_approval").count()
    )
    orders_processing = (
        db.query(Order).filter(Order.status == "processing").count()
    )
    orders_shipped = db.query(Order).filter(Order.status == "shipped").count()

    return {
        "products_low": products_low,
        "products_critical": products_critical,
        "customers_red": customers_red,
        "orders_pending_approval": orders_pending_approval,
        "orders_processing": orders_processing,
        "orders_shipped": orders_shipped,
    }


@router.get("/ping")
def ping() -> Dict[str, str]:
    """Lightweight health probe for the simulation module."""
    return {"status": "ok", "module": "simulation"}
