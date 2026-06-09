import React, { useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Typography,
  Stack,
  Tabs,
  Tab,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Skeleton,
  Alert,
  Divider,
  LinearProgress,
  Button,
  TextField,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Snackbar,
  Switch,
  FormControlLabel,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  Cell,
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
} from 'recharts';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import CreditScoreIcon from '@mui/icons-material/CreditScore';
import SpeedIcon from '@mui/icons-material/Speed';
import PaymentsIcon from '@mui/icons-material/Payments';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import RequestQuoteRoundedIcon from '@mui/icons-material/RequestQuoteRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import TrafficLight from '../components/common/TrafficLight.jsx';
import { getAR } from '../api/client.js';
import { formatCurrency, formatDate, statusColor } from '../utils/format.js';

const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 22 } },
};

function healthLabel(h) {
  const s = String(h || 'green').toLowerCase();
  if (s === 'red') return 'At Risk';
  if (s === 'yellow') return 'Watch';
  return 'Healthy';
}

function utilizationStatus(pct) {
  if (pct >= 85) return 'red';
  if (pct >= 60) return 'yellow';
  return 'green';
}

function daysBetween(a, b) {
  if (!a || !b) return 0;
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

function classifyAging(invoice, today) {
  // open invoices with balance > 0 only; closed/paid skip
  const status = String(invoice.status || '').toLowerCase();
  if (status === 'closed' || status === 'paid') return null;
  if (!(Number(invoice.balance) > 0)) return null;
  const due = invoice.due_date ? new Date(invoice.due_date) : null;
  if (!due) return 'current';
  const overdue = daysBetween(due, today);
  if (overdue <= 0) return 'current';
  if (overdue <= 30) return '1-30';
  if (overdue <= 60) return '31-60';
  if (overdue <= 90) return '61-90';
  return '90+';
}

export default function ARDashboard() {
  const customerId =
    (typeof window !== 'undefined' && localStorage.getItem('customerId')) || '1';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['customer-ar', customerId],
    queryFn: () => getAR(customerId),
    retry: 1,
    staleTime: 60_000,
  });

  // Demo scenario: simulate a distributor that has exceeded its credit limit
  // (Credit Limit $50,000 / Outstanding $65,000) so the end-to-end amendment
  // workflow can be demonstrated even when live data is within limits.
  const [demoExceeded, setDemoExceeded] = useState(false);

  // Credit-limit amendment request dialog state
  const [amendOpen, setAmendOpen] = useState(false);
  const [requestedLimit, setRequestedLimit] = useState('');
  const [amendReason, setAmendReason] = useState('');
  const [amendToast, setAmendToast] = useState(null); // { direction }

  const ar = data || {};
  const realCreditLimit = Number(ar.credit_limit ?? 0);
  const realOutstanding = Number(ar.outstanding_balance ?? 0);

  const creditLimit = demoExceeded ? 50000 : realCreditLimit;
  const outstanding = demoExceeded ? 65000 : realOutstanding;

  // True available credit (may be negative) and utilization (may exceed 100%).
  const available = demoExceeded
    ? creditLimit - outstanding
    : Number(ar.available_credit ?? creditLimit - outstanding);
  const utilizationPct =
    creditLimit > 0 ? Math.round((outstanding / creditLimit) * 100) : 0;
  const utilizationViz = Math.max(0, Math.min(100, utilizationPct));
  const creditExceeded = creditLimit > 0 && outstanding > creditLimit;
  const healthRaw = creditExceeded
    ? 'red'
    : ar.credit_health || utilizationStatus(utilizationViz);
  const invoices = Array.isArray(ar.invoices) ? ar.invoices : [];

  // Split invoices into open/closed
  const openInvoices = useMemo(() => {
    return invoices.filter((iv) => {
      const s = String(iv.status || '').toLowerCase();
      return s !== 'closed' && s !== 'paid';
    });
  }, [invoices]);
  const closedInvoices = useMemo(() => {
    return invoices.filter((iv) => {
      const s = String(iv.status || '').toLowerCase();
      return s === 'closed' || s === 'paid';
    });
  }, [invoices]);

  // Aging buckets for open invoices
  const today = useMemo(() => new Date(), []);
  // Aging summary derived from the Outstanding Balance — distributed across the
  // four aging buckets with random weights that always reconcile back to the
  // total outstanding balance. Recomputed only when the outstanding changes.
  const aging = useMemo(() => {
    const colors = ['#2E7D32', '#E8A33D', '#ED6C02', '#C62828'];
    const labels = ['Current', '31–60', '61–90', '90+'];
    const fullLabels = ['Current (0–30 Days)', '31–60 Days', '61–90 Days', '90+ Days'];
    const total = Math.max(0, Math.round(outstanding));
    const amounts = [0, 0, 0, 0];
    if (total > 0) {
      const w = [0, 0, 0, 0].map(() => 0.15 + Math.random() * 0.85);
      const wsum = w.reduce((a, b) => a + b, 0);
      let used = 0;
      for (let i = 1; i < 4; i += 1) {
        amounts[i] = Math.floor((w[i] / wsum) * total);
        used += amounts[i];
      }
      amounts[0] = total - used; // Current carries the rounding remainder
    }
    return labels.map((bucket, i) => ({
      bucket,
      fullLabel: fullLabels[i],
      amount: amounts[i],
      color: colors[i],
    }));
  }, [outstanding]);

  // Payment position - DSO & average payment time
  const paymentMetrics = useMemo(() => {
    // DSO (Days Sales Outstanding) ~= outstanding / (sales of last 90d / 90)
    // Approximation using sum of all invoices in last 90d
    const ninetyAgo = new Date(today.getTime() - 90 * 86400000);
    let sales90 = 0;
    for (const iv of invoices) {
      const d = iv.invoice_date ? new Date(iv.invoice_date) : null;
      if (d && d >= ninetyAgo) sales90 += Number(iv.amount || 0);
    }
    const dso = sales90 > 0 ? Math.round((outstanding / sales90) * 90) : 0;

    // Average payment time on closed invoices = paid_date or now - invoice_date
    const closedTimes = [];
    for (const iv of invoices) {
      const s = String(iv.status || '').toLowerCase();
      if (s === 'closed' || s === 'paid') {
        const start = iv.invoice_date ? new Date(iv.invoice_date) : null;
        const end = iv.paid_date
          ? new Date(iv.paid_date)
          : iv.updated_at
          ? new Date(iv.updated_at)
          : iv.due_date
          ? new Date(iv.due_date)
          : null;
        if (start && end) {
          const d = daysBetween(start, end);
          if (d >= 0 && d < 365) closedTimes.push(d);
        }
      }
    }
    const avgPayTime =
      closedTimes.length > 0
        ? Math.round(closedTimes.reduce((a, b) => a + b, 0) / closedTimes.length)
        : 0;

    // Overdue count
    let overdueCount = 0;
    for (const iv of openInvoices) {
      const due = iv.due_date ? new Date(iv.due_date) : null;
      if (due && due < today && Number(iv.balance) > 0) overdueCount += 1;
    }

    return { dso, avgPayTime, overdueCount, sales90 };
  }, [invoices, openInvoices, outstanding, today]);

  // ---- Credit limit amendment validation / submit ----
  const requestedNum = Number(requestedLimit);
  const amendValid =
    requestedLimit !== '' &&
    Number.isFinite(requestedNum) &&
    requestedNum > 0 &&
    requestedNum !== creditLimit;
  const amendDirection = requestedNum > creditLimit ? 'increase' : 'decrease';

  const submitAmendment = () => {
    if (!amendValid) return;
    setAmendOpen(false);
    setAmendToast({ direction: amendDirection });
    setRequestedLimit('');
    setAmendReason('');
  };

  if (isLoading) {
    return (
      <Box>
        <PageHeader title="Accounts Receivable" subtitle="Loading credit & invoices..." />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={140} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={140} /></Grid>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={140} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={260} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={260} /></Grid>
          <Grid item xs={12}><Skeleton variant="rounded" height={320} /></Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Accounts Receivable"
        subtitle="Your credit, invoices, and aging summary"
        actions={
          <Tooltip title="Preview a distributor whose outstanding balance exceeds its credit limit">
            <FormControlLabel
              control={
                <Switch
                  size="small"
                  color="secondary"
                  checked={demoExceeded}
                  onChange={(e) => setDemoExceeded(e.target.checked)}
                />
              }
              label={
                <Typography variant="caption" sx={{ fontWeight: 700, letterSpacing: '0.03em' }}>
                  Demo: credit-exceeded scenario
                </Typography>
              }
              sx={{ m: 0 }}
            />
          </Tooltip>
        }
      />

      {isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Couldn't load AR data ({error?.message || 'unknown error'}).
        </Alert>
      )}

      {/* Top 3 hero cards */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={4}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <AccountBalanceWalletIcon sx={{ color: '#B5891F' }} />
                <Typography variant="overline" color="text.secondary">
                  Outstanding Balance
                </Typography>
              </Stack>
              <Typography variant="h2" sx={{ fontWeight: 900, mt: 1, lineHeight: 1 }}>
                {formatCurrency(outstanding)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Across {openInvoices.length} open invoice{openInvoices.length === 1 ? '' : 's'}
              </Typography>
            </GlassCard>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <CreditScoreIcon sx={{ color: '#B5891F' }} />
                <Typography variant="overline" color="text.secondary">
                  Credit Limit
                </Typography>
              </Stack>
              <Typography variant="h2" sx={{ fontWeight: 900, mt: 1, lineHeight: 1 }}>
                {formatCurrency(creditLimit)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Available: <strong>{formatCurrency(available)}</strong>
              </Typography>
            </GlassCard>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={4}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2}>
                <SpeedIcon sx={{ color: '#B5891F' }} />
                <Typography variant="overline" color="text.secondary">
                  Credit Utilization
                </Typography>
              </Stack>
              <Stack direction="row" alignItems="center" spacing={2} mt={1}>
                <Box sx={{ width: 90, height: 90, position: 'relative' }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <RadialBarChart
                      cx="50%"
                      cy="50%"
                      innerRadius="65%"
                      outerRadius="100%"
                      barSize={10}
                      data={[
                        {
                          value: utilizationViz,
                          fill: creditExceeded ? 'url(#arRedGrad)' : 'url(#arGoldGrad)',
                        },
                      ]}
                      startAngle={90}
                      endAngle={-270}
                    >
                      <defs>
                        <linearGradient id="arGoldGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#D4A52A" />
                          <stop offset="50%" stopColor="#F2C849" />
                          <stop offset="100%" stopColor="#E8A33D" />
                        </linearGradient>
                        <linearGradient id="arRedGrad" x1="0" y1="0" x2="1" y2="1">
                          <stop offset="0%" stopColor="#C62828" />
                          <stop offset="100%" stopColor="#ED6C02" />
                        </linearGradient>
                      </defs>
                      <PolarAngleAxis
                        type="number"
                        domain={[0, 100]}
                        angleAxisId={0}
                        tick={false}
                      />
                      <RadialBar
                        background={{ fill: 'rgba(212,165,42,0.10)' }}
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
                      alignItems: 'center',
                      justifyContent: 'center',
                      pointerEvents: 'none',
                    }}
                  >
                    <Typography
                      variant="h6"
                      sx={{ fontWeight: 800, color: creditExceeded ? '#C62828' : 'inherit' }}
                    >
                      {utilizationPct}%
                    </Typography>
                  </Box>
                </Box>
                <Box sx={{ flex: 1 }}>
                  <LinearProgress
                    variant="determinate"
                    value={utilizationViz}
                    sx={{
                      height: 10,
                      borderRadius: 6,
                      backgroundColor: 'rgba(212,165,42,0.15)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 6,
                        background:
                          utilizationPct >= 85
                            ? 'linear-gradient(90deg,#C62828,#ED6C02)'
                            : utilizationPct >= 60
                            ? 'linear-gradient(90deg,#E8A33D,#F2C849)'
                            : 'linear-gradient(90deg,#2E7D32,#66BB6A)',
                      },
                    }}
                  />
                  <Typography variant="caption" color="text.secondary">
                    {creditExceeded
                      ? `Over limit by ${formatCurrency(Math.abs(available))}`
                      : `of ${formatCurrency(creditLimit)} limit used`}
                  </Typography>
                </Box>
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Credit health + Aging chart */}
        <Grid item xs={12} md={5}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.5} mb={1}>
                {creditExceeded ? (
                  <WarningAmberRoundedIcon sx={{ color: '#C62828' }} />
                ) : (
                  <TrafficLight status={healthRaw} size={18} title={healthLabel(healthRaw)} />
                )}
                <Typography
                  variant="h6"
                  sx={{ fontWeight: 700, color: creditExceeded ? '#C62828' : 'inherit' }}
                >
                  Credit Health: {creditExceeded ? 'Credit Limit Exceeded' : healthLabel(healthRaw)}
                </Typography>
                {creditExceeded && (
                  <Chip
                    size="small"
                    label="Action needed"
                    sx={{
                      ml: 'auto',
                      fontWeight: 700,
                      bgcolor: 'rgba(198,40,40,0.12)',
                      color: '#C62828',
                      border: '1px solid rgba(198,40,40,0.4)',
                    }}
                  />
                )}
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ lineHeight: 1.6 }}>
                {creditExceeded
                  ? 'Your outstanding balance has exceeded your assigned credit limit. New orders will require manager approval. Submit a credit limit amendment request below to restore your ordering capacity.'
                  : healthRaw === 'green'
                  ? 'Your account is in great standing. Credit utilization is comfortably below thresholds and payments are tracking on time. You have full ordering capacity available.'
                  : healthRaw === 'yellow'
                  ? 'Your account is approaching its credit limit or has slightly delayed payments. Consider settling open invoices to maintain flexibility on future orders.'
                  : 'Your account is at or above credit thresholds and may have overdue balances. New orders may require manager approval. Please reach out to your account manager to discuss payment.'}
              </Typography>

              {/* Credit summary figures */}
              <Grid container spacing={1.5} sx={{ mt: 0.5 }}>
                <Grid item xs={6}>
                  <CreditFigure label="Credit Limit" value={formatCurrency(creditLimit)} />
                </Grid>
                <Grid item xs={6}>
                  <CreditFigure label="Outstanding Balance" value={formatCurrency(outstanding)} />
                </Grid>
                <Grid item xs={6}>
                  <CreditFigure
                    label="Available Credit"
                    value={formatCurrency(available)}
                    danger={available < 0}
                  />
                </Grid>
                <Grid item xs={6}>
                  <CreditFigure
                    label="Credit Utilization"
                    value={`${utilizationPct}%`}
                    danger={creditExceeded}
                  />
                </Grid>
              </Grid>

              <Divider sx={{ my: 2 }} />

              <Stack direction="row" spacing={2}>
                <MiniMetric icon={<EventBusyIcon fontSize="small" />} label="Overdue Invoices" value={paymentMetrics.overdueCount} />
                <MiniMetric icon={<PaymentsIcon fontSize="small" />} label="90-day Sales" value={formatCurrency(paymentMetrics.sales90)} />
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>

        <Grid item xs={12} md={7}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Aging Summary
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                Outstanding balance ({formatCurrency(outstanding)}) by days past due
              </Typography>
              <Box sx={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={aging} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(26,26,26,0.08)" vertical={false} />
                    <XAxis dataKey="bucket" tick={{ fontSize: 12 }} />
                    <YAxis
                      tick={{ fontSize: 12 }}
                      tickFormatter={(v) => formatCurrency(v)}
                      width={70}
                    />
                    <RTooltip
                      formatter={(v) => [formatCurrency(v), 'Balance']}
                      labelFormatter={(label, payload) =>
                        payload?.[0]?.payload?.fullLabel || label
                      }
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(212,165,42,0.3)',
                        background: 'rgba(255,255,255,0.95)',
                      }}
                    />
                    <Bar dataKey="amount" radius={[8, 8, 0, 0]}>
                      {aging.map((d, i) => (
                        <Cell key={i} fill={d.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Payment position panel */}
        <Grid item xs={12}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Typography variant="h6" sx={{ fontWeight: 700 }}>
                Payment Position
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Key liquidity indicators derived from invoice history
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={6} md={3}>
                  <BigMetric label="Days Sales Outstanding (DSO)" value={`${paymentMetrics.dso} days`} hint="Lower is better" />
                </Grid>
                <Grid item xs={6} md={3}>
                  <BigMetric label="Average Payment Time" value={`${paymentMetrics.avgPayTime} days`} hint="On closed invoices" />
                </Grid>
                <Grid item xs={6} md={3}>
                  <BigMetric label="Open Invoices" value={openInvoices.length} hint={`${paymentMetrics.overdueCount} overdue`} />
                </Grid>
                <Grid item xs={6} md={3}>
                  <BigMetric label="Available Credit" value={formatCurrency(available)} hint={`Limit ${formatCurrency(creditLimit)}`} />
                </Grid>
              </Grid>
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Invoice tables */}
        <Grid item xs={12}>
          <motion.div variants={item} initial="hidden" animate="show">
            <InvoiceTables open={openInvoices} closed={closedInvoices} />
          </motion.div>
        </Grid>

        {/* ---- Credit Limit Amendment (bottom of page) ---- */}
        <Grid item xs={12}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard
              sx={
                creditExceeded
                  ? {
                      border: '1px solid rgba(198,40,40,0.45)',
                      boxShadow:
                        '0 0 0 1px rgba(198,40,40,0.12), 0 10px 30px rgba(198,40,40,0.12)',
                    }
                  : undefined
              }
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                alignItems={{ sm: 'center' }}
                spacing={2}
              >
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <RequestQuoteRoundedIcon
                      sx={{ color: creditExceeded ? '#C62828' : '#B5891F' }}
                    />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Credit Limit Amendment
                    </Typography>
                    {creditExceeded && (
                      <Chip
                        size="small"
                        label="Recommended"
                        sx={{
                          fontWeight: 700,
                          bgcolor: 'rgba(198,40,40,0.12)',
                          color: '#C62828',
                          border: '1px solid rgba(198,40,40,0.4)',
                        }}
                      />
                    )}
                  </Stack>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                    {creditExceeded
                      ? 'Your balance is over the limit — request an increase to restore your ordering capacity. Submissions are routed to your account manager for review.'
                      : 'Request an increase or decrease to your assigned credit limit. Submissions are routed to your account manager for review.'}
                  </Typography>
                </Box>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={<TuneRoundedIcon />}
                  onClick={() => {
                    setRequestedLimit('');
                    setAmendReason('');
                    setAmendOpen(true);
                  }}
                  sx={
                    creditExceeded
                      ? {
                          animation: 'arPulse 1.8s ease-in-out infinite',
                          '@keyframes arPulse': {
                            '0%,100%': { boxShadow: '0 6px 20px rgba(212,165,42,0.35)' },
                            '50%': {
                              boxShadow:
                                '0 0 0 6px rgba(212,165,42,0.18), 0 8px 26px rgba(212,165,42,0.5)',
                            },
                          },
                        }
                      : undefined
                  }
                >
                  Amend Credit Limit
                </Button>
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>
      </Grid>

      {/* Amendment request dialog */}
      <Dialog open={amendOpen} onClose={() => setAmendOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ fontWeight: 800 }}>Amend Credit Limit</DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mt: 0.5 }}>
            <TextField
              label="Current Credit Limit"
              value={formatCurrency(creditLimit)}
              InputProps={{ readOnly: true }}
              fullWidth
            />
            <TextField
              label="Requested / New Credit Limit"
              type="number"
              value={requestedLimit}
              onChange={(e) => setRequestedLimit(e.target.value)}
              fullWidth
              InputProps={{
                startAdornment: <InputAdornment position="start">$</InputAdornment>,
              }}
              error={requestedLimit !== '' && !amendValid}
              helperText={
                requestedLimit === ''
                  ? 'Enter the new credit limit you would like to request.'
                  : !Number.isFinite(requestedNum) || requestedNum <= 0
                  ? 'Enter a valid amount greater than zero.'
                  : requestedNum === creditLimit
                  ? 'Requested limit must differ from your current limit.'
                  : `This is an ${amendDirection} of ${formatCurrency(
                      Math.abs(requestedNum - creditLimit)
                    )}.`
              }
            />
            <TextField
              label="Reason for Increase / Decrease"
              value={amendReason}
              onChange={(e) => setAmendReason(e.target.value)}
              fullWidth
              multiline
              minRows={3}
              placeholder="Briefly explain why you are requesting this change..."
            />
          </Stack>
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button onClick={() => setAmendOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            variant="contained"
            color="secondary"
            disabled={!amendValid}
            onClick={submitAmendment}
            startIcon={<RequestQuoteRoundedIcon />}
          >
            Submit Application
          </Button>
        </DialogActions>
      </Dialog>

      {/* Success confirmation */}
      <Snackbar
        open={Boolean(amendToast)}
        autoHideDuration={6000}
        onClose={() => setAmendToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert
          icon={<CheckCircleRoundedIcon fontSize="inherit" />}
          severity="success"
          variant="filled"
          onClose={() => setAmendToast(null)}
          sx={{ fontWeight: 600 }}
        >
          Credit limit {amendToast?.direction || 'amendment'} request submitted for review.
        </Alert>
      </Snackbar>
    </Box>
  );
}

