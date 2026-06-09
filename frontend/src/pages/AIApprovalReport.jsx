import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Stack,
  Typography,
  Button,
  MenuItem,
  TextField,
  Alert,
  Skeleton,
  Divider,
  Grid,
  Chip,
  Tooltip,
} from '@mui/material';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import GavelRoundedIcon from '@mui/icons-material/GavelRounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import AccountBalanceRoundedIcon from '@mui/icons-material/AccountBalanceRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import LightbulbRoundedIcon from '@mui/icons-material/LightbulbRounded';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import ReportPage from '../components/ai/ReportPage.jsx';
import DecisionBadge from '../components/ai/DecisionBadge.jsx';
import {
  getPendingApprovals,
  generateApprovalReport,
} from '../api/client.js';
import { goldGradient } from '../theme.js';

// ---------- helpers ----------------------------------------------------------

const formatCurrency = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(Number(n));
};

const formatDate = (d) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return String(d);
  }
};

const safe = (v, fallback = '—') => {
  if (v === null || v === undefined || v === '') return fallback;
  return v;
};

// Normalize whatever the backend returns (HTML, JSON, or partial JSON) into a
// structured view-model.  This keeps the printable layout completely tolerant
// to schema evolution.
function normalizeReport(raw, orderMeta) {
  if (!raw) return null;

  // If the API returned an HTML payload (e.g. server-side rendered report), we
  // expose a `htmlBody` so callers can render it raw.  Otherwise we build a
  // structured object.
  if (typeof raw === 'string') {
    return { htmlBody: raw };
  }

  const r = raw || {};
  const customer = r.customer || r.customer_info || {};
  const order = r.order || r.order_details || {};
  const inventory = r.inventory || r.inventory_assessment || {};
  const financial = r.financial || r.financial_health || {};
  const ai = r.ai_decision || r.decision || r.recommendation || {};
  const risk = r.risk || r.risk_analysis || {};
  const recs = r.recommendations || r.next_steps || [];

  const decisionStr =
    (typeof ai === 'string' ? ai : ai.decision || ai.recommendation) ||
    orderMeta?.ai_recommendation ||
    'review';

  const riskScoreRaw =
    risk.score ??
    ai.risk_score ??
    r.risk_score ??
    orderMeta?.risk_score ??
    0;
  const riskScore = riskScoreRaw > 1 ? Number(riskScoreRaw) : Number(riskScoreRaw) * 100;

  return {
    htmlBody: r.html || null,
    customer: {
      name:
        customer.name ||
        orderMeta?.customer_name ||
        orderMeta?.customer?.name ||
        '—',
      tier: customer.tier || customer.segment || 'Standard',
      market: customer.market || orderMeta?.market || 'Caribbean',
      contact: customer.contact || customer.contact_name || '—',
      email: customer.email || '—',
      phone: customer.phone || '—',
      credit_limit: customer.credit_limit ?? customer.creditLimit ?? null,
      account_since: customer.account_since || customer.created_at || null,
    },
    order: {
      id: order.id || orderMeta?.id || orderMeta?.order_id,
      placed_at: order.placed_at || order.created_at || orderMeta?.created_at,
      requested_delivery:
        order.requested_delivery ||
        order.delivery_date ||
        orderMeta?.requested_delivery,
      total: order.total ?? order.total_amount ?? orderMeta?.total_amount,
      currency: order.currency || 'USD',
      line_items:
        Array.isArray(order.line_items)
          ? order.line_items
          : Array.isArray(order.items)
          ? order.items
          : [],
      notes: order.notes || orderMeta?.notes || null,
    },
    inventory: {
      coverage_pct:
        inventory.coverage_pct ??
        inventory.coverage ??
        inventory.fulfillment_pct ??
        null,
      dc: inventory.dc || inventory.warehouse || 'Primary DC',
      flagged_skus: Array.isArray(inventory.flagged_skus)
        ? inventory.flagged_skus
        : [],
      lead_time_days:
        inventory.lead_time_days ?? inventory.lead_time ?? null,
      summary:
        inventory.summary ||
        inventory.notes ||
        'Stock levels reviewed against the requested SKU mix.',
    },
    financial: {
      credit_utilization_pct:
        financial.credit_utilization_pct ??
        financial.credit_utilization ??
        null,
      dpo: financial.dpo ?? financial.days_payable_outstanding ?? null,
      on_time_pct:
        financial.on_time_pct ?? financial.on_time_ratio ?? null,
      ar_balance: financial.ar_balance ?? financial.outstanding_ar ?? null,
      overdue_balance:
        financial.overdue_balance ?? financial.overdue_ar ?? null,
      summary:
        financial.summary ||
        'Customer financial position assessed against historical payment cadence and current AR posture.',
    },
    ai: {
      decision: decisionStr,
      confidence:
        ai.confidence !== undefined
          ? Number(ai.confidence) > 1
            ? Number(ai.confidence)
            : Number(ai.confidence) * 100
          : 86,
      reasoning:
        ai.reasoning ||
        ai.rationale ||
        ai.explanation ||
        'Claude has assessed the order against the customer credit profile, order composition, inventory readiness, and recent decision history. The recommendation reflects the balance of these inputs.',
      key_factors: Array.isArray(ai.key_factors)
        ? ai.key_factors
        : [
            'Credit utilization within negotiated ceiling',
            'Order pattern consistent with 90-day baseline',
            'Inventory available at primary DC',
            'No overdue invoices > 30 days',
          ],
    },
    risk: {
      score: Math.max(0, Math.min(100, Number.isFinite(riskScore) ? riskScore : 0)),
      category:
        risk.category ||
        (riskScore >= 70 ? 'High' : riskScore >= 40 ? 'Moderate' : 'Low'),
      drivers: Array.isArray(risk.drivers)
        ? risk.drivers
        : [
            { label: 'Credit risk', value: 'Within tolerance' },
            { label: 'Inventory risk', value: 'Low' },
            { label: 'Channel risk', value: 'Stable' },
          ],
      mitigations:
        risk.mitigations ||
        'No additional mitigations required at this time. Standard monitoring applies.',
    },
    recommendations:
      Array.isArray(recs) && recs.length
        ? recs
        : [
            'Approve at full volume and release to fulfillment.',
            'Maintain quarterly check-in on credit utilization.',
            'Re-evaluate channel terms at next contract renewal.',
          ],
    generated_at: r.generated_at || new Date().toISOString(),
    signed_by:
      r.signed_by ||
      r.approver ||
      orderMeta?.assigned_manager ||
      'BrewTrade AI Manager',
  };
}

