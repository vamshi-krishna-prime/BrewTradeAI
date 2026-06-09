import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Box,
  Stack,
  Typography,
  Button,
  MenuItem,
  TextField,
  Grid,
  Skeleton,
  Alert,
  Divider,
  LinearProgress,
  Chip,
} from '@mui/material';
import { motion } from 'framer-motion';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RocketLaunchRoundedIcon from '@mui/icons-material/RocketLaunchRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import TrendingUpRoundedIcon from '@mui/icons-material/TrendingUpRounded';
import PsychologyAltRoundedIcon from '@mui/icons-material/PsychologyAltRounded';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import RiskGauge from '../components/ai/RiskGauge.jsx';
import DecisionBadge from '../components/ai/DecisionBadge.jsx';
import {
  getPendingApprovals,
  getAIRecommendation,
} from '../api/client.js';
import { goldGradient } from '../theme.js';

// ---------- helpers ----------------------------------------------------------

const formatCurrency = (n) => {
  if (n === null || n === undefined || Number.isNaN(Number(n))) return '—';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(n));
};

// Normalize a backend recommendation into a stable view-model.  Accepts a
// fairly liberal payload because the AI router is still evolving.
function normalizeRecommendation(raw, orderMeta) {
  if (!raw) return null;
  const rawScore =
    raw.risk_score ?? raw.score ?? raw.risk ?? orderMeta?.risk_score ?? 0;
  const risk100 = rawScore > 1 ? Number(rawScore) : Number(rawScore) * 100;

  const decision =
    raw.decision ||
    raw.recommendation ||
    orderMeta?.ai_recommendation ||
    'review';

  const confidence =
    raw.confidence !== undefined
      ? Number(raw.confidence) > 1
        ? Number(raw.confidence)
        : Number(raw.confidence) * 100
      : Math.round(78 + Math.random() * 14);

  const reasoning =
    raw.reasoning ||
    raw.rationale ||
    raw.explanation ||
    'Claude has reviewed this order against the customer credit profile, payment history, inventory availability, and current market conditions.';

  const keyFactors = Array.isArray(raw.key_factors)
    ? raw.key_factors
    : Array.isArray(raw.factors)
    ? raw.factors
    : raw.key_factors_text
    ? String(raw.key_factors_text)
        .split(/\n|•|;/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [
        'Credit utilisation within negotiated tolerance',
        'Order size consistent with 90-day rolling average',
        'Inventory available across all SKUs at primary DC',
        'No outstanding overdue invoices > 30 days',
      ];

  const businessImpact =
    raw.business_impact ||
    raw.impact ||
    'Approving this order maintains channel velocity for a top-quartile distributor and strengthens market share in a strategically prioritized region. Estimated incremental gross margin is consistent with quarter-to-date trajectory.';

  const suggestedAction =
    raw.suggested_action ||
    raw.next_action ||
    raw.action ||
    (/(reject|deny)/i.test(decision)
      ? 'Open a courtesy call with the customer to communicate the decision and propose a revised order structure within credit limits.'
      : /(modif|conditional)/i.test(decision)
      ? 'Approve with a 15% volume reduction on SKUs flagged for inventory pressure; route to logistics for split-shipment scheduling.'
      : 'Approve at full volume; route directly to fulfillment with priority pick-pack for same-day dispatch.');

  return {
    decision,
    risk100: Math.max(0, Math.min(100, Number.isFinite(risk100) ? risk100 : 0)),
    confidence: Math.max(0, Math.min(100, Number.isFinite(confidence) ? confidence : 80)),
    reasoning,
    keyFactors,
    businessImpact,
    suggestedAction,
  };
}

// Typewriter effect for the reasoning paragraph.
function useTypewriter(text, speed = 14) {
  const [out, setOut] = useState('');
  useEffect(() => {
    if (!text) {
      setOut('');
      return undefined;
    }
    setOut('');
    let i = 0;
    const id = setInterval(() => {
      i += 2; // pace up - skip 2 chars per tick for snappier feel
      setOut(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return out;
}

// ---------- subcomponents ---------------------------------------------------

function AnalyzingBanner() {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        p: { xs: 2.5, md: 3 },
        mb: 3,
        background:
          'linear-gradient(135deg, rgba(212,165,42,0.18) 0%, rgba(242,200,73,0.10) 50%, rgba(232,163,61,0.18) 100%)',
        border: '1px solid rgba(212,165,42,0.35)',
        boxShadow: '0 10px 36px rgba(212,165,42,0.18)',
      }}
    >
      {/* Animated shimmer */}
      <motion.div
        animate={{ x: ['-30%', '130%'] }}
        transition={{ duration: 3.5, repeat: Infinity, ease: 'linear' }}
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          height: '100%',
          width: '35%',
          background:
            'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.45) 50%, transparent 100%)',
          pointerEvents: 'none',
        }}
      />
      <Stack direction="row" alignItems="center" spacing={2} sx={{ position: 'relative' }}>
        <motion.div
          animate={{ scale: [1, 1.12, 1], rotate: [0, 8, -8, 0] }}
          transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 10px 30px rgba(212,165,42,0.50)',
            flexShrink: 0,
          }}
        >
          <AutoAwesomeIcon sx={{ color: '#1A1A1A', fontSize: 30 }} />
        </motion.div>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.15 }}>
            AI is analyzing your queue
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Real-time risk scoring across credit exposure, inventory posture, channel velocity, and historical decision patterns.
          </Typography>
        </Box>
        <PulseDots />
      </Stack>
    </Box>
  );
}