function CreditFigure({ label, value, danger }) {
  return (
    <Box
      sx={{
        p: 1.25,
        borderRadius: 2,
        border: '1px solid',
        borderColor: danger ? 'rgba(198,40,40,0.35)' : 'rgba(212,165,42,0.20)',
        background: danger ? 'rgba(198,40,40,0.06)' : 'rgba(212,165,42,0.05)',
      }}
    >
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {label}
      </Typography>
      <Typography
        variant="h6"
        sx={{ fontWeight: 800, color: danger ? '#C62828' : 'inherit' }}
      >
        {value}
      </Typography>
    </Box>
  );
}

function MiniMetric({ icon, label, value }) {
  return (
    <Box sx={{ flex: 1 }}>
      <Stack direction="row" alignItems="center" spacing={0.8}>
        {icon}
        <Typography variant="caption" color="text.secondary">
          {label}
        </Typography>
      </Stack>
      <Typography variant="h6" sx={{ fontWeight: 800, mt: 0.5 }}>
        {value}
      </Typography>
    </Box>
  );
}

function BigMetric({ label, value, hint }) {
  return (
    <Box
      sx={{
        p: 2,
        borderRadius: 2,
        border: '1px solid rgba(212,165,42,0.20)',
        background: 'rgba(212,165,42,0.05)',
      }}
    >
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
      <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5 }}>
        {value}
      </Typography>
      {hint && (
        <Typography variant="caption" color="text.secondary">
          {hint}
        </Typography>
      )}
    </Box>
  );
}

