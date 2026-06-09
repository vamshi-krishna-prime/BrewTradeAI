"""
BrewTrade AI - Seed data service.

Populates the SQLite database with realistic Carib Brewery demo data:
products, markets, customers, customer product access, merchandise,
promotions, orders (with line items + status history), invoices,
documents, and users (distributors / managers / executives).

Designed to complete in under 60 seconds with deterministic output
(random.seed(42)) and is idempotent: if customers already exist, it
logs and exits without re-seeding.
"""
from __future__ import annotations

import random
import re
import time
from datetime import datetime, timedelta
from typing import Dict, List

from faker import Faker
from sqlalchemy.orm import Session

from models import (
    AIDecisionLog,
    Customer,
    CustomerProductAccess,
    Document,
    Invoice,
    InventoryEvent,
    Merchandise,
    Order,
    OrderItem,
    OrderStatusHistory,
    Product,
    Promotion,
    User,
)


# ----------------------------------------------------------------------
# Constants
# ----------------------------------------------------------------------
MARKETS: List[str] = ["Jamaica", "USA", "UK", "Guyana", "Barbados", "Bahamas"]

PRODUCT_SEED: List[Dict] = [
    {
        "sku": "CB-LAG-001",
        "name": "Stag",
        "category": "beer",
        "base_price": 2.10,
        "moq": 1000,
        "available_quantity": 42000,
        "description": (
            "Stag Lager - Trinidad & Tobago's flagship beer. A crisp, "
            "refreshing premium lager brewed since 1979 and trusted by "
            "the country's beer drinkers."
        ),
        "approved_markets": ["Jamaica", "USA", "Guyana", "Barbados", "Bahamas"],
    },
    {
        "sku": "CB-LAG-002",
        "name": "Carib Lager",
        "category": "beer",
        "base_price": 1.95,
        "moq": 1000,
        "available_quantity": 48000,
        "description": (
            "Carib Lager - the iconic Caribbean beer with a clean, smooth "
            "taste. Brewed in Trinidad since 1950 and exported worldwide."
        ),
        "approved_markets": ["Jamaica", "USA", "UK", "Guyana", "Barbados", "Bahamas"],
    },
    {
        "sku": "CB-LAG-003",
        "name": "Carib Light",
        "category": "beer",
        "base_price": 2.05,
        "moq": 1000,
        "available_quantity": 32000,
        "description": (
            "Carib Light - a refreshing low-calorie lager for the "
            "health-conscious consumer without compromising on Caribbean flavor."
        ),
        "approved_markets": ["USA", "UK", "Guyana"],
    },
    {
        "sku": "CB-MLT-001",
        "name": "Carib Malta",
        "category": "malt",
        "base_price": 1.75,
        "moq": 1500,
        "available_quantity": 28000,
        "description": (
            "Carib Malta - a non-alcoholic malt beverage rich in vitamins. "
            "Sweet, refreshing and a Caribbean household favorite."
        ),
        "approved_markets": ["UK", "Guyana"],
    },
    {
        "sku": "CB-SHN-001",
        "name": "Shandy Sorrel",
        "category": "shandy",
        "base_price": 1.85,
        "moq": 750,
        "available_quantity": 22000,
        "description": (
            "Shandy Sorrel - the taste of Caribbean Christmas all year. "
            "A unique blend of beer and traditional sorrel."
        ),
        "approved_markets": ["Jamaica", "Guyana", "Barbados"],
    },
    {
        "sku": "CB-SHN-002",
        "name": "Shandy Lemon",
        "category": "shandy",
        "base_price": 1.80,
        "moq": 750,
        "available_quantity": 26000,
        "description": (
            "Shandy Lemon - a zesty mix of beer and natural lemon. "
            "Light, refreshing and perfect for the islands."
        ),
        "approved_markets": ["Jamaica", "Guyana", "Barbados"],
    },
    {
        "sku": "CB-SHN-003",
        "name": "Shandy Ginger",
        "category": "shandy",
        "base_price": 1.90,
        "moq": 750,
        "available_quantity": 21000,
        "description": (
            "Shandy Ginger - a spicy fusion of beer and Caribbean ginger. "
            "Bold, warming and uniquely refreshing."
        ),
        "approved_markets": ["Jamaica", "Guyana", "Barbados"],
    },
    {
        "sku": "CB-STO-001",
        "name": "Mackeson Stout",
        "category": "stout",
        "base_price": 2.45,
        "moq": 1000,
        "available_quantity": 18000,
        "description": (
            "Mackeson Stout - a sweet milk stout with a smooth, creamy "
            "finish. Brewed under license at Carib Brewery."
        ),
        "approved_markets": ["USA", "Guyana"],
    },
    {
        "sku": "CB-STO-002",
        "name": "Royal Extra Stout",
        "category": "stout",
        "base_price": 2.55,
        "moq": 1000,
        "available_quantity": 19500,
        "description": (
            "Royal Extra Stout - a strong, full-bodied stout with a rich, "
            "robust flavor. A Caribbean classic since 1938."
        ),
        "approved_markets": ["USA", "Guyana", "Bahamas"],
    },
    {
        "sku": "CB-MLT-002",
        "name": "Smalta Malta",
        "category": "malt",
        "base_price": 1.65,
        "moq": 1500,
        "available_quantity": 24000,
        "description": (
            "Smalta - a premium non-alcoholic malt with a rich, full body. "
            "Naturally brewed with no added preservatives."
        ),
        "approved_markets": ["UK", "Guyana"],
    },
    {
        "sku": "CB-COO-001",
        "name": "Caribbean Cooler",
        "category": "cooler",
        "base_price": 2.25,
        "moq": 500,
        "available_quantity": 14500,
        "description": (
            "Caribbean Cooler - a tropical fruit-flavored alcoholic "
            "beverage. Light, sweet and perfect for sunny days."
        ),
        "approved_markets": ["Guyana", "Bahamas"],
    },
    {
        "sku": "CB-LAG-004",
        "name": "Stag Premium",
        "category": "beer",
        "base_price": 2.85,
        "moq": 500,
        "available_quantity": 12500,
        "description": (
            "Stag Premium - an elevated take on the Stag classic. "
            "Brewed for a smoother, fuller flavor for discerning drinkers."
        ),
        "approved_markets": ["Jamaica", "USA", "Guyana"],
    },
]

