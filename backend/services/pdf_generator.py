"""
BrewTrade AI - Report / PDF generator.

Pure-Python report generation with zero external dependencies. Produces
print-ready HTML that can be:
  - Rendered directly in the browser
  - Piped through any HTML->PDF converter (wkhtmltopdf, WeasyPrint, browser print)
  - Used as a self-contained shareable artifact

The HTML is intentionally self-contained: all styles are inline in a single
<style> block so the output renders without external assets.
"""
from __future__ import annotations

import html
from datetime import datetime
from typing import Any, Dict, List, Optional


# ---------------------------------------------------------------------------
# Small helpers
# ---------------------------------------------------------------------------


def _esc(value: Any) -> str:
    """HTML-escape any value, treating None as empty."""
    if value is None:
        return ""
    return html.escape(str(value), quote=True)


def _fmt_money(value: Any) -> str:
    try:
        return f"${float(value):,.2f}"
    except (TypeError, ValueError):
        return "$0.00"


def _fmt_int(value: Any) -> str:
    try:
        return f"{int(value):,}"
    except (TypeError, ValueError):
        return "0"


def _fmt_date(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.strftime("%Y-%m-%d %H:%M UTC")
    return _esc(value)


def _badge(decision: str) -> str:
    decision_lc = (decision or "").lower()
    color_map = {
        "approve": ("#0a7d3b", "#e6f4ec"),
        "approve_with_modification": ("#a36b00", "#fff4dc"),
        "reject": ("#a01b1b", "#fde8e8"),
    }
    fg, bg = color_map.get(decision_lc, ("#2c3e50", "#ecf0f1"))
    label = decision_lc.replace("_", " ").upper() or "PENDING"
    return (
        f'<span style="display:inline-block;padding:6px 14px;border-radius:14px;'
        f'background:{bg};color:{fg};font-weight:700;letter-spacing:0.5px;font-size:12px;">'
        f"{_esc(label)}</span>"
    )


def _risk_bar(score: Any) -> str:
    try:
        n = max(0, min(100, int(score)))
    except (TypeError, ValueError):
        n = 0

    if n >= 75:
        color = "#a01b1b"
    elif n >= 45:
        color = "#a36b00"
    else:
        color = "#0a7d3b"

    return (
        '<div style="background:#e8e8e8;border-radius:10px;height:20px;width:100%;position:relative;overflow:hidden;">'
        f'<div style="background:{color};height:100%;width:{n}%;border-radius:10px;"></div>'
        f'<div style="position:absolute;top:0;left:0;width:100%;height:20px;line-height:20px;text-align:center;font-weight:700;font-size:12px;color:#fff;text-shadow:0 0 3px rgba(0,0,0,0.55);">'
        f"{n} / 100</div>"
        "</div>"
    )


def _kv_row(label: str, value: str) -> str:
    return (
        '<tr>'
        f'<td style="padding:6px 12px;background:#f8f9fb;font-weight:600;color:#555;width:36%;">{_esc(label)}</td>'
        f'<td style="padding:6px 12px;color:#111;">{value}</td>'
        "</tr>"
    )


def _list_block(title: str, items: List[Any], color: str = "#2c3e50") -> str:
    if not items:
        return ""
    lis = "".join(f"<li style='margin-bottom:6px;line-height:1.5;'>{_esc(item)}</li>" for item in items)
    return (
        '<div style="margin-top:18px;">'
        f'<h3 style="color:{color};font-size:14px;text-transform:uppercase;letter-spacing:1px;border-bottom:1px solid #ddd;padding-bottom:4px;margin-bottom:10px;">{_esc(title)}</h3>'
        f'<ul style="margin:0;padding-left:22px;color:#222;">{lis}</ul>'
        "</div>"
    )


def _items_table(items: List[Dict[str, Any]]) -> str:
    if not items:
        return "<p style='color:#888;font-style:italic;'>No line items recorded.</p>"

    rows = []
    for idx, it in enumerate(items, start=1):
        if not isinstance(it, dict):
            continue
        # Try several common shapes
        name = it.get("name") or it.get("product_name") or it.get("sku") or f"Item #{it.get('product_id') or it.get('merchandise_id') or idx}"
        qty_req = it.get("quantity_requested") or it.get("quantity") or 0
        qty_app = it.get("quantity_approved")
        unit = it.get("unit_price") or 0
        line_total = it.get("line_total") or (float(unit or 0) * int(qty_req or 0))

        zebra = "#fafbfc" if idx % 2 == 0 else "#ffffff"
        rows.append(
            f'<tr style="background:{zebra};">'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;">{_esc(name)}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">{_fmt_int(qty_req)}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">{_fmt_int(qty_app) if qty_app is not None else "—"}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">{_fmt_money(unit)}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;font-weight:600;">{_fmt_money(line_total)}</td>'
            "</tr>"
        )

    return (
        '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;">'
        '<thead><tr style="background:#1f2d3d;color:#fff;">'
        '<th style="padding:10px 12px;text-align:left;">Item</th>'
        '<th style="padding:10px 12px;text-align:right;">Qty Requested</th>'
        '<th style="padding:10px 12px;text-align:right;">Qty Approved</th>'
        '<th style="padding:10px 12px;text-align:right;">Unit Price</th>'
        '<th style="padding:10px 12px;text-align:right;">Line Total</th>'
        "</tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table>"
    )


def _inventory_block(inventory_status: Optional[Dict[str, Any]]) -> str:
    if not inventory_status or not isinstance(inventory_status, dict):
        return "<p style='color:#888;font-style:italic;'>No inventory snapshot supplied.</p>"

    items = (
        inventory_status.get("items")
        or inventory_status.get("lines")
        or inventory_status.get("checks")
        or []
    )
    if not isinstance(items, list) or not items:
        # Fallback: render the dict as KV pairs
        rows = "".join(
            _kv_row(_esc(k), _esc(v))
            for k, v in inventory_status.items()
        )
        return f'<table style="width:100%;border-collapse:collapse;font-size:13px;">{rows}</table>'

    rows = []
    for it in items:
        if not isinstance(it, dict):
            continue
        name = it.get("name") or it.get("product_name") or f"Product #{it.get('product_id', '?')}"
        requested = it.get("requested") or it.get("quantity_requested") or it.get("required") or "-"
        available = it.get("available") or it.get("on_hand") or it.get("stock") or "-"
        shortage = it.get("shortage") or it.get("short") or 0
        status = "OK" if not shortage else f"SHORT {shortage}"
        status_color = "#0a7d3b" if not shortage else "#a01b1b"
        rows.append(
            "<tr>"
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;">{_esc(name)}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">{_esc(requested)}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">{_esc(available)}</td>'
            f'<td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;color:{status_color};font-weight:700;">{_esc(status)}</td>'
            "</tr>"
        )

    return (
        '<table style="width:100%;border-collapse:collapse;margin-top:10px;font-size:13px;">'
        '<thead><tr style="background:#1f2d3d;color:#fff;">'
        '<th style="padding:10px 12px;text-align:left;">Product</th>'
        '<th style="padding:10px 12px;text-align:right;">Requested</th>'
        '<th style="padding:10px 12px;text-align:right;">Available</th>'
        '<th style="padding:10px 12px;text-align:right;">Status</th>'
        "</tr></thead>"
        f"<tbody>{''.join(rows)}</tbody>"
        "</table>"
    )


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------


def generate_approval_report_html(
    order: Dict[str, Any],
    customer: Dict[str, Any],
    ai_recommendation: Dict[str, Any],
    inventory_status: Optional[Dict[str, Any]] = None,
) -> str:
    """Generate a printable approval report HTML document.

    Args:
        order: Order dict (id, order_number, total_value, status, items, etc.).
        customer: Customer dict (name, market, credit_limit, etc.).
        ai_recommendation: Output of analyze_order_for_approval().
        inventory_status: Optional inventory snapshot dict.

    Returns:
        A complete, self-contained HTML5 document string.
    """
    order = order or {}
    customer = customer or {}
    ai_recommendation = ai_recommendation or {}

    generated_at = datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")

    order_number = _esc(order.get("order_number", f"#{order.get('id', '???')}"))
    order_status = _esc(order.get("status", "—"))
    order_total = _fmt_money(order.get("total_value"))
    order_created = _fmt_date(order.get("created_at"))
    order_notes = _esc(order.get("notes") or "—")
    expected_delivery = _fmt_date(order.get("expected_delivery"))

    customer_name = _esc(customer.get("name", "Unknown Customer"))
    customer_market = _esc(customer.get("market", "—"))
    customer_credit_limit = _fmt_money(customer.get("credit_limit"))
    customer_outstanding = _fmt_money(customer.get("outstanding_balance"))
    try:
        available_credit = max(
            0.0,
            float(customer.get("credit_limit") or 0)
            - float(customer.get("outstanding_balance") or 0),
        )
    except (TypeError, ValueError):
        available_credit = 0.0
    customer_available = _fmt_money(available_credit)
    customer_health = _esc(str(customer.get("credit_health", "—")).upper())
    customer_contact = _esc(customer.get("contact_name") or "—")
    customer_email = _esc(customer.get("contact_email") or "—")

    decision = ai_recommendation.get("decision", "pending")
    risk_score = ai_recommendation.get("risk_score", 0)
    reasoning = _esc(ai_recommendation.get("reasoning", "—"))
    business_impact = _esc(ai_recommendation.get("business_impact", "—"))
    suggested_action = _esc(ai_recommendation.get("suggested_action", "—"))
    confidence = ai_recommendation.get("confidence", 0)
    try:
        confidence_pct = f"{float(confidence) * 100:.0f}%"
    except (TypeError, ValueError):
        confidence_pct = "—"
    key_factors = ai_recommendation.get("key_factors") or []

    items_html = _items_table(order.get("items") or [])
    inventory_html = _inventory_block(inventory_status)

    # Assemble HTML
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>BrewTrade AI - Approval Report - {order_number}</title>
<style>
  @page {{ size: A4; margin: 18mm; }}
  * {{ box-sizing: border-box; }}
  body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    margin: 0;
    padding: 32px;
    color: #1f2d3d;
    background: #ffffff;
    line-height: 1.5;
  }}
  .report {{ max-width: 880px; margin: 0 auto; }}
  .header {{
    border-bottom: 4px solid #1f2d3d;
    padding-bottom: 18px;
    margin-bottom: 24px;
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
  }}
  .brand {{ font-size: 26px; font-weight: 800; color: #1f2d3d; letter-spacing: -0.5px; }}
  .brand-tag {{ font-size: 11px; color: #7a8694; text-transform: uppercase; letter-spacing: 2px; }}
  .meta {{ text-align: right; font-size: 12px; color: #7a8694; }}
  h1 {{
    font-size: 22px;
    margin: 4px 0 4px 0;
    color: #1f2d3d;
  }}
  h2 {{
    font-size: 16px;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: #1f2d3d;
    border-bottom: 2px solid #1f2d3d;
    padding-bottom: 6px;
    margin: 28px 0 14px 0;
  }}
  table.kv {{ width: 100%; border-collapse: collapse; font-size: 13px; }}
  table.kv tr {{ border-bottom: 1px solid #eef0f3; }}
  .panel {{
    background: #f8f9fb;
    border-left: 4px solid #1f2d3d;
    padding: 16px 18px;
    margin: 14px 0;
    border-radius: 4px;
  }}
  .panel-title {{
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: 2px;
    color: #7a8694;
    margin-bottom: 6px;
    font-weight: 700;
  }}
  .panel-body {{ font-size: 14px; color: #1f2d3d; }}
  .two-col {{ display: flex; gap: 24px; }}
  .two-col > div {{ flex: 1; }}
  .footer {{
    margin-top: 36px;
    padding-top: 18px;
    border-top: 1px solid #ddd;
    font-size: 11px;
    color: #7a8694;
    text-align: center;
  }}
  .signature-block {{
    margin-top: 40px;
    display: flex;
    justify-content: space-between;
    gap: 40px;
  }}
  .signature-block .sig {{
    flex: 1;
    border-top: 1px solid #333;
    padding-top: 6px;
    font-size: 11px;
    color: #555;
    text-align: center;
  }}
</style>
</head>
<body>
<div class="report">

  <div class="header">
    <div>
      <div class="brand-tag">BrewTrade AI</div>
      <div class="brand">Order Approval Report</div>
    </div>
    <div class="meta">
      Generated: {_esc(generated_at)}<br>
      Order: <strong>{order_number}</strong>
    </div>
  </div>

  <div style="display:flex;justify-content:space-between;align-items:center;background:#1f2d3d;color:#fff;padding:18px 22px;border-radius:6px;">
    <div>
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9fb0c2;">AI Recommendation</div>
      <div style="margin-top:6px;">{_badge(decision)}</div>
    </div>
    <div style="text-align:right;">
      <div style="font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#9fb0c2;">Confidence</div>
      <div style="font-size:26px;font-weight:800;margin-top:4px;">{_esc(confidence_pct)}</div>
    </div>
  </div>

  <h2>Risk Assessment</h2>
  {_risk_bar(risk_score)}

  <div class="panel">
    <div class="panel-title">AI Reasoning</div>
    <div class="panel-body">{reasoning}</div>
  </div>

  <div class="two-col">
    <div class="panel" style="border-left-color:#0a7d3b;background:#f0f8f4;">
      <div class="panel-title" style="color:#0a7d3b;">Business Impact</div>
      <div class="panel-body">{business_impact}</div>
    </div>
    <div class="panel" style="border-left-color:#a36b00;background:#fff8eb;">
      <div class="panel-title" style="color:#a36b00;">Suggested Action</div>
      <div class="panel-body">{suggested_action}</div>
    </div>
  </div>

  {_list_block("Key Factors", key_factors)}

  <h2>Order Summary</h2>
  <table class="kv">
    {_kv_row("Order Number", order_number)}
    {_kv_row("Status", order_status)}
    {_kv_row("Total Value", f"<strong>{order_total}</strong>")}
    {_kv_row("Created", _esc(order_created))}
    {_kv_row("Expected Delivery", _esc(expected_delivery) or "—")}
    {_kv_row("Notes", order_notes)}
  </table>

  <h2>Customer Profile</h2>
  <table class="kv">
    {_kv_row("Customer", f"<strong>{customer_name}</strong>")}
    {_kv_row("Market", customer_market)}
    {_kv_row("Credit Limit", customer_credit_limit)}
    {_kv_row("Outstanding Balance", customer_outstanding)}
    {_kv_row("Available Credit", f"<strong>{customer_available}</strong>")}
    {_kv_row("Credit Health", customer_health)}
    {_kv_row("Contact", customer_contact)}
    {_kv_row("Email", customer_email)}
  </table>

  <h2>Line Items</h2>
  {items_html}

  <h2>Inventory Check</h2>
  {inventory_html}

  <div class="signature-block">
    <div class="sig">Approver Signature</div>
    <div class="sig">Date</div>
  </div>

  <div class="footer">
    This report was generated automatically by BrewTrade AI.
    AI-assisted recommendation — final approval authority rests with the assigned manager.
  </div>

</div>
</body>
</html>
"""


# ---------------------------------------------------------------------------
# Backwards-compatible stub the legacy code may still call
# ---------------------------------------------------------------------------


def generate_document(doc_type: str, payload: Dict[str, Any]) -> str:
    """Legacy entrypoint kept for backward compatibility with other modules."""
    return f"static/{doc_type}_stub.pdf"
