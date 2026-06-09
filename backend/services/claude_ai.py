"""
BrewTrade AI - Claude AI service.

Production wrapper around the Anthropic SDK for the BrewTrade AI platform.
Provides:
  - Order approval analysis
  - Decision explainability (post-hoc rationale)
  - Executive summary generation
  - Order planning copilot
  - Customer intelligence summarization
  - Approval report generation (via pdf_generator)

Every function gracefully degrades to a deterministic, varied mock response
when the API key is the placeholder or the API call fails, so the rest of
the platform stays operational even without a live Claude key.
"""
from __future__ import annotations

import hashlib
import json
import logging
import random
import re
from typing import Any, Dict, List, Optional

from config import settings

logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Model & SDK config
# ---------------------------------------------------------------------------

# User explicitly requested claude-opus-4-5 (active legacy model).
CLAUDE_MODEL = "claude-opus-4-5"
CLAUDE_MODEL_FALLBACK = "claude-sonnet-4-5"

_PLACEHOLDER_KEY = "YOUR_CLAUDE_API_KEY_HERE"

_client = None  # lazy singleton
_client_init_error: Optional[str] = None


def _is_placeholder_key(api_key: Optional[str]) -> bool:
    """Detect placeholder / unset / obviously fake API keys."""
    if not api_key:
        return True
    if api_key.strip() == "":
        return True
    if api_key == _PLACEHOLDER_KEY:
        return True
    if api_key.startswith("YOUR_") or api_key.endswith("_HERE"):
        return True
    # Real Anthropic keys start with sk-ant-
    if not api_key.startswith("sk-ant-"):
        return True
    return False


def _get_client():
    """Lazily initialize the Anthropic client.

    Returns None if the API key is a placeholder (mock mode).
    Raises a RuntimeError with an informative message if initialization
    fails for any other reason — but callers should treat that as a signal
    to fall back to mock data.
    """
    global _client, _client_init_error

    if _client is not None:
        return _client

    if _client_init_error is not None:
        # We already tried and failed; don't keep retrying on every call.
        return None

    api_key = settings.CLAUDE_API_KEY

    if _is_placeholder_key(api_key):
        _client_init_error = (
            "Claude API key is a placeholder (configure CLAUDE_API_KEY in .env "
            "to enable live Claude calls). BrewTrade AI is running in MOCK MODE."
        )
        logger.warning(_client_init_error)
        return None

    try:
        import anthropic  # local import so the module loads even if SDK missing
        _client = anthropic.Anthropic(api_key=api_key)
        logger.info("Anthropic client initialized (model=%s)", CLAUDE_MODEL)
        return _client
    except ImportError as exc:
        _client_init_error = f"anthropic SDK not installed: {exc}"
        logger.error(_client_init_error)
        return None
    except Exception as exc:  # noqa: BLE001
        _client_init_error = f"Failed to initialize Anthropic client: {exc}"
        logger.exception("Anthropic client init failed")
        return None


def is_live() -> bool:
    """Return True if Claude is configured for live API calls."""
    return _get_client() is not None


# ---------------------------------------------------------------------------
# Prompt construction & JSON parsing helpers
# ---------------------------------------------------------------------------

_SYSTEM_PROMPT = """You are the BrewTrade AI decision intelligence engine for a Caribbean beer/malt/shandy distributor managing international export orders across markets like Jamaica, Barbados, Trinidad, Guyana, and others.

Your role is to provide rigorous, business-grade analysis for:
  1. Order approval recommendations (credit risk, inventory availability, market fit)
  2. Decision explainability for managers and executives
  3. Executive KPI summaries
  4. Order planning copilot suggestions
  5. Customer intelligence briefs

Hard rules:
  - You MUST respond with a single valid JSON object — no preamble, no markdown fences, no trailing prose.
  - Match the requested schema exactly. Use the field names given.
  - Be specific and quantitative. Cite numbers from the supplied data.
  - Reasoning should be 2-4 sentences, business-appropriate tone.
  - Be honest about risk. Do not rubber-stamp orders that exceed credit limits, deplete inventory, or target unapproved markets.
  - Confidence should reflect actual evidence strength (0.4-0.6 for ambiguous cases, 0.8-0.95 for clear cases).

The platform domain:
  - Customers have credit_limit, outstanding_balance, and credit_health (green/yellow/red).
  - Products have approved_markets, available_quantity, and per-customer pricing.
  - Orders have total_value, status, and line items.
  - Markets have varying demand patterns, regulatory regimes, and seasonality.
"""


def _build_system_block() -> List[Dict[str, Any]]:
    """System prompt with prompt-caching enabled (saves cost across requests)."""
    return [
        {
            "type": "text",
            "text": _SYSTEM_PROMPT,
            "cache_control": {"type": "ephemeral"},
        }
    ]


