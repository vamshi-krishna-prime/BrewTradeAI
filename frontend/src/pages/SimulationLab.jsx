import React, { useCallback, useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  Chip,
  Button,
  IconButton,
  Snackbar,
  Alert,
  LinearProgress,
  Tooltip,
  Skeleton,
} from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  Legend,
} from 'recharts';

import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import WarningIcon from '@mui/icons-material/Warning';
import CreditCardOffIcon from '@mui/icons-material/CreditCardOff';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RestoreIcon from '@mui/icons-material/Restore';
import ScienceIcon from '@mui/icons-material/Science';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import HistoryIcon from '@mui/icons-material/History';
import RefreshIcon from '@mui/icons-material/Refresh';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';

import GlassCard from '../components/common/GlassCard.jsx';
import SimulationButton from '../components/exec/SimulationButton.jsx';
import client from '../api/client.js';
import { goldGradient } from '../theme.js';
import { formatDate } from '../utils/format.js';

// =============================================================================
// Event metadata: maps event_type -> icon, label, accent color
// =============================================================================
const EVENT_META = {
  demand_spike: {
    label: 'Demand Spike',
    icon: <TrendingUpIcon />,
    color: '#2E7D32',
    bg: 'rgba(46,125,50,0.10)',
  },
  inventory_shortage: {
    label: 'Inventory Shortage',
    icon: <WarningIcon />,
    color: '#B71C1C',
    bg: 'rgba(198,40,40,0.10)',
  },
  credit_risk: {
    label: 'Credit Risk',
    icon: <CreditCardOffIcon />,
    color: '#8C5A14',
    bg: 'rgba(232,163,61,0.14)',
  },
  new_promotion: {
    label: 'New Promotion',
    icon: <LocalOfferIcon />,
    color: '#B5891F',
    bg: 'rgba(212,165,42,0.14)',
  },
  shipping_delay: {
    label: 'Shipping Delay',
    icon: <LocalShippingIcon />,
    color: '#0277BD',
    bg: 'rgba(2,119,189,0.10)',
  },
  new_customer: {
    label: 'New Customer',
    icon: <PersonAddIcon />,
    color: '#1B5E20',
    bg: 'rgba(46,125,50,0.10)',
  },
  inventory_recovery: {
    label: 'Inventory Recovery',
    icon: <RestoreIcon />,
    color: '#0288D1',
    bg: 'rgba(2,136,209,0.10)',
  },
  auto_tick: {
    label: 'Auto Tick',
    icon: <HistoryIcon />,
    color: '#5A5A5A',
    bg: 'rgba(90,90,90,0.10)',
  },
};

function metaFor(eventType) {
  return (
    EVENT_META[eventType] || {
      label: eventType || 'Event',
      icon: <ScienceIcon />,
      color: '#5A5A5A',
      bg: 'rgba(90,90,90,0.10)',
    }
  );
}

// =============================================================================
// Simulation control buttons configuration
// =============================================================================
const SIM_BUTTONS = [
  {
    key: 'demand-spike',
    label: 'Simulate Demand Spike',
    description: 'Surge of orders against a hot product line.',
    icon: <TrendingUpIcon />,
  },
  {
    key: 'inventory-shortage',
    label: 'Simulate Inventory Shortage',
    description: 'Push 1-2 SKUs below MOQ — see who reacts first.',
    icon: <WarningIcon />,
  },
  {
    key: 'credit-risk',
    label: 'Simulate Credit Risk',
    description: 'Spike outstanding balance for a customer.',
    icon: <CreditCardOffIcon />,
  },
  {
    key: 'new-promotion',
    label: 'Simulate New Promotion',
    description: 'Launch a 7-day promo on a random product.',
    icon: <LocalOfferIcon />,
  },
  {
    key: 'shipping-delay',
    label: 'Simulate Shipping Delay',
    description: 'Inject a delay event on a processing order.',
    icon: <LocalShippingIcon />,
  },
  {
    key: 'new-customer',
    label: 'Simulate New Customer',
    description: 'Onboard a new distributor with access rows.',
    icon: <PersonAddIcon />,
  },
  {
    key: 'inventory-recovery',
    label: 'Simulate Inventory Recovery',
    description: 'Restock low/critical products to healthy levels.',
    icon: <RestoreIcon />,
  },
];

