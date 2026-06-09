"""
BrewTrade AI - Pure business logic helpers.

These functions are deliberately stateless and side-effect free so they
can be unit-tested in isolation and reused across the simulation engine,
the AI advisor, and the order/customer routers.
"""
from __future__ import annotations

from datetime import datetime
from typing import Any, Optional


# ---------------------------------------------------------------------------
# Credit health
# ---------------------------------------------------------------------------
def calculate_credit_health(outstanding: float, credit_limit: float) -> str:
    """
    Classify a customer's credit health based on utilization.

    Rules:
        utilization > 0.9  -> red
        utilization > 0.7  -> yellow
        otherwise          -> green

    A zero or negative credit_limit means the customer effectively has no
    credit available; if they have any outstanding balance we mark them red,
    otherwise green.
    """
    if credit_limit is None or credit_limit <= 0:
        return "red" if (outstanding or 0) > 0 else "green"

    utilization = (outstanding or 0) / credit_limit

    if utilization > 0.9:
        return "red"
    if utilization > 0.7:
        return "yellow"
    return "green"


# ---------------------------------------------------------------------------
# Risk score
# ---------------------------------------------------------------------------
def calculate_risk_score(customer: Any, order: Any) -> float:
    """
    Compute a 0-100 risk score for an order.

    Higher = riskier. We combine:
        * credit utilization (0-50 pts)
        * credit-health flag  (0-20 pts)
        * order size vs credit limit (0-20 pts)
        * order size in absolute terms (0-10 pts)

    `customer` and `order` are ORM objects (or any object with matching
    attributes); we read defensively so callers can pass partial mocks.
    """
    credit_limit = float(getattr(customer, "credit_limit", 0) or 0)
    outstanding = float(getattr(customer, "outstanding_balance", 0) or 0)
    health = getattr(customer, "credit_health", "green") or "green"
    total_value = float(getattr(order, "total_value", 0) or 0)

    score = 0.0

    # Credit utilization (50 pts)
    if credit_limit > 0:
        util = outstanding / credit_limit
        score += min(util, 1.5) * 50  # cap at 75 pts before clamp
    elif outstanding > 0:
        score += 50  # no limit set but they owe money

    # Health flag (20 pts)
    score += {"red": 20, "yellow": 10, "green": 0}.get(health, 0)

    # Order size vs remaining credit (20 pts)
    if credit_limit > 0:
        remaining = max(credit_limit - outstanding, 0)
        if remaining == 0:
            score += 20
        else:
            ratio = total_value / remaining
            score += min(ratio, 1.0) * 20

    # Absolute order size (10 pts) - large orders get extra scrutiny
    if total_value > 50_000:
        score += 10
    elif total_value > 25_000:
        score += 6
    elif total_value > 10_000:
        score += 3

    return round(max(0.0, min(score, 100.0)), 2)


# ---------------------------------------------------------------------------
# Inventory confidence
# ---------------------------------------------------------------------------
def calculate_inventory_confidence(requested: int, available: int) -> str:
    """
    Classify our confidence in being able to fulfil `requested` units
    given `available` on hand.

        available >= 2x requested -> high
        available >=     requested -> medium
        otherwise                  -> low
    """
    requested = int(requested or 0)
    available = int(available or 0)

    if requested <= 0:
        return "high"
    if available >= requested * 2:
        return "high"
    if available >= requested:
        return "medium"
    return "low"


# ---------------------------------------------------------------------------
# Order numbering
# ---------------------------------------------------------------------------
def generate_order_number(date: Optional[datetime] = None, sequence: int = 1) -> str:
    """
    Produce a deterministic-looking order number in the form
        BT-YYYYMMDD-NNNN
    where NNNN is a zero-padded 4-digit sequence counter. The caller is
    responsible for supplying a unique `sequence` (e.g. count of orders
    placed today + 1). If omitted we default to 1 so the helper still
    returns a valid string for tests.
    """
    date = date or datetime.utcnow()
    return f"BT-{date.strftime('%Y%m%d')}-{int(sequence):04d}"


# ---------------------------------------------------------------------------
# Backwards-compat shim
# ---------------------------------------------------------------------------
def validate_order(order_payload: dict) -> dict:
    """
    Legacy stub kept for routers that may still import it. Real
    validation lives in the orders router; this just returns a clean
    success envelope.
    """
    return {"valid": True, "issues": []}