def _extract_json(text: str) -> Optional[Dict[str, Any]]:
    """Pull the first valid JSON object out of a model response.

    Handles cases where the model wraps JSON in ```json ... ``` fences
    or includes a stray sentence despite instructions.
    """
    if not text:
        return None

    # Try direct parse first
    stripped = text.strip()
    try:
        return json.loads(stripped)
    except json.JSONDecodeError:
        pass

    # Strip code fences
    fence = re.search(r"```(?:json)?\s*(\{.*?\})\s*```", text, re.DOTALL)
    if fence:
        try:
            return json.loads(fence.group(1))
        except json.JSONDecodeError:
            pass

    # Greedy braces extraction
    first = text.find("{")
    last = text.rfind("}")
    if first != -1 and last != -1 and last > first:
        candidate = text[first : last + 1]
        try:
            return json.loads(candidate)
        except json.JSONDecodeError:
            pass

    return None


def _call_claude(user_prompt: str, max_tokens: int = 2048) -> Optional[Dict[str, Any]]:
    """Single source of truth for Claude API calls.

    Returns the parsed JSON dict on success, None on any failure (caller
    should fall back to mock).
    """
    client = _get_client()
    if client is None:
        return None

    try:
        response = client.messages.create(
            model=CLAUDE_MODEL,
            max_tokens=max_tokens,
            system=_build_system_block(),
            messages=[{"role": "user", "content": user_prompt}],
        )
    except Exception as exc:  # noqa: BLE001
        # Catch every API/network exception — never let it bubble to the endpoint.
        logger.warning("Claude API call failed (%s); falling back to mock", exc)
        return None

    # Concatenate all text blocks
    text_parts: List[str] = []
    for block in getattr(response, "content", []) or []:
        if getattr(block, "type", None) == "text":
            text_parts.append(getattr(block, "text", "") or "")
    raw_text = "\n".join(text_parts).strip()

    parsed = _extract_json(raw_text)
    if parsed is None:
        logger.warning(
            "Claude returned non-JSON or unparsable response (len=%d); falling back to mock",
            len(raw_text),
        )
        return None
    return parsed


# ---------------------------------------------------------------------------
# Deterministic seeding for mock variation
# ---------------------------------------------------------------------------


def _seed_from(*parts: Any) -> random.Random:
    """Create a deterministic RNG so mock outputs vary by input but are stable."""
    blob = "|".join(str(p) for p in parts)
    digest = hashlib.sha256(blob.encode("utf-8")).hexdigest()
    return random.Random(int(digest[:16], 16))


def _safe_float(x: Any, default: float = 0.0) -> float:
    try:
        return float(x)
    except (TypeError, ValueError):
        return default


def _safe_int(x: Any, default: int = 0) -> int:
    try:
        return int(x)
    except (TypeError, ValueError):
        return default


# ===========================================================================
# 1. analyze_order_for_approval
# ===========================================================================


def analyze_order_for_approval(
    order_dict: Dict[str, Any],
    customer_dict: Dict[str, Any],
    inventory_status: Dict[str, Any],
    financial_health: Dict[str, Any],
) -> Dict[str, Any]:
    """Produce an approval recommendation for an order.

    Returns:
        {
            decision: 'approve' | 'approve_with_modification' | 'reject',
            risk_score: 0-100,
            reasoning: str,
            business_impact: str,
            suggested_action: str,
            key_factors: [str],
            confidence: 0-1,
        }
    """
    user_prompt = f"""<task>
Analyze whether this order should be approved, approved with modifications, or rejected.
</task>

<order>
{json.dumps(order_dict, default=str, indent=2)}
</order>

<customer>
{json.dumps(customer_dict, default=str, indent=2)}
</customer>

<inventory_status>
{json.dumps(inventory_status, default=str, indent=2)}
</inventory_status>

<financial_health>
{json.dumps(financial_health, default=str, indent=2)}
</financial_health>

<instructions>
Evaluate the order across four dimensions:
  1. CREDIT RISK — Will this order push the customer past their credit limit? Is their credit_health flagged?
  2. INVENTORY — Can we fulfill the requested quantities from available stock?
  3. MARKET FIT — Are the products approved for this customer's market?
  4. STRATEGIC VALUE — Is this a key account, a growth market, a promotional push?

Output a JSON object with EXACTLY these fields:
{{
  "decision": "approve" | "approve_with_modification" | "reject",
  "risk_score": <integer 0-100, where 0 = no risk and 100 = severe risk>,
  "reasoning": "<2-4 sentence rationale citing specific numbers>",
  "business_impact": "<1-2 sentence statement of revenue / customer relationship impact>",
  "suggested_action": "<concrete next step for the approver>",
  "key_factors": ["<factor 1>", "<factor 2>", "<factor 3>", ...],
  "confidence": <float 0.0-1.0>
}}
</instructions>"""

    result = _call_claude(user_prompt, max_tokens=1500)
    if result is None:
        return _mock_analyze_order(order_dict, customer_dict, inventory_status, financial_health)

    return _coerce_recommendation(result, order_dict, customer_dict)


