import React, { useMemo } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
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
  Avatar,
  IconButton,
  Tooltip,
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import CancelOutlinedIcon from '@mui/icons-material/CancelOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PaidOutlinedIcon from '@mui/icons-material/PaidOutlined';
import TimerOutlinedIcon from '@mui/icons-material/TimerOutlined';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import RefreshIcon from '@mui/icons-material/Refresh';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import KPICard from '../components/common/KPICard.jsx';
import TrafficLight from '../components/common/TrafficLight.jsx';
import {
  getPendingApprovals,
  getExecutiveKPIs,
} from '../api/client.js';
import client from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import { goldGradient } from '../theme.js';

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06, delayChildren: 0.05 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 20 } },
};

const RISK_COLORS = {
  high: '#C62828',
  medium: '#E8A33D',
  low: '#2E7D32',
};

function riskChipStyles(level) {
  const key = String(level || 'low').toLowerCase();
  const color = RISK_COLORS[key] || RISK_COLORS.low;
  return {
    background: `${color}1A`,
    color,
    borderColor: `${color}55`,
    fontWeight: 700,
    textTransform: 'capitalize',
  };
}

function startOfDay(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfWeek(d = new Date()) {
  const day = d.getDay(); // 0 Sun .. 6 Sat
  const diff = (day + 6) % 7; // Monday start
  const m = new Date(d);
  m.setDate(d.getDate() - diff);
  return startOfDay(m);
}
function hoursBetween(a, b) {
  return (new Date(b).getTime() - new Date(a).getTime()) / 3_600_000;
}

// Pull inventory list from the same backend the API client knows about.
async function fetchInventory() {
  const { data } = await client.get('/inventory');
  return data;
}

export default function ManagerDashboard() {
  const navigate = useNavigate();

  const pendingQ = useQuery({
    queryKey: ['mgr', 'pending'],
    queryFn: () => getPendingApprovals(),
    staleTime: 30_000,
    retry: 1,
  });

  const ordersQ = useQuery({
    queryKey: ['mgr', 'orders-all'],
    // Slim, order-level projection only — the dashboard derives its KPIs and
    // the 14-day chart purely from status / created_at / total_value, so it
    // skips the heavy items + status_history payload (and its N+1 lazy-load).
    queryFn: () =>
      client.get('/orders', { params: { summary: true } }).then((r) => r.data),
    staleTime: 30_000,
    retry: 1,
  });

  const inventoryQ = useQuery({
    queryKey: ['mgr', 'inventory'],
    queryFn: fetchInventory,
    staleTime: 60_000,
    retry: 1,
  });

  const kpiQ = useQuery({
    queryKey: ['mgr', 'exec-kpis'],
    queryFn: () => getExecutiveKPIs(),
    staleTime: 60_000,
    retry: 1,
  });

  const isLoading =
    pendingQ.isLoading || ordersQ.isLoading || inventoryQ.isLoading;
  const isError =
    pendingQ.isError || ordersQ.isError || inventoryQ.isError;

  // ---------- derive KPIs ----------
  const pending = pendingQ.data || [];
  const allOrders = ordersQ.data || [];
  const inventory = inventoryQ.data || [];
  const execKPIs = kpiQ.data || {};

  const today = startOfDay();
  const weekStart = startOfWeek();

  const approvedToday = useMemo(
    () =>
      allOrders.filter((o) => {
        if (!o.created_at) return false;
        const isApproved = ['approved', 'processing', 'shipped', 'delivered'].includes(
          String(o.status || '').toLowerCase()
        );
        return isApproved && new Date(o.created_at) >= today;
      }).length,
    [allOrders, today]
  );

  const rejectedCount = useMemo(
    () => allOrders.filter((o) => String(o.status || '').toLowerCase() === 'rejected').length,
    [allOrders]
  );

  const highRiskCustomers = useMemo(() => {
    const ids = new Set();
    pending.forEach((p) => {
      if (
        String(p.risk_level).toLowerCase() === 'high' ||
        String(p.customer?.credit_health || '').toLowerCase() === 'red'
      ) {
        if (p.customer?.id) ids.add(p.customer.id);
      }
    });
    return ids.size;
  }, [pending]);

  const inventoryAlerts = useMemo(() => {
    return inventory
      .filter((p) => Number(p.available_quantity) < Number(p.moq || 0) * 2)
      .map((p) => ({
        ...p,
        threshold: (p.moq || 0) * 2,
        deficit: Math.max(0, (p.moq || 0) * 2 - p.available_quantity),
      }))
      .sort((a, b) => b.deficit - a.deficit);
  }, [inventory]);

  const revenueToday = useMemo(
    () =>
      allOrders
        .filter((o) => {
          const isApproved = ['approved', 'processing', 'shipped', 'delivered'].includes(
            String(o.status || '').toLowerCase()
          );
          return (
            isApproved && o.created_at && new Date(o.created_at) >= today
          );
        })
        .reduce((acc, o) => acc + Number(o.total_value || 0), 0),
    [allOrders, today]
  );

  const revenueWeek = useMemo(
    () =>
      allOrders
        .filter((o) => {
          const isApproved = ['approved', 'processing', 'shipped', 'delivered'].includes(
            String(o.status || '').toLowerCase()
          );
          return (
            isApproved && o.created_at && new Date(o.created_at) >= weekStart
          );
        })
        .reduce((acc, o) => acc + Number(o.total_value || 0), 0),
    [allOrders, weekStart]
  );

  // Approval SLA: prefer exec KPI; else compute locally
  const approvalSLA = useMemo(() => {
    if (typeof execKPIs.approval_sla_avg_hours === 'number') {
      return execKPIs.approval_sla_avg_hours;
    }
    const approved = allOrders.filter((o) =>
      ['approved', 'processing', 'shipped', 'delivered'].includes(
        String(o.status || '').toLowerCase()
      )
    );
    if (approved.length === 0) return 0;
    // Without per-status timestamps, approximate as hours since created_at
    const total = approved.reduce(
      (acc, o) => acc + (o.created_at ? hoursBetween(o.created_at, new Date()) : 0),
      0
    );
    return total / approved.length;
  }, [allOrders, execKPIs]);

  // ---------- chart data ----------
  const last14Days = useMemo(() => {
    const days = [];
    for (let i = 13; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      days.push(d);
    }
    return days.map((d) => {
      const next = new Date(d);
      next.setDate(d.getDate() + 1);
      const dayOrders = allOrders.filter(
        (o) =>
          o.created_at &&
          new Date(o.created_at) >= d &&
          new Date(o.created_at) < next
      );
      const approved = dayOrders.filter((o) =>
        ['approved', 'processing', 'shipped', 'delivered'].includes(
          String(o.status || '').toLowerCase()
        )
      ).length;
      const rejected = dayOrders.filter(
        (o) => String(o.status || '').toLowerCase() === 'rejected'
      ).length;
      return {
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        approved,
        rejected,
      };
    });
  }, [allOrders]);

  const riskDistribution = useMemo(() => {
    const counts = { high: 0, medium: 0, low: 0 };
    pending.forEach((p) => {
      const k = String(p.risk_level || 'low').toLowerCase();
      if (counts[k] !== undefined) counts[k] += 1;
    });
    return [
      { name: 'High Risk', value: counts.high, color: RISK_COLORS.high },
      { name: 'Medium Risk', value: counts.medium, color: RISK_COLORS.medium },
      { name: 'Low Risk', value: counts.low, color: RISK_COLORS.low },
    ];
  }, [pending]);
  const totalRisk = riskDistribution.reduce((acc, r) => acc + r.value, 0);

  const topPending = useMemo(
    () =>
      [...pending]
        .sort(
          (a, b) =>
            (Number(b.risk_score) || 0) - (Number(a.risk_score) || 0)
        )
        .slice(0, 5),
    [pending]
  );

  const kpis = [
    {
      label: 'Pending Orders',
      value: pending.length,
      icon: <HourglassBottomIcon />,
    },
    {
      label: 'Approved Today',
      value: approvedToday,
      icon: <CheckCircleOutlineIcon />,
    },
    {
      label: 'Rejected Orders',
      value: rejectedCount,
      icon: <CancelOutlinedIcon />,
    },
    {
      label: 'High Risk Customers',
      value: highRiskCustomers,
      icon: <WarningAmberIcon />,
    },
    {
      label: 'Inventory Alerts',
      value: inventoryAlerts.length,
      icon: <Inventory2OutlinedIcon />,
    },
    {
      label: 'Revenue Today',
      value: revenueToday,
      icon: <PaidOutlinedIcon />,
      format: (n) => formatCurrency(n),
      sub: `${formatCurrency(revenueWeek)} this week`,
    },
    {
      label: 'Approval SLA (avg hrs)',
      value: approvalSLA,
      icon: <TimerOutlinedIcon />,
      format: (n) =>
        Number(n) > 0 ? `${Number(n).toFixed(1)}h` : '0h',
    },
  ];

  // ---------- loading ----------
  if (isLoading) {
    return (
      <Box>
        <PageHeader
          title="Market Manager"
          subtitle="Loading approval workspace..."
        />
        <Grid container spacing={2.5}>
          {Array.from({ length: 7 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} lg={12 / 7} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
          <Grid item xs={12} md={7}>
            <Skeleton variant="rounded" height={360} />
          </Grid>
          <Grid item xs={12} md={5}>
            <Skeleton variant="rounded" height={360} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Market Manager"
        subtitle="Approval queue, risk pulse and inventory intelligence at a glance"
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => {
                  pendingQ.refetch();
                  ordersQ.refetch();
                  inventoryQ.refetch();
                  kpiQ.refetch();
                }}
                sx={{
                  border: '1px solid rgba(212,165,42,0.3)',
                  borderRadius: 2,
                }}
              >
                <RefreshIcon fontSize="small" />
              </IconButton>
            </Tooltip>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<FactCheckIcon />}
              component={RouterLink}
              to="/manager/approvals"
            >
              Open Approval Queue
            </Button>
          </Stack>
        }
      />

      {isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some data feeds are unavailable. The dashboard is showing partial info.
        </Alert>
      )}

      {/* KPIs */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Grid container spacing={2}>
          {kpis.map((k, i) => (
            <Grid item xs={12} sm={6} md={4} lg={12 / 7} key={i}>
              <motion.div variants={itemAnim}>
                <KPICard
                  label={k.label}
                  value={k.value}
                  icon={k.icon}
                  format={k.format}
                />
                {k.sub && (
                  <Typography
                    variant="caption"
                    color="text.secondary"
                    sx={{ pl: 1, display: 'block', mt: 0.5 }}
                  >
                    {k.sub}
                  </Typography>
                )}
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* Two-column section */}
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        {/* Pending approvals */}
        <Grid item xs={12} md={7}>
          <motion.div variants={itemAnim} initial="hidden" animate="show">
            <GlassCard sx={{ p: 0 }}>
              <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 800 }}>
                    Pending Approvals
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Top {Math.min(5, pending.length)} orders by risk score
                  </Typography>
                </Box>
                <Button
                  size="small"
                  color="secondary"
                  endIcon={<ChevronRightIcon />}
                  component={RouterLink}
                  to="/manager/approvals"
                >
                  View all ({pending.length})
                </Button>
              </Box>
              <Divider />

              {topPending.length === 0 ? (
                <Box sx={{ p: 5, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    No orders awaiting approval. Inbox clear.
                  </Typography>
                </Box>
              ) : (
                <Stack divider={<Divider flexItem />}>
                  {topPending.map((o, idx) => {
                    const cust = o.customer || {};
                    const initials = (cust.name || '?')
                      .split(' ')
                      .map((s) => s[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase();
                    return (
                      <motion.div
                        key={o.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.04 * idx }}
                        whileHover={{
                          background: 'rgba(212,165,42,0.05)',
                        }}
                      >
                        <Box
                          onClick={() => navigate(`/manager/review/${o.id}`)}
                          sx={{
                            p: 2,
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1.5,
                            cursor: 'pointer',
                          }}
                        >
                          <Avatar
                            sx={{
                              width: 40,
                              height: 40,
                              background: goldGradient,
                              color: '#1A1A1A',
                              fontWeight: 800,
                              fontSize: '0.9rem',
                            }}
                          >
                            {initials}
                          </Avatar>
                          <Box sx={{ flex: 1, minWidth: 0 }}>
                            <Stack direction="row" alignItems="center" spacing={1}>
                              <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                                {cust.name || 'Customer'}
                              </Typography>
                              <Chip
                                size="small"
                                label={cust.market || '—'}
                                sx={{
                                  background: 'rgba(212,165,42,0.10)',
                                  color: '#8a6b1a',
                                  fontWeight: 600,
                                }}
                              />
                            </Stack>
                            <Stack
                              direction="row"
                              spacing={1.5}
                              alignItems="center"
                              sx={{ mt: 0.4 }}
                            >
                              <Typography variant="caption" color="text.secondary">
                                {o.order_number || `#${o.id}`}
                              </Typography>
                              <Typography variant="caption" color="text.secondary">
                                {formatDate(o.created_at)}
                              </Typography>
                              <Typography
                                variant="caption"
                                sx={{ fontWeight: 700, color: '#1A1A1A' }}
                              >
                                {formatCurrency(o.total_value)}
                              </Typography>
                            </Stack>
                          </Box>
                          <Chip
                            size="small"
                            variant="outlined"
                            label={`Risk: ${o.risk_level || 'low'}`}
                            sx={riskChipStyles(o.risk_level)}
                          />
                          <IconButton size="small">
                            <OpenInNewIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </motion.div>
                    );
                  })}
                </Stack>
              )}
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Inventory alerts */}
        <Grid item xs={12} md={5}>
          <motion.div variants={itemAnim} initial="hidden" animate="show">
            <GlassCard sx={{ p: 0 }}>
              <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <Inventory2OutlinedIcon sx={{ color: '#B5891F' }} />
                    <Typography variant="h6" sx={{ fontWeight: 800 }}>
                      Inventory Alerts
                    </Typography>
                  </Stack>
                  <Typography variant="body2" color="text.secondary">
                    Products below 2x MOQ threshold
                  </Typography>
                </Box>
                <Chip
                  size="small"
                  label={inventoryAlerts.length}
                  sx={{
                    background: 'rgba(198,40,40,0.10)',
                    color: '#B71C1C',
                    fontWeight: 800,
                  }}
                />
              </Box>
              <Divider />

              {inventoryAlerts.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">
                    All products healthy.
                  </Typography>
                </Box>
              ) : (
                <Box sx={{ maxHeight: 340, overflowY: 'auto' }}>
                  <Stack divider={<Divider flexItem />}>
                    {inventoryAlerts.slice(0, 8).map((p, idx) => {
                      const ratio =
                        p.threshold > 0 ? p.available_quantity / p.threshold : 1;
                      const barColor =
                        ratio < 0.34
                          ? '#C62828'
                          : ratio < 0.67
                          ? '#E8A33D'
                          : '#2E7D32';
                      return (
                        <motion.div
                          key={p.product_id}
                          initial={{ opacity: 0, x: 10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.03 * idx }}
                        >
                          <Box sx={{ p: 2 }}>
                            <Stack direction="row" alignItems="center" spacing={1.5}>
                              <Box sx={{ flex: 1, minWidth: 0 }}>
                                <Typography
                                  variant="subtitle2"
                                  sx={{
                                    fontWeight: 700,
                                    whiteSpace: 'nowrap',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                  }}
                                >
                                  {p.name}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  {p.sku} • {p.category}
                                </Typography>
                              </Box>
                              <Box sx={{ textAlign: 'right' }}>
                                <Typography
                                  variant="subtitle2"
                                  sx={{ fontWeight: 800, color: barColor }}
                                >
                                  {p.available_quantity}
                                </Typography>
                                <Typography variant="caption" color="text.secondary">
                                  / {p.threshold} threshold
                                </Typography>
                              </Box>
                            </Stack>
                            <Box
                              sx={{
                                mt: 1,
                                height: 6,
                                width: '100%',
                                borderRadius: 3,
                                background: 'rgba(0,0,0,0.05)',
                                overflow: 'hidden',
                              }}
                            >
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{
                                  width: `${Math.min(100, ratio * 100)}%`,
                                }}
                                transition={{ duration: 0.8, ease: 'easeOut' }}
                                style={{
                                  height: '100%',
                                  background: barColor,
                                  borderRadius: 3,
                                }}
                              />
                            </Box>
                          </Box>
                        </motion.div>
                      );
                    })}
                  </Stack>
                </Box>
              )}
            </GlassCard>
          </motion.div>
        </Grid>
      </Grid>

      {/* Charts row */}
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        {/* Approval performance */}
        <Grid item xs={12} md={8}>
          <motion.div variants={itemAnim} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1}>
                <Typography variant="h6" sx={{ fontWeight: 800 }}>
                  Approval Performance
                </Typography>
                <Box sx={{ flex: 1 }} />
                <Stack direction="row" spacing={1.5}>
                  <LegendDot color="#2E7D32" label="Approved" />
                  <LegendDot color="#C62828" label="Rejected" />
                </Stack>
              </Stack>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Orders approved vs rejected — last 14 days
              </Typography>
              <Box sx={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={last14Days} barGap={4}>
                    <defs>
                      <linearGradient id="approvedBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#4CAF50" />
                        <stop offset="100%" stopColor="#2E7D32" />
                      </linearGradient>
                      <linearGradient id="rejectedBar" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#EF5350" />
                        <stop offset="100%" stopColor="#C62828" />
                      </linearGradient>
                    </defs>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke="rgba(0,0,0,0.06)"
                    />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 11, fill: '#5A5A5A' }}
                      tickLine={false}
                      axisLine={{ stroke: 'rgba(0,0,0,0.08)' }}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: '#5A5A5A' }}
                      tickLine={false}
                      axisLine={false}
                      allowDecimals={false}
                    />
                    <RTooltip
                      cursor={{ fill: 'rgba(212,165,42,0.08)' }}
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(212,165,42,0.25)',
                        boxShadow: '0 10px 28px rgba(0,0,0,0.08)',
                      }}
                    />
                    <Bar
                      dataKey="approved"
                      fill="url(#approvedBar)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                    <Bar
                      dataKey="rejected"
                      fill="url(#rejectedBar)"
                      radius={[6, 6, 0, 0]}
                      maxBarSize={28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </Box>
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Risk distribution */}
        <Grid item xs={12} md={4}>
          <motion.div variants={itemAnim} initial="hidden" animate="show">
            <GlassCard>
              <Typography variant="h6" sx={{ fontWeight: 800 }}>
                Risk Distribution
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Pending orders by AI risk level
              </Typography>
              <Box sx={{ height: 220, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={riskDistribution}
                      dataKey="value"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {riskDistribution.map((entry, i) => (
                        <Cell key={i} fill={entry.color} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(212,165,42,0.25)',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      formatter={(value) => (
                        <span
                          style={{
                            fontSize: 12,
                            color: '#5A5A5A',
                            marginLeft: 4,
                          }}
                        >
                          {value}
                        </span>
                      )}
                    />
                  </PieChart>
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
                    mt: -3,
                  }}
                >
                  <Typography variant="h4" sx={{ fontWeight: 900, lineHeight: 1 }}>
                    {totalRisk}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    pending
                  </Typography>
                </Box>
              </Box>
              <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                {riskDistribution.map((r) => (
                  <Stack
                    key={r.name}
                    direction="row"
                    alignItems="center"
                    spacing={1}
                  >
                    <TrafficLight
                      status={
                        r.color === RISK_COLORS.high
                          ? 'red'
                          : r.color === RISK_COLORS.medium
                          ? 'yellow'
                          : 'green'
                      }
                      size={10}
                    />
                    <Typography variant="body2" sx={{ flex: 1 }}>
                      {r.name}
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {r.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>
      </Grid>
    </Box>
  );
}

function LegendDot({ color, label }) {
  return (
    <Stack direction="row" alignItems="center" spacing={0.7}>
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 0 0 3px ${color}22`,
        }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}