# Per-market product allow-list (by product name)
MARKET_PRODUCT_MAP: Dict[str, List[str]] = {
    "Jamaica": ["Stag", "Carib Lager", "Shandy Sorrel", "Shandy Lemon", "Shandy Ginger"],
    "USA": ["Stag", "Carib Lager", "Carib Light", "Royal Extra Stout", "Mackeson Stout"],
    "UK": ["Carib Malta", "Carib Light", "Smalta Malta"],
    "Guyana": [
        "Stag",
        "Carib Lager",
        "Carib Light",
        "Carib Malta",
        "Shandy Sorrel",
        "Shandy Lemon",
        "Shandy Ginger",
        "Mackeson Stout",
        "Royal Extra Stout",
        "Smalta Malta",
        "Caribbean Cooler",
        "Stag Premium",
    ],
    "Barbados": [
        "Stag",
        "Carib Lager",
        "Shandy Sorrel",
        "Shandy Lemon",
        "Shandy Ginger",
    ],
    "Bahamas": ["Stag", "Carib Lager", "Caribbean Cooler"],
}

COMPANY_SUFFIXES = ["Distributors", "Trading Co.", "Beverages Ltd.", "Imports LLC"]

# Merchandise specifications
MERCH_SPEC = {
    "apparel": [
        ("Carib Classic T-Shirt", 12.50, 200),
        ("Stag Lager Polo Shirt", 24.00, 150),
        ("Carib Light Tank Top", 11.00, 200),
        ("Royal Extra Hoodie", 38.00, 100),
        ("Carnival Stag Jersey", 28.00, 150),
        ("Mackeson Bartender Apron", 16.50, 200),
        ("Carib Trucker Cap", 14.00, 250),
        ("Stag Snapback Cap", 15.50, 250),
        ("Carib Rain Jacket", 52.00, 100),
        ("Shandy Sorrel Festival Tee", 13.00, 200),
        ("Brewmaster Long Sleeve", 22.00, 150),
        ("Carib Light Womens Crop", 14.00, 200),
        ("Stag Premium Embroidered Polo", 32.00, 100),
    ],
    "accessories": [
        ("Carib Bottle Opener Keychain", 3.50, 500),
        ("Stag Logo Lanyard", 4.00, 500),
        ("Mackeson Pin Badge Set", 5.50, 400),
        ("Carib Reusable Tote Bag", 7.00, 300),
        ("Stag Phone Wallet Sticker", 3.00, 500),
        ("Carib Light Wristband Pack", 4.50, 500),
        ("Royal Extra Enamel Pin", 4.00, 400),
        ("Shandy Sorrel Sticker Pack", 3.50, 500),
        ("Carib Sunglasses (Branded)", 9.50, 300),
        ("Stag Drawstring Bag", 6.50, 300),
    ],
    "barware": [
        ("Carib Pint Glass (16oz)", 5.50, 300),
        ("Stag Branded Pilsner Glass", 6.00, 300),
        ("Royal Extra Stout Tulip Glass", 7.50, 250),
        ("Carib Light Slim Can Glass", 5.00, 300),
        ("Carib Wall-Mount Bottle Opener", 8.50, 200),
        ("Stag Magnetic Bottle Opener", 4.50, 400),
        ("Carib Rubber Coaster Set (6pc)", 6.50, 300),
        ("Mackeson Felt Coaster Pack", 5.00, 400),
        ("Carib Insulated Ice Bucket", 38.00, 100),
        ("Stag Bar Mat (Long)", 18.00, 200),
        ("Carib Beer Tray (Round)", 14.00, 250),
        ("Carib Tap Handle (Custom)", 42.00, 100),
        ("Stag Branded Pitcher (60oz)", 22.00, 150),
    ],
    "trade_materials": [
        ("Carib Outdoor Banner (3x6ft)", 35.00, 100),
        ("Stag Window Cling Pack (10pc)", 12.00, 300),
        ("Carib Light Wall Poster (A1)", 8.50, 400),
        ("Mackeson Pull-Up Banner", 65.00, 75),
        ("Carib Table Tent (Pack of 25)", 18.00, 200),
        ("Stag Point-of-Sale Counter Card", 9.50, 300),
        ("Royal Extra Hanging Mobile", 22.00, 150),
        ("Shandy Festival Floor Decal", 28.00, 100),
        ("Carib Menu Board Insert", 11.50, 250),
        ("Stag LED Light-Up Sign", 78.00, 50),
        ("Carib Sidewalk A-Frame", 58.00, 50),
    ],
    "campaign": [
        ("Carnival Stag Event Kit", 75.00, 50),
        ("Cricket World Cup Carib Cooler", 68.00, 60),
        ("Summer Shandy Beach Bundle", 58.00, 75),
        ("Carib Branded Bar Stool", 62.00, 50),
        ("Stag Inflatable Bottle (5ft)", 45.00, 75),
        ("Carib Festival Tent (10x10ft)", 80.00, 50),
        ("Mackeson Stout Tasting Kit", 38.00, 100),
        ("Royal Extra VIP Hospitality Set", 79.00, 50),
        ("Carib Light Yoga Mat (Promo)", 24.00, 150),
        ("Shandy Sorrel Christmas Hamper", 42.00, 100),
    ],
}