def _coerce_recommendation(
    result: Dict[str, Any],
    order_dict: Dict[str, Any],
    customer_dict: Dict[str, Any],
) -> Dict[str, Any]:
    """Normalize the model's response into the documented shape."""
    decision = str(result.get("decision", "approve_with_modification")).lower().strip()
    if decision not in {"approve", "approve_with_modification", "reject"}:
        # Map common synonyms
        if decision in {"approved", "yes"}:
            decision = "approve"
        elif decision in {"rejected", "deny", "denied", "no"}:
            decision = "reject"
        else:
            decision = "approve_with_modification"

    risk_score = _safe_int(result.get("risk_score", 50))
    risk_score = max(0, min(100, risk_score))

    confidence = _safe_float(result.get("confidence", 0.75))
    confidence = max(0.0, min(1.0, confidence))

    key_factors = result.get("key_factors") or []
    if not isinstance(key_factors, list):
        key_factors = [str(key_factors)]
    key_factors = [str(f) for f in key_factors][:8]

    return {
        "decision": decision,
        "risk_score": risk_score,
        "reasoning": str(result.get("reasoning", "")).strip()
            or "Order evaluated against credit, inventory, and market parameters.",
        "business_impact": str(result.get("business_impact", "")).strip()
            or "Standard order with neutral business impact.",
        "suggested_action": str(result.get("suggested_action", "")).strip()
            or "Proceed with manager approval.",
        "key_factors": key_factors,
        "confidence": confidence,
    }


def _mock_analyze_order(
    order_dict: Dict[str, Any],
    customer_dict: Dict[str, Any],
    inventory_status: Dict[str, Any],
    financial_health: Dict[str, Any],
) -> Dict[str, Any]:
    """Deterministic, data-aware mock that mirrors plausible Claude output."""
    rng = _seed_from(
        order_dict.get("id"),
        order_dict.get("order_number"),
        customer_dict.get("id"),
    )

    total_value = _safe_float(order_dict.get("total_value"))
    credit_limit = _safe_float(customer_dict.get("credit_limit"))
    outstanding = _safe_float(customer_dict.get("outstanding_balance"))
    available_credit = max(0.0, credit_limit - outstanding)
    credit_health = str(customer_dict.get("credit_health", "green")).lower()
    market = customer_dict.get("market", "the customer's market")
    customer_name = customer_dict.get("name", "this customer")

    # Inventory shortage signal
    shortage_items: List[str] = []
    if isinstance(inventory_status, dict):
        items = inventory_status.get("items") or inventory_status.get("shortages") or []
        if isinstance(items, list):
            for item in items:
                if isinstance(item, dict):
                    short = item.get("shortage") or item.get("short")
                    if short:
                        shortage_items.append(
                            f"{item.get('name', item.get('product_id', 'item'))} (short {short})"
                        )

    # Decision logic
    factors: List[str] = []
    risk = 20 + rng.randint(0, 15)

    # Credit-driven risk
    if total_value > available_credit > 0:
        over = total_value - available_credit
        risk += min(50, int((over / max(available_credit, 1.0)) * 30) + 25)
        factors.append(
            f"Order value ${total_value:,.0f} exceeds available credit ${available_credit:,.0f} by ${over:,.0f}"
        )
    elif total_value > 0.85 * available_credit and available_credit > 0:
        risk += 15
        factors.append(
            f"Order consumes {total_value / available_credit * 100:.0f}% of available credit"
        )
    else:
        factors.append(
            f"Order value ${total_value:,.0f} within available credit ${available_credit:,.0f}"
        )

    if credit_health == "red":
        risk += 25
        factors.append(f"{customer_name} flagged red on credit health")
    elif credit_health == "yellow":
        risk += 10
        factors.append(f"{customer_name} on credit watch (yellow)")
    else:
        factors.append(f"Credit health: green")

    if shortage_items:
        risk += 10
        factors.append(f"Inventory shortages: {'; '.join(shortage_items[:3])}")
    else:
        factors.append("All requested SKUs in stock")

    # Financial health overlay
    fh_rating = ""
    if isinstance(financial_health, dict):
        fh_rating = str(financial_health.get("rating", "")).lower()
        dso = financial_health.get("days_sales_outstanding")
        if dso and _safe_float(dso) > 60:
            risk += 8
            factors.append(f"Elevated DSO of {dso} days")
        if fh_rating in {"poor", "weak", "deteriorating"}:
            risk += 12
            factors.append(f"Financial health rated {fh_rating}")

    risk = max(0, min(100, risk + rng.randint(-5, 5)))

    if risk >= 75:
        decision = "reject"
        suggested = (
            f"Reject this order and contact {customer_name} to clear "
            f"${outstanding:,.0f} in outstanding balance before resubmitting."
        )
        business_impact = (
            f"Rejecting prevents ~${total_value * 0.15:,.0f} bad-debt exposure but "
            f"may strain the {market} relationship."
        )
        confidence = 0.85 + rng.random() * 0.1
    elif risk >= 45:
        decision = "approve_with_modification"
        suggested = (
            "Approve with reduced quantities matching available credit and inventory; "
            "request 50% prepayment for the remainder."
        )
        business_impact = (
            f"Modified approval captures ~${total_value * 0.65:,.0f} of revenue "
            f"while protecting against credit concentration in {market}."
        )
        confidence = 0.7 + rng.random() * 0.15
    else:
        decision = "approve"
        suggested = (
            f"Approve as-submitted and schedule shipment to {market} within 7 days."
        )
        business_impact = (
            f"Captures ${total_value:,.0f} in revenue from {customer_name}, "
            f"reinforcing a healthy account in the {market} market."
        )
        confidence = 0.82 + rng.random() * 0.13

    reasoning = (
        f"{customer_name} is currently {credit_health} on credit with "
        f"${available_credit:,.0f} of headroom against this ${total_value:,.0f} order. "
        + (
            f"Inventory check flagged {len(shortage_items)} SKU shortage(s). "
            if shortage_items
            else "All SKUs are in stock. "
        )
        + (
            f"Financial health rating: {fh_rating}. "
            if fh_rating
            else ""
        )
        + f"Overall risk profile favors a '{decision}' decision."
    )

    return {
        "decision": decision,
        "risk_score": risk,
        "reasoning": reasoning.strip(),
        "business_impact": business_impact,
        "suggested_action": suggested,
        "key_factors": factors[:6],
        "confidence": round(min(0.97, confidence), 2),
    }


