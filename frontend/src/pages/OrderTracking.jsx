import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Divider,
  Avatar,
  Tooltip,
  CircularProgress,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassTopIcon from '@mui/icons-material/HourglassTop';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import InventoryIcon from '@mui/icons-material/Inventory';
import SendIcon from '@mui/icons-material/Send';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import CancelIcon from '@mui/icons-material/Cancel';
import PersonIcon from '@mui/icons-material/Person';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import {
  getOrder,
  getOrderTracking,
  askAIAboutOrder,
} from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import { goldGradient, goldGradientSoft } from '../theme.js';

const MotionBox = motion(Box);

const STEP_KEYS = [
  'submitted',
  'pending_approval',
  'approved',
  'processing',
  'shipped',
  'delivered',
];

const STEP_META = {
  submitted: { label: 'Submitted', icon: <ReceiptLongIcon /> },
  pending_approval: { label: 'Pending Approval', icon: <HourglassTopIcon /> },
  approved: { label: 'Approved', icon: <FactCheckIcon /> },
  processing: { label: 'Processing', icon: <InventoryIcon /> },
  shipped: { label: 'Shipped', icon: <SendIcon /> },
  delivered: { label: 'Delivered', icon: <CheckCircleIcon /> },
};

// Statuses for which the AI insights panel should be visible.
const AI_INSIGHT_STATUSES = new Set([
  'pending_approval',
  'approved',
  'processing',
  'shipped',
  'delivered',
  'rejected',
]);