PROMOTION_SEED = [
    ("Carnival Stag Promo", "Stag", "Jamaica", 0.15, "2026-02-01", "2026-03-15"),
    ("Cricket World Cup Carib Push", "Carib Lager", "USA", 0.20, "2026-05-15", "2026-07-30"),
    ("Summer Shandy Festival", "Shandy Sorrel", "Guyana", 0.18, "2026-06-01", "2026-08-31"),
    ("Mackeson Stout Winter Warmer", "Mackeson Stout", "USA", 0.12, "2025-11-01", "2026-02-28"),
    ("Royal Extra Heritage Month", "Royal Extra Stout", "Guyana", 0.10, "2026-01-15", "2026-02-15"),
    ("Carib Light Fitness Push", "Carib Light", "USA", 0.25, "2026-04-01", "2026-05-31"),
    ("Carib Malta Family Pack", "Carib Malta", "UK", 0.15, "2026-03-01", "2026-04-30"),
    ("Shandy Lemon Beach Season", "Shandy Lemon", "Barbados", 0.20, "2026-05-01", "2026-09-30"),
    ("Shandy Ginger Spice Festival", "Shandy Ginger", "Jamaica", 0.18, "2026-04-15", "2026-06-15"),
    ("Smalta Wellness Campaign", "Smalta Malta", "UK", 0.22, "2026-02-15", "2026-04-15"),
    ("Caribbean Cooler Junkanoo Promo", "Caribbean Cooler", "Bahamas", 0.20, "2025-12-15", "2026-01-31"),
    ("Stag Premium Launch", "Stag Premium", "USA", 0.30, "2026-06-01", "2026-07-31"),
    ("Carib Lager Independence Day", "Carib Lager", "Jamaica", 0.15, "2026-08-01", "2026-08-31"),
    ("Stag Cricket Sponsorship", "Stag", "Guyana", 0.12, "2026-03-01", "2026-05-31"),
    ("Royal Extra Father's Day", "Royal Extra Stout", "Bahamas", 0.18, "2026-06-01", "2026-06-30"),
    ("Carib Light Summer Slim", "Carib Light", "UK", 0.20, "2026-06-15", "2026-08-15"),
    ("Shandy Sorrel Christmas", "Shandy Sorrel", "Barbados", 0.25, "2025-11-15", "2025-12-31"),
]