# ===========================================================================
# 2. explain_decision
# ===========================================================================


def explain_decision(order_dict: Dict[str, Any], question: str) -> Dict[str, Any]:
    """Generate an explainability response for an order decision.

    Returns:
        { explanation: str, supporting_data: [str] }
    """
    user_prompt = f"""<task>
Answer the user's question about this order decision using the order data as evidence.
</task>

<order>
{json.dumps(order_dict, default=str, indent=2)}
</order>

<user_question>
{question}
</user_question>

<instructions>
Produce a clear, manager-grade explanation. Cite specific fields from the order
(total_value, risk_score, ai_recommendation, status, line items, etc.) as supporting evidence.

Output a JSON object with EXACTLY these fields:
{{
  "explanation": "<3-5 sentence answer to the user's question>",
  "supporting_data": ["<evidence point 1>", "<evidence point 2>", ...]
}}
</instructions>"""

    result = _call_claude(user_prompt, max_tokens=1200)
    if result is None:
        return _mock_explain_decision(order_dict, question)

    explanation = str(result.get("explanation", "")).strip()
    if not explanation:
        return _mock_explain_decision(order_dict, question)

    supporting = result.get("supporting_data") or []
    if not isinstance(supporting, list):
        supporting = [str(supporting)]
    supporting = [str(s) for s in supporting][:10]

    return {"explanation": explanation, "supporting_data": supporting}


