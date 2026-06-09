"""
BrewTrade AI - Real-time Simulation Engine.

Mutates the database to mimic real-world events:
    * demand spikes
    * inventory shortages / recoveries
    * credit-risk shifts
    * new promotions
    * shipping delays
    * new customer onboarding
    * automatic order workflow advancement (auto-tick)

Every public method takes an SQLAlchemy ``Session`` and returns a dict of
the shape::

    {
        "event_type": "...",
        "affected_entities": [...],
        "summary": "...",
        "timestamp": "<iso-8601 UTC>",
    }

The same payload is persisted to ``simulation_logs`` so the frontend
can stream a live "ticker" of what's happening.
"""
from __future__ import annotations

import random
import string
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from models import (
    Customer,
    CustomerProductAccess,
    InventoryEvent,
    Order,
    OrderItem,
    OrderStatusHistory,
    Product,
    Promotion,
    SimulationLog,
)
from services.business_logic import (
    calculate_credit_health,
    generate_order_number,
)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
# Order workflow used by the auto-tick. Terminal states are omitted.
_WORKFLOW_NEXT: Dict[str, str] = {
    "submitted": "pending_approval",
    "pending_approval": "approved",
    "approved": "processing",
    "processing": "shipped",
    "shipped": "delivered",
}

# A handful of sample markets used when seeding new customers.
_SAMPLE_MARKETS = [
    "Jamaica", "Barbados", "Trinidad & Tobago", "Guyana",
    "St. Lucia", "Bahamas", "Grenada", "Antigua",
]

_SAMPLE_FIRST_NAMES = [
    "Marcus", "Ayanna", "Devon", "Keisha", "Rohan", "Imani",
    "Terrence", "Shanice", "Dwayne", "Latoya", "Andre", "Nia",
]
_SAMPLE_LAST_NAMES = [
    "Campbell", "Joseph", "Thompson", "Williams", "Persaud",
    "Maharaj", "Edwards", "Henry", "Charles", "St. John",
]


# ===========================================================================
# Helpers
# ===========================================================================
def _now() -> datetime:
    return datetime.utcnow()


def _iso(dt: datetime) -> str:
    return dt.replace(microsecond=0).isoformat() + "Z"


def _envelope(event_type: str, affected: List[Any], summary: str) -> Dict[str, Any]:
    return {
        "event_type": event_type,
        "affected_entities": affected,
        "summary": summary,
        "timestamp": _iso(_now()),
    }


def _log(db: Session, payload: Dict[str, Any]) -> SimulationLog:
    """Persist a SimulationLog row mirroring the envelope."""
    entry = SimulationLog(
        event_type=payload["event_type"],
        payload={
            "affected_entities": payload.get("affected_entities", []),
            "summary": payload.get("summary"),
            "timestamp": payload.get("timestamp"),
        },
        timestamp=_now(),
    )
    db.add(entry)
    db.flush()
    return entry


def _next_order_number(db: Session) -> str:
    """Compute the next unique BT-YYYYMMDD-NNNN order number."""
    today = _now()
    start_of_day = datetime(today.year, today.month, today.day)
    todays_count = (
        db.query(func.count(Order.id))
        .filter(Order.created_at >= start_of_day)
        .scalar()
        or 0
    )
    # Loop in the very unlikely case of a collision.
    for offset in range(1, 100):
        candidate = generate_order_number(today, todays_count + offset)
        if not db.query(Order.id).filter(Order.order_number == candidate).first():
            return candidate
    # Fallback - append random suffix
    suffix = "".join(random.choices(string.ascii_uppercase, k=3))
    return f"BT-{today.strftime('%Y%m%d')}-{suffix}"