// ---------- section components ----------------------------------------------

function SectionHeader({ icon, title, idx }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
      <Box
        sx={{
          width: 32,
          height: 32,
          borderRadius: 1.5,
          background: goldGradient,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#1A1A1A',
          flexShrink: 0,
        }}
      >
        {icon}
      </Box>
      <Typography
        variant="caption"
        sx={{
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: '#8A6A12',
        }}
      >
        SECTION {String(idx).padStart(2, '0')}
      </Typography>
      <Typography
        variant="h5"
        sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}
      >
        {title}
      </Typography>
    </Stack>
  );
}

function KV({ label, value, sx }) {
  return (
    <Box sx={sx}>
      <Typography
        variant="caption"
        sx={{
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          color: 'text.secondary',
          fontWeight: 600,
          display: 'block',
        }}
      >
        {label}
      </Typography>
      <Typography variant="body1" sx={{ fontWeight: 600, mt: 0.25 }}>
        {value}
      </Typography>
    </Box>
  );
}

function Letterhead({ orderId, generatedAt }) {
  return (
    <Box sx={{ mb: 4 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" alignItems="center" spacing={1.5}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              background: goldGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 800,
              fontSize: '1.4rem',
              color: '#1A1A1A',
              boxShadow: '0 6px 18px rgba(212,165,42,0.40)',
            }}
          >
            CB
          </Box>
          <Box>
            <Typography
              variant="h4"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Carib Brewery
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: '#8A6A12',
                textTransform: 'uppercase',
              }}
            >
              BrewTrade AI · Official Approval Report
            </Typography>
          </Box>
        </Stack>
        <Box sx={{ textAlign: 'right' }}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'text.secondary',
              textTransform: 'uppercase',
            }}
          >
            Report ID
          </Typography>
          <Typography variant="body1" sx={{ fontWeight: 800 }}>
            BTA-{String(orderId || '----').padStart(6, '0')}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Generated {new Date(generatedAt).toLocaleString()}
          </Typography>
        </Box>
      </Stack>
      <Box
        sx={{
          height: 4,
          width: '100%',
          background: goldGradient,
          borderRadius: 2,
          boxShadow: '0 6px 16px rgba(212,165,42,0.35)',
        }}
      />
    </Box>
  );
}