def _mock_explain_decision(order_dict: Dict[str, Any], question: str) -> Dict[str, Any]:
    rng = _seed_from(order_dict.get("id"), question[:64])

    order_number = order_dict.get("order_number", f"#{order_dict.get('id', '???')}")
    total_value = _safe_float(order_dict.get("total_value"))
    status = order_dict.get("status", "unknown")
    ai_rec = order_dict.get("ai_recommendation", "review")
    risk = _safe_float(order_dict.get("risk_score", 0))
    item_count = len(order_dict.get("items", []) or [])

    q_lower = question.lower()

    if any(k in q_lower for k in ["why", "reason", "rationale"]):
        opener = (
            f"Order {order_number} was recommended for '{ai_rec}' primarily because of its "
            f"risk score of {risk:.0f} relative to the customer's standing."
        )
    elif any(k in q_lower for k in ["risk", "exposure"]):
        opener = (
            f"The risk score of {risk:.0f} on order {order_number} reflects the combined "
            f"weight of credit utilization, inventory fulfillment, and market exposure factors."
        )
    elif any(k in q_lower for k in ["approve", "should i"]):
        opener = (
            f"Based on the data, order {order_number} aligns with the platform's recommendation "
            f"to '{ai_rec}'."
        )
    else:
        opener = (
            f"Order {order_number} (status: {status}, value: ${total_value:,.0f}) "
            f"can be analyzed across credit, inventory, and market dimensions."
        )

    detail = (
        f" The order contains {item_count} line item(s) totaling ${total_value:,.0f}, "
        f"currently sitting in '{status}' status. "
        f"The AI recommendation was '{ai_rec}' with a risk score of {risk:.0f}/100."
    )

    closing_options = [
        " Reviewing the customer's recent payment behavior and the market's seasonal demand pattern would sharpen this further.",
        " The decision aligns with the platform's risk-weighted approval policy for this market segment.",
        " Manager override remains available if strategic considerations outweigh the quantitative signals.",
    ]
    closing = rng.choice(closing_options)

    explanation = opener + detail + closing

    supporting = [
        f"Order number: {order_number}",
        f"Total value: ${total_value:,.2f}",
        f"Status: {status}",
        f"AI recommendation: {ai_rec}",
        f"Risk score: {risk:.0f}/100",
        f"Line item count: {item_count}",
    ]

    return {"explanation": explanation, "supporting_data": supporting}


# ===========================================================================
# 3. generate_executive_summary
# ===========================================================================


def generate_executive_summary(kpi_dict: Dict[str, Any]) -> Dict[str, Any]:
    """Generate a CEO-grade executive narrative from current KPIs.

    Returns:
        {
            summary: str,
            highlights: [str],
            concerns: [str],
            recommendations: [str],
        }
    """
    user_prompt = f"""<task>
Synthesize this snapshot of platform KPIs into an executive briefing.
</task>

<kpis>
{json.dumps(kpi_dict, default=str, indent=2)}
</kpis>

<instructions>
Write for the CEO of an international beverage distributor.

Output a JSON object with EXACTLY these fields:
{{
  "summary": "<3-5 sentence narrative overview citing 2-3 quantitative anchors>",
  "highlights": ["<positive datapoint 1>", "<positive datapoint 2>", ...],
  "concerns": ["<risk or concern 1>", "<risk or concern 2>", ...],
  "recommendations": ["<actionable next step 1>", "<actionable next step 2>", ...]
}}

Make highlights/concerns/recommendations 3-5 items each.
</instructions>"""

    result = _call_claude(user_prompt, max_tokens=1500)
    if result is None:
        return _mock_executive_summary(kpi_dict)

    return {
        "summary": str(result.get("summary", "")).strip()
            or _mock_executive_summary(kpi_dict)["summary"],
        "highlights": [str(x) for x in (result.get("highlights") or [])][:8],
        "concerns": [str(x) for x in (result.get("concerns") or [])][:8],
        "recommendations": [str(x) for x in (result.get("recommendations") or [])][:8],
    }


def _mock_executive_summary(kpi_dict: Dict[str, Any]) -> Dict[str, Any]:
    rng = _seed_from(
        kpi_dict.get("total_revenue"),
        kpi_dict.get("total_orders"),
        kpi_dict.get("pending_approval_count"),
    )

    total_revenue = _safe_float(kpi_dict.get("total_revenue"))
    total_orders = _safe_int(kpi_dict.get("total_orders"))
    aov = _safe_float(kpi_dict.get("avg_order_value"))
    pending = _safe_int(kpi_dict.get("pending_approval_count"))
    approved = _safe_int(kpi_dict.get("approved_count"))
    rejected = _safe_int(kpi_dict.get("rejected_count"))

    top_products = kpi_dict.get("top_products") or []
    top_markets = kpi_dict.get("top_markets") or []

    top_product_name = (
        top_products[0].get("name", "the lead SKU")
        if top_products and isinstance(top_products[0], dict)
        else "the lead SKU"
    )
    top_market_name = (
        top_markets[0].get("market", top_markets[0].get("name", "the lead market"))
        if top_markets and isinstance(top_markets[0], dict)
        else "the lead market"
    )

    approval_rate = (approved / max(approved + rejected, 1)) * 100 if (approved + rejected) else 0

    summary = (
        f"BrewTrade AI processed {total_orders:,} orders generating "
        f"${total_revenue:,.0f} in revenue at an average order value of "
        f"${aov:,.0f}. {top_product_name} continues to anchor demand, with "
        f"{top_market_name} leading market contribution. "
        f"The approval pipeline holds {pending} orders awaiting manager review "
        f"against an overall approval rate of {approval_rate:.0f}%."
    )

    highlights = [
        f"${total_revenue:,.0f} in cumulative revenue across {total_orders:,} orders",
        f"Average order value of ${aov:,.0f}",
        f"{approved:,} orders approved year-to-date",
        f"{top_product_name} leading product mix",
        f"{top_market_name} leading market contribution",
    ]
    rng.shuffle(highlights)
    highlights = highlights[:4]

    concerns: List[str] = []
    if pending > 10:
        concerns.append(f"{pending} orders pending manager approval may indicate review bottleneck")
    if rejected > 0:
        concerns.append(f"{rejected} orders rejected — root-cause review recommended")
    if aov < 5000 and total_orders > 50:
        concerns.append(f"Average order value of ${aov:,.0f} below historical baseline")
    concerns.append("Caribbean hurricane season may compress Q3 shipping windows")
    concerns.append("FX volatility on USD-denominated invoices warrants hedging review")
    rng.shuffle(concerns)
    concerns = concerns[:4]

    recommendations = [
        f"Convene approval committee to clear the {pending}-order pending queue within 72 hours",
        f"Run a promotional push on {top_product_name} in secondary markets",
        f"Tighten credit terms for accounts in red/yellow health to protect AR",
        f"Investigate why approval rate sits at {approval_rate:.0f}%",
        f"Pilot bundled SKU offerings in {top_market_name} to lift AOV",
    ]
    rng.shuffle(recommendations)
    recommendations = recommendations[:4]

    return {
        "summary": summary,
        "highlights": highlights,
        "concerns": concerns,
        "recommendations": recommendations,
    }