# ===========================================================================
# Engine
# ===========================================================================
class SimulationEngine:
    """
    Stateless coordinator of simulation methods. Every method takes the
    db Session it should operate on so the engine can be used both from
    the FastAPI routers (request-scoped session) and from background
    schedulers (which open their own session).
    """

    # ---------------------------------------------------------------- demand
    def simulate_demand_spike(
        self,
        db: Session,
        product_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Pick 1-3 products and create 3-5 fresh orders that all include
        them, simulating a viral demand spike.
        """
        # Pick the products
        if product_id:
            products = db.query(Product).filter(Product.id == product_id).all()
        else:
            all_products = db.query(Product).all()
            if not all_products:
                payload = _envelope(
                    "demand_spike",
                    [],
                    "Demand spike skipped - no products in catalogue.",
                )
                _log(db, payload)
                db.commit()
                return payload
            k = min(random.randint(1, 3), len(all_products))
            products = random.sample(all_products, k)

        if not products:
            payload = _envelope(
                "demand_spike",
                [],
                f"Demand spike skipped - product_id={product_id} not found.",
            )
            _log(db, payload)
            db.commit()
            return payload

        customers = db.query(Customer).all()
        if not customers:
            payload = _envelope(
                "demand_spike",
                [],
                "Demand spike skipped - no customers in DB.",
            )
            _log(db, payload)
            db.commit()
            return payload

        order_count = random.randint(3, 5)
        created_orders: List[Dict[str, Any]] = []

        for _ in range(order_count):
            customer = random.choice(customers)
            order = Order(
                order_number=_next_order_number(db),
                customer_id=customer.id,
                status="pending_approval",
                total_value=0.0,
                created_at=_now(),
                notes="Auto-generated by demand-spike simulator.",
            )
            db.add(order)
            db.flush()

            total = 0.0
            for product in products:
                # Look up customer-specific pricing if available
                access = (
                    db.query(CustomerProductAccess)
                    .filter(
                        CustomerProductAccess.customer_id == customer.id,
                        CustomerProductAccess.product_id == product.id,
                    )
                    .first()
                )
                unit_price = (
                    access.promotional_price
                    if access and access.promo_active and access.promotional_price
                    else (access.customer_price if access else product.base_price)
                )
                qty = max(product.moq or 1, random.randint(20, 80))
                line_total = round(unit_price * qty, 2)
                total += line_total

                db.add(
                    OrderItem(
                        order_id=order.id,
                        product_id=product.id,
                        quantity_requested=qty,
                        unit_price=unit_price,
                        line_total=line_total,
                    )
                )

            order.total_value = round(total, 2)
            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    status="pending_approval",
                    actor="system",
                    note="Created by demand-spike simulator.",
                )
            )
            created_orders.append(
                {
                    "order_id": order.id,
                    "order_number": order.order_number,
                    "customer_id": customer.id,
                    "total_value": order.total_value,
                }
            )

        product_names = ", ".join(p.name for p in products)
        payload = _envelope(
            "demand_spike",
            [{"type": "product", "id": p.id, "name": p.name} for p in products]
            + [{"type": "order", **o} for o in created_orders],
            f"Demand spike for {product_names}: created {len(created_orders)} new orders.",
        )
        _log(db, payload)
        db.commit()
        return payload

    # ------------------------------------------------------------- shortage
    def simulate_inventory_shortage(
        self,
        db: Session,
        product_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Reduce available_quantity below MOQ for 1-2 products.
        """
        if product_id:
            products = db.query(Product).filter(Product.id == product_id).all()
        else:
            all_products = db.query(Product).filter(Product.available_quantity > 0).all()
            if not all_products:
                all_products = db.query(Product).all()
            if not all_products:
                payload = _envelope(
                    "inventory_shortage",
                    [],
                    "Inventory shortage skipped - no products available.",
                )
                _log(db, payload)
                db.commit()
                return payload
            k = min(random.randint(1, 2), len(all_products))
            products = random.sample(all_products, k)

        affected: List[Dict[str, Any]] = []
        for product in products:
            before = int(product.available_quantity or 0)
            moq = int(product.moq or 1)
            # Drive inventory to somewhere between 0 and moq-1
            new_qty = random.randint(0, max(moq - 1, 0))
            delta = new_qty - before
            product.available_quantity = new_qty

            db.add(
                InventoryEvent(
                    product_id=product.id,
                    change=delta,
                    reason="Simulated shortage (port disruption / supplier delay).",
                    timestamp=_now(),
                )
            )
            affected.append(
                {
                    "type": "product",
                    "id": product.id,
                    "name": product.name,
                    "available_before": before,
                    "available_after": new_qty,
                    "moq": moq,
                }
            )

        names = ", ".join(a["name"] for a in affected)
        payload = _envelope(
            "inventory_shortage",
            affected,
            f"Inventory shortage triggered for: {names}.",
        )
        _log(db, payload)
        db.commit()
        return payload

    # ---------------------------------------------------------- credit-risk
    def simulate_credit_risk(
        self,
        db: Session,
        customer_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Bump outstanding_balance for 1-2 customers and recalc credit_health.
        """
        if customer_id:
            customers = db.query(Customer).filter(Customer.id == customer_id).all()
        else:
            pool = db.query(Customer).all()
            if not pool:
                payload = _envelope(
                    "credit_risk",
                    [],
                    "Credit risk skipped - no customers in DB.",
                )
                _log(db, payload)
                db.commit()
                return payload
            k = min(random.randint(1, 2), len(pool))
            customers = random.sample(pool, k)

        affected: List[Dict[str, Any]] = []
        for customer in customers:
            limit = float(customer.credit_limit or 0)
            old_balance = float(customer.outstanding_balance or 0)
            # Push utilization toward 0.75-1.05 of credit limit so we hit
            # yellow / red bands. If limit is 0, just add a flat 5k bump.
            if limit > 0:
                target_ratio = random.uniform(0.75, 1.05)
                new_balance = round(limit * target_ratio, 2)
            else:
                new_balance = round(old_balance + 5000, 2)

            customer.outstanding_balance = new_balance
            old_health = customer.credit_health
            new_health = calculate_credit_health(new_balance, limit)
            customer.credit_health = new_health

            affected.append(
                {
                    "type": "customer",
                    "id": customer.id,
                    "name": customer.name,
                    "credit_limit": limit,
                    "balance_before": old_balance,
                    "balance_after": new_balance,
                    "health_before": old_health,
                    "health_after": new_health,
                }
            )

        summary = "Credit risk update: " + "; ".join(
            f"{a['name']} -> {a['health_after']} ({a['balance_after']:.0f}/{a['credit_limit']:.0f})"
            for a in affected
        )
        payload = _envelope("credit_risk", affected, summary)
        _log(db, payload)
        db.commit()
        return payload

    # ---------------------------------------------------------------- promo
    def simulate_new_promotion(self, db: Session) -> Dict[str, Any]:
        """
        Create a 7-day promotion against a random product.
        """
        product = db.query(Product).order_by(func.random()).first()
        if product is None:
            payload = _envelope(
                "new_promotion",
                [],
                "Promotion skipped - no products in catalogue.",
            )
            _log(db, payload)
            db.commit()
            return payload

        discount = round(random.uniform(5, 25), 1)
        start = _now()
        end = start + timedelta(days=7)
        market = (
            random.choice(product.approved_markets)
            if product.approved_markets
            else random.choice(_SAMPLE_MARKETS)
        )

        promo = Promotion(
            title=f"{discount:.0f}% off {product.name}",
            description=(
                f"Limited-time {discount:.0f}% discount on {product.name} "
                f"({product.sku}) for {market}. Valid 7 days."
            ),
            product_id=product.id,
            discount_percent=discount,
            start_date=start,
            end_date=end,
            market=market,
        )
        db.add(promo)
        db.flush()

        # Flip promo_active on any matching CustomerProductAccess rows
        accesses = (
            db.query(CustomerProductAccess)
            .filter(CustomerProductAccess.product_id == product.id)
            .all()
        )
        for access in accesses:
            access.promo_active = True
            access.promotional_price = round(
                access.customer_price * (1 - discount / 100), 2
            )

        affected = [
            {
                "type": "promotion",
                "id": promo.id,
                "title": promo.title,
                "product_id": product.id,
                "product_name": product.name,
                "discount_percent": discount,
                "market": market,
                "start_date": _iso(start),
                "end_date": _iso(end),
            }
        ]
        payload = _envelope(
            "new_promotion",
            affected,
            f"New promotion launched: {promo.title} in {market} (ends {end.date()}).",
        )
        _log(db, payload)
        db.commit()
        return payload

    # --------------------------------------------------------- shipping delay
    def simulate_shipping_delay(
        self,
        db: Session,
        order_id: Optional[int] = None,
    ) -> Dict[str, Any]:
        """
        Add an OrderStatusHistory entry noting a shipping delay on a
        processing order.
        """
        q = db.query(Order)
        if order_id:
            order = q.filter(Order.id == order_id).first()
        else:
            order = (
                q.filter(Order.status == "processing")
                .order_by(func.random())
                .first()
            )
            if order is None:
                # Fall back to any approved/shipped order so the demo
                # still has something to show.
                order = (
                    q.filter(Order.status.in_(["approved", "shipped"]))
                    .order_by(func.random())
                    .first()
                )

        if order is None:
            payload = _envelope(
                "shipping_delay",
                [],
                "Shipping delay skipped - no eligible orders found.",
            )
            _log(db, payload)
            db.commit()
            return payload

        note = "Shipping delayed due to port congestion"
        db.add(
            OrderStatusHistory(
                order_id=order.id,
                status=order.status,
                actor="system",
                note=note,
                timestamp=_now(),
            )
        )
        # Push expected delivery out by 3-7 days
        delay_days = random.randint(3, 7)
        if order.expected_delivery:
            order.expected_delivery = order.expected_delivery + timedelta(days=delay_days)
        else:
            order.expected_delivery = _now() + timedelta(days=delay_days + 7)

        affected = [
            {
                "type": "order",
                "id": order.id,
                "order_number": order.order_number,
                "customer_id": order.customer_id,
                "status": order.status,
                "delay_days": delay_days,
            }
        ]
        payload = _envelope(
            "shipping_delay",
            affected,
            f"Order {order.order_number} delayed by {delay_days} days ({note}).",
        )
        _log(db, payload)
        db.commit()
        return payload

    # ---------------------------------------------------------- new customer
    def simulate_new_customer(self, db: Session) -> Dict[str, Any]:
        """
        Create a brand-new Customer plus 3-4 CustomerProductAccess rows.
        """
        market = random.choice(_SAMPLE_MARKETS)
        first = random.choice(_SAMPLE_FIRST_NAMES)
        last = random.choice(_SAMPLE_LAST_NAMES)
        biz_suffix = random.choice(
            ["Distribution", "Trading Co.", "Imports", "Beverages Ltd.", "Holdings"]
        )
        name = f"{last} {biz_suffix}"

        credit_limit = float(random.choice([25_000, 50_000, 75_000, 100_000]))

        customer = Customer(
            name=name,
            market=market,
            credit_limit=credit_limit,
            outstanding_balance=0.0,
            credit_health="green",
            contact_name=f"{first} {last}",
            contact_email=f"{first.lower()}.{last.lower().replace(' ', '')}"
            f"@{last.lower().replace(' ', '')}-co.example",
            contact_phone="+1-" + "".join(random.choices("0123456789", k=10)),
            created_at=_now(),
        )
        db.add(customer)
        db.flush()

        # Grant access to 3-4 products with a 0-10% discount off base.
        products = db.query(Product).all()
        access_rows: List[Dict[str, Any]] = []
        if products:
            k = min(random.randint(3, 4), len(products))
            picks = random.sample(products, k)
            for product in picks:
                discount = random.uniform(0, 0.10)
                customer_price = round(product.base_price * (1 - discount), 2)
                access = CustomerProductAccess(
                    customer_id=customer.id,
                    product_id=product.id,
                    customer_price=customer_price,
                    promotional_price=None,
                    promo_active=False,
                )
                db.add(access)
                access_rows.append(
                    {
                        "product_id": product.id,
                        "product_name": product.name,
                        "customer_price": customer_price,
                    }
                )

        affected = [
            {
                "type": "customer",
                "id": customer.id,
                "name": customer.name,
                "market": market,
                "credit_limit": credit_limit,
                "products_granted": access_rows,
            }
        ]
        payload = _envelope(
            "new_customer",
            affected,
            f"New customer onboarded: {customer.name} ({market}) with "
            f"{len(access_rows)} product(s) granted.",
        )
        _log(db, payload)
        db.commit()
        return payload

    # -------------------------------------------------------- inventory recovery
    def simulate_inventory_recovery(self, db: Session) -> Dict[str, Any]:
        """
        Restock products whose available_quantity is below 2x MOQ.
        """
        candidates: List[Product] = (
            db.query(Product)
            .filter(Product.available_quantity < Product.moq * 2)
            .all()
        )
        if not candidates:
            # Top up something anyway so the dashboard sees activity.
            candidates = db.query(Product).order_by(func.random()).limit(2).all()

        affected: List[Dict[str, Any]] = []
        for product in candidates:
            before = int(product.available_quantity or 0)
            moq = int(product.moq or 1)
            # Restock to 5x-10x MOQ
            restock = random.randint(moq * 5, moq * 10)
            new_qty = before + restock
            product.available_quantity = new_qty

            db.add(
                InventoryEvent(
                    product_id=product.id,
                    change=restock,
                    reason="Simulated inventory recovery (shipment received).",
                    timestamp=_now(),
                )
            )
            affected.append(
                {
                    "type": "product",
                    "id": product.id,
                    "name": product.name,
                    "restock_units": restock,
                    "available_before": before,
                    "available_after": new_qty,
                }
            )

        names = ", ".join(a["name"] for a in affected) if affected else "—"
        payload = _envelope(
            "inventory_recovery",
            affected,
            f"Inventory restocked for {len(affected)} product(s): {names}.",
        )
        _log(db, payload)
        db.commit()
        return payload

    # --------------------------------------------------------------- auto-tick
    def simulate_auto_tick(self, db: Session) -> Dict[str, Any]:
        """
        Advance every non-terminal order forward by one workflow state.
        Called by the APScheduler tick every 60 seconds.

        Returns a summary envelope listing the transitions.
        """
        # We only auto-advance orders that haven't reached a terminal state.
        eligible_statuses = list(_WORKFLOW_NEXT.keys())
        orders: List[Order] = (
            db.query(Order).filter(Order.status.in_(eligible_statuses)).all()
        )

        transitions: List[Dict[str, Any]] = []
        for order in orders:
            current = order.status
            nxt = _WORKFLOW_NEXT.get(current)
            if not nxt:
                continue
            # Slow the workflow down a little: ~70% chance to advance per tick
            # so different orders end up in different states (more realistic).
            if random.random() > 0.7:
                continue

            order.status = nxt
            if nxt == "shipped":
                order.expected_delivery = _now() + timedelta(days=random.randint(5, 14))

            db.add(
                OrderStatusHistory(
                    order_id=order.id,
                    status=nxt,
                    actor="system",
                    note=f"Auto-tick advanced status {current} -> {nxt}.",
                    timestamp=_now(),
                )
            )
            transitions.append(
                {
                    "type": "order",
                    "id": order.id,
                    "order_number": order.order_number,
                    "from": current,
                    "to": nxt,
                }
            )

        payload = _envelope(
            "auto_tick",
            transitions,
            f"Auto-tick advanced {len(transitions)} order(s).",
        )
        # Only log if anything actually changed - avoids spamming the log.
        if transitions:
            _log(db, payload)
        db.commit()
        return payload


# ---------------------------------------------------------------------------
# Module-level singleton + legacy shim
# ---------------------------------------------------------------------------
engine = SimulationEngine()


def run_scenario(scenario: str, parameters: Dict[str, Any] | None = None) -> Dict[str, Any]:
    """
    Legacy entrypoint kept for compatibility with the older stub.
    Dispatches to the named scenario using a fresh DB session.
    """
    from database import SessionLocal

    parameters = parameters or {}
    db = SessionLocal()
    try:
        if scenario == "demand_spike":
            return engine.simulate_demand_spike(db, parameters.get("product_id"))
        if scenario == "inventory_shortage":
            return engine.simulate_inventory_shortage(db, parameters.get("product_id"))
        if scenario == "credit_risk":
            return engine.simulate_credit_risk(db, parameters.get("customer_id"))
        if scenario == "new_promotion":
            return engine.simulate_new_promotion(db)
        if scenario == "shipping_delay":
            return engine.simulate_shipping_delay(db, parameters.get("order_id"))
        if scenario == "new_customer":
            return engine.simulate_new_customer(db)
        if scenario == "inventory_recovery":
            return engine.simulate_inventory_recovery(db)
        return {
            "event_type": "unknown",
            "affected_entities": [],
            "summary": f"Unknown scenario: {scenario}",
            "timestamp": _iso(_now()),
        }
    finally:
        db.close()
