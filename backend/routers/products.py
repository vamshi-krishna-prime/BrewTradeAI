"""
BrewTrade AI - Products / Catalog router.

Customer-facing endpoints filter the catalog through CustomerProductAccess so that
each distributor only sees the SKUs they are entitled to (with their negotiated
price and any active promotional override).  Admin/manager endpoints return the
unfiltered product list.
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models import Product, CustomerProductAccess, Customer
from schemas import ProductOut

router = APIRouter(prefix="/api/products", tags=["Products"])


def _product_to_out(product: Product, access: Optional[CustomerProductAccess]) -> ProductOut:
    """Build a ProductOut, layering customer-specific pricing on top of the base product."""
    customer_price = access.customer_price if access else None
    promotional_price = access.promotional_price if access and access.promo_active else None
    promo_active = bool(access and access.promo_active and access.promotional_price is not None)

    return ProductOut(
        id=product.id,
        sku=product.sku,
        name=product.name,
        category=product.category,
        image_url=product.image_url,
        base_price=product.base_price,
        moq=product.moq,
        available_quantity=product.available_quantity,
        description=product.description,
        approved_markets=product.approved_markets or [],
        customer_price=customer_price,
        promotional_price=promotional_price,
        promo_active=promo_active,
        created_at=product.created_at,
    )


@router.get("/ping")
def ping():
    return {"status": "ok", "module": "products"}


@router.get("/catalog", response_model=List[ProductOut])
def get_catalog(
    customer_id: int = Query(..., description="Customer whose entitled catalog to return"),
    db: Session = Depends(get_db),
):
    """
    Return ONLY the products this customer has been granted access to, with
    customer-specific pricing (and promotional pricing when promo_active).
    Products without a CustomerProductAccess row are hidden entirely.
    """
    customer = db.query(Customer).filter(Customer.id == customer_id).first()
    if not customer:
        raise HTTPException(status_code=404, detail="Customer not found")

    rows = (
        db.query(CustomerProductAccess, Product)
        .join(Product, CustomerProductAccess.product_id == Product.id)
        .filter(CustomerProductAccess.customer_id == customer_id)
        .order_by(Product.category.asc(), Product.name.asc())
        .all()
    )

    return [_product_to_out(product, access) for access, product in rows]


@router.get("/{product_id}", response_model=ProductOut)
def get_product(
    product_id: int,
    customer_id: Optional[int] = Query(None, description="Customer context for pricing"),
    db: Session = Depends(get_db),
):
    """
    Return a single product.  When customer_id is supplied, the response is
    enriched with that customer's price/promotional price and is gated on the
    customer actually having access to the SKU.
    """
    product = db.query(Product).filter(Product.id == product_id).first()
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")

    access: Optional[CustomerProductAccess] = None
    if customer_id is not None:
        customer = db.query(Customer).filter(Customer.id == customer_id).first()
        if not customer:
            raise HTTPException(status_code=404, detail="Customer not found")

        access = (
            db.query(CustomerProductAccess)
            .filter(
                CustomerProductAccess.customer_id == customer_id,
                CustomerProductAccess.product_id == product_id,
            )
            .first()
        )
        if not access:
            # Hidden from this customer entirely.
            raise HTTPException(status_code=404, detail="Product not available for this customer")

    return _product_to_out(product, access)


@router.get("", response_model=List[ProductOut])
def list_all_products(db: Session = Depends(get_db)):
    """Admin / manager view: every product in the catalog (no customer filtering)."""
    products = (
        db.query(Product)
        .options(joinedload(Product.access_grants))
        .order_by(Product.category.asc(), Product.name.asc())
        .all()
    )
    return [_product_to_out(p, None) for p in products]