ORDER_STATUS_DISTRIBUTION = [
    ("submitted", 0.05),
    ("pending_approval", 0.08),
    ("approved", 0.15),
    ("processing", 0.20),
    ("shipped", 0.25),
    ("delivered", 0.25),
    ("rejected", 0.02),
]

STATUS_PROGRESSION = {
    "submitted": ["submitted"],
    "pending_approval": ["submitted", "pending_approval"],
    "approved": ["submitted", "pending_approval", "approved"],
    "processing": ["submitted", "pending_approval", "approved", "processing"],
    "shipped": ["submitted", "pending_approval", "approved", "processing", "shipped"],
    "delivered": [
        "submitted",
        "pending_approval",
        "approved",
        "processing",
        "shipped",
        "delivered",
    ],
    "rejected": ["submitted", "pending_approval", "rejected"],
}


# ----------------------------------------------------------------------
# Helpers
# ----------------------------------------------------------------------
def _slug(text: str) -> str:
    """URL/identifier-friendly lowercase slug."""
    text = re.sub(r"[^a-zA-Z0-9]+", "_", text).strip("_").lower()
    return text or "item"


def _credit_health(utilization: float) -> str:
    if utilization < 0.6:
        return "green"
    if utilization < 0.85:
        return "yellow"
    return "red"


def _weighted_choice(rng: random.Random, distribution: List) -> str:
    """Pick an item from a (value, weight) list using the supplied RNG."""
    values = [d[0] for d in distribution]
    weights = [d[1] for d in distribution]
    return rng.choices(values, weights=weights, k=1)[0]


def _bulk_commit(db: Session, objects: List, batch_size: int = 500) -> None:
    """Insert a list of ORM objects in chunked add_all/commit batches."""
    for i in range(0, len(objects), batch_size):
        db.add_all(objects[i : i + batch_size])
        db.commit()


