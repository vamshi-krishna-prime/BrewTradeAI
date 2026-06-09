import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Chip,
  Button,
  Stack,
  Skeleton,
  Divider,
  Alert,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
  LinearProgress,
} from '@mui/material';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
  Treemap,
  Tooltip as RTooltip,
} from 'recharts';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import EditIcon from '@mui/icons-material/Edit';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import PsychologyIcon from '@mui/icons-material/Psychology';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import HistoryIcon from '@mui/icons-material/History';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import StorefrontIcon from '@mui/icons-material/Storefront';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import TrafficLight from '../components/common/TrafficLight.jsx';
import {
  getOrderReview,
  getAIRecommendation,
  approveOrder,
  rejectOrder,
} from '../api/client.js';
import client from '../api/client.js';
import { formatCurrency, formatDate, statusColor } from '../utils/format.js';
import { goldGradient } from '../theme.js';

// ---------- helpers ----------
const RISK_COLORS = {
  high: '#C62828',
  medium: '#E8A33D',
  low: '#2E7D32',
};

function ageInHours(createdAt) {
  if (!createdAt) return 0;
  return (Date.now() - new Date(createdAt).getTime()) / 3_600_000;
}
function ageLabel(createdAt) {
  const h = ageInHours(createdAt);
  if (h < 1) return `${Math.max(1, Math.round(h * 60))}m ago`;
  if (h < 24) return `${Math.round(h)}h ago`;
  return `${Math.round(h / 24)}d ago`;
}
function creditTrafficStatus(healthRaw) {
  const s = String(healthRaw || 'green').toLowerCase();
  if (['red', 'yellow', 'green'].includes(s)) return s;
  return 'green';
}

async function fetchWarehouseVisualization() {
  const { data } = await client.get('/inventory/warehouse/visualization');
  return data;
}