function statusLabel(s) {
  if (!s) return '—';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function OrderTracking() {
  const { id } = useParams();
  const orderId = Number(id);
  const navigate = useNavigate();

  const trackingQuery = useQuery({
    queryKey: ['order-tracking', orderId],
    queryFn: () => getOrderTracking(orderId),
    enabled: Number.isFinite(orderId),
  });

  const orderQuery = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => getOrder(orderId),
    enabled: Number.isFinite(orderId),
  });

  const [aiAnswer, setAiAnswer] = useState(null);
  const [aiQuestion, setAiQuestion] = useState(
    'Why is my order in this status?'
  );

  const aiMutation = useMutation({
    mutationFn: ({ question }) => askAIAboutOrder(orderId, question),
    onSuccess: (data) => {
      // Normalise a few shapes the AI service might return.
      const text =
        data?.answer ||
        data?.explanation ||
        data?.text ||
        data?.message ||
        (typeof data === 'string' ? data : null);
      setAiAnswer(text || JSON.stringify(data, null, 2));
    },
    onError: (err) => {
      setAiAnswer(
        `Sorry — I couldn't fetch an explanation right now. (${
          err?.response?.data?.detail || err?.message || 'unknown error'
        })`
      );
    },
  });

  const order = orderQuery.data;
  const tracking = trackingQuery.data;

  // Compute step states even if the API returns a slightly different shape.
  const steps = useMemo(() => {
    if (Array.isArray(tracking?.steps) && tracking.steps.length > 0) {
      // Backend already provided fully-decorated steps; just trim to canonical keys.
      const byKey = new Map();
      for (const s of tracking.steps) byKey.set(s.key, s);
      return STEP_KEYS.map((key, idx) => {
        const s = byKey.get(key) || {};
        return {
          key,
          label: s.label || STEP_META[key].label,
          icon: STEP_META[key].icon,
          state: s.state || 'pending',
          timestamp: s.timestamp || null,
          actor: s.actor || null,
          note: s.note || null,
          index: idx,
        };
      });
    }
    // Fallback if tracking is unavailable: derive from order.status alone.
    const currentIdx = STEP_KEYS.indexOf(order?.status);
    return STEP_KEYS.map((key, idx) => ({
      key,
      label: STEP_META[key].label,
      icon: STEP_META[key].icon,
      state:
        currentIdx === -1
          ? 'pending'
          : idx < currentIdx
          ? 'complete'
          : idx === currentIdx
          ? 'current'
          : 'pending',
      timestamp: null,
      actor: null,
      note: null,
      index: idx,
    }));
  }, [tracking, order]);

  const isRejected = order?.status === 'rejected';

  // Timeline (sorted history) - prefer order.status_history if richer, else tracking.steps.
  const timeline = useMemo(() => {
    const fromOrder = Array.isArray(order?.status_history)
      ? order.status_history
      : [];
    const fromTracking = Array.isArray(tracking?.steps)
      ? tracking.steps.filter((s) => s.timestamp)
      : [];
    const merged = fromOrder.length >= fromTracking.length ? fromOrder : fromTracking;
    return [...merged].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
  }, [order, tracking]);

  // Items + approved quantity comparison
  const itemRows = useMemo(() => {
    const items = Array.isArray(order?.items) ? order.items : [];
    return items.map((it) => {
      const requested = it.quantity_requested ?? it.quantity ?? 0;
      const approved =
        it.quantity_approved !== null && it.quantity_approved !== undefined
          ? it.quantity_approved
          : null;
      const modified = approved !== null && approved !== requested;
      return {
        id: it.id || it.order_item_id || `${it.product_id}-${requested}`,
        productId: it.product_id,
        name: it.name || it.product_name || (it.product && it.product.name) || `Product #${it.product_id}`,
        sku: it.sku || (it.product && it.product.sku) || null,
        imageUrl:
          it.image_url || (it.product && it.product.image_url) || null,
        category: it.category || (it.product && it.product.category) || null,
        unitPrice: it.unit_price || 0,
        lineTotal: it.line_total || (it.unit_price || 0) * requested,
        requested,
        approved,
        modified,
      };
    });
  }, [order]);

  const askAi = useCallback(
    (q) => {
      const question = (q || aiQuestion || '').trim();
      if (!question) return;
      aiMutation.mutate({ question });
    },
    [aiMutation, aiQuestion]
  );

  // Trigger an initial default-question call lazily when user opens panel.
  // We don't auto-fire on mount to avoid an unwanted POST.
  if (!Number.isFinite(orderId)) {
    return <Alert severity="error">Invalid order id.</Alert>;
  }

  const isLoading = trackingQuery.isLoading || orderQuery.isLoading;
  const isError = trackingQuery.isError && orderQuery.isError;

  return (
    <Box>
      <PageHeader
        title={
          order?.order_number ? `Order ${order.order_number}` : `Order #${orderId}`
        }
        subtitle="Real-time status tracking and approval timeline"
        breadcrumbs={[
          { label: 'Distributor', to: '/distributor/dashboard' },
          { label: 'My Orders', to: '/distributor/my-orders' },
          { label: order?.order_number || `#${orderId}` },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              startIcon={<ArrowBackIcon />}
              onClick={() => navigate('/distributor/my-orders')}
              variant="outlined"
              color="secondary"
              size="small"
            >
              Back
            </Button>
            <Button
              startIcon={<RefreshIcon />}
              onClick={() => {
                trackingQuery.refetch();
                orderQuery.refetch();
              }}
              variant="outlined"
              color="secondary"
              size="small"
            >
              Refresh
            </Button>
          </Stack>
        }
      />

      {isLoading && (
        <Box sx={{ p: 6, textAlign: 'center' }}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {isError && (
        <Alert severity="error">
          {trackingQuery.error?.response?.data?.detail ||
            orderQuery.error?.response?.data?.detail ||
            'Failed to load order.'}
        </Alert>
      )}

      {!isLoading && !isError && (
        <>
          {/* Top summary card */}
          <GlassCard sx={{ p: 3, mb: 3 }}>
            <Stack
              direction={{ xs: 'column', md: 'row' }}
              spacing={3}
              justifyContent="space-between"
              alignItems={{ md: 'center' }}
            >
              <Stack direction="row" spacing={2} alignItems="center">
                <Box
                  sx={{
                    width: 56,
                    height: 56,
                    borderRadius: 2,
                    background: goldGradient,
                    color: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 8px 22px rgba(212,165,42,0.45)',
                  }}
                >
                  <ReceiptLongIcon sx={{ fontSize: 30 }} />
                </Box>
                <Box>
                  <Typography variant="overline" color="text.secondary">
                    Order
                  </Typography>
                  <Typography variant="h5" sx={{ fontWeight: 800 }}>
                    {order?.order_number || `#${orderId}`}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Placed {formatDate(order?.created_at, 'MMM d, yyyy p')}
                  </Typography>
                </Box>
              </Stack>

              <SummaryStat
                label="Customer"
                value={
                  order?.customer?.name ||
                  order?.customer_name ||
                  `#${order?.customer_id || ''}`
                }
              />
              <SummaryStat
                label="Total"
                value={formatCurrency(order?.total_value)}
                strong
              />
              <SummaryStat
                label="Items"
                value={itemRows.length || 0}
              />
              <SummaryStat
                label="Status"
                value={
                  <Chip
                    label={statusLabel(order?.status)}
                    size="small"
                    sx={{
                      fontWeight: 800,
                      background: isRejected
                        ? 'rgba(198,40,40,0.12)'
                        : goldGradientSoft,
                      color: isRejected ? '#B71C1C' : '#1A1A1A',
                      border: isRejected
                        ? '1px solid rgba(198,40,40,0.4)'
                        : '1px solid rgba(212,165,42,0.35)',
                    }}
                  />
                }
              />
              <SummaryStat
                label="Expected Delivery"
                value={formatDate(order?.expected_delivery || tracking?.expected_delivery)}
              />
            </Stack>
          </GlassCard>

          {/* Stepper */}
          <GlassCard sx={{ p: { xs: 2, md: 3 }, mb: 3 }}>
            <HorizontalStepper steps={steps} rejected={isRejected} />
          </GlassCard>

          {/* Main two-column area */}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: 'minmax(0, 1fr) 1fr' },
              gap: 3,
              alignItems: 'flex-start',
            }}
          >
            {/* Timeline column */}
            <GlassCard sx={{ p: 3 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 2 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Status Timeline
                </Typography>
                <Chip
                  size="small"
                  label={`${timeline.length} update${timeline.length === 1 ? '' : 's'}`}
                  sx={{
                    background: goldGradientSoft,
                    border: '1px solid rgba(212,165,42,0.3)',
                  }}
                />
              </Stack>

              {timeline.length === 0 ? (
                <Typography variant="body2" color="text.secondary">
                  No status updates yet.
                </Typography>
              ) : (
                <Box sx={{ position: 'relative', pl: 3 }}>
                  {/* Vertical rail */}
                  <Box
                    sx={{
                      position: 'absolute',
                      left: 9,
                      top: 6,
                      bottom: 6,
                      width: 2,
                      background:
                        'linear-gradient(180deg, rgba(212,165,42,0.5), rgba(212,165,42,0.05))',
                    }}
                  />
                  <Stack spacing={2}>
                    <AnimatePresence initial>
                      {timeline.map((entry, i) => {
                        const isRejection = entry.status === 'rejected';
                        const accent = isRejection ? '#C62828' : '#D4A52A';
                        return (
                          <MotionBox
                            key={`${entry.status}-${entry.timestamp || i}`}
                            initial={{ opacity: 0, x: -8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ duration: 0.25, delay: i * 0.04 }}
                            sx={{ position: 'relative' }}
                          >
                            <Box
                              sx={{
                                position: 'absolute',
                                left: -23,
                                top: 4,
                                width: 16,
                                height: 16,
                                borderRadius: '50%',
                                background: isRejection ? '#C62828' : goldGradient,
                                border: '2px solid #fff',
                                boxShadow: `0 0 0 3px ${accent}33`,
                              }}
                            />
                            <Stack
                              direction="row"
                              justifyContent="space-between"
                              alignItems="flex-start"
                            >
                              <Box>
                                <Typography variant="body2" sx={{ fontWeight: 800 }}>
                                  {statusLabel(entry.status || entry.label)}
                                </Typography>
                                {entry.note && (
                                  <Typography
                                    variant="body2"
                                    color="text.secondary"
                                    sx={{ mt: 0.25 }}
                                  >
                                    {entry.note}
                                  </Typography>
                                )}
                                {entry.actor && (
                                  <Stack
                                    direction="row"
                                    spacing={0.5}
                                    alignItems="center"
                                    sx={{ mt: 0.5 }}
                                  >
                                    <PersonIcon
                                      sx={{ fontSize: 14, color: 'text.secondary' }}
                                    />
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                    >
                                      {entry.actor}
                                    </Typography>
                                  </Stack>
                                )}
                              </Box>
                              <Stack
                                direction="row"
                                spacing={0.5}
                                alignItems="center"
                                sx={{ flexShrink: 0 }}
                              >
                                <AccessTimeIcon
                                  sx={{ fontSize: 14, color: 'text.secondary' }}
                                />
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {entry.timestamp
                                    ? formatDate(entry.timestamp, 'MMM d, p')
                                    : '—'}
                                </Typography>
                              </Stack>
                            </Stack>
                          </MotionBox>
                        );
                      })}
                    </AnimatePresence>
                  </Stack>
                </Box>
              )}
            </GlassCard>

            {/* Items column */}
            <GlassCard sx={{ p: 3 }}>
              <Stack
                direction="row"
                justifyContent="space-between"
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Order Items
                </Typography>
                <Chip
                  size="small"
                  icon={<LocalShippingIcon />}
                  label={`${itemRows.length} item${itemRows.length === 1 ? '' : 's'}`}
                  sx={{
                    background: goldGradientSoft,
                    border: '1px solid rgba(212,165,42,0.3)',
                  }}
                />
              </Stack>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell>Product</TableCell>
                      <TableCell align="center">Requested</TableCell>
                      <TableCell align="center">Approved</TableCell>
                      <TableCell align="right">Line Total</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {itemRows.map((row) => (
                      <TableRow key={row.id} hover>
                        <TableCell>
                          <Stack direction="row" spacing={1.25} alignItems="center">
                            <Avatar
                              src={row.imageUrl || undefined}
                              variant="rounded"
                              sx={{
                                width: 40,
                                height: 40,
                                background: row.imageUrl
                                  ? 'transparent'
                                  : goldGradientSoft,
                                color: '#1A1A1A',
                                border: '1px solid rgba(212,165,42,0.25)',
                                fontWeight: 700,
                                fontSize: '0.85rem',
                              }}
                            >
                              {(row.name || '?').slice(0, 1)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700 }}
                                noWrap
                              >
                                {row.name}
                              </Typography>
                              <Typography
                                variant="caption"
                                color="text.secondary"
                              >
                                {row.sku || `Product #${row.productId}`}
                              </Typography>
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {row.requested}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          {row.approved === null ? (
                            <Typography variant="caption" color="text.secondary">
                              Pending
                            </Typography>
                          ) : row.modified ? (
                            <Tooltip
                              title={`Modified by manager: requested ${row.requested}, approved ${row.approved}`}
                            >
                              <Chip
                                size="small"
                                label={`${row.approved}`}
                                icon={<CancelIcon />}
                                sx={{
                                  fontWeight: 800,
                                  background: 'rgba(232,163,61,0.18)',
                                  color: '#9C5A12',
                                  border: '1px solid #E8A33D',
                                }}
                              />
                            </Tooltip>
                          ) : (
                            <Chip
                              size="small"
                              label={row.approved}
                              icon={<CheckCircleIcon />}
                              sx={{
                                fontWeight: 800,
                                background: 'rgba(46,125,50,0.12)',
                                color: '#1B5E20',
                                border: '1px solid #2E7D32',
                              }}
                            />
                          )}
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(row.lineTotal)}
                          </Typography>
                          <Typography
                            variant="caption"
                            color="text.secondary"
                          >
                            @ {formatCurrency(row.unitPrice)}
                          </Typography>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>

              <Divider sx={{ my: 2 }} />

              <Stack
                direction="row"
                justifyContent="flex-end"
                spacing={4}
                alignItems="center"
              >
                <Typography variant="body2" color="text.secondary">
                  Order Total
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800 }}>
                  {formatCurrency(order?.total_value)}
                </Typography>
              </Stack>
            </GlassCard>
          </Box>

          {/* AI Insights panel */}
          {AI_INSIGHT_STATUSES.has(order?.status) && (
            <GlassCard sx={{ p: 3, mt: 3 }}>
              <Stack
                direction="row"
                spacing={1.5}
                alignItems="center"
                sx={{ mb: 1.5 }}
              >
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 1.5,
                    background: goldGradient,
                    color: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <SmartToyIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    AI Insights
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    Ask Brewy why your order is where it is, or what happens next.
                  </Typography>
                </Box>
              </Stack>

              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <TextField
                  value={aiQuestion}
                  onChange={(e) => setAiQuestion(e.target.value)}
                  placeholder="Ask about this order…"
                  size="small"
                  fullWidth
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') askAi(aiQuestion);
                  }}
                />
                <Button
                  variant="contained"
                  color="secondary"
                  onClick={() => askAi(aiQuestion)}
                  disabled={aiMutation.isPending || !aiQuestion.trim()}
                  startIcon={
                    aiMutation.isPending ? (
                      <CircularProgress size={16} color="inherit" />
                    ) : (
                      <SmartToyIcon />
                    )
                  }
                  sx={{ minWidth: 140 }}
                >
                  {aiMutation.isPending ? 'Thinking…' : 'Ask Brewy'}
                </Button>
              </Stack>

              <AnimatePresence>
                {aiAnswer && (
                  <MotionBox
                    key="ai-answer"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    sx={{
                      mt: 2,
                      p: 2,
                      borderRadius: 2,
                      background: goldGradientSoft,
                      border: '1px solid rgba(212,165,42,0.3)',
                      whiteSpace: 'pre-wrap',
                      lineHeight: 1.55,
                      fontSize: '0.95rem',
                    }}
                  >
                    {aiAnswer}
                  </MotionBox>
                )}
              </AnimatePresence>
            </GlassCard>
          )}
        </>
      )}
    </Box>
  );
}

