"""
BrewTrade AI - Promotions router.

Promotions are bounded by [start_date, end_date] and optionally scoped to a
market.  The active-promotions endpoint cross-references the requesting
customer's market so distributors only see relevant offers, and enriches each
record with a time_remaining_seconds countdown for the UI.
"""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import Field
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models import Customer, Promotion
from schemas import PromotionOut, ORMModel

router = APIRouter(prefix="/api/promotions", tags=["Promotions"])


class ActivePromotionOut(ORMModel):
    id: int
    title: str
    description: Optional[str] = None
    product_id: Optional[int] = None
    discount_percent: float = 0.0
    start_date: datetime
    end_date: datetime
    market: Optional[str] = None
    image_url: Optional[str] = None
    created_at: datetime
    time_remaining_seconds: int = Field(0, description="Seconds until end_date; 0 if expired")


@router.get("/ping")
def ping():
    return {"status": "ok", "module": "promotions"}


@router.get("/active", response_model=List[ActivePromotionOut])
def get_active_promotions(
    customer_id: int = Query(..., description="Customer whose market drives the filter"),
    db: Session = Depends(get_db),
):
    """
    Return promotions that are (a) currently in their active window and (b)
    either global (market is NULL) or scoped to this customer's market.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    now = datetime.utcnow()
    promos = (
        db.query(Promotion)
        .filter(
            Promotion.start_date <= now,
            Promotion.end_date >= now,
            or_(Promotion.market.is_(None), Promotion.market == customer.market),
        )
        .order_by(Promotion.end_date.asc())
        .all()
    )

    out: List[ActivePromotionOut] = []
    for p in promos:
        remaining = int((p.end_date - now).total_seconds())
        if remaining < 0:
            remaining = 0
        out.append(
            ActivePromotionOut(
                id=p.id,
                title=p.title,
                description=p.description,
                product_id=p.product_id,
                discount_percent=p.discount_percent,
                start_date=p.start_date,
                end_date=p.end_date,
                market=p.market,
                image_url=p.image_url,
                created_at=p.created_at,
                time_remaining_seconds=remaining,
            )
        )
    return out


@router.get("", response_model=List[PromotionOut])
def list_all_promotions(db: Session = Depends(get_db)):
    """Manager view: all promotions regardless of active window or market."""
    return (
        db.query(Promotion)
        .order_by(Promotion.start_date.desc())
        .all()
    )


@router.get("/{promo_id}", response_model=PromotionOut)
def get_promotion(promo_id: int, db: Session = Depends(get_db)):
    promo = db.query(Promotion).filter(Promotion.id == promo_id).first()
    if not promo:
        raise HTTPException(status_code=404, detail="Promotion not found")
    return promo