# ===========================================================================
# 4. assist_order_planning
# ===========================================================================


def assist_order_planning(
    customer_dict: Dict[str, Any],
    prompt: str,
    available_products: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Recommend products & merchandise for a customer based on a free-form prompt.

    Returns:
        {
            recommended_products: [{product_id, name, suggested_quantity, rationale}],
            merchandise_suggestions: [...],
            demand_forecast: str,
        }
    """
    # Trim to keep token cost reasonable
    trimmed_products = []
    for p in available_products[:40]:
        if not isinstance(p, dict):
            continue
        trimmed_products.append({
            "id": p.get("id"),
            "sku": p.get("sku"),
            "name": p.get("name"),
            "category": p.get("category"),
            "base_price": p.get("base_price"),
            "available_quantity": p.get("available_quantity"),
            "moq": p.get("moq"),
            "approved_markets": p.get("approved_markets"),
        })

    user_prompt = f"""<task>
Recommend an order plan for this customer based on their stated need.
</task>

<customer>
{json.dumps(customer_dict, default=str, indent=2)}
</customer>

<customer_request>
{prompt}
</customer_request>

<available_products>
{json.dumps(trimmed_products, default=str, indent=2)}
</available_products>

<instructions>
Select 3-6 products that best match the customer's request, factoring in:
  - Their market (only recommend products approved for it)
  - Available inventory
  - Customer credit headroom
  - Likely demand pattern in their market

Output a JSON object with EXACTLY these fields:
{{
  "recommended_products": [
    {{
      "product_id": <int>,
      "name": "<product name>",
      "suggested_quantity": <int — respect MOQ and available stock>,
      "rationale": "<1-2 sentence justification>"
    }}
  ],
  "merchandise_suggestions": [
    {{"name": "<merch item>", "rationale": "<why it pairs with the order>"}}
  ],
  "demand_forecast": "<2-3 sentence outlook for this customer's market and these SKUs>"
}}
</instructions>"""

    result = _call_claude(user_prompt, max_tokens=2000)
    if result is None:
        return _mock_assist_order_planning(customer_dict, prompt, available_products)

    rec_products = result.get("recommended_products") or []
    if not isinstance(rec_products, list):
        rec_products = []

    cleaned_recs = []
    for r in rec_products[:10]:
        if not isinstance(r, dict):
            continue
        cleaned_recs.append({
            "product_id": _safe_int(r.get("product_id")),
            "name": str(r.get("name", "")).strip() or "Unnamed product",
            "suggested_quantity": _safe_int(r.get("suggested_quantity"), default=1),
            "rationale": str(r.get("rationale", "")).strip(),
        })

    merch = result.get("merchandise_suggestions") or []
    if not isinstance(merch, list):
        merch = []
    cleaned_merch = []
    for m in merch[:10]:
        if isinstance(m, dict):
            cleaned_merch.append({
                "name": str(m.get("name", "")).strip() or "Branded item",
                "rationale": str(m.get("rationale", "")).strip(),
            })
        else:
            cleaned_merch.append({"name": str(m), "rationale": ""})

    if not cleaned_recs:
        return _mock_assist_order_planning(customer_dict, prompt, available_products)

    return {
        "recommended_products": cleaned_recs,
        "merchandise_suggestions": cleaned_merch,
        "demand_forecast": str(result.get("demand_forecast", "")).strip()
            or "Demand expected to remain steady across the planning horizon.",
    }


def _mock_assist_order_planning(
    customer_dict: Dict[str, Any],
    prompt: str,
    available_products: List[Dict[str, Any]],
) -> Dict[str, Any]:
    rng = _seed_from(customer_dict.get("id"), prompt[:64])

    market = str(customer_dict.get("market", "")).strip()
    credit_limit = _safe_float(customer_dict.get("credit_limit"))
    outstanding = _safe_float(customer_dict.get("outstanding_balance"))
    available_credit = max(0.0, credit_limit - outstanding)

    # Filter to products approved for the customer's market and in stock
    eligible: List[Dict[str, Any]] = []
    for p in available_products or []:
        if not isinstance(p, dict):
            continue
        approved = p.get("approved_markets") or []
        if market and approved and market not in approved:
            continue
        if _safe_int(p.get("available_quantity")) <= 0:
            continue
        eligible.append(p)

    if not eligible:
        eligible = [p for p in (available_products or []) if isinstance(p, dict)][:6]

    rng.shuffle(eligible)

    # Pick 3-5 products
    target_count = rng.randint(3, min(5, max(3, len(eligible))))
    chosen = eligible[:target_count]

    recommended_products = []
    running_total = 0.0
    for p in chosen:
        moq = max(1, _safe_int(p.get("moq"), default=10))
        stock = max(moq, _safe_int(p.get("available_quantity"), default=moq * 10))
        price = max(1.0, _safe_float(p.get("base_price"), default=25.0))

        # Suggest a quantity that fits inside remaining credit
        max_affordable = int(max(0.0, (available_credit - running_total)) / price)
        qty = max(moq, min(stock, max(moq, max_affordable // 2 if max_affordable else moq * rng.randint(2, 6))))
        qty = min(qty, stock)
        running_total += qty * price

        rationale_options = [
            f"Strong rotation SKU for {market or 'this market'}; sized to match typical reorder cadence",
            f"Inventory healthy at {stock} units; supports a confident ship-now position",
            f"Margin profile and MOQ ({moq}) align with the customer's order pattern",
            f"Pairs naturally with the rest of this proposed mix for shelf-set continuity",
        ]
        recommended_products.append({
            "product_id": _safe_int(p.get("id")),
            "name": p.get("name", "Product"),
            "suggested_quantity": qty,
            "rationale": rng.choice(rationale_options),
        })

    merch_pool = [
        {"name": "Branded glassware (case of 24)", "rationale": "Elevates on-premise visibility for the lead SKU"},
        {"name": "POS counter mats", "rationale": "Drives impulse pull-through at retail accounts"},
        {"name": "Branded apparel pack", "rationale": "Reinforces ambassador program in the trade"},
        {"name": "LED illuminated signage", "rationale": "Anchors the brand block at flagship accounts"},
        {"name": "Cooler decal kit", "rationale": "Low-cost visibility across grocery and convenience"},
    ]
    rng.shuffle(merch_pool)
    merchandise_suggestions = merch_pool[: rng.randint(2, 3)]

    forecast_templates = [
        f"Demand in {market or 'the target market'} should track in line with seasonal averages, "
        f"with modest upside from the proposed SKU mix. Recommend monitoring sell-through 14 days post-arrival.",
        f"Forecast points to steady weekly velocity across the proposed assortment in {market or 'this market'}; "
        f"expect ~80% sell-through within 30 days based on comparable accounts.",
        f"Outlook is constructive: the SKU mix matches recent winning patterns in {market or 'the region'}, "
        f"with merchandise support expected to lift velocity by 8-12%.",
    ]

    return {
        "recommended_products": recommended_products,
        "merchandise_suggestions": merchandise_suggestions,
        "demand_forecast": rng.choice(forecast_templates),
    }


# ===========================================================================
# 5. summarize_customer_intel
# ===========================================================================


def summarize_customer_intel(
    customer_dict: Dict[str, Any],
    orders_dict: Dict[str, Any],
    invoices_dict: Dict[str, Any],
) -> Dict[str, Any]:
    """Summarize a customer's account health and growth posture.

    Returns:
        { summary: str, risk_factors: [str], opportunities: [str] }
    """
    user_prompt = f"""<task>
Produce an account intelligence brief on this customer.
</task>

<customer>
{json.dumps(customer_dict, default=str, indent=2)}
</customer>

<orders>
{json.dumps(orders_dict, default=str, indent=2)}
</orders>

<invoices>
{json.dumps(invoices_dict, default=str, indent=2)}
</invoices>

<instructions>
This brief will be read by an account manager preparing for a customer call.

Output a JSON object with EXACTLY these fields:
{{
  "summary": "<3-5 sentence narrative: who they are, recent activity, account health>",
  "risk_factors": ["<risk 1>", "<risk 2>", ...],
  "opportunities": ["<opportunity 1>", "<opportunity 2>", ...]
}}

Provide 2-5 items in each list. Be specific to the data — cite order counts, balances, markets.
</instructions>"""

    result = _call_claude(user_prompt, max_tokens=1500)
    if result is None:
        return _mock_customer_intel(customer_dict, orders_dict, invoices_dict)

    summary = str(result.get("summary", "")).strip()
    if not summary:
        return _mock_customer_intel(customer_dict, orders_dict, invoices_dict)

    return {
        "summary": summary,
        "risk_factors": [str(x) for x in (result.get("risk_factors") or [])][:8],
        "opportunities": [str(x) for x in (result.get("opportunities") or [])][:8],
    }


def _mock_customer_intel(
    customer_dict: Dict[str, Any],
    orders_dict: Dict[str, Any],
    invoices_dict: Dict[str, Any],
) -> Dict[str, Any]:
    rng = _seed_from(
        customer_dict.get("id"),
        len(str(orders_dict)),
        len(str(invoices_dict)),
    )

    name = customer_dict.get("name", "This customer")
    market = customer_dict.get("market", "their market")
    credit_limit = _safe_float(customer_dict.get("credit_limit"))
    outstanding = _safe_float(customer_dict.get("outstanding_balance"))
    available_credit = max(0.0, credit_limit - outstanding)
    health = str(customer_dict.get("credit_health", "green")).lower()

    # Order metrics
    order_list: List[Dict[str, Any]] = []
    if isinstance(orders_dict, dict):
        order_list = orders_dict.get("orders") or orders_dict.get("items") or []
    elif isinstance(orders_dict, list):
        order_list = orders_dict
    order_count = len(order_list)
    order_total = sum(_safe_float(o.get("total_value")) for o in order_list if isinstance(o, dict))

    # Invoice metrics
    invoice_list: List[Dict[str, Any]] = []
    if isinstance(invoices_dict, dict):
        invoice_list = invoices_dict.get("invoices") or invoices_dict.get("items") or []
    elif isinstance(invoices_dict, list):
        invoice_list = invoices_dict
    overdue_count = sum(
        1 for inv in invoice_list
        if isinstance(inv, dict) and str(inv.get("status", "")).lower() == "overdue"
    )
    open_balance = sum(
        _safe_float(inv.get("balance"))
        for inv in invoice_list
        if isinstance(inv, dict) and str(inv.get("status", "")).lower() != "closed"
    )

    summary = (
        f"{name} operates in the {market} market with a credit line of "
        f"${credit_limit:,.0f} (${available_credit:,.0f} currently available). "
        f"Over the recent window they placed {order_count} order(s) totaling "
        f"${order_total:,.0f}. "
        f"Their credit posture is rated {health}, with "
        f"${open_balance:,.0f} in open invoice balance"
        + (f" and {overdue_count} overdue invoice(s)." if overdue_count else " and no overdue items.")
    )

    risk_factors: List[str] = []
    if health == "red":
        risk_factors.append(f"Credit health flagged RED — collection priority")
    elif health == "yellow":
        risk_factors.append(f"Credit health on watch (yellow)")
    if overdue_count:
        risk_factors.append(f"{overdue_count} invoice(s) currently overdue")
    if outstanding > 0.75 * credit_limit and credit_limit > 0:
        risk_factors.append(
            f"Utilization at {outstanding / credit_limit * 100:.0f}% of credit limit"
        )
    if order_count == 0:
        risk_factors.append("No recent order activity — possible churn risk")
    risk_factors.append(f"Concentrated exposure to {market} — sensitive to local FX & policy shifts")

    rng.shuffle(risk_factors)
    risk_factors = risk_factors[:4]

    opportunities: List[str] = [
        f"Available credit of ${available_credit:,.0f} unlocks a meaningful incremental order",
        f"Strong fit for the next promotional cycle in {market}",
        f"Cross-sell merchandise + POS to lift account stickiness",
        f"Quarterly business review would consolidate the {order_count}-order trend into a growth plan",
        f"Trial new SKU launches with this account given their established presence in {market}",
    ]
    rng.shuffle(opportunities)
    opportunities = opportunities[:4]

    return {
        "summary": summary,
        "risk_factors": risk_factors,
        "opportunities": opportunities,
    }