// ----------------------------------------------------------------------
// Horizontal stepper
// ----------------------------------------------------------------------
function HorizontalStepper({ steps, rejected }) {
  // Find current step index (or first pending)
  const currentIndex = steps.findIndex((s) => s.state === 'current');
  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: `repeat(${steps.length}, 1fr)`,
          alignItems: 'flex-start',
          gap: 0,
          minWidth: 720,
          position: 'relative',
        }}
      >
        {steps.map((s, idx) => {
          const isLast = idx === steps.length - 1;
          const complete = s.state === 'complete';
          const current = s.state === 'current';
          const skipped = rejected && s.state === 'skipped';
          return (
            <Box key={s.key} sx={{ position: 'relative', textAlign: 'center' }}>
              {/* Connector to next step */}
              {!isLast && (
                <Box
                  sx={{
                    position: 'absolute',
                    top: 28,
                    left: '50%',
                    right: '-50%',
                    height: 4,
                    background: 'rgba(26,26,26,0.08)',
                    borderRadius: 2,
                    overflow: 'hidden',
                    zIndex: 0,
                  }}
                >
                  <MotionBox
                    initial={{ width: '0%' }}
                    animate={{
                      width:
                        complete || (current && idx < currentIndex)
                          ? '100%'
                          : current
                          ? '50%'
                          : '0%',
                    }}
                    transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 * idx }}
                    sx={{
                      height: '100%',
                      background: goldGradient,
                    }}
                  />
                </Box>
              )}

              {/* Step circle */}
              <Box
                sx={{
                  position: 'relative',
                  zIndex: 1,
                  display: 'inline-flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                }}
              >
                <MotionBox
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    type: 'spring',
                    stiffness: 260,
                    damping: 18,
                    delay: 0.05 * idx,
                  }}
                  sx={{ position: 'relative' }}
                >
                  {current && (
                    <MotionBox
                      animate={{
                        scale: [1, 1.35, 1],
                        opacity: [0.55, 0.1, 0.55],
                      }}
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                        ease: 'easeOut',
                      }}
                      sx={{
                        position: 'absolute',
                        inset: -8,
                        borderRadius: '50%',
                        background: goldGradient,
                        zIndex: 0,
                      }}
                    />
                  )}
                  <Box
                    sx={{
                      position: 'relative',
                      zIndex: 1,
                      width: 56,
                      height: 56,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: complete
                        ? goldGradient
                        : current
                        ? goldGradient
                        : skipped
                        ? 'rgba(198,40,40,0.1)'
                        : 'rgba(26,26,26,0.06)',
                      color: complete || current ? '#1A1A1A' : skipped ? '#C62828' : '#9A9A9A',
                      boxShadow: complete || current
                        ? '0 10px 22px rgba(212,165,42,0.45)'
                        : 'none',
                      border:
                        complete || current
                          ? '1px solid rgba(212,165,42,0.6)'
                          : '1px solid rgba(26,26,26,0.1)',
                      transition: 'all 0.25s ease',
                    }}
                  >
                    {React.cloneElement(s.icon, { sx: { fontSize: 26 } })}
                  </Box>
                </MotionBox>

                <Typography
                  variant="caption"
                  sx={{
                    mt: 1.25,
                    fontWeight: current || complete ? 800 : 600,
                    color: current || complete ? '#1A1A1A' : skipped ? '#B71C1C' : 'text.secondary',
                    maxWidth: 130,
                  }}
                >
                  {s.label}
                </Typography>
                {s.timestamp ? (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', mt: 0.25 }}
                  >
                    {formatDate(s.timestamp, 'MMM d, p')}
                  </Typography>
                ) : current ? (
                  <Typography
                    variant="caption"
                    sx={{ color: '#9C5A12', mt: 0.25, fontWeight: 700 }}
                  >
                    In progress
                  </Typography>
                ) : (
                  <Typography
                    variant="caption"
                    sx={{ color: 'text.secondary', mt: 0.25, opacity: 0.65 }}
                  >
                    —
                  </Typography>
                )}
              </Box>
            </Box>
          );
        })}
      </Box>
    </Box>
  );
}

function SummaryStat({ label, value, strong }) {
  return (
    <Box>
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ letterSpacing: '0.08em' }}
      >
        {label}
      </Typography>
      <Box
        sx={{
          fontWeight: strong ? 800 : 700,
          fontSize: strong ? '1.4rem' : '1rem',
          mt: 0.25,
        }}
      >
        {value ?? '—'}
      </Box>
    </Box>
  );
}