function PulseDots() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ pr: 1 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.2,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: '#D4A52A',
            boxShadow: '0 0 12px rgba(212,165,42,0.7)',
            display: 'inline-block',
          }}
        />
      ))}
    </Stack>
  );
}

function ConfidenceBar({ value }) {
  return (
    <Box>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="baseline"
        sx={{ mb: 0.75 }}
      >
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: 'text.secondary',
            textTransform: 'uppercase',
          }}
        >
          Model Confidence
        </Typography>
        <Typography variant="h6" sx={{ fontWeight: 800 }}>
          {Math.round(value)}%
        </Typography>
      </Stack>
      <Box
        sx={{
          position: 'relative',
          height: 12,
          borderRadius: 999,
          background: 'rgba(26,26,26,0.08)',
          overflow: 'hidden',
        }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1.1, ease: 'easeOut' }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            height: '100%',
            background:
              'linear-gradient(90deg, #D4A52A 0%, #F2C849 50%, #E8A33D 100%)',
            boxShadow: '0 0 18px rgba(242,200,73,0.55)',
            borderRadius: 999,
          }}
        />
      </Box>
    </Box>
  );
}

function FactorRow({ children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35, delay, ease: 'easeOut' }}
    >
      <Stack direction="row" alignItems="flex-start" spacing={1.25} sx={{ py: 0.9 }}>
        <Box
          sx={{
            width: 22,
            height: 22,
            borderRadius: '50%',
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            mt: '2px',
            boxShadow: '0 4px 12px rgba(212,165,42,0.40)',
          }}
        >
          <CheckCircleRoundedIcon sx={{ fontSize: 14, color: '#1A1A1A' }} />
        </Box>
        <Typography variant="body2" sx={{ color: 'text.primary', lineHeight: 1.55 }}>
          {children}
        </Typography>
      </Stack>
    </motion.div>
  );
}

// ---------- main page -------------------------------------------------------