// =============================================================================
// API helpers
// =============================================================================
const fetchLog = () =>
  client.get('/simulation/log', { params: { limit: 50 } }).then((r) => r.data);
const fetchStatus = () => client.get('/simulation/status').then((r) => r.data);
const runEvent = (key) => client.post(`/simulation/${key}`).then((r) => r.data);

// =============================================================================
// Hero
// =============================================================================
function Hero({ onReset, resetting }) {
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        p: { xs: 2.5, md: 3.25 },
        mb: 2.5,
        background:
          'linear-gradient(135deg, rgba(26,26,26,0.92) 0%, rgba(40,28,8,0.92) 60%, rgba(60,42,12,0.92) 100%)',
        border: '1px solid rgba(212,165,42,0.45)',
        boxShadow: '0 12px 40px rgba(0,0,0,0.25)',
        color: '#fff',
      }}
    >
      {/* Grid overlay for control-room vibe */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.18,
          backgroundImage:
            'linear-gradient(rgba(212,165,42,0.25) 1px, transparent 1px), linear-gradient(90deg, rgba(212,165,42,0.25) 1px, transparent 1px)',
          backgroundSize: '32px 32px',
          pointerEvents: 'none',
        }}
      />
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={2}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ position: 'relative' }}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
            <ScienceIcon sx={{ color: '#F2C849' }} />
            <Typography
              variant="overline"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: '#F2C849',
              }}
            >
              Control Room · Live Sandbox
            </Typography>
          </Stack>
          <Typography
            variant="h3"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.02em',
              background: goldGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1.05,
            }}
          >
            Real-Time Simulation Lab
          </Typography>
          <Typography variant="body2" sx={{ color: 'rgba(255,255,255,0.78)', mt: 0.75 }}>
            Trigger market scenarios. Watch the platform — and Claude — respond in real time.
          </Typography>
        </Box>

        <Stack direction="row" alignItems="center" spacing={1.25}>
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.85,
              px: 1.5,
              py: 0.6,
              borderRadius: 10,
              background: 'rgba(46,125,50,0.20)',
              border: '1px solid rgba(46,125,50,0.55)',
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.9, 0.4, 0.9] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-flex' }}
            >
              <FiberManualRecordIcon sx={{ color: '#7CCB85', fontSize: 12 }} />
            </motion.div>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#A5E0AB',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Streaming
            </Typography>
          </Box>
          <Button
            onClick={onReset}
            disabled={resetting}
            variant="contained"
            color="secondary"
            startIcon={<RestartAltIcon />}
          >
            {resetting ? 'Resetting…' : 'Reset Simulation'}
          </Button>
        </Stack>
      </Stack>
    </Box>
  );
}

