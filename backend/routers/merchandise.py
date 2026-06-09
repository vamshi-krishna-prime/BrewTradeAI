"""
BrewTrade AI - Merchandise router.

Non-beer items (apparel, barware, trade materials, campaign POSM).  Supports
category browsing, category aggregation, and a validation endpoint used by the
order builder to check MOQ + stock constraints before submission.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from database import get_db
from models import Merchandise
from schemas import MerchandiseOut

router = APIRouter(prefix="/api/merchandise", tags=["Merchandise"])


# ---------- request / response shapes specific to this router ----------

class MerchandiseValidateItem(BaseModel):
    merchandise_id: int
    quantity: int


class MerchandiseValidateRequest(BaseModel):
    items: List[MerchandiseValidateItem]


class MerchandiseValidateLineResult(BaseModel):
    merchandise_id: int
    requested_quantity: int
    valid: bool
    errors: List[str] = []
    name: Optional[str] = None
    sku: Optional[str] = None
    moq: Optional[int] = None
    stock: Optional[int] = None
    price: Optional[float] = None
    line_total: Optional[float] = None


class MerchandiseValidateResponse(BaseModel):
    valid: bool
    total_value: float
    results: List[MerchandiseValidateLineResult]


class MerchandiseCategoryOut(BaseModel):
    category: str
    count: int


# ---------- endpoints ----------

@router.get("/ping")
def ping():
    return {"status": "ok", "module": "merchandise"}


@router.get("/categories", response_model=List[MerchandiseCategoryOut])
def list_categories(db: Session = Depends(get_db)):
    """List every merchandise category and how many SKUs sit in it."""
    rows = (
        db.query(Merchandise.category, func.count(Merchandise.id))
        .group_by(Merchandise.category)
        .order_by(Merchandise.category.asc())
        .all()
    )
    return [MerchandiseCategoryOut(category=cat, count=count) for cat, count in rows]


@router.get("", response_model=List[MerchandiseOut])
def list_merchandise(
    category: Optional[str] = Query(None, description="Optional category filter"),
    db: Session = Depends(get_db),
):
    """
    List merchandise, ordered by category then name (which yields a natural
    grouped layout for the UI).  Optionally filtered to a single category.
    """
    query = db.query(Merchandise)
    if category:
        query = query.filter(Merchandise.category == category)
    items = query.order_by(Merchandise.category.asc(), Merchandise.name.asc()).all()
    return items


@router.post("/validate", response_model=MerchandiseValidateResponse)
def validate_merchandise(
    payload: MerchandiseValidateRequest,
    db: Session = Depends(get_db),
):
    """
    Validate a basket of merchandise lines against MOQ and stock-on-hand.
    Returns a per-line verdict plus the aggregate validity and total value.
    """
    results: List[MerchandiseValidateLineResult] = []
    overall_valid = True
    total_value = 0.0

    # Bulk-fetch all referenced merchandise rows in one query.
    ids = [item.merchandise_id for item in payload.items]
    merch_by_id = {
        m.id: m
        for m in db.query(Merchandise).filter(Merchandise.id.in_(ids)).all()
    } if ids else {}

    for item in payload.items:
        errors: List[str] = []
        merch = merch_by_id.get(item.merchandise_id)

        if merch is None:
            errors.append(f"Merchandise id {item.merchandise_id} not found")
            results.append(
                MerchandiseValidateLineResult(
                    merchandise_id=item.merchandise_id,
                    requested_quantity=item.quantity,
                    valid=False,
                    errors=errors,
                )
            )
            overall_valid = False
            continue

        if item.quantity <= 0:
            errors.append("Quantity must be greater than zero")
        if item.quantity < merch.moq:
            errors.append(f"Quantity {item.quantity} is below MOQ of {merch.moq}")
        if item.quantity > merch.stock:
            errors.append(
                f"Requested {item.quantity} exceeds available stock of {merch.stock}"
            )

        line_valid = len(errors) == 0
        line_total = merch.price * item.quantity if line_valid else 0.0
        if line_valid:
            total_value += line_total
        else:
            overall_valid = False

        results.append(
            MerchandiseValidateLineResult(
                merchandise_id=merch.id,
                requested_quantity=item.quantity,
                valid=line_valid,
                errors=errors,
                name=merch.name,
                sku=merch.sku,
                moq=merch.moq,
                stock=merch.stock,
                price=merch.price,
                line_total=line_total,
            )
        )

    return MerchandiseValidateResponse(
        valid=overall_valid,
        total_value=round(total_value, 2),
        results=results,
    )