export default function OrderReview() {
  const { id: orderId } = useParams();
  const navigate = useNavigate();

  const [approvedQty, setApprovedQty] = useState({});
  const [notes, setNotes] = useState('');
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [successOpen, setSuccessOpen] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const reviewQ = useQuery({
    queryKey: ['order-review', orderId],
    queryFn: () => getOrderReview(orderId),
    staleTime: 30_000,
    retry: 1,
    enabled: !!orderId,
  });

  const warehouseQ = useQuery({
    queryKey: ['warehouse-viz'],
    queryFn: fetchWarehouseVisualization,
    staleTime: 60_000,
    retry: 1,
  });

  const aiQ = useQuery({
    queryKey: ['ai-recommendation', orderId],
    queryFn: () => getAIRecommendation(orderId),
    staleTime: 60_000,
    retry: 0,
    enabled: !!orderId,
  });

  const review = reviewQ.data || {};
  const order = review.order || {};
  const customer = review.customer || {};
  const finHealth = review.financial_health || {};
  const items = useMemo(() => review.items || [], [review.items]);
  const historical = review.historical_orders || [];
  const riskScore = Number(review.risk_score || 0);
  const riskLevel = String(review.risk_level || 'low').toLowerCase();

  // Seed approvedQty state with quantity_requested whenever items change
  useEffect(() => {
    if (!items || items.length === 0) return;
    setApprovedQty((prev) => {
      const next = { ...prev };
      let touched = false;
      items.forEach((it) => {
        if (next[it.order_item_id] === undefined) {
          const cap = Math.min(it.quantity_requested, it.available);
          next[it.order_item_id] = Math.max(0, cap);
          touched = true;
        }
      });
      return touched ? next : prev;
    });
  }, [items]);

  // ---------- derived totals ----------
  const grandTotal = useMemo(() => {
    return items.reduce((acc, it) => {
      const qty = Number(approvedQty[it.order_item_id] ?? it.quantity_requested);
      return acc + qty * Number(it.unit_price || 0);
    }, 0);
  }, [items, approvedQty]);

  const totalRequested = useMemo(
    () => items.reduce((acc, it) => acc + Number(it.quantity_requested || 0), 0),
    [items]
  );
  const totalApproved = useMemo(
    () =>
      items.reduce(
        (acc, it) =>
          acc +
          Number(approvedQty[it.order_item_id] ?? it.quantity_requested ?? 0),
        0
      ),
    [items, approvedQty]
  );
  const fulfillmentPct =
    totalRequested > 0
      ? Math.round((totalApproved / totalRequested) * 100)
      : 100;

  const handleQtyChange = (item, raw) => {
    const cap = Math.min(item.quantity_requested, item.available);
    let val = parseInt(raw, 10);
    if (Number.isNaN(val) || val < 0) val = 0;
    if (val > cap) val = cap;
    setApprovedQty((prev) => ({ ...prev, [item.order_item_id]: val }));
  };

  // ---------- credit utilization meter ----------
  const utilization =
    finHealth.credit_limit > 0
      ? Math.min(
          100,
          Math.round(
            ((finHealth.outstanding_balance || 0) / finHealth.credit_limit) * 100
          )
        )
      : 0;

  // ---------- warehouse data ----------
  const warehouseCells = warehouseQ.data?.cells || [];
  const warehouseZones = warehouseQ.data?.zones || [];

  // Highlight zones containing this order's SKUs
  const orderProductIds = new Set(items.map((it) => it.product_id));
  const orderZones = new Set(
    warehouseCells
      .filter((c) => orderProductIds.has(c.product_id))
      .map((c) => c.warehouse_zone)
  );

  // Build treemap data per zone
  const treeData = useMemo(() => {
    if (!warehouseCells || warehouseCells.length === 0) return [];
    const byZone = {};
    warehouseCells.forEach((c) => {
      const z = c.warehouse_zone || 'A';
      if (!byZone[z]) byZone[z] = { name: `Zone ${z}`, children: [] };
      byZone[z].children.push({
        name: c.name,
        size: Math.max(10, c.capacity || 100),
        status: c.status,
        percentage: c.percentage,
        productId: c.product_id,
      });
    });
    return Object.values(byZone);
  }, [warehouseCells]);

  // Shortage rows
  const shortages = items.filter((it) => it.shortage_flag);

  // ---------- action handlers ----------
  const handleApprove = async () => {
    setSubmitting(true);
    setSubmitError('');
    try {
      const managerId =
        Number(localStorage.getItem('userId')) || Number(localStorage.getItem('managerId')) || 2;
      await approveOrder(orderId, {
        manager_id: managerId,
        approved_items: items.map((it) => ({
          order_item_id: it.order_item_id,
          quantity_approved: Number(
            approvedQty[it.order_item_id] ?? it.quantity_requested
          ),
        })),
        notes: notes || null,
      });
      const allFull = items.every(
        (it) =>
          Number(approvedQty[it.order_item_id] ?? it.quantity_requested) ===
          it.quantity_requested
      );
      setSuccessMsg(
        allFull
          ? 'Order approved and routed to processing.'
          : 'Order approved with modifications and routed to processing.'
      );
      setSuccessOpen(true);
    } catch (e) {
      setSubmitError(
        e?.response?.data?.detail || e?.message || 'Failed to approve order'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) return;
    setSubmitting(true);
    setSubmitError('');
    try {
      const managerId =
        Number(localStorage.getItem('userId')) || Number(localStorage.getItem('managerId')) || 2;
      await rejectOrder(orderId, {
        manager_id: managerId,
        reason: rejectReason,
      });
      setRejectOpen(false);
      setSuccessMsg('Order rejected. Distributor has been notified.');
      setSuccessOpen(true);
    } catch (e) {
      setSubmitError(
        e?.response?.data?.detail || e?.message || 'Failed to reject order'
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessClose = () => {
    setSuccessOpen(false);
    navigate('/manager/approvals');
  };

  // ---------- loading ----------
  if (reviewQ.isLoading) {
    return (
      <Box>
        <PageHeader title="Order Review" subtitle="Loading workspace..." />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={7}>
            <Skeleton variant="rounded" height={220} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={360} />
          </Grid>
          <Grid item xs={12} md={5}>
            <Skeleton variant="rounded" height={280} sx={{ mb: 2 }} />
            <Skeleton variant="rounded" height={280} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  if (reviewQ.isError) {
    return (
      <Box>
        <PageHeader title="Order Review" />
        <Alert severity="error">
          Failed to load order: {reviewQ.error?.message || 'unknown error'}
        </Alert>
        <Button
          sx={{ mt: 2 }}
          onClick={() => navigate('/manager/approvals')}
          startIcon={<ArrowBackIcon />}
        >
          Back to queue
        </Button>
      </Box>
    );
  }

  return (
    <Box sx={{ pb: 14 }}>
      {/* Sticky header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <GlassCard
          hover={false}
          sx={{
            position: 'sticky',
            top: 72,
            zIndex: 10,
            mb: 2.5,
            p: 2.5,
            background: 'rgba(255,255,255,0.92)',
          }}
        >
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={2}
            alignItems={{ md: 'center' }}
          >
            <Tooltip title="Back to queue">
              <IconButton
                onClick={() => navigate('/manager/approvals')}
                sx={{ border: '1px solid rgba(212,165,42,0.3)' }}
              >
                <ArrowBackIcon />
              </IconButton>
            </Tooltip>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <Typography
                  variant="h5"
                  sx={{
                    fontWeight: 900,
                    background: goldGradient,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {order.order_number || `Order #${order.id}`}
                </Typography>
                <Chip
                  size="small"
                  color={statusColor(order.status)}
                  label={String(order.status || '').replace('_', ' ')}
                  sx={{ textTransform: 'capitalize', fontWeight: 700 }}
                />
                <Chip
                  size="small"
                  label={`Risk: ${riskLevel}`}
                  sx={{
                    background: `${RISK_COLORS[riskLevel] || RISK_COLORS.low}1A`,
                    color: RISK_COLORS[riskLevel] || RISK_COLORS.low,
                    fontWeight: 800,
                    textTransform: 'capitalize',
                  }}
                />
              </Stack>
              <Stack direction="row" spacing={2} sx={{ mt: 0.4 }}>
                <Typography variant="body2" color="text.secondary">
                  <strong style={{ color: '#1A1A1A' }}>{customer.name}</strong>
                  {customer.market ? ` • ${customer.market}` : ''}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {ageLabel(order.created_at)}
                </Typography>
              </Stack>
            </Box>
            <Stack alignItems="flex-end">
              <Typography variant="caption" color="text.secondary">
                Live Total
              </Typography>
              <Typography variant="h4" sx={{ fontWeight: 900 }}>
                {formatCurrency(grandTotal)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Original: {formatCurrency(order.total_value)} ·{' '}
                {fulfillmentPct}% fulfilled
              </Typography>
            </Stack>
          </Stack>
        </GlassCard>
      </motion.div>

      <Grid container spacing={2.5}>
        {/* LEFT 60% */}
        <Grid item xs={12} md={7}>
          {/* Customer Information */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
          >
            <GlassCard sx={{ mb: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1.5}>
                <StorefrontIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Customer Information
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Chip
                  size="small"
                  label={`${historical.length} historical orders`}
                  icon={<HistoryIcon fontSize="small" />}
                  sx={{
                    background: 'rgba(212,165,42,0.10)',
                    color: '#8a6b1a',
                    fontWeight: 700,
                  }}
                />
              </Stack>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6}>
                  <Stack direction="row" spacing={1.5} alignItems="center">
                    <Avatar
                      sx={{
                        width: 48,
                        height: 48,
                        background: goldGradient,
                        color: '#1A1A1A',
                        fontWeight: 800,
                      }}
                    >
                      {(customer.name || '?')
                        .split(' ')
                        .map((s) => s[0])
                        .join('')
                        .slice(0, 2)
                        .toUpperCase()}
                    </Avatar>
                    <Box>
                      <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                        {customer.name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {customer.market} market
                      </Typography>
                    </Box>
                  </Stack>
                  {customer.contact_name && (
                    <Stack spacing={0.3} sx={{ mt: 1.5 }}>
                      <Typography variant="body2" color="text.secondary">
                        Contact:{' '}
                        <strong style={{ color: '#1A1A1A' }}>
                          {customer.contact_name}
                        </strong>
                      </Typography>
                      {customer.contact_email && (
                        <Typography variant="caption" color="text.secondary">
                          {customer.contact_email}
                        </Typography>
                      )}
                      {customer.contact_phone && (
                        <Typography variant="caption" color="text.secondary">
                          {customer.contact_phone}
                        </Typography>
                      )}
                    </Stack>
                  )}
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Stack spacing={1}>
                    <KVRow
                      label="Credit Limit"
                      value={formatCurrency(finHealth.credit_limit)}
                    />
                    <KVRow
                      label="Outstanding"
                      value={formatCurrency(finHealth.outstanding_balance)}
                      strong
                    />
                    <KVRow
                      label="Available Credit"
                      value={formatCurrency(finHealth.available_credit)}
                    />
                    <Stack
                      direction="row"
                      justifyContent="space-between"
                      alignItems="center"
                    >
                      <Typography variant="body2" color="text.secondary">
                        Credit Health
                      </Typography>
                      <Stack direction="row" alignItems="center" spacing={0.8}>
                        <TrafficLight
                          status={creditTrafficStatus(finHealth.credit_health)}
                          size={14}
                        />
                        <Typography
                          variant="body2"
                          sx={{ fontWeight: 700, textTransform: 'capitalize' }}
                        >
                          {finHealth.credit_health || 'green'}
                        </Typography>
                      </Stack>
                    </Stack>
                  </Stack>
                </Grid>
              </Grid>
            </GlassCard>
          </motion.div>

          {/* Order Items */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard sx={{ mb: 2.5, p: 0 }}>
              <Box sx={{ p: 2.5, pb: 1.5 }}>
                <Stack direction="row" alignItems="center" spacing={1}>
                  <EditIcon sx={{ color: '#B5891F' }} />
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Order Items
                  </Typography>
                  <Box sx={{ flex: 1 }} />
                  {shortages.length > 0 && (
                    <Chip
                      size="small"
                      icon={<WarningAmberIcon fontSize="small" />}
                      label={`${shortages.length} shortage${shortages.length > 1 ? 's' : ''}`}
                      sx={{
                        background: 'rgba(232,163,61,0.18)',
                        color: '#8a6b1a',
                        fontWeight: 700,
                      }}
                    />
                  )}
                </Stack>
                <Typography variant="body2" color="text.secondary">
                  Edit approved quantity per line — totals recalculate live
                </Typography>
              </Box>
              <Divider />
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ fontWeight: 800 }}>Product</TableCell>
                    <TableCell sx={{ fontWeight: 800 }}>SKU</TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">
                      Requested
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">
                      Available
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">
                      Coverage
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="center">
                      Approved
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">
                      Unit Price
                    </TableCell>
                    <TableCell sx={{ fontWeight: 800 }} align="right">
                      Line Total
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((it) => {
                    const qty = Number(
                      approvedQty[it.order_item_id] ?? it.quantity_requested
                    );
                    const lineTotal = qty * Number(it.unit_price || 0);
                    const cap = Math.min(it.quantity_requested, it.available);
                    return (
                      <TableRow
                        key={it.order_item_id}
                        sx={{
                          background: it.shortage_flag
                            ? 'rgba(232,163,61,0.10)'
                            : 'transparent',
                        }}
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            {it.image_url ? (
                              <Box
                                component="img"
                                src={it.image_url}
                                alt={it.name}
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 1,
                                  objectFit: 'cover',
                                  border: '1px solid rgba(0,0,0,0.06)',
                                }}
                              />
                            ) : (
                              <Box
                                sx={{
                                  width: 36,
                                  height: 36,
                                  borderRadius: 1,
                                  background: 'rgba(212,165,42,0.15)',
                                }}
                              />
                            )}
                            <Box>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {it.name}
                              </Typography>
                              {it.category && (
                                <Typography variant="caption" color="text.secondary">
                                  {it.category}
                                </Typography>
                              )}
                            </Box>
                          </Stack>
                        </TableCell>
                        <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                          {it.sku || '—'}
                        </TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {it.quantity_requested}
                        </TableCell>
                        <TableCell align="right">
                          <Typography
                            variant="body2"
                            sx={{
                              fontWeight: 700,
                              color: it.shortage_flag ? '#E8A33D' : 'inherit',
                            }}
                          >
                            {it.available}
                          </Typography>
                        </TableCell>
                        <TableCell align="right">
                          <Box sx={{ minWidth: 72 }}>
                            <Typography variant="caption" sx={{ fontWeight: 700 }}>
                              {it.coverage_pct}%
                            </Typography>
                            <Box
                              sx={{
                                width: '100%',
                                height: 4,
                                background: 'rgba(0,0,0,0.06)',
                                borderRadius: 2,
                                overflow: 'hidden',
                                mt: 0.3,
                              }}
                            >
                              <Box
                                sx={{
                                  height: '100%',
                                  width: `${Math.min(100, it.coverage_pct)}%`,
                                  background:
                                    it.coverage_pct >= 100
                                      ? '#2E7D32'
                                      : it.coverage_pct >= 60
                                      ? '#E8A33D'
                                      : '#C62828',
                                }}
                              />
                            </Box>
                          </Box>
                        </TableCell>
                        <TableCell align="center">
                          <TextField
                            type="number"
                            size="small"
                            value={qty}
                            onChange={(e) => handleQtyChange(it, e.target.value)}
                            inputProps={{
                              min: 0,
                              max: cap,
                              style: {
                                textAlign: 'center',
                                fontWeight: 700,
                                padding: '6px 4px',
                              },
                            }}
                            sx={{
                              width: 80,
                              '& .MuiOutlinedInput-root': {
                                background: 'rgba(255,255,255,0.7)',
                              },
                            }}
                            helperText={
                              qty < it.quantity_requested
                                ? `cap ${cap}`
                                : ' '
                            }
                            FormHelperTextProps={{
                              sx: {
                                fontSize: '0.65rem',
                                mt: 0.2,
                                mx: 0,
                                textAlign: 'center',
                                color:
                                  qty < it.quantity_requested ? '#8a6b1a' : 'transparent',
                              },
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {formatCurrency(it.unit_price)}
                        </TableCell>
                        <TableCell align="right">
                          <motion.div
                            key={lineTotal}
                            initial={{ scale: 1.05, color: '#B5891F' }}
                            animate={{ scale: 1, color: '#1A1A1A' }}
                            transition={{ duration: 0.3 }}
                          >
                            <Typography variant="body2" sx={{ fontWeight: 800 }}>
                              {formatCurrency(lineTotal)}
                            </Typography>
                          </motion.div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              <Divider />
              <Box
                sx={{
                  p: 2,
                  background: 'rgba(212,165,42,0.05)',
                  display: 'flex',
                  justifyContent: 'flex-end',
                  alignItems: 'center',
                  gap: 3,
                }}
              >
                <Typography variant="body2" color="text.secondary">
                  {totalApproved} of {totalRequested} units · {fulfillmentPct}%
                  fulfilled
                </Typography>
                <Stack alignItems="flex-end">
                  <Typography variant="caption" color="text.secondary">
                    Grand Total
                  </Typography>
                  <motion.div
                    key={grandTotal}
                    initial={{ scale: 1.04 }}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.25 }}
                  >
                    <Typography variant="h5" sx={{ fontWeight: 900 }}>
                      {formatCurrency(grandTotal)}
                    </Typography>
                  </motion.div>
                </Stack>
              </Box>
            </GlassCard>
          </motion.div>

          {/* Historical Performance */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <GlassCard sx={{ mb: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1} mb={1.5}>
                <HistoryIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Historical Performance
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  Last 5 orders
                </Typography>
              </Stack>
              {historical.length === 0 ? (
                <Typography color="text.secondary" variant="body2">
                  No prior orders for this customer.
                </Typography>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">
                        Value
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {historical.map((h) => (
                      <TableRow key={h.id}>
                        <TableCell
                          sx={{ fontFamily: 'monospace', fontWeight: 600 }}
                        >
                          {h.order_number || `#${h.id}`}
                        </TableCell>
                        <TableCell>{formatDate(h.created_at)}</TableCell>
                        <TableCell align="right" sx={{ fontWeight: 600 }}>
                          {formatCurrency(h.total_value)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={statusColor(h.status)}
                            label={String(h.status || '').replace('_', ' ')}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassCard>
          </motion.div>

          {/* Approval Notes */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard>
              <Typography variant="h6" sx={{ fontWeight: 800, mb: 1 }}>
                Approval Notes
              </Typography>
              <TextField
                multiline
                fullWidth
                minRows={3}
                placeholder="Add a note for this approval (visible to distributor)..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </GlassCard>
          </motion.div>
        </Grid>

        {/* RIGHT 40% */}
        <Grid item xs={12} md={5}>
          {/* AI Decision Copilot */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
          >
            <GlassCard
              sx={{
                mb: 2.5,
                background:
                  'linear-gradient(135deg, rgba(212,165,42,0.10), rgba(255,255,255,0.7))',
                border: '1px solid rgba(212,165,42,0.35)',
              }}
            >
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1}>
                <Box
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: 2,
                    background: goldGradient,
                    color: '#1A1A1A',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
                  }}
                >
                  <PsychologyIcon />
                </Box>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 900 }}>
                    Carib AI Decision Copilot
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    AI-powered risk assessment
                  </Typography>
                </Box>
                <Tooltip title="Refresh AI">
                  <IconButton
                    onClick={() => aiQ.refetch()}
                    size="small"
                    sx={{ border: '1px solid rgba(212,165,42,0.35)' }}
                  >
                    <RefreshIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>

              <AICopilotBody
                aiData={aiQ.data}
                isLoading={aiQ.isLoading || aiQ.isFetching}
                isError={aiQ.isError}
                fallbackRiskScore={riskScore}
                fallbackRiskLevel={riskLevel}
              />
            </GlassCard>
          </motion.div>

          {/* Financial Health */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.15 }}
          >
            <GlassCard sx={{ mb: 2.5 }}>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1.5}>
                <AccountBalanceWalletIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Financial Health
                </Typography>
                <Box sx={{ flex: 1 }} />
                <TrafficLight
                  status={creditTrafficStatus(finHealth.credit_health)}
                  size={14}
                />
              </Stack>
              <Box sx={{ mb: 1.5 }}>
                <Stack
                  direction="row"
                  justifyContent="space-between"
                  alignItems="baseline"
                >
                  <Typography variant="body2" color="text.secondary">
                    Credit utilization
                  </Typography>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    {utilization}%
                  </Typography>
                </Stack>
                <Box
                  sx={{
                    mt: 0.5,
                    height: 10,
                    width: '100%',
                    borderRadius: 5,
                    background: 'rgba(0,0,0,0.06)',
                    overflow: 'hidden',
                  }}
                >
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${utilization}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    style={{
                      height: '100%',
                      background:
                        utilization >= 85
                          ? '#C62828'
                          : utilization >= 60
                          ? '#E8A33D'
                          : '#2E7D32',
                      borderRadius: 5,
                    }}
                  />
                </Box>
              </Box>
              <Stack spacing={0.7}>
                <KVRow
                  label="Credit limit"
                  value={formatCurrency(finHealth.credit_limit)}
                />
                <KVRow
                  label="Outstanding"
                  value={formatCurrency(finHealth.outstanding_balance)}
                  strong
                />
                <KVRow
                  label="Available"
                  value={formatCurrency(finHealth.available_credit)}
                />
                <Divider sx={{ my: 0.5 }} />
                <KVRow
                  label="If approved (this order)"
                  value={formatCurrency(
                    Math.max(
                      0,
                      (finHealth.available_credit || 0) - grandTotal
                    )
                  )}
                  strong
                />
              </Stack>
            </GlassCard>
          </motion.div>

          {/* Inventory Intelligence */}
          <motion.div
            initial={{ opacity: 0, x: 14 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
          >
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1}>
                <Inventory2OutlinedIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Inventory Intelligence
                </Typography>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Warehouse map · 3 zones · highlighting current order
              </Typography>

              {warehouseQ.isLoading ? (
                <Skeleton variant="rounded" height={180} />
              ) : (
                <>
                  <Box sx={{ height: 180, mb: 1.5 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <Treemap
                        data={treeData}
                        dataKey="size"
                        stroke="#fff"
                        content={
                          <WarehouseCell
                            highlightZones={orderZones}
                            highlightProducts={orderProductIds}
                          />
                        }
                      >
                        <RTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload || !payload[0]) return null;
                            const d = payload[0].payload;
                            return (
                              <Box
                                sx={{
                                  background: '#fff',
                                  border: '1px solid rgba(212,165,42,0.3)',
                                  borderRadius: 1.5,
                                  p: 1,
                                  boxShadow: '0 10px 22px rgba(0,0,0,0.08)',
                                }}
                              >
                                <Typography variant="caption" sx={{ fontWeight: 800 }}>
                                  {d.name}
                                </Typography>
                                {d.status && (
                                  <Typography
                                    variant="caption"
                                    sx={{ display: 'block' }}
                                    color="text.secondary"
                                  >
                                    {d.status} · {d.percentage}%
                                  </Typography>
                                )}
                              </Box>
                            );
                          }}
                        />
                      </Treemap>
                    </ResponsiveContainer>
                  </Box>

                  <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
                    {warehouseZones.map((z) => (
                      <Chip
                        key={z.zone}
                        size="small"
                        label={`Zone ${z.zone} · ${z.utilization_pct}%`}
                        sx={{
                          background: orderZones.has(z.zone)
                            ? goldGradient
                            : 'rgba(0,0,0,0.05)',
                          color: orderZones.has(z.zone) ? '#1A1A1A' : 'text.secondary',
                          fontWeight: orderZones.has(z.zone) ? 800 : 500,
                        }}
                      />
                    ))}
                  </Stack>

                  {shortages.length > 0 ? (
                    <Box
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        background: 'rgba(232,163,61,0.10)',
                        border: '1px solid rgba(232,163,61,0.35)',
                      }}
                    >
                      <Stack direction="row" alignItems="center" spacing={1} mb={0.6}>
                        <WarningAmberIcon
                          fontSize="small"
                          sx={{ color: '#8a6b1a' }}
                        />
                        <Typography
                          variant="subtitle2"
                          sx={{ fontWeight: 800, color: '#8a6b1a' }}
                        >
                          Shortage Alerts ({shortages.length})
                        </Typography>
                      </Stack>
                      <Stack spacing={0.4}>
                        {shortages.map((s) => (
                          <Stack
                            key={s.order_item_id}
                            direction="row"
                            justifyContent="space-between"
                          >
                            <Typography variant="caption" sx={{ fontWeight: 600 }}>
                              {s.name}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {s.available} / {s.quantity_requested} (
                              {s.coverage_pct}%)
                            </Typography>
                          </Stack>
                        ))}
                      </Stack>
                    </Box>
                  ) : (
                    <Box
                      sx={{
                        p: 1.2,
                        borderRadius: 2,
                        background: 'rgba(46,125,50,0.08)',
                        border: '1px solid rgba(46,125,50,0.25)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 1,
                      }}
                    >
                      <CheckCircleIcon
                        fontSize="small"
                        sx={{ color: '#2E7D32' }}
                      />
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: 700, color: '#1B5E20' }}
                      >
                        Full inventory coverage on all lines.
                      </Typography>
                    </Box>
                  )}
                </>
              )}
            </GlassCard>
          </motion.div>
        </Grid>
      </Grid>

      {/* Sticky bottom action bar */}
      <Box
        component={motion.div}
        initial={{ y: 80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.25, type: 'spring', stiffness: 160, damping: 22 }}
        sx={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 1100,
          backdropFilter: 'blur(18px)',
          background: 'rgba(255,255,255,0.85)',
          borderTop: '1px solid rgba(212,165,42,0.3)',
          boxShadow: '0 -10px 30px rgba(0,0,0,0.06)',
          px: { xs: 2, md: 4 },
          py: 1.5,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={2}>
          <Box sx={{ flex: 1 }}>
            <Typography variant="caption" color="text.secondary">
              {order.order_number} · {customer.name}
            </Typography>
            <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
              {formatCurrency(grandTotal)} · {totalApproved}/{totalRequested}{' '}
              units approved
            </Typography>
            {submitError && (
              <Typography variant="caption" sx={{ color: '#C62828' }}>
                {submitError}
              </Typography>
            )}
          </Box>
          <Button
            variant="outlined"
            color="error"
            startIcon={<CancelIcon />}
            disabled={submitting}
            onClick={() => setRejectOpen(true)}
            sx={{
              borderColor: 'rgba(198,40,40,0.5)',
              color: '#C62828',
              '&:hover': {
                borderColor: '#C62828',
                background: 'rgba(198,40,40,0.06)',
              },
            }}
          >
            Reject
          </Button>
          <Button
            variant="outlined"
            color="secondary"
            startIcon={<EditIcon />}
            disabled={submitting || totalApproved === totalRequested}
            onClick={handleApprove}
          >
            Approve With Modification
          </Button>
          <Button
            variant="contained"
            color="secondary"
            startIcon={<CheckCircleIcon />}
            disabled={submitting}
            onClick={handleApprove}
          >
            Approve
          </Button>
        </Stack>
        {submitting && (
          <LinearProgress
            color="secondary"
            sx={{ position: 'absolute', left: 0, right: 0, bottom: 0 }}
          />
        )}
      </Box>

      {/* Reject dialog */}
      <Dialog
        open={rejectOpen}
        onClose={() => !submitting && setRejectOpen(false)}
        fullWidth
        maxWidth="sm"
        PaperProps={{
          sx: {
            background: 'rgba(255,255,255,0.95)',
            backdropFilter: 'blur(18px)',
            border: '1px solid rgba(198,40,40,0.3)',
          },
        }}
      >
        <DialogTitle sx={{ fontWeight: 800 }}>
          Reject {order.order_number}?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Provide a clear reason — this will be sent to {customer.name}.
          </Typography>
          <TextField
            autoFocus
            multiline
            fullWidth
            minRows={3}
            label="Rejection reason"
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Outstanding balance exceeds credit limit. Settle invoice INV-2049 before resubmitting."
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2.5 }}>
          <Button onClick={() => setRejectOpen(false)} disabled={submitting}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={submitting || !rejectReason.trim()}
            onClick={handleReject}
            startIcon={<CancelIcon />}
          >
            Reject Order
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success modal */}
      <Dialog
        open={successOpen}
        onClose={handleSuccessClose}
        PaperProps={{
          sx: {
            background: 'rgba(255,255,255,0.97)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(212,165,42,0.35)',
            textAlign: 'center',
            p: 2,
          },
        }}
      >
        <Box sx={{ p: 3 }}>
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 18 }}
          >
            <Box
              sx={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: goldGradient,
                mx: 'auto',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 14px 32px rgba(212,165,42,0.4)',
                mb: 2,
              }}
            >
              <CheckCircleIcon sx={{ fontSize: 48, color: '#1A1A1A' }} />
            </Box>
          </motion.div>
          <Typography variant="h5" sx={{ fontWeight: 900, mb: 1 }}>
            Done.
          </Typography>
          <Typography color="text.secondary" sx={{ mb: 3 }}>
            {successMsg}
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            onClick={handleSuccessClose}
            fullWidth
          >
            Back to Queue
          </Button>
        </Box>
      </Dialog>
    </Box>
  );
}

// ---------- subcomponents ----------
function KVRow({ label, value, strong }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: strong ? 800 : 600, fontFamily: 'inherit' }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function WarehouseCell(props) {
  const { x, y, width, height, name, status, highlightZones, highlightProducts, productId, depth } =
    props;
  if (depth === 0) return null;
  if (width < 4 || height < 4) return null;

  const statusColor =
    status === 'critical'
      ? '#C62828'
      : status === 'low'
      ? '#E8A33D'
      : '#2E7D32';
  const isHot = highlightProducts && productId && highlightProducts.has(productId);

  return (
    <g>
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        style={{
          fill: isHot
            ? 'url(#hotcell)'
            : `${statusColor}33`,
          stroke: isHot ? '#D4A52A' : '#fff',
          strokeWidth: isHot ? 2 : 1,
        }}
      />
      <defs>
        <linearGradient id="hotcell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#F2C849" />
          <stop offset="100%" stopColor="#D4A52A" />
        </linearGradient>
      </defs>
      {width > 60 && height > 22 && (
        <text
          x={x + 6}
          y={y + 16}
          fill="#1A1A1A"
          fontSize={10}
          fontWeight={700}
        >
          {String(name || '').slice(0, Math.floor(width / 7))}
        </text>
      )}
    </g>
  );
}

function AICopilotBody({
  aiData,
  isLoading,
  isError,
  fallbackRiskScore,
  fallbackRiskLevel,
}) {
  // Pull either real AI data, or fall back to the heuristic risk_score
  // returned by /orders/:id/review.
  const rec = aiData || {};
  const score =
    typeof rec.risk_score === 'number'
      ? rec.risk_score
      : Math.round((fallbackRiskScore || 0) * 100);
  const decision =
    rec.decision ||
    (fallbackRiskLevel === 'high'
      ? 'review'
      : fallbackRiskLevel === 'medium'
      ? 'review'
      : 'approve');
  const reasoning =
    rec.reasoning ||
    (fallbackRiskLevel === 'high'
      ? 'High credit utilization combined with the order value pushes this customer near their limit. Recommend manual review.'
      : fallbackRiskLevel === 'medium'
      ? 'Customer is in a healthy mid-range. Approve, but verify inventory coverage on key SKUs.'
      : 'Credit health is strong and inventory coverage is solid. Safe to approve.');
  const factors =
    rec.key_factors ||
    [
      'Credit utilization',
      'Historical order pattern',
      'Inventory coverage',
      'Market performance',
    ];
  const impact =
    rec.business_impact ||
    'Approving this order supports revenue continuity in the customer market.';
  const confidence =
    typeof rec.confidence === 'number'
      ? Math.round(rec.confidence * (rec.confidence > 1 ? 1 : 100))
      : 78;

  const decisionColor =
    decision === 'approve'
      ? '#2E7D32'
      : decision === 'reject'
      ? '#C62828'
      : '#E8A33D';

  if (isLoading) {
    return (
      <Stack spacing={2} alignItems="center" sx={{ py: 3 }}>
        <LinearProgress sx={{ width: '100%' }} color="secondary" />
        <Typography variant="caption" color="text.secondary">
          Consulting Claude...
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={2}>
      <Grid container spacing={1.5} alignItems="center">
        <Grid item xs={5}>
          <Box sx={{ position: 'relative', height: 140 }}>
            <ResponsiveContainer width="100%" height="100%">
              <RadialBarChart
                cx="50%"
                cy="50%"
                innerRadius="62%"
                outerRadius="100%"
                barSize={14}
                data={[{ name: 'score', value: score, fill: 'url(#riskgrad)' }]}
                startAngle={90}
                endAngle={-270}
              >
                <defs>
                  <linearGradient id="riskgrad" x1="0" y1="0" x2="1" y2="1">
                    <stop
                      offset="0%"
                      stopColor={
                        score > 70
                          ? '#EF5350'
                          : score > 40
                          ? '#F2C849'
                          : '#4CAF50'
                      }
                    />
                    <stop
                      offset="100%"
                      stopColor={
                        score > 70
                          ? '#C62828'
                          : score > 40
                          ? '#D4A52A'
                          : '#2E7D32'
                      }
                    />
                  </linearGradient>
                </defs>
                <PolarAngleAxis
                  type="number"
                  domain={[0, 100]}
                  angleAxisId={0}
                  tick={false}
                />
                <RadialBar
                  background={{ fill: 'rgba(0,0,0,0.06)' }}
                  dataKey="value"
                  cornerRadius={8}
                />
              </RadialBarChart>
            </ResponsiveContainer>
            <Box
              sx={{
                position: 'absolute',
                inset: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                pointerEvents: 'none',
              }}
            >
              <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
                {Math.round(score)}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                risk score
              </Typography>
            </Box>
          </Box>
        </Grid>
        <Grid item xs={7}>
          <Chip
            label={`Decision: ${decision}`}
            sx={{
              background: `${decisionColor}1A`,
              color: decisionColor,
              fontWeight: 900,
              textTransform: 'uppercase',
              border: `1px solid ${decisionColor}55`,
              fontSize: '0.78rem',
            }}
          />
          <Box sx={{ mt: 1.2 }}>
            <Typography variant="caption" color="text.secondary">
              Confidence
            </Typography>
            <Box
              sx={{
                mt: 0.4,
                height: 8,
                width: '100%',
                borderRadius: 4,
                background: 'rgba(0,0,0,0.06)',
                overflow: 'hidden',
              }}
            >
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, confidence)}%` }}
                transition={{ duration: 0.8 }}
                style={{
                  height: '100%',
                  background: goldGradient,
                  borderRadius: 4,
                }}
              />
            </Box>
            <Typography
              variant="caption"
              sx={{ fontWeight: 800, color: '#8a6b1a' }}
            >
              {confidence}%
            </Typography>
          </Box>
        </Grid>
      </Grid>

      <Box>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <LightbulbOutlinedIcon fontSize="small" sx={{ color: '#B5891F' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Reasoning
          </Typography>
        </Stack>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {reasoning}
        </Typography>
      </Box>

      <Box>
        <Stack direction="row" alignItems="center" spacing={0.8}>
          <AutoAwesomeIcon fontSize="small" sx={{ color: '#B5891F' }} />
          <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
            Key Factors
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.6} flexWrap="wrap" gap={0.6} sx={{ mt: 0.7 }}>
          {(Array.isArray(factors) ? factors : []).map((f, i) => (
            <Chip
              key={i}
              size="small"
              label={String(f)}
              sx={{
                background: 'rgba(212,165,42,0.10)',
                color: '#8a6b1a',
                fontWeight: 600,
              }}
            />
          ))}
        </Stack>
      </Box>

      <Box>
        <Typography variant="subtitle2" sx={{ fontWeight: 800 }}>
          Business Impact
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
          {impact}
        </Typography>
      </Box>

      {isError && (
        <Alert severity="info" sx={{ py: 0.5 }}>
          AI service returned no recommendation — using heuristic fallback.
        </Alert>
      )}
    </Stack>
  );
}
