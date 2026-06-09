"""
BrewTrade AI - Inventory router.
Inventory events, stock visibility, and warehouse visualization.
"""
import hashlib
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models import InventoryEvent, Product


router = APIRouter(prefix="/api/inventory", tags=["Inventory"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _status_for(available: int, moq: int) -> str:
    """Compute inventory status given available qty and MOQ."""
    if available <= moq:
        return "critical"
    if available > moq * 5:
        return "healthy"
    return "low"


def _zone_for(category: Optional[str]) -> str:
    """Deterministic 'random' zone (A/B/C) based on category."""
    if not category:
        return "A"
    digest = hashlib.md5(category.lower().encode("utf-8")).hexdigest()
    return ["A", "B", "C"][int(digest, 16) % 3]


def _capacity_for(product: Product) -> int:
    """Estimate warehouse capacity for a product.

    Capacity is a function of MOQ so percentages are realistic
    (capacity = max(MOQ * 20, available_quantity, 100)).
    """
    return max(product.moq * 20, product.available_quantity, 100)


# ---------------------------------------------------------------------------
# Request models
# ---------------------------------------------------------------------------
class AdjustRequest(BaseModel):
    change: int
    reason: Optional[str] = None


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/ping")
def ping():
    return {"status": "ok", "module": "inventory"}


@router.get("")
@router.get("/")
def list_inventory(db: Session = Depends(get_db)) -> List[Dict[str, Any]]:
    """Return every product with its availability and stock status."""
    products = db.query(Product).order_by(Product.name.asc()).all()
    out: List[Dict[str, Any]] = []
    for p in products:
        out.append(
            {
                "product_id": p.id,
                "sku": p.sku,
                "name": p.name,
                "category": p.category,
                "image_url": p.image_url,
                "moq": p.moq,
                "available_quantity": p.available_quantity,
                "status": _status_for(p.available_quantity, p.moq),
                "base_price": p.base_price,
            }
        )
    return out


@router.get("/warehouse/visualization")
def warehouse_visualization(db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Grid-friendly payload for the warehouse visualization page."""
    products = db.query(Product).order_by(Product.category.asc(), Product.name.asc()).all()
    cells: List[Dict[str, Any]] = []
    for p in products:
        capacity = _capacity_for(p)
        used = max(0, min(p.available_quantity, capacity))
        percentage = round((used / capacity) * 100, 1) if capacity else 0.0
        cells.append(
            {
                "product_id": p.id,
                "name": p.name,
                "sku": p.sku,
                "category": p.category,
                "capacity": capacity,
                "used": used,
                "percentage": percentage,
                "status": _status_for(p.available_quantity, p.moq),
                "warehouse_zone": _zone_for(p.category),
            }
        )

    # Zone-level summary for the dashboard
    zones: Dict[str, Dict[str, Any]] = {}
    for cell in cells:
        z = cell["warehouse_zone"]
        bucket = zones.setdefault(
            z, {"zone": z, "products": 0, "capacity": 0, "used": 0}
        )
        bucket["products"] += 1
        bucket["capacity"] += cell["capacity"]
        bucket["used"] += cell["used"]
    for bucket in zones.values():
        cap = bucket["capacity"] or 1
        bucket["utilization_pct"] = round((bucket["used"] / cap) * 100, 1)

    return {
        "cells": cells,
        "zones": sorted(zones.values(), key=lambda z: z["zone"]),
        "total_products": len(cells),
    }


@router.get("/{product_id}")
def get_product_inventory(product_id: int, db: Session = Depends(get_db)) -> Dict[str, Any]:
    """Inventory detail for a single product including last 20 events."""
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    events = (
        db.query(InventoryEvent)
        .filter(InventoryEvent.product_id == product_id)
        .order_by(InventoryEvent.timestamp.desc())
        .limit(20)
        .all()
    )

    capacity = _capacity_for(product)
    used = max(0, min(product.available_quantity, capacity))

    return {
        "product_id": product.id,
        "sku": product.sku,
        "name": product.name,
        "category": product.category,
        "image_url": product.image_url,
        "moq": product.moq,
        "available_quantity": product.available_quantity,
        "status": _status_for(product.available_quantity, product.moq),
        "warehouse_zone": _zone_for(product.category),
        "capacity": capacity,
        "used": used,
        "percentage": round((used / capacity) * 100, 1) if capacity else 0.0,
        "history": [
            {
                "id": e.id,
                "change": e.change,
                "reason": e.reason,
                "timestamp": e.timestamp,
            }
            for e in events
        ],
    }


@router.post("/{product_id}/adjust")
def adjust_inventory(
    product_id: int,
    payload: AdjustRequest,
    db: Session = Depends(get_db),
) -> Dict[str, Any]:
    """Admin endpoint to record an inventory adjustment.

    Adds an `InventoryEvent` row and updates the product's
    `available_quantity` (never below 0).
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    if payload.change == 0:
        raise HTTPException(status_code=400, detail="Change must be non-zero")

    new_qty = max(0, (product.available_quantity or 0) + payload.change)
    product.available_quantity = new_qty

    event = InventoryEvent(
        product_id=product.id,
        change=payload.change,
        reason=payload.reason or "manual_adjustment",
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    db.refresh(product)

    return {
        "status": "ok",
        "product_id": product.id,
        "available_quantity": product.available_quantity,
        "status_level": _status_for(product.available_quantity, product.moq),
        "event": {
            "id": event.id,
            "change": event.change,
            "reason": event.reason,
            "timestamp": event.timestamp,
        },
    }