// =============================================================================
// Live event log (left panel)
// =============================================================================
function EventLog({ events, isLoading }) {
  return (
    <GlassCard sx={{ p: 2.25, height: '100%' }} hover={false}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: 2,
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1A1A1A',
            boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
          }}
        >
          <HistoryIcon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            Simulation Event Log
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Newest first · refreshes every 5s
          </Typography>
        </Box>
        <Chip
          size="small"
          label={`${events?.length || 0} events`}
          sx={{ background: 'rgba(212,165,42,0.12)', fontWeight: 600 }}
        />
      </Stack>

      <Box
        sx={{
          maxHeight: { xs: 360, lg: 760 },
          overflowY: 'auto',
          pr: 0.5,
          // Custom scrollbar
          '&::-webkit-scrollbar': { width: 8 },
          '&::-webkit-scrollbar-thumb': {
            background: 'rgba(212,165,42,0.35)',
            borderRadius: 99,
          },
        }}
      >
        {isLoading && (!events || events.length === 0) ? (
          <Stack spacing={1}>
            {[0, 1, 2, 3, 4].map((i) => (
              <Skeleton key={i} variant="rounded" height={68} />
            ))}
          </Stack>
        ) : (
          <Stack spacing={1.1}>
            <AnimatePresence initial={false}>
              {(events || []).map((evt) => {
                const meta = metaFor(evt.event_type);
                const payload = evt.payload || {};
                const summary =
                  payload.summary ||
                  payload.message ||
                  payload.description ||
                  meta.label;
                const entities =
                  payload.affected_entities ||
                  payload.entities ||
                  payload.products ||
                  payload.customers ||
                  [];

                return (
                  <motion.div
                    key={evt.id}
                    layout
                    initial={{ opacity: 0, y: -22, backgroundColor: 'rgba(242,200,73,0.45)' }}
                    animate={{
                      opacity: 1,
                      y: 0,
                      backgroundColor: 'rgba(255,255,255,0.0)',
                    }}
                    exit={{ opacity: 0, y: 8 }}
                    transition={{ duration: 0.45, ease: 'easeOut' }}
                    style={{ borderRadius: 12 }}
                  >
                    <Box
                      sx={{
                        p: 1.25,
                        borderRadius: 2,
                        border: `1px solid ${meta.color}33`,
                        background: meta.bg,
                        display: 'flex',
                        gap: 1.25,
                        alignItems: 'flex-start',
                      }}
                    >
                      <Box
                        sx={{
                          width: 34,
                          height: 34,
                          borderRadius: '50%',
                          background: '#fff',
                          color: meta.color,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          border: `1px solid ${meta.color}55`,
                          flexShrink: 0,
                          '& svg': { fontSize: 20 },
                        }}
                      >
                        {meta.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack
                          direction="row"
                          alignItems="center"
                          spacing={0.75}
                          sx={{ mb: 0.25 }}
                        >
                          <Typography
                            variant="caption"
                            sx={{
                              fontWeight: 800,
                              color: meta.color,
                              letterSpacing: '0.12em',
                              textTransform: 'uppercase',
                            }}
                          >
                            {meta.label}
                          </Typography>
                          <Box sx={{ flex: 1 }} />
                          <Typography
                            variant="caption"
                            sx={{ color: 'text.secondary', whiteSpace: 'nowrap' }}
                          >
                            {evt.timestamp
                              ? formatDate(evt.timestamp, 'MMM d, h:mm:ss a')
                              : ''}
                          </Typography>
                        </Stack>
                        <Typography
                          variant="body2"
                          sx={{ lineHeight: 1.45, color: 'text.primary' }}
                        >
                          {summary}
                        </Typography>
                        {Array.isArray(entities) && entities.length > 0 && (
                          <Stack direction="row" spacing={0.5} sx={{ mt: 0.75, flexWrap: 'wrap', gap: 0.5 }}>
                            {entities.slice(0, 6).map((ent, i) => (
                              <Chip
                                key={i}
                                size="small"
                                label={
                                  typeof ent === 'string'
                                    ? ent
                                    : ent.name || ent.label || ent.id || JSON.stringify(ent)
                                }
                                sx={{
                                  background: 'rgba(255,255,255,0.7)',
                                  border: `1px solid ${meta.color}33`,
                                  color: meta.color,
                                  fontWeight: 600,
                                  height: 22,
                                }}
                              />
                            ))}
                          </Stack>
                        )}
                      </Box>
                    </Box>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {(!events || events.length === 0) && !isLoading && (
              <Box
                sx={{
                  textAlign: 'center',
                  py: 4,
                  color: 'text.secondary',
                }}
              >
                <ErrorOutlineIcon sx={{ fontSize: 32, opacity: 0.6, mb: 1 }} />
                <Typography variant="body2">No simulation events yet.</Typography>
                <Typography variant="caption">
                  Trigger a scenario above to populate the live log.
                </Typography>
              </Box>
            )}
          </Stack>
        )}
      </Box>
    </GlassCard>
  );
}

// =============================================================================
// State dashboard (right panel)
// =============================================================================
const ORDER_COLORS = {
  pending_approval: '#E8A33D',
  processing: '#0288D1',
  shipped: '#2E7D32',
};

function StateDashboard({ status, statusLoading, events }) {
  const ordersPie = useMemo(() => {
    if (!status) return [];
    return [
      {
        key: 'pending_approval',
        name: 'Pending Approval',
        value: Number(status.orders_pending_approval || 0),
      },
      {
        key: 'processing',
        name: 'Processing',
        value: Number(status.orders_processing || 0),
      },
      {
        key: 'shipped',
        name: 'Shipped',
        value: Number(status.orders_shipped || 0),
      },
    ].filter((d) => d.value > 0);
  }, [status]);

  // Mini inventory event history: bucket inventory-related events per minute
  const inventoryMiniChart = useMemo(() => {
    if (!events) return [];
    const buckets = {};
    const cutoff = Date.now() - 1000 * 60 * 30; // last 30 minutes
    const inventoryTypes = new Set([
      'inventory_shortage',
      'inventory_recovery',
      'demand_spike',
    ]);
    for (const evt of events) {
      if (!inventoryTypes.has(evt.event_type)) continue;
      if (!evt.timestamp) continue;
      const t = new Date(evt.timestamp).getTime();
      if (t < cutoff) continue;
      const minute = Math.floor(t / 60000) * 60000;
      buckets[minute] = (buckets[minute] || 0) + 1;
    }
    const keys = Object.keys(buckets)
      .map(Number)
      .sort((a, b) => a - b);
    return keys.map((m) => ({
      time: new Date(m).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      events: buckets[m],
    }));
  }, [events]);

  const lowPct = useMemo(() => {
    if (!status) return 0;
    const total = (status.products_low || 0) + (status.products_critical || 0);
    return total ? (status.products_low / (status.products_low + status.products_critical + 8)) * 100 : 0;
  }, [status]);

  const critPct = useMemo(() => {
    if (!status) return 0;
    const total = (status.products_low || 0) + (status.products_critical || 0);
    return total ? (status.products_critical / (status.products_low + status.products_critical + 8)) * 100 : 0;
  }, [status]);

  return (
    <Stack spacing={2.5}>
      {/* Top stat row */}
      <Grid container spacing={2}>
        <Grid item xs={12} sm={6} md={3}>
          <GlassCard sx={{ p: 2 }} hover={false}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'rgba(232,163,61,0.18)',
                  color: '#8C5A14',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Inventory2OutlinedIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Products Low
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {statusLoading ? '—' : status?.products_low || 0}
                </Typography>
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, lowPct)}
              sx={{
                mt: 1,
                height: 6,
                borderRadius: 99,
                backgroundColor: 'rgba(26,26,26,0.08)',
                '& .MuiLinearProgress-bar': { background: '#E8A33D' },
              }}
            />
          </GlassCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <GlassCard sx={{ p: 2 }} hover={false}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'rgba(198,40,40,0.12)',
                  color: '#B71C1C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <WarningIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Products Critical
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {statusLoading ? '—' : status?.products_critical || 0}
                </Typography>
              </Box>
            </Stack>
            <LinearProgress
              variant="determinate"
              value={Math.min(100, critPct)}
              sx={{
                mt: 1,
                height: 6,
                borderRadius: 99,
                backgroundColor: 'rgba(26,26,26,0.08)',
                '& .MuiLinearProgress-bar': { background: '#C62828' },
              }}
            />
          </GlassCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <GlassCard sx={{ p: 2 }} hover={false}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'rgba(198,40,40,0.12)',
                  color: '#B71C1C',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <GroupsOutlinedIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Customers · Red
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {statusLoading ? '—' : status?.customers_red || 0}
                </Typography>
              </Box>
            </Stack>
            <Chip
              size="small"
              label="Credit health"
              sx={{
                mt: 1,
                background: 'rgba(198,40,40,0.10)',
                color: '#B71C1C',
                fontWeight: 600,
                height: 22,
              }}
            />
          </GlassCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <GlassCard sx={{ p: 2 }} hover={false}>
            <Stack direction="row" alignItems="center" spacing={1.25}>
              <Box
                sx={{
                  width: 40,
                  height: 40,
                  borderRadius: 2,
                  background: 'rgba(2,136,209,0.12)',
                  color: '#0277BD',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <ReceiptLongIcon />
              </Box>
              <Box sx={{ flex: 1 }}>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Active Orders
                </Typography>
                <Typography variant="h5" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {statusLoading
                    ? '—'
                    : (status?.orders_pending_approval || 0) +
                      (status?.orders_processing || 0) +
                      (status?.orders_shipped || 0)}
                </Typography>
              </Box>
            </Stack>
            <Chip
              size="small"
              label="Pending / Proc / Shipped"
              sx={{
                mt: 1,
                background: 'rgba(2,136,209,0.10)',
                color: '#01579B',
                fontWeight: 600,
                height: 22,
              }}
            />
          </GlassCard>
        </Grid>
      </Grid>

      {/* Order donut + mini inventory chart */}
      <Grid container spacing={2.5}>
        <Grid item xs={12} md={6}>
          <GlassCard sx={{ p: 2.5 }} hover={false}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
              <ReceiptLongIcon sx={{ color: '#B5891F' }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Orders by Status
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Live workflow distribution
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ height: 240, position: 'relative' }}>
              {statusLoading ? (
                <Skeleton variant="rounded" height={240} />
              ) : (
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={ordersPie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={55}
                      outerRadius={88}
                      paddingAngle={3}
                      stroke="none"
                    >
                      {ordersPie.map((d) => (
                        <Cell key={d.key} fill={ORDER_COLORS[d.key] || '#888'} />
                      ))}
                    </Pie>
                    <RTooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(212,165,42,0.35)',
                        background: 'rgba(255,255,255,0.96)',
                      }}
                    />
                    <Legend
                      verticalAlign="bottom"
                      iconType="circle"
                      wrapperStyle={{ fontSize: 11, fontWeight: 600 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Box>
          </GlassCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <GlassCard sx={{ p: 2.5 }} hover={false}>
            <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1 }}>
              <Inventory2OutlinedIcon sx={{ color: '#B5891F' }} />
              <Box>
                <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                  Recent Inventory Events
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  Per-minute, last 30 minutes
                </Typography>
              </Box>
            </Stack>
            <Box sx={{ height: 240 }}>
              {inventoryMiniChart.length === 0 ? (
                <Box
                  sx={{
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexDirection: 'column',
                    color: 'text.secondary',
                  }}
                >
                  <HourglassBottomIcon sx={{ fontSize: 32, opacity: 0.55, mb: 1 }} />
                  <Typography variant="body2">No inventory events in the last 30 min.</Typography>
                </Box>
              ) : (
                <ResponsiveContainer>
                  <AreaChart data={inventoryMiniChart} margin={{ top: 4, right: 14, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="invMini" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#F2C849" stopOpacity={0.85} />
                        <stop offset="100%" stopColor="#D4A52A" stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#5A5A5A' }} />
                    <YAxis tick={{ fontSize: 11, fill: '#5A5A5A' }} allowDecimals={false} />
                    <RTooltip
                      contentStyle={{
                        borderRadius: 10,
                        border: '1px solid rgba(212,165,42,0.35)',
                        background: 'rgba(255,255,255,0.96)',
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="events"
                      stroke="#D4A52A"
                      strokeWidth={2.5}
                      fill="url(#invMini)"
                    />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </Box>
          </GlassCard>
        </Grid>
      </Grid>
    </Stack>
  );
}

// =============================================================================
// Main page
// =============================================================================
export default function SimulationLab() {
  const queryClient = useQueryClient();
  const [pendingKey, setPendingKey] = useState(null);
  const [toast, setToast] = useState(null); // { severity, message }
  const [resetting, setResetting] = useState(false);

  const logQ = useQuery({
    queryKey: ['sim', 'log'],
    queryFn: fetchLog,
    refetchInterval: 5_000,
  });
  const statusQ = useQuery({
    queryKey: ['sim', 'status'],
    queryFn: fetchStatus,
    refetchInterval: 5_000,
  });

  const refreshAll = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['sim'] });
    // Also nudge executive analytics if it's cached
    queryClient.invalidateQueries({ queryKey: ['exec'] });
  }, [queryClient]);

  const runMut = useMutation({
    mutationFn: runEvent,
    onMutate: (key) => {
      setPendingKey(key);
    },
    onSuccess: (data, key) => {
      const meta = SIM_BUTTONS.find((b) => b.key === key);
      const summary =
        (data && (data.summary || data.message || data.description)) ||
        `${meta?.label || 'Event'} triggered successfully.`;
      setToast({ severity: 'success', message: summary });
      refreshAll();
    },
    onError: (err, key) => {
      const meta = SIM_BUTTONS.find((b) => b.key === key);
      const msg =
        err?.response?.data?.detail ||
        err?.message ||
        `Failed to trigger ${meta?.label || key}.`;
      setToast({ severity: 'error', message: msg });
    },
    onSettled: () => {
      setPendingKey(null);
    },
  });

  const handleReset = useCallback(async () => {
    setResetting(true);
    try {
      const r = await client.post('/simulation/inventory-recovery');
      setToast({
        severity: 'success',
        message:
          (r?.data && (r.data.summary || r.data.message)) ||
          'Simulation reset — inventory recovered.',
      });
      refreshAll();
    } catch (err) {
      setToast({
        severity: 'error',
        message:
          err?.response?.data?.detail || err?.message || 'Reset failed.',
      });
    } finally {
      setResetting(false);
    }
  }, [refreshAll]);

  return (
    <Box>
      <Hero onReset={handleReset} resetting={resetting} />

      {/* Action buttons grid */}
      <Box sx={{ mb: 2.5 }}>
        <Stack
          direction="row"
          alignItems="center"
          justifyContent="space-between"
          sx={{ mb: 1.5 }}
        >
          <Typography
            variant="overline"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.22em',
              color: 'text.secondary',
            }}
          >
            Scenario Controls
          </Typography>
          <Tooltip title="Refresh live state">
            <IconButton
              size="small"
              onClick={refreshAll}
              sx={{
                background: 'rgba(212,165,42,0.10)',
                border: '1px solid rgba(212,165,42,0.30)',
                '&:hover': { background: 'rgba(212,165,42,0.18)' },
              }}
            >
              <RefreshIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        </Stack>
        <Grid container spacing={2}>
          {SIM_BUTTONS.map((btn) => (
            <Grid item xs={12} sm={6} md={4} lg={3} key={btn.key}>
              <SimulationButton
                icon={btn.icon}
                label={btn.label}
                description={btn.description}
                loading={pendingKey === btn.key}
                disabled={!!pendingKey && pendingKey !== btn.key}
                onClick={() => runMut.mutate(btn.key)}
              />
            </Grid>
          ))}
        </Grid>
      </Box>

      {/* Live panels */}
      <Grid container spacing={2.5} alignItems="stretch">
        <Grid item xs={12} lg={5}>
          <EventLog events={logQ.data} isLoading={logQ.isLoading} />
        </Grid>
        <Grid item xs={12} lg={7}>
          <StateDashboard
            status={statusQ.data}
            statusLoading={statusQ.isLoading}
            events={logQ.data}
          />
        </Grid>
      </Grid>

      {/* Toast snackbar */}
      <Snackbar
        open={!!toast}
        autoHideDuration={4200}
        onClose={() => setToast(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {toast ? (
          <Alert
            onClose={() => setToast(null)}
            severity={toast.severity}
            variant="filled"
            sx={{
              fontWeight: 600,
              boxShadow: '0 10px 30px rgba(26,26,26,0.18)',
            }}
          >
            {toast.message}
          </Alert>
        ) : (
          <div />
        )}
      </Snackbar>
    </Box>
  );
}