# ----------------------------------------------------------------------
# Main entry
# ----------------------------------------------------------------------
def seed_all(db: Session) -> None:
    """Populate every table with demo data. Skips when already seeded."""
    existing = db.query(Customer).count()
    if existing > 0:
        print(f"[seed_data] already seeded ({existing} customers present) - skipping.")
        return

    random.seed(42)
    rng = random.Random(42)
    fake = Faker()
    Faker.seed(42)

    start = time.time()
    print("[seed_data] starting seed...")

    # ---------------- PRODUCTS ----------------
    products: List[Product] = []
    now = datetime.utcnow()
    for spec in PRODUCT_SEED:
        slug = _slug(spec["name"])
        products.append(
            Product(
                sku=spec["sku"],
                name=spec["name"],
                category=spec["category"],
                image_url=f"/static/products/{slug}.jpg",
                base_price=spec["base_price"],
                moq=spec["moq"],
                available_quantity=spec["available_quantity"],
                description=spec["description"],
                approved_markets=spec["approved_markets"],
                created_at=now,
            )
        )
    db.add_all(products)
    db.commit()
    for p in products:
        db.refresh(p)
    products_by_name: Dict[str, Product] = {p.name: p for p in products}
    print(f"[seed_data] inserted {len(products)} products")

    # ---------------- INVENTORY EVENTS (opening stock) ----------------
    inv_events: List[InventoryEvent] = []
    for p in products:
        inv_events.append(
            InventoryEvent(
                product_id=p.id,
                change=p.available_quantity,
                reason="opening_stock",
                timestamp=now - timedelta(days=365),
            )
        )
    _bulk_commit(db, inv_events)
    print(f"[seed_data] inserted {len(inv_events)} inventory events")

    # ---------------- MERCHANDISE ----------------
    merch_objects: List[Merchandise] = []
    merch_counter = 0
    for category, items in MERCH_SPEC.items():
        for name, price, moq in items:
            merch_counter += 1
            slug = _slug(name)
            stock = rng.randint(500, 8000)
            merch_objects.append(
                Merchandise(
                    sku=f"CB-MRC-{merch_counter:03d}",
                    name=name,
                    category=category,
                    image_url=f"/static/merchandise/{slug}.jpg",
                    price=price,
                    moq=moq,
                    stock=stock,
                    description=f"{name} - official Carib Brewery branded merchandise.",
                    created_at=now,
                )
            )
    db.add_all(merch_objects)
    db.commit()
    print(f"[seed_data] inserted {len(merch_objects)} merchandise items")

    # ---------------- CUSTOMERS ----------------
    customers: List[Customer] = []
    customers_per_market = {m: 0 for m in MARKETS}
    target_customers = 60  # 10 per market
    for i in range(target_customers):
        market = MARKETS[i % len(MARKETS)]
        customers_per_market[market] += 1

        base_name = fake.unique.company().split(",")[0].split(" Ltd")[0].split(" Inc")[0]
        # Strip any trailing "and Sons", commas etc and add Caribbean flavor
        base_name = re.sub(r"[,]", "", base_name).strip()
        suffix = rng.choice(COMPANY_SUFFIXES)
        name = f"{base_name} {suffix}"

        credit_limit = round(rng.uniform(50_000, 2_000_000), 2)
        utilization = rng.uniform(0.10, 0.95)
        outstanding = round(credit_limit * utilization, 2)
        health = _credit_health(utilization)

        contact_name = fake.name()
        # email built from slugged contact + market for predictability
        email_local = _slug(contact_name).replace("_", ".")
        contact_email = f"{email_local}@{_slug(base_name)}.com"
        contact_phone = fake.phone_number()

        customers.append(
            Customer(
                name=name,
                market=market,
                credit_limit=credit_limit,
                outstanding_balance=outstanding,
                credit_health=health,
                contact_name=contact_name,
                contact_email=contact_email,
                contact_phone=contact_phone,
                created_at=now - timedelta(days=rng.randint(60, 1200)),
            )
        )
    db.add_all(customers)
    db.commit()
    for c in customers:
        db.refresh(c)
    print(f"[seed_data] inserted {len(customers)} customers")

    # ---------------- CUSTOMER PRODUCT ACCESS ----------------
    access_objects: List[CustomerProductAccess] = []
    customer_accessible_products: Dict[int, List[Product]] = {}
    for c in customers:
        allowed_names = MARKET_PRODUCT_MAP[c.market]
        accessible: List[Product] = []
        for pname in allowed_names:
            product = products_by_name.get(pname)
            if not product:
                continue
            # +/- 10% pricing variation
            price_variation = rng.uniform(-0.10, 0.10)
            customer_price = round(product.base_price * (1 + price_variation), 2)
            promo_active = rng.random() < 0.30
            promotional_price = None
            if promo_active:
                promo_discount = rng.uniform(0.10, 0.30)
                promotional_price = round(customer_price * (1 - promo_discount), 2)
            access_objects.append(
                CustomerProductAccess(
                    customer_id=c.id,
                    product_id=product.id,
                    customer_price=customer_price,
                    promotional_price=promotional_price,
                    promo_active=promo_active,
                )
            )
            accessible.append(product)
        customer_accessible_products[c.id] = accessible
    _bulk_commit(db, access_objects)
    print(f"[seed_data] inserted {len(access_objects)} customer-product access rows")

    # ---------------- PROMOTIONS ----------------
    promotions: List[Promotion] = []
    for title, prod_name, market, discount, start_iso, end_iso in PROMOTION_SEED:
        prod = products_by_name.get(prod_name)
        slug = _slug(title)
        promotions.append(
            Promotion(
                title=title,
                description=(
                    f"{title} - special {int(discount * 100)}% off campaign "
                    f"on {prod_name} for the {market} market. Limited time only."
                ),
                product_id=prod.id if prod else None,
                discount_percent=discount * 100,
                start_date=datetime.fromisoformat(start_iso),
                end_date=datetime.fromisoformat(end_iso),
                market=market,
                image_url=f"/static/promotions/{slug}.jpg",
                created_at=now,
            )
        )
    db.add_all(promotions)
    db.commit()
    print(f"[seed_data] inserted {len(promotions)} promotions")

    # ---------------- ORDERS + ITEMS + STATUS HISTORY ----------------
    target_orders = 5000
    days_back = 365

    order_objects: List[Order] = []
    item_objects: List[OrderItem] = []
    history_objects: List[OrderStatusHistory] = []

    # Build a per-customer price lookup for quick price resolution
    price_lookup: Dict[int, Dict[int, Dict]] = {c.id: {} for c in customers}
    for a in access_objects:
        price_lookup[a.customer_id][a.product_id] = {
            "customer_price": a.customer_price,
            "promotional_price": a.promotional_price,
            "promo_active": a.promo_active,
        }

    # Pre-flush counter for order numbers
    order_number_counter = 1

    for i in range(target_orders):
        # Pick a customer biased slightly toward markets with broader catalogs
        c = rng.choice(customers)
        accessible = customer_accessible_products.get(c.id, [])
        if not accessible:
            continue

        # Date with slight upward trend + seasonal spikes
        # We pick a day uniformly then nudge toward recent / seasonal peaks
        day_offset = rng.randint(0, days_back - 1)
        # Seasonal spike: carnival (Feb), summer (Jun-Aug), Christmas (Dec)
        order_date = now - timedelta(days=day_offset)
        # Slight upward trend: bias toward recent days
        if rng.random() < 0.20:
            day_offset = rng.randint(0, 90)
            order_date = now - timedelta(days=day_offset)
        # Add an intra-day time
        order_date = order_date - timedelta(
            hours=rng.randint(0, 23), minutes=rng.randint(0, 59)
        )

        status = _weighted_choice(rng, ORDER_STATUS_DISTRIBUTION)
        order_number = f"ORD-{order_date.year}-{order_number_counter:06d}"
        order_number_counter += 1

        # Determine number of line items (mix: most 2-3, some 1, some 4-6)
        roll = rng.random()
        if roll < 0.20:
            n_items = 1
        elif roll < 0.70:
            n_items = rng.randint(2, 3)
        else:
            n_items = rng.randint(4, 6)
        n_items = min(n_items, len(accessible))

        chosen_products = rng.sample(accessible, n_items)

        total_value = 0.0
        items_for_order: List[OrderItem] = []
        for prod in chosen_products:
            pricing = price_lookup[c.id].get(prod.id, {})
            unit_price = pricing.get("customer_price", prod.base_price)
            if pricing.get("promo_active") and pricing.get("promotional_price"):
                # 70% chance the order uses promo price when promo is active
                if rng.random() < 0.70:
                    unit_price = pricing["promotional_price"]

            # Quantities: respect MOQ, with realistic case sizes
            qty = prod.moq * rng.randint(1, 8)
            line_total = round(unit_price * qty, 2)
            total_value += line_total

            quantity_approved = None
            if status in ("approved", "processing", "shipped", "delivered"):
                # 90% approved fully, 10% partial fulfillment
                if rng.random() < 0.90:
                    quantity_approved = qty
                else:
                    quantity_approved = int(qty * rng.uniform(0.5, 0.95))
            elif status == "rejected":
                quantity_approved = 0

            items_for_order.append(
                OrderItem(
                    product_id=prod.id,
                    merchandise_id=None,
                    quantity_requested=qty,
                    quantity_approved=quantity_approved,
                    unit_price=unit_price,
                    line_total=line_total,
                )
            )

        total_value = round(total_value, 2)

        expected_delivery = None
        if status in ("approved", "processing", "shipped", "delivered"):
            expected_delivery = order_date + timedelta(days=rng.randint(7, 30))

        approved_by = None
        approval_notes = None
        if status in ("approved", "processing", "shipped", "delivered"):
            approved_by = rng.choice(
                ["manager_jamaica", "manager_usa", "manager_uk", "manager_global"]
            )
            approval_notes = rng.choice(
                [
                    "Credit and inventory checks passed.",
                    "Approved within standard policy.",
                    "Volume bonus applied.",
                    "Approved after AI review.",
                    "Customer in good standing - approved.",
                ]
            )
        elif status == "rejected":
            approved_by = rng.choice(["manager_global", "manager_usa"])
            approval_notes = rng.choice(
                [
                    "Credit limit exceeded.",
                    "Outstanding overdue invoices.",
                    "Product not approved for market.",
                ]
            )

        # AI fields populated for ~40% of orders (those with manager touch)
        risk_score = None
        ai_recommendation = None
        if status not in ("submitted",) and rng.random() < 0.60:
            risk_score = round(rng.uniform(0.05, 0.95), 3)
            if status == "rejected":
                ai_recommendation = "reject" if risk_score > 0.5 else "review"
            elif risk_score < 0.30:
                ai_recommendation = "approve"
            elif risk_score < 0.70:
                ai_recommendation = "review"
            else:
                ai_recommendation = "reject"

        order = Order(
            order_number=order_number,
            customer_id=c.id,
            status=status,
            total_value=total_value,
            created_at=order_date,
            expected_delivery=expected_delivery,
            approved_by=approved_by,
            approval_notes=approval_notes,
            risk_score=risk_score,
            ai_recommendation=ai_recommendation,
            notes=None,
        )
        order_objects.append(order)
        # Attach items via relationship so we can flush together
        order.items = items_for_order

    # Insert orders in batches with cascade for items
    print(f"[seed_data] preparing to insert {len(order_objects)} orders...")
    for i in range(0, len(order_objects), 500):
        batch = order_objects[i : i + 500]
        db.add_all(batch)
        db.commit()
    print(f"[seed_data] inserted {len(order_objects)} orders (with line items)")

    # Build status history rows now that orders have IDs
    for o in order_objects:
        progression = STATUS_PROGRESSION.get(o.status, [o.status])
        # Spread history events between created_at and (maybe) expected_delivery
        base_ts = o.created_at
        # Each subsequent status pushes forward 0.5-3 days
        ts = base_ts
        for idx, st in enumerate(progression):
            if idx == 0:
                actor = "distributor"
                note = "Order submitted."
            elif st == "pending_approval":
                actor = "system"
                note = "Awaiting manager approval."
                ts = ts + timedelta(hours=rng.randint(1, 12))
            elif st == "approved":
                actor = o.approved_by or "manager_global"
                note = o.approval_notes or "Approved."
                ts = ts + timedelta(hours=rng.randint(2, 36))
            elif st == "processing":
                actor = "system"
                note = "Order entered processing in warehouse."
                ts = ts + timedelta(days=rng.randint(1, 3))
            elif st == "shipped":
                actor = "system"
                note = "Container loaded - shipment dispatched."
                ts = ts + timedelta(days=rng.randint(1, 5))
            elif st == "delivered":
                actor = "system"
                note = "POD received - delivery confirmed."
                ts = ts + timedelta(days=rng.randint(3, 14))
            elif st == "rejected":
                actor = o.approved_by or "manager_global"
                note = o.approval_notes or "Rejected."
                ts = ts + timedelta(hours=rng.randint(2, 24))
            else:
                actor = "system"
                note = None

            history_objects.append(
                OrderStatusHistory(
                    order_id=o.id,
                    status=st,
                    timestamp=ts,
                    actor=actor,
                    note=note,
                )
            )

    _bulk_commit(db, history_objects)
    print(f"[seed_data] inserted {len(history_objects)} order status history rows")

    # ---------------- INVOICES ----------------
    invoice_objects: List[Invoice] = []
    invoice_counter = 1
    eligible_orders = [
        o
        for o in order_objects
        if o.status in ("approved", "processing", "shipped", "delivered")
    ]
    # ~80% of eligible orders get invoices
    invoice_pool = [o for o in eligible_orders if rng.random() < 0.80]

    for o in invoice_pool:
        # Status: 60% closed, 30% open, 10% overdue
        s_roll = rng.random()
        if s_roll < 0.60:
            inv_status = "closed"
        elif s_roll < 0.90:
            inv_status = "open"
        else:
            inv_status = "overdue"

        amount = o.total_value
        if inv_status == "closed":
            balance = 0.0
        elif inv_status == "open":
            balance = round(amount * rng.uniform(0.70, 1.00), 2)
        else:
            balance = round(amount * rng.uniform(0.80, 1.00), 2)

        # Invoice issued 0-7 days after order
        invoice_date = o.created_at + timedelta(days=rng.randint(0, 7))
        due_date = invoice_date + timedelta(days=30)
        if inv_status == "overdue":
            # Force overdue by backdating
            invoice_date = now - timedelta(days=rng.randint(45, 180))
            due_date = invoice_date + timedelta(days=30)

        invoice_number = f"INV-{invoice_date.year}-{invoice_counter:06d}"
        invoice_counter += 1

        invoice_objects.append(
            Invoice(
                invoice_number=invoice_number,
                customer_id=o.customer_id,
                order_id=o.id,
                amount=amount,
                balance=balance,
                status=inv_status,
                invoice_date=invoice_date,
                due_date=due_date,
            )
        )

    _bulk_commit(db, invoice_objects)
    print(f"[seed_data] inserted {len(invoice_objects)} invoices")

    # ---------------- DOCUMENTS ----------------
    document_objects: List[Document] = []
    target_documents = 2200
    doc_types = ["export", "statement", "commercial_invoice", "caricom", "shipping"]
    doc_filename_prefix = {
        "export": "EXP",
        "statement": "STMT",
        "commercial_invoice": "INV",
        "caricom": "CARICOM",
        "shipping": "BOL",
    }
    doc_titles = {
        "export": "Export Declaration",
        "statement": "Customer Statement",
        "commercial_invoice": "Commercial Invoice",
        "caricom": "CARICOM Certificate of Origin",
        "shipping": "Bill of Lading",
    }

    for i in range(target_documents):
        doc_type = rng.choice(doc_types)
        customer = rng.choice(customers)
        created = now - timedelta(
            days=rng.randint(0, 365),
            hours=rng.randint(0, 23),
            minutes=rng.randint(0, 59),
        )
        prefix = doc_filename_prefix[doc_type]
        filename = f"{prefix}-{created.year}-{i + 1:06d}.pdf"
        title = f"{doc_titles[doc_type]} - {customer.name}"
        document_objects.append(
            Document(
                customer_id=customer.id,
                doc_type=doc_type,
                filename=filename,
                title=title,
                created_at=created,
                file_path="",  # download endpoint handles fallback
            )
        )
    _bulk_commit(db, document_objects)
    print(f"[seed_data] inserted {len(document_objects)} documents")

    # ---------------- USERS ----------------
    user_objects: List[User] = []

    # Distributor users (one per customer)
    used_usernames = set()
    for c in customers:
        base = _slug(c.name).replace("_distributors", "").replace(
            "_trading_co", ""
        ).replace("_beverages_ltd", "").replace("_imports_llc", "")
        # ensure uniqueness
        username = base
        suffix = 1
        while username in used_usernames:
            suffix += 1
            username = f"{base}_{suffix}"
        used_usernames.add(username)
        user_objects.append(
            User(
                username=username,
                password="demo123",
                role="distributor",
                customer_id=c.id,
                created_at=now,
            )
        )

    # Guaranteed demo distributor: matches README + LoginPage hint
    # (caribbean_imports / demo123) so the demo always has a known login.
    demo_customer = Customer(
        name="Caribbean Imports LLC",
        market="Jamaica",
        credit_limit=750000.0,
        outstanding_balance=120000.0,
        credit_health="green",
        contact_name="Aaliyah Joseph",
        contact_email="aaliyah.joseph@caribbean-imports.jm",
        contact_phone="(876) 555-0149",
        created_at=now - timedelta(days=540),
    )
    db.add(demo_customer)
    db.commit()
    db.refresh(demo_customer)

    demo_access_rows: List[CustomerProductAccess] = []
    for pname in MARKET_PRODUCT_MAP["Jamaica"]:
        prod = products_by_name.get(pname)
        if not prod:
            continue
        demo_access_rows.append(
            CustomerProductAccess(
                customer_id=demo_customer.id,
                product_id=prod.id,
                customer_price=round(prod.base_price * 0.98, 2),
                promotional_price=(
                    round(prod.base_price * 0.80, 2) if pname == "Stag" else None
                ),
                promo_active=(pname == "Stag"),
            )
        )
    db.add_all(demo_access_rows)
    db.commit()

    user_objects.append(
        User(
            username="caribbean_imports",
            password="demo123",
            role="distributor",
            customer_id=demo_customer.id,
            created_at=now,
        )
    )

    # Manager users
    for uname in [
        "manager_jamaica",
        "manager_usa",
        "manager_uk",
        "manager_global",
        "manager_demo",
    ]:
        user_objects.append(
            User(
                username=uname,
                password="demo123",
                role="manager",
                customer_id=None,
                created_at=now,
            )
        )

    # Executive users
    for uname in ["exec_demo", "ceo_demo"]:
        user_objects.append(
            User(
                username=uname,
                password="demo123",
                role="executive",
                customer_id=None,
                created_at=now,
            )
        )

    db.add_all(user_objects)
    db.commit()
    print(f"[seed_data] inserted {len(user_objects)} users")

    # ---------------- AI DECISION LOGS (sampled) ----------------
    # Generate a sampling of AI decision logs for orders that have a risk_score
    ai_logs: List[AIDecisionLog] = []
    scored_orders = [o for o in order_objects if o.risk_score is not None]
    sample_size = min(len(scored_orders), 1500)
    for o in rng.sample(scored_orders, sample_size):
        flags = []
        if o.risk_score and o.risk_score > 0.7:
            flags.append("high_risk")
        if o.total_value > 50000:
            flags.append("large_order")
        ai_logs.append(
            AIDecisionLog(
                order_id=o.id,
                prompt=f"Evaluate order {o.order_number} for customer {o.customer_id}",
                response={
                    "decision": o.ai_recommendation,
                    "risk_score": o.risk_score,
                    "confidence": round(rng.uniform(0.65, 0.99), 3),
                    "flags": flags,
                    "rationale": (
                        f"Order risk assessed at {o.risk_score:.2f} based on "
                        f"customer credit utilization, order size, and history."
                    ),
                },
                decision=o.ai_recommendation,
                risk_score=o.risk_score,
                created_at=o.created_at + timedelta(minutes=rng.randint(5, 240)),
            )
        )
    _bulk_commit(db, ai_logs)
    print(f"[seed_data] inserted {len(ai_logs)} AI decision logs")

    elapsed = time.time() - start
    line_items_count = sum(len(o.items) for o in order_objects)
    print(
        f"[seed_data] DONE in {elapsed:.1f}s -- "
        f"products={len(products)}, customers={len(customers)}, "
        f"merchandise={len(merch_objects)}, promotions={len(promotions)}, "
        f"orders={len(order_objects)}, order_items={line_items_count}, "
        f"invoices={len(invoice_objects)}, documents={len(document_objects)}, "
        f"users={len(user_objects)}, ai_logs={len(ai_logs)}"
    )