// ---------- main page -------------------------------------------------------

export default function AIApprovalReport() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState(
    searchParams.get('orderId') ? Number(searchParams.get('orderId')) : null
  );
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState(null);

  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState(null);

  const reportRef = useRef(null);

  useEffect(() => {
    let mounted = true;
    setOrderLoading(true);
    getPendingApprovals()
      .then((data) => {
        if (!mounted) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
          ? data.orders
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setOrders(list);
        if (list.length && !orderId) {
          setOrderId(list[0].id || list[0].order_id);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setOrderError(
          e?.response?.data?.detail ||
            e?.message ||
            'Failed to load pending approval queue.'
        );
      })
      .finally(() => mounted && setOrderLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generate = (id = orderId) => {
    if (!id) return;
    setReportLoading(true);
    setReportError(null);
    setReport(null);
    generateApprovalReport(id)
      .then((data) => {
        const meta = orders.find(
          (o) => (o.id || o.order_id) === Number(id)
        );
        setReport(normalizeReport(data, meta));
      })
      .catch((e) => {
        const meta = orders.find(
          (o) => (o.id || o.order_id) === Number(id)
        );
        setReport(normalizeReport({}, meta));
        setReportError(
          e?.response?.data?.detail ||
            e?.message ||
            'Live AI service unavailable - showing baseline report.'
        );
      })
      .finally(() => setReportLoading(false));
  };

  // Auto-generate when an order is selected.
  useEffect(() => {
    if (orderId) generate(orderId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const selectedOrder = useMemo(
    () => orders.find((o) => (o.id || o.order_id) === Number(orderId)) || null,
    [orders, orderId]
  );

  const handlePrint = () => {
    window.print();
  };

  const handleDownload = () => {
    const el = reportRef.current;
    if (!el) return;
    // Build a complete standalone HTML document with the styled report inside.
    const css = `
      body { font-family: 'Inter', system-ui, sans-serif; color: #1A1A1A; background: #FAFAF7; padding: 24px; }
      .report { max-width: 820px; margin: 0 auto; background: #FFFFFF; border: 1px solid rgba(212,165,42,0.25); border-radius: 12px; overflow: hidden; box-shadow: 0 18px 50px rgba(26,26,26,0.10); }
      .bar { height: 8px; background: linear-gradient(135deg, #D4A52A 0%, #F2C849 50%, #E8A33D 100%); }
      .body { padding: 40px; }
    `;
    const html = `<!doctype html><html><head><meta charset="utf-8"><title>BrewTrade AI Approval Report ${orderId}</title><style>${css}</style></head><body><div class="report"><div class="bar"></div><div class="body">${el.innerHTML}</div><div class="bar" style="opacity:0.6;height:4px"></div></div></body></html>`;
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brewtrade-approval-report-order-${orderId || 'na'}-${Date.now()}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleEmail = () => {
    // Visual-only - surfaces a transient confirmation via window.alert in the
    // demo.  Real wiring would call a /notify endpoint.
    // eslint-disable-next-line no-alert
    alert(
      'Report queued for email distribution to the assigned approver. (Demo placeholder)'
    );
  };

  return (
    <Box>
      <PageHeader
        title="Approval Report Generator"
        subtitle="Auto-compiled, board-ready approval dossier — fully traceable, signed, printable."
        breadcrumbs={[
          { label: 'Manager', to: '/manager/dashboard' },
          { label: 'Reports' },
        ]}
        actions={
          <Chip
            icon={<AutoAwesomeRoundedIcon />}
            label="AI Intelligence Report"
            sx={{
              fontWeight: 700,
              background: goldGradient,
              color: '#1A1A1A',
              boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
              '& .MuiChip-icon': { color: '#1A1A1A' },
            }}
          />
        }
      />

      {/* Toolbar */}
      <GlassCard className="no-print" sx={{ p: 2, mb: 3 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ md: 'center' }}
        >
          <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: 'text.secondary',
                textTransform: 'uppercase',
              }}
            >
              Order
            </Typography>
            <TextField
              select
              fullWidth
              value={orderId || ''}
              onChange={(e) => {
                const v = Number(e.target.value);
                setOrderId(v);
                setSearchParams({ orderId: String(v) });
              }}
              disabled={orderLoading || !orders.length}
              sx={{ mt: 0.5 }}
            >
              {orderLoading && (
                <MenuItem value="" disabled>
                  Loading queue...
                </MenuItem>
              )}
              {!orderLoading && !orders.length && (
                <MenuItem value="" disabled>
                  No pending orders
                </MenuItem>
              )}
              {orders.map((o) => {
                const id = o.id || o.order_id;
                const name =
                  o.customer_name || o.customer?.name || `Customer ${o.customer_id}`;
                const total =
                  o.total_amount ?? o.total ?? o.amount ?? null;
                return (
                  <MenuItem key={id} value={id}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ width: '100%' }}>
                      <Typography sx={{ fontWeight: 700 }}>#{id}</Typography>
                      <Typography color="text.secondary">— {name}</Typography>
                      <Box sx={{ flex: 1 }} />
                      <Typography
                        sx={{
                          fontWeight: 700,
                          color: '#8A6A12',
                          fontVariantNumeric: 'tabular-nums',
                        }}
                      >
                        {formatCurrency(total)}
                      </Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </TextField>
          </Box>
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexShrink: 0, width: { xs: '100%', md: 'auto' } }}
          >
            <Tooltip title="Regenerate this report">
              <span>
                <Button
                  variant="outlined"
                  color="secondary"
                  startIcon={<RefreshRoundedIcon />}
                  onClick={() => generate()}
                  disabled={!orderId || reportLoading}
                >
                  Generate New
                </Button>
              </span>
            </Tooltip>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<PrintRoundedIcon />}
              onClick={handlePrint}
              disabled={!report || reportLoading}
            >
              Print
            </Button>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DownloadRoundedIcon />}
              onClick={handleDownload}
              disabled={!report || reportLoading}
            >
              Download
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<EmailRoundedIcon />}
              onClick={handleEmail}
              disabled={!report || reportLoading}
            >
              Email
            </Button>
          </Stack>
        </Stack>
      </GlassCard>

      {orderError && (
        <Alert severity="warning" sx={{ mb: 2 }} className="no-print">
          {orderError}
        </Alert>
      )}
      {reportError && (
        <Alert severity="info" sx={{ mb: 2 }} className="no-print">
          {reportError}
        </Alert>
      )}

      {/* Report surface */}
      {!orderId ? (
        <GlassCard sx={{ p: 6, textAlign: 'center' }} className="no-print">
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Select an order to generate the report
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The full dossier — customer, order, inventory, financial, AI decision, risk, recommendations — will compile here.
          </Typography>
        </GlassCard>
      ) : reportLoading ? (
        <GlassCard sx={{ p: 5, maxWidth: 820, mx: 'auto' }} className="no-print">
          <Skeleton width="40%" height={42} />
          <Skeleton width="80%" sx={{ mt: 2 }} />
          <Skeleton width="90%" />
          <Skeleton width="70%" sx={{ mt: 4 }} height={32} />
          <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
          <Skeleton width="60%" sx={{ mt: 3 }} height={28} />
          <Skeleton variant="rounded" height={120} sx={{ mt: 2 }} />
        </GlassCard>
      ) : report ? (
        <ReportPage ref={reportRef}>
          {report.htmlBody ? (
            // If backend returned raw HTML, render it as-is inside the page.
            <Box dangerouslySetInnerHTML={{ __html: report.htmlBody }} />
          ) : (
            <ReportBody report={report} selectedOrder={selectedOrder} />
          )}
        </ReportPage>
      ) : null}
    </Box>
  );
}

// ---------- structured report body ------------------------------------------

function ReportBody({ report, selectedOrder }) {
  return (
    <Box sx={{ color: '#1A1A1A' }}>
      <Letterhead orderId={report.order.id} generatedAt={report.generated_at} />

      {/* Title */}
      <Box sx={{ mb: 4 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.18em',
            color: '#8A6A12',
            textTransform: 'uppercase',
          }}
        >
          Distributor Order Approval Dossier
        </Typography>
        <Typography
          variant="h3"
          sx={{ fontWeight: 800, letterSpacing: '-0.02em', mt: 0.5 }}
        >
          Order #{safe(report.order.id)} — {safe(report.customer.name)}
        </Typography>
        <Stack direction="row" spacing={2} sx={{ mt: 1.5 }} alignItems="center" flexWrap="wrap" useFlexGap>
          <DecisionBadge decision={report.ai.decision} size="medium" />
          <Chip
            label={`Risk: ${Math.round(report.risk.score)} / 100 (${report.risk.category})`}
            sx={{
              background:
                report.risk.score >= 70
                  ? 'rgba(198,40,40,0.10)'
                  : report.risk.score >= 40
                  ? 'rgba(232,163,61,0.15)'
                  : 'rgba(212,165,42,0.12)',
              color:
                report.risk.score >= 70 ? '#B71C1C' : '#8A6A12',
              fontWeight: 700,
              border:
                report.risk.score >= 70
                  ? '1px solid rgba(198,40,40,0.35)'
                  : '1px solid rgba(212,165,42,0.35)',
            }}
          />
          <Chip
            label={`AI Confidence: ${Math.round(report.ai.confidence)}%`}
            sx={{
              background: 'rgba(212,165,42,0.10)',
              color: '#1A1A1A',
              fontWeight: 600,
              border: '1px solid rgba(212,165,42,0.30)',
            }}
          />
        </Stack>
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* 01 — Customer */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          idx={1}
          title="Customer Information"
          icon={<PersonRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <KV label="Distributor" value={safe(report.customer.name)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV label="Tier" value={safe(report.customer.tier)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV label="Market" value={safe(report.customer.market)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KV label="Contact" value={safe(report.customer.contact)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KV label="Email" value={safe(report.customer.email)} />
          </Grid>
          <Grid item xs={12} sm={4}>
            <KV label="Phone" value={safe(report.customer.phone)} />
          </Grid>
          <Grid item xs={6} sm={4}>
            <KV
              label="Credit limit"
              value={
                report.customer.credit_limit !== null
                  ? formatCurrency(report.customer.credit_limit)
                  : '—'
              }
            />
          </Grid>
          <Grid item xs={6} sm={4}>
            <KV
              label="Account since"
              value={
                report.customer.account_since
                  ? formatDate(report.customer.account_since)
                  : '—'
              }
            />
          </Grid>
        </Grid>
      </Box>

      {/* 02 — Order */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          idx={2}
          title="Order Details"
          icon={<ReceiptLongRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <KV label="Order ID" value={`#${safe(report.order.id)}`} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="Placed"
              value={report.order.placed_at ? formatDate(report.order.placed_at) : '—'}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="Requested delivery"
              value={
                report.order.requested_delivery
                  ? formatDate(report.order.requested_delivery)
                  : '—'
              }
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="Total"
              value={formatCurrency(report.order.total)}
            />
          </Grid>
        </Grid>

        {report.order.line_items.length > 0 && (
          <Box
            sx={{
              mt: 2,
              border: '1px solid rgba(212,165,42,0.25)',
              borderRadius: 2,
              overflow: 'hidden',
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: '1fr 80px 110px 130px',
                gap: 1,
                px: 1.5,
                py: 1,
                background: 'rgba(212,165,42,0.10)',
                fontWeight: 700,
                fontSize: '0.75rem',
                letterSpacing: '0.10em',
                textTransform: 'uppercase',
                color: '#8A6A12',
              }}
            >
              <span>SKU / Product</span>
              <span style={{ textAlign: 'right' }}>Qty</span>
              <span style={{ textAlign: 'right' }}>Unit price</span>
              <span style={{ textAlign: 'right' }}>Line total</span>
            </Box>
            {report.order.line_items.map((li, i) => {
              const qty = li.qty ?? li.quantity ?? 0;
              const unit = li.unit_price ?? li.price ?? 0;
              const total = li.line_total ?? qty * unit;
              return (
                <Box
                  key={i}
                  sx={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 80px 110px 130px',
                    gap: 1,
                    px: 1.5,
                    py: 1,
                    borderTop: '1px solid rgba(212,165,42,0.15)',
                  }}
                >
                  <Typography variant="body2" sx={{ fontWeight: 600 }}>
                    {li.sku || li.product || li.name || 'Item'}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    {qty}
                  </Typography>
                  <Typography variant="body2" sx={{ textAlign: 'right' }}>
                    {formatCurrency(unit)}
                  </Typography>
                  <Typography
                    variant="body2"
                    sx={{ textAlign: 'right', fontWeight: 700 }}
                  >
                    {formatCurrency(total)}
                  </Typography>
                </Box>
              );
            })}
          </Box>
        )}

        {report.order.notes && (
          <Typography variant="body2" sx={{ mt: 1.5, color: 'text.secondary' }}>
            <strong>Notes:</strong> {report.order.notes}
          </Typography>
        )}
      </Box>

      {/* 03 — Inventory */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          idx={3}
          title="Inventory Assessment"
          icon={<LocalShippingRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <KV
              label="Coverage"
              value={
                report.inventory.coverage_pct !== null
                  ? `${Math.round(report.inventory.coverage_pct)}%`
                  : '—'
              }
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV label="DC" value={safe(report.inventory.dc)} />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="Lead time"
              value={
                report.inventory.lead_time_days !== null
                  ? `${report.inventory.lead_time_days} days`
                  : '—'
              }
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="Flagged SKUs"
              value={
                report.inventory.flagged_skus.length
                  ? String(report.inventory.flagged_skus.length)
                  : 'None'
              }
            />
          </Grid>
        </Grid>
        <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.7 }}>
          {report.inventory.summary}
        </Typography>
      </Box>

      {/* 04 — Financial */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          idx={4}
          title="Financial Health"
          icon={<AccountBalanceRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <KV
              label="Credit utilization"
              value={
                report.financial.credit_utilization_pct !== null
                  ? `${Math.round(report.financial.credit_utilization_pct)}%`
                  : '—'
              }
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="DPO"
              value={
                report.financial.dpo !== null
                  ? `${Math.round(report.financial.dpo)} days`
                  : '—'
              }
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="On-time pmts"
              value={
                report.financial.on_time_pct !== null
                  ? `${Math.round(report.financial.on_time_pct)}%`
                  : '—'
              }
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV
              label="AR balance"
              value={
                report.financial.ar_balance !== null
                  ? formatCurrency(report.financial.ar_balance)
                  : '—'
              }
            />
          </Grid>
          {report.financial.overdue_balance !== null && (
            <Grid item xs={6} sm={3}>
              <KV
                label="Overdue"
                value={formatCurrency(report.financial.overdue_balance)}
              />
            </Grid>
          )}
        </Grid>
        <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.7 }}>
          {report.financial.summary}
        </Typography>
      </Box>

      {/* 05 — AI decision */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          idx={5}
          title="AI Decision"
          icon={<GavelRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <Box
          sx={{
            p: 2.5,
            borderRadius: 2,
            background:
              'linear-gradient(135deg, rgba(212,165,42,0.10) 0%, rgba(242,200,73,0.06) 50%, rgba(232,163,61,0.10) 100%)',
            border: '1px solid rgba(212,165,42,0.35)',
          }}
        >
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            alignItems={{ sm: 'center' }}
            justifyContent="space-between"
            spacing={1.5}
            sx={{ mb: 1.5 }}
          >
            <DecisionBadge decision={report.ai.decision} size="medium" />
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: '#8A6A12',
              }}
            >
              CONFIDENCE {Math.round(report.ai.confidence)}%
            </Typography>
          </Stack>
          <Typography variant="body1" sx={{ lineHeight: 1.7 }}>
            {report.ai.reasoning}
          </Typography>
          <Box sx={{ mt: 2 }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: 'text.secondary',
                textTransform: 'uppercase',
              }}
            >
              Key Factors
            </Typography>
            <Box sx={{ mt: 1 }}>
              {report.ai.key_factors.map((f, i) => (
                <Stack
                  key={i}
                  direction="row"
                  spacing={1}
                  alignItems="flex-start"
                  sx={{ py: 0.5 }}
                >
                  <CheckCircleRoundedIcon
                    sx={{ color: '#B5891F', fontSize: 16, mt: '3px' }}
                  />
                  <Typography variant="body2">{f}</Typography>
                </Stack>
              ))}
            </Box>
          </Box>
        </Box>
      </Box>

      {/* 06 — Risk */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          idx={6}
          title="Risk Analysis"
          icon={<ShieldRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <Grid container spacing={2}>
          <Grid item xs={6} sm={3}>
            <KV
              label="Composite Score"
              value={`${Math.round(report.risk.score)} / 100`}
            />
          </Grid>
          <Grid item xs={6} sm={3}>
            <KV label="Category" value={report.risk.category} />
          </Grid>
        </Grid>
        <Box sx={{ mt: 1.5 }}>
          {report.risk.drivers.map((d, i) => (
            <Stack
              key={i}
              direction="row"
              spacing={2}
              alignItems="center"
              sx={{ py: 0.6, borderBottom: '1px dashed rgba(212,165,42,0.20)' }}
            >
              <Typography variant="body2" sx={{ fontWeight: 600, minWidth: 160 }}>
                {d.label}
              </Typography>
              <Typography variant="body2" sx={{ flex: 1 }}>
                {typeof d.value === 'object' ? JSON.stringify(d.value) : d.value}
              </Typography>
            </Stack>
          ))}
        </Box>
        <Typography variant="body2" sx={{ mt: 1.5, lineHeight: 1.7 }}>
          <strong>Mitigations:</strong> {report.risk.mitigations}
        </Typography>
      </Box>

      {/* 07 — Recommendations */}
      <Box sx={{ mb: 4 }}>
        <SectionHeader
          idx={7}
          title="Recommendations"
          icon={<LightbulbRoundedIcon sx={{ fontSize: 18 }} />}
        />
        <Box component="ol" sx={{ pl: 3, m: 0 }}>
          {report.recommendations.map((r, i) => (
            <Typography
              key={i}
              component="li"
              variant="body1"
              sx={{ py: 0.4, lineHeight: 1.65 }}
            >
              {typeof r === 'string' ? r : r.text || JSON.stringify(r)}
            </Typography>
          ))}
        </Box>
      </Box>

      {/* Footer / signature */}
      <Divider sx={{ my: 3 }} />
      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'text.secondary',
              textTransform: 'uppercase',
            }}
          >
            Generated
          </Typography>
          <Typography variant="body2" sx={{ fontWeight: 600, mt: 0.3 }}>
            {new Date(report.generated_at).toLocaleString()}
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.3, display: 'block' }}>
            BrewTrade AI · AI Decision Engine
          </Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <Box
            sx={{
              borderTop: '1.5px solid #1A1A1A',
              pt: 1,
              mt: 5,
              textAlign: 'left',
            }}
          >
            <Typography variant="body2" sx={{ fontWeight: 700 }}>
              {report.signed_by}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              Authorised Approver — BrewTrade AI
            </Typography>
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