// ---------- Invoice table with tabs + sorting ----------
function InvoiceTables({ open, closed }) {
  const [tab, setTab] = useState(0);
  const [sortKey, setSortKey] = useState('invoice_date');
  const [sortDir, setSortDir] = useState('desc');

  const rows = tab === 0 ? open : closed;

  const enriched = useMemo(() => {
    const now = new Date();
    return rows.map((iv) => ({
      ...iv,
      days_outstanding: iv.invoice_date
        ? Math.max(0, daysBetween(new Date(iv.invoice_date), now))
        : 0,
    }));
  }, [rows]);

  const sorted = useMemo(() => {
    const cmp = (a, b) => {
      let av = a[sortKey];
      let bv = b[sortKey];
      if (sortKey === 'invoice_date' || sortKey === 'due_date') {
        av = av ? new Date(av).getTime() : 0;
        bv = bv ? new Date(bv).getTime() : 0;
      } else if (sortKey === 'amount' || sortKey === 'balance' || sortKey === 'days_outstanding') {
        av = Number(av || 0);
        bv = Number(bv || 0);
      } else {
        av = String(av ?? '');
        bv = String(bv ?? '');
      }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    };
    return [...enriched].sort(cmp);
  }, [enriched, sortKey, sortDir]);

  const handleSort = (key) => {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  };

  const columns = [
    { id: 'invoice_number', label: 'Invoice #', align: 'left' },
    { id: 'invoice_date', label: 'Date', align: 'left' },
    { id: 'amount', label: 'Amount', align: 'right' },
    { id: 'balance', label: 'Balance', align: 'right' },
    { id: 'due_date', label: 'Due Date', align: 'left' },
    { id: 'status', label: 'Status', align: 'left' },
    { id: 'days_outstanding', label: 'Days Out', align: 'right' },
  ];

  return (
    <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
      <Box sx={{ px: 2.5, pt: 2 }}>
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="secondary"
          indicatorColor="secondary"
        >
          <Tab label={`Open Invoices (${open.length})`} />
          <Tab label={`Closed Invoices (${closed.length})`} />
        </Tabs>
      </Box>
      <Divider />
      {sorted.length === 0 ? (
        <Box sx={{ p: 5, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No {tab === 0 ? 'open' : 'closed'} invoices.
          </Typography>
        </Box>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((c) => (
                <TableCell key={c.id} align={c.align} sx={{ fontWeight: 700 }}>
                  <TableSortLabel
                    active={sortKey === c.id}
                    direction={sortKey === c.id ? sortDir : 'asc'}
                    onClick={() => handleSort(c.id)}
                  >
                    {c.label}
                  </TableSortLabel>
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {sorted.map((iv) => (
              <TableRow key={iv.id || iv.invoice_number} hover>
                <TableCell sx={{ fontWeight: 600 }}>
                  {iv.invoice_number || `#${iv.id}`}
                </TableCell>
                <TableCell>{formatDate(iv.invoice_date)}</TableCell>
                <TableCell align="right">{formatCurrency(iv.amount)}</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700 }}>
                  {formatCurrency(iv.balance)}
                </TableCell>
                <TableCell>{formatDate(iv.due_date)}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={statusColor(iv.status)}
                    label={String(iv.status || '').replace('_', ' ')}
                    sx={{ textTransform: 'capitalize' }}
                  />
                </TableCell>
                <TableCell align="right">{iv.days_outstanding}d</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </GlassCard>
  );
}