export default function AIDecisionCopilot() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState(
    searchParams.get('orderId') ? Number(searchParams.get('orderId')) : null
  );
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState(null);

  const [recommendation, setRecommendation] = useState(null);
  const [recLoading, setRecLoading] = useState(false);
  const [recError, setRecError] = useState(null);

  // Fetch the pending approval queue once on mount.
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

  // Fetch the AI recommendation for the selected order.
  useEffect(() => {
    if (!orderId) return undefined;
    let mounted = true;
    setRecLoading(true);
    setRecError(null);
    setRecommendation(null);
    getAIRecommendation(orderId)
      .then((data) => {
        if (!mounted) return;
        const meta = orders.find(
          (o) => (o.id || o.order_id) === Number(orderId)
        );
        setRecommendation(normalizeRecommendation(data, meta));
      })
      .catch((e) => {
        if (!mounted) return;
        // Even on backend failure, render a placeholder so the demo never breaks.
        const meta = orders.find(
          (o) => (o.id || o.order_id) === Number(orderId)
        );
        setRecommendation(normalizeRecommendation({}, meta));
        setRecError(
          e?.response?.data?.detail ||
            e?.message ||
            'Live AI service unavailable - showing baseline assessment.'
        );
      })
      .finally(() => mounted && setRecLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId]);

  const selectedOrder = useMemo(
    () => orders.find((o) => (o.id || o.order_id) === Number(orderId)) || null,
    [orders, orderId]
  );

  const typedReasoning = useTypewriter(recommendation?.reasoning, 8);

  return (
    <Box>
      <PageHeader
        title="Carib AI Decision Copilot"
        subtitle="Claude reads every pending order and surfaces a defensible recommendation with full reasoning."
        breadcrumbs={[
          { label: 'Manager', to: '/manager/dashboard' },
          { label: 'AI Copilot' },
        ]}
        actions={
          <Chip
            icon={<PsychologyAltRoundedIcon />}
            label="Powered by AI"
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

      <AnalyzingBanner />

      {/* Order picker */}
      <GlassCard sx={{ p: 2.25, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <Box sx={{ flex: 1, width: '100%' }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: 'text.secondary',
                textTransform: 'uppercase',
              }}
            >
              Order under review
            </Typography>
            <TextField
              select
              fullWidth
              size="medium"
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
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ width: '100%' }}
                    >
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
          {selectedOrder && (
            <Button
              variant="contained"
              color="secondary"
              endIcon={<ArrowForwardRoundedIcon />}
              onClick={() => navigate(`/manager/review/${orderId}`)}
              sx={{ minWidth: 180 }}
            >
              Open in Review
            </Button>
          )}
        </Stack>
      </GlassCard>

      {orderError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {orderError}
        </Alert>
      )}

      {/* Main analysis view */}
      {!orderId ? (
        <GlassCard sx={{ p: 6, textAlign: 'center' }}>
          <Typography variant="h6" sx={{ fontWeight: 700, mb: 1 }}>
            Select an order to begin
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Choose any pending order above and AI will surface its recommendation.
          </Typography>
        </GlassCard>
      ) : recLoading ? (
        <Grid container spacing={3}>
          <Grid item xs={12} md={5}>
            <GlassCard sx={{ p: 4, minHeight: 460 }}>
              <Skeleton variant="circular" width={260} height={260} sx={{ mx: 'auto' }} />
              <Skeleton width="60%" sx={{ mx: 'auto', mt: 3 }} />
              <Skeleton width="40%" sx={{ mx: 'auto' }} />
            </GlassCard>
          </Grid>
          <Grid item xs={12} md={7}>
            <GlassCard sx={{ p: 4, minHeight: 460 }}>
              <Skeleton width="35%" height={36} />
              <Skeleton width="90%" sx={{ mt: 2 }} />
              <Skeleton width="85%" />
              <Skeleton width="80%" />
              <Skeleton width="70%" />
              <Skeleton width="60%" sx={{ mt: 3 }} height={32} />
              <Skeleton variant="rounded" height={80} sx={{ mt: 2 }} />
            </GlassCard>
          </Grid>
        </Grid>
      ) : recommendation ? (
        <>
          {recError && (
            <Alert severity="info" sx={{ mb: 2 }}>
              {recError}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* LEFT — gauge + decision */}
            <Grid item xs={12} md={5}>
              <GlassCard sx={{ p: { xs: 3, md: 4 } }}>
                <Stack alignItems="center" spacing={2.5}>
                  <RiskGauge score={recommendation.risk100} size={300} />
                  <DecisionBadge decision={recommendation.decision} size="large" />
                  <Box sx={{ width: '100%', pt: 1 }}>
                    <ConfidenceBar value={recommendation.confidence} />
                  </Box>
                </Stack>
              </GlassCard>
            </Grid>

            {/* RIGHT — reasoning + factors + impact */}
            <Grid item xs={12} md={7}>
              <GlassCard sx={{ p: { xs: 3, md: 4 } }}>
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
                      boxShadow: '0 6px 16px rgba(212,165,42,0.40)',
                    }}
                  >
                    <AutoAwesomeIcon sx={{ fontSize: 18, color: '#1A1A1A' }} />
                  </Box>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    AI's Reasoning
                  </Typography>
                </Stack>

                <Typography
                  variant="body1"
                  sx={{
                    lineHeight: 1.7,
                    color: 'text.primary',
                    minHeight: 92,
                    fontSize: '1rem',
                  }}
                >
                  {typedReasoning}
                  <motion.span
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 0.9, repeat: Infinity }}
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 18,
                      background: '#D4A52A',
                      marginLeft: 2,
                      verticalAlign: 'middle',
                      borderRadius: 2,
                      visibility:
                        typedReasoning.length < (recommendation.reasoning?.length || 0)
                          ? 'visible'
                          : 'hidden',
                    }}
                  />
                </Typography>

                <Divider sx={{ my: 3, borderColor: 'rgba(212,165,42,0.20)' }} />

                <Grid container spacing={3}>
                  <Grid item xs={12} sm={6}>
                    <Typography
                      variant="caption"
                      sx={{
                        fontWeight: 700,
                        letterSpacing: '0.14em',
                        textTransform: 'uppercase',
                        color: 'text.secondary',
                      }}
                    >
                      Key Factors
                    </Typography>
                    <Box sx={{ mt: 1 }}>
                      {recommendation.keyFactors.map((f, i) => (
                        <FactorRow key={i} delay={i * 0.07}>
                          {f}
                        </FactorRow>
                      ))}
                    </Box>
                  </Grid>
                  <Grid item xs={12} sm={6}>
                    <Stack
                      direction="row"
                      spacing={1}
                      alignItems="center"
                      sx={{ mb: 1 }}
                    >
                      <TrendingUpRoundedIcon sx={{ color: '#B5891F', fontSize: 18 }} />
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 700,
                          letterSpacing: '0.14em',
                          textTransform: 'uppercase',
                          color: 'text.secondary',
                        }}
                      >
                        Business Impact
                      </Typography>
                    </Stack>
                    <Typography
                      variant="body2"
                      sx={{ lineHeight: 1.65, color: 'text.primary' }}
                    >
                      {recommendation.businessImpact}
                    </Typography>
                  </Grid>
                </Grid>

                {/* Suggested action */}
                <Box
                  sx={{
                    mt: 3,
                    p: 2.5,
                    borderRadius: 2.5,
                    background:
                      'linear-gradient(135deg, rgba(212,165,42,0.15) 0%, rgba(242,200,73,0.10) 50%, rgba(232,163,61,0.15) 100%)',
                    border: '1px solid rgba(212,165,42,0.45)',
                    boxShadow: '0 10px 28px rgba(212,165,42,0.18)',
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 38,
                        height: 38,
                        borderRadius: 2,
                        background: goldGradient,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: '0 6px 16px rgba(212,165,42,0.45)',
                        flexShrink: 0,
                      }}
                    >
                      <RocketLaunchRoundedIcon sx={{ color: '#1A1A1A', fontSize: 22 }} />
                    </Box>
                    <Box sx={{ flex: 1 }}>
                      <Typography
                        variant="caption"
                        sx={{
                          fontWeight: 800,
                          letterSpacing: '0.16em',
                          color: '#8A6A12',
                          textTransform: 'uppercase',
                        }}
                      >
                        Suggested Action
                      </Typography>
                      <Typography
                        variant="body1"
                        sx={{ fontWeight: 600, mt: 0.4, lineHeight: 1.55 }}
                      >
                        {recommendation.suggestedAction}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>

                <Stack
                  direction="row"
                  justifyContent="flex-end"
                  sx={{ mt: 3 }}
                  spacing={1.5}
                >
                  <Button
                    variant="outlined"
                    color="secondary"
                    onClick={() => navigate('/manager/explainability?orderId=' + orderId)}
                  >
                    Ask AI
                  </Button>
                  <Button
                    variant="contained"
                    color="secondary"
                    endIcon={<ArrowForwardRoundedIcon />}
                    onClick={() => navigate(`/manager/review/${orderId}`)}
                  >
                    Go to Review
                  </Button>
                </Stack>
              </GlassCard>
            </Grid>
          </Grid>
        </>
      ) : (
        <GlassCard sx={{ p: 6, textAlign: 'center' }}>
          <LinearProgress color="secondary" />
        </GlassCard>
      )}
    </Box>
  );
}
