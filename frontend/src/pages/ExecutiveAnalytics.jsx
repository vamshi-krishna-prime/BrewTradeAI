import React, { useMemo, useState } from 'react';
import {
  Box,
  Grid,
  Stack,
  Typography,
  Chip,
  Button,
  IconButton,
  ToggleButton,
  ToggleButtonGroup,
  Skeleton,
  LinearProgress,
  Table,
  TableHead,
  TableBody,
  TableRow,
  TableCell,
  Divider,
  Tooltip,
  Alert,
} from '@mui/material';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RTooltip,
  ResponsiveContainer,
  Line,
  ComposedChart,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import Plot from 'react-plotly.js';

import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import CreditScoreIcon from '@mui/icons-material/CreditScore';
import PublicIcon from '@mui/icons-material/Public';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import InsightsIcon from '@mui/icons-material/Insights';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';

import GlassCard from '../components/common/GlassCard.jsx';
import KPICard from '../components/common/KPICard.jsx';
import client from '../api/client.js';
import { formatCurrency, formatNumber, formatDate } from '../utils/format.js';
import { goldGradient, goldGradientSoft } from '../theme.js';

// =============================================================================
// API helpers
// =============================================================================
const fetchKPIs = () =>
  client.get('/analytics/executive/kpis').then((r) => r.data);
const fetchRevenueTrend = () =>
  client.get('/analytics/revenue/trend', { params: { period: 'monthly' } }).then((r) => r.data);
const fetchOrdersTrend = () =>
  client.get('/analytics/orders/trend').then((r) => r.data);
const fetchMarket = () =>
  client.get('/analytics/market/comparison').then((r) => r.data);
const fetchInventoryHealth = () =>
  client.get('/analytics/inventory/health').then((r) => r.data);
const fetchCreditDistribution = () =>
  client.get('/analytics/credit/distribution').then((r) => r.data);
const fetchExecSummary = () =>
  client.get('/ai/executive/summary').then((r) => r.data);

// =============================================================================
// Date range helpers
// =============================================================================
const RANGES = [
  { key: '7d', label: 'Last 7 days', days: 7 },
  { key: '30d', label: 'Last 30 days', days: 30 },
  { key: '90d', label: 'Last 90 days', days: 90 },
  { key: 'ytd', label: 'YTD', days: null },
];

function rangeStart(rangeKey) {
  const now = new Date();
  if (rangeKey === 'ytd') return new Date(now.getFullYear(), 0, 1);
  const range = RANGES.find((r) => r.key === rangeKey) || RANGES[3];
  const d = new Date(now);
  d.setDate(d.getDate() - range.days);
  return d;
}

function filterOrdersByRange(rows, rangeKey) {
  if (!Array.isArray(rows)) return [];
  const start = rangeStart(rangeKey);
  return rows.filter((r) => {
    if (!r.date) return false;
    const d = new Date(r.date);
    return d >= start;
  });
}

function filterRevenueByRange(rows, rangeKey) {
  // revenue trend rows are "YYYY-MM" buckets.  For sub-month ranges we keep
  // all months that overlap [start, now]; for YTD we keep current year.
  if (!Array.isArray(rows)) return [];
  const start = rangeStart(rangeKey);
  return rows.filter((r) => {
    if (!r.period) return false;
    const [y, m] = r.period.split('-').map(Number);
    if (!y || !m) return false;
    const bucketEnd = new Date(y, m, 0); // last day of bucket
    return bucketEnd >= start;
  });
}

// =============================================================================
// Hero header
// =============================================================================
function Hero() {
  const today = new Date();
  return (
    <Box
      sx={{
        position: 'relative',
        overflow: 'hidden',
        borderRadius: 3,
        p: { xs: 2.5, md: 3.25 },
        mb: 2.5,
        background:
          'linear-gradient(135deg, rgba(212,165,42,0.16) 0%, rgba(242,200,73,0.10) 40%, rgba(255,255,255,0.65) 100%)',
        border: '1px solid rgba(212,165,42,0.32)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
      }}
    >
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        spacing={2}
      >
        <Box>
          <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 0.5 }}>
            <InsightsIcon sx={{ color: '#B5891F' }} />
            <Typography
              variant="overline"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.22em',
                color: '#B5891F',
              }}
            >
              BrewTrade AI · C-Suite View
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
            Executive Command Center
          </Typography>
          <Typography variant="body2" sx={{ color: 'text.secondary', mt: 0.75 }}>
            {formatDate(today, 'EEEE, MMMM d, yyyy')} · real-time view across global markets
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
              background: 'rgba(46,125,50,0.10)',
              border: '1px solid rgba(46,125,50,0.30)',
            }}
          >
            <motion.div
              animate={{ scale: [1, 1.5, 1], opacity: [0.9, 0.4, 0.9] }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
              style={{ display: 'inline-flex' }}
            >
              <FiberManualRecordIcon sx={{ color: '#2E7D32', fontSize: 12 }} />
            </motion.div>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                color: '#1B5E20',
                letterSpacing: '0.14em',
                textTransform: 'uppercase',
              }}
            >
              Live
            </Typography>
          </Box>
        </Stack>
      </Stack>
    </Box>
  );
}

// =============================================================================
// Date range picker
// =============================================================================
function DateRangePicker({ value, onChange }) {
  return (
    <ToggleButtonGroup
      value={value}
      exclusive
      size="small"
      onChange={(_e, v) => v && onChange(v)}
      sx={{
        '& .MuiToggleButton-root': {
          textTransform: 'none',
          fontWeight: 600,
          px: 1.6,
          borderColor: 'rgba(212,165,42,0.35)',
          color: 'text.primary',
        },
        '& .Mui-selected': {
          background: goldGradient,
          color: '#1A1A1A !important',
          '&:hover': { background: goldGradient, filter: 'brightness(1.05)' },
        },
      }}
    >
      {RANGES.map((r) => (
        <ToggleButton key={r.key} value={r.key} aria-label={r.label}>
          {r.label}
        </ToggleButton>
      ))}
    </ToggleButtonGroup>
  );
}

// =============================================================================
// Revenue Trends (Plotly area, gold gradient fill)
// =============================================================================
function RevenueTrendsChart({ data, isLoading }) {
  const series = useMemo(() => {
    const last12 = (data || []).slice(-12);
    return {
      x: last12.map((d) => d.period),
      y: last12.map((d) => Number(d.revenue || 0)),
    };
  }, [data]);

  return (
    <GlassCard sx={{ p: 2.5 }} hover={false}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Revenue Trends
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Last 12 months · approved orders
          </Typography>
        </Box>
        <Chip
          size="small"
          label="Monthly"
          sx={{ background: 'rgba(212,165,42,0.12)', fontWeight: 600 }}
        />
      </Stack>
      {isLoading ? (
        <Skeleton variant="rounded" height={280} />
      ) : (
        <Box sx={{ height: 280, width: '100%' }}>
          <Plot
            data={[
              {
                x: series.x,
                y: series.y,
                type: 'scatter',
                mode: 'lines',
                fill: 'tozeroy',
                line: { color: '#D4A52A', width: 3, shape: 'spline', smoothing: 0.8 },
                fillcolor: 'rgba(242,200,73,0.32)',
                hovertemplate: '<b>%{x}</b><br>$%{y:,.0f}<extra></extra>',
              },
            ]}
            layout={{
              autosize: true,
              margin: { l: 56, r: 18, t: 12, b: 36 },
              paper_bgcolor: 'rgba(0,0,0,0)',
              plot_bgcolor: 'rgba(0,0,0,0)',
              font: { family: 'Inter, system-ui, sans-serif', color: '#1A1A1A', size: 12 },
              xaxis: {
                gridcolor: 'rgba(26,26,26,0.06)',
                tickfont: { size: 11 },
              },
              yaxis: {
                gridcolor: 'rgba(26,26,26,0.06)',
                tickprefix: '$',
                tickformat: ',.0f',
                tickfont: { size: 11 },
              },
              showlegend: false,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: '100%', height: '100%' }}
            useResizeHandler
          />
        </Box>
      )}
    </GlassCard>
  );
}

// =============================================================================
// Order Trends (Recharts dual-axis bar + line)
// =============================================================================
function OrderTrendsChart({ data, isLoading }) {
  return (
    <GlassCard sx={{ p: 2.5 }} hover={false}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Order Trends
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Daily volume (count) and value
          </Typography>
        </Box>
        <Stack direction="row" spacing={0.75}>
          <Chip
            size="small"
            label="Count"
            sx={{ background: 'rgba(212,165,42,0.12)', fontWeight: 600 }}
          />
          <Chip
            size="small"
            label="Value"
            sx={{ background: 'rgba(46,125,50,0.10)', color: '#1B5E20', fontWeight: 600 }}
          />
        </Stack>
      </Stack>
      {isLoading ? (
        <Skeleton variant="rounded" height={280} />
      ) : (
        <Box sx={{ height: 280, width: '100%' }}>
          <ResponsiveContainer>
            <ComposedChart data={data || []} margin={{ top: 8, right: 16, left: 4, bottom: 4 }}>
              <defs>
                <linearGradient id="barGold" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#F2C849" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#D4A52A" stopOpacity={0.7} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(26,26,26,0.06)" vertical={false} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 11, fill: '#5A5A5A' }}
                tickFormatter={(v) => {
                  try {
                    return formatDate(v, 'MMM d');
                  } catch {
                    return v;
                  }
                }}
              />
              <YAxis
                yAxisId="left"
                tick={{ fontSize: 11, fill: '#5A5A5A' }}
                allowDecimals={false}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                tick={{ fontSize: 11, fill: '#5A5A5A' }}
                tickFormatter={(v) => `$${formatNumber(v)}`}
              />
              <RTooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid rgba(212,165,42,0.35)',
                  background: 'rgba(255,255,255,0.96)',
                }}
                formatter={(val, name) =>
                  name === 'value' ? [`$${formatNumber(val)}`, 'Value'] : [val, 'Orders']
                }
              />
              <Bar
                yAxisId="left"
                dataKey="orders"
                fill="url(#barGold)"
                radius={[6, 6, 0, 0]}
                maxBarSize={28}
                name="orders"
              />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="value"
                stroke="#2E7D32"
                strokeWidth={2.5}
                dot={{ r: 2 }}
                activeDot={{ r: 5 }}
                name="value"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </Box>
      )}
    </GlassCard>
  );
}

// =============================================================================
// Market Comparison (Recharts horizontal bar)
// =============================================================================
function MarketComparisonChart({ data, isLoading }) {
  const series = useMemo(() => {
    return (data || [])
      .map((m) => ({
        market: m.market,
        revenue: Number(m.revenue || 0),
        orders: Number(m.orders || 0),
      }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);
  }, [data]);

  return (
    <GlassCard sx={{ p: 2.5 }} hover={false}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Market Performance
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Revenue per market
          </Typography>
        </Box>
      </Stack>
      {isLoading ? (
        <Skeleton variant="rounded" height={280} />
      ) : (
        <Box sx={{ height: 280, width: '100%' }}>
          <ResponsiveContainer>
            <BarChart
              data={series}
              layout="vertical"
              margin={{ top: 4, right: 18, left: 14, bottom: 4 }}
            >
              <defs>
                <linearGradient id="hbGold" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#D4A52A" stopOpacity={0.95} />
                  <stop offset="100%" stopColor="#F2C849" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(26,26,26,0.06)" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fontSize: 11, fill: '#5A5A5A' }}
                tickFormatter={(v) => `$${formatNumber(v)}`}
              />
              <YAxis
                type="category"
                dataKey="market"
                tick={{ fontSize: 12, fill: '#1A1A1A', fontWeight: 600 }}
                width={110}
              />
              <RTooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid rgba(212,165,42,0.35)',
                  background: 'rgba(255,255,255,0.96)',
                }}
                formatter={(val) => [`$${formatNumber(val)}`, 'Revenue']}
              />
              <Bar dataKey="revenue" fill="url(#hbGold)" radius={[0, 6, 6, 0]} maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </Box>
      )}
    </GlassCard>
  );
}

// =============================================================================
// Credit Risk Distribution (Recharts donut)
// =============================================================================
const CREDIT_COLORS = { green: '#2E7D32', yellow: '#E8A33D', red: '#C62828' };

function CreditDistributionChart({ data, isLoading }) {
  const slices = useMemo(() => {
    const dist = (data && data.distribution) || [];
    return dist
      .map((d) => ({
        name: d.bucket.charAt(0).toUpperCase() + d.bucket.slice(1),
        bucket: d.bucket,
        value: Number(d.count || 0),
        percentage: Number(d.percentage || 0),
      }))
      .filter((d) => d.value > 0);
  }, [data]);

  const total = useMemo(() => slices.reduce((s, d) => s + d.value, 0), [slices]);

  return (
    <GlassCard sx={{ p: 2.5 }} hover={false}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Credit Risk Distribution
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Customers bucketed by credit health
          </Typography>
        </Box>
      </Stack>
      {isLoading ? (
        <Skeleton variant="rounded" height={280} />
      ) : (
        <Box sx={{ position: 'relative', height: 280, width: '100%' }}>
          <ResponsiveContainer>
            <PieChart>
              <Pie
                data={slices}
                dataKey="value"
                nameKey="name"
                innerRadius={68}
                outerRadius={100}
                paddingAngle={3}
                stroke="none"
              >
                {slices.map((entry) => (
                  <Cell key={entry.bucket} fill={CREDIT_COLORS[entry.bucket] || '#999'} />
                ))}
              </Pie>
              <RTooltip
                contentStyle={{
                  borderRadius: 10,
                  border: '1px solid rgba(212,165,42,0.35)',
                  background: 'rgba(255,255,255,0.96)',
                }}
                formatter={(val, name) => [val, name]}
              />
              <Legend
                verticalAlign="bottom"
                iconType="circle"
                wrapperStyle={{ fontSize: 12, fontWeight: 600 }}
              />
            </PieChart>
          </ResponsiveContainer>
          {/* Center label */}
          <Box
            sx={{
              position: 'absolute',
              top: '46%',
              left: 0,
              right: 0,
              textAlign: 'center',
              transform: 'translateY(-50%)',
              pointerEvents: 'none',
            }}
          >
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              Customers
            </Typography>
            <Typography variant="h4" sx={{ fontWeight: 800, lineHeight: 1 }}>
              {total}
            </Typography>
          </Box>
        </Box>
      )}
    </GlassCard>
  );
}

// =============================================================================
// Inventory Health table (categories + stock bars)
// =============================================================================
function InventoryHealthTable({ data, isLoading }) {
  return (
    <GlassCard sx={{ p: 2.5 }} hover={false}>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 1.5 }}>
        <Box>
          <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
            Inventory Health by Category
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Stock utilization and product counts across categories
          </Typography>
        </Box>
        <Inventory2OutlinedIcon sx={{ color: '#B5891F' }} />
      </Stack>

      {isLoading ? (
        <Stack spacing={1}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} variant="rounded" height={42} />
          ))}
        </Stack>
      ) : (
        <Box sx={{ overflowX: 'auto' }}>
          <Table size="small" sx={{ minWidth: 600 }}>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary' }}>Category</TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Products
                </TableCell>
                <TableCell align="right" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Units
                </TableCell>
                <TableCell align="center" sx={{ fontWeight: 700, color: 'text.secondary' }}>
                  Health Mix
                </TableCell>
                <TableCell sx={{ fontWeight: 700, color: 'text.secondary', minWidth: 220 }}>
                  Utilization
                </TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {(data || []).map((row) => {
                const util = Number(row.utilization_pct || 0);
                const utilColor =
                  util >= 70 ? '#2E7D32' : util >= 40 ? '#E8A33D' : '#C62828';
                return (
                  <TableRow key={row.category} hover>
                    <TableCell sx={{ fontWeight: 700, textTransform: 'capitalize' }}>
                      {row.category}
                    </TableCell>
                    <TableCell align="right">{row.product_count}</TableCell>
                    <TableCell align="right">{formatNumber(row.total_units)}</TableCell>
                    <TableCell align="center">
                      <Stack direction="row" spacing={0.5} justifyContent="center">
                        {row.healthy ? (
                          <Chip
                            label={`${row.healthy} OK`}
                            size="small"
                            sx={{
                              background: 'rgba(46,125,50,0.10)',
                              color: '#1B5E20',
                              fontWeight: 700,
                              height: 22,
                            }}
                          />
                        ) : null}
                        {row.low ? (
                          <Chip
                            label={`${row.low} Low`}
                            size="small"
                            sx={{
                              background: 'rgba(232,163,61,0.18)',
                              color: '#8C5A14',
                              fontWeight: 700,
                              height: 22,
                            }}
                          />
                        ) : null}
                        {row.critical ? (
                          <Chip
                            label={`${row.critical} Crit`}
                            size="small"
                            sx={{
                              background: 'rgba(198,40,40,0.12)',
                              color: '#B71C1C',
                              fontWeight: 700,
                              height: 22,
                            }}
                          />
                        ) : null}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" alignItems="center" spacing={1}>
                        <Box sx={{ flex: 1, minWidth: 120 }}>
                          <LinearProgress
                            variant="determinate"
                            value={Math.max(0, Math.min(100, util))}
                            sx={{
                              height: 8,
                              borderRadius: 99,
                              backgroundColor: 'rgba(26,26,26,0.08)',
                              '& .MuiLinearProgress-bar': {
                                background: utilColor,
                                borderRadius: 99,
                              },
                            }}
                          />
                        </Box>
                        <Typography variant="body2" sx={{ fontWeight: 700, minWidth: 48, textAlign: 'right' }}>
                          {util.toFixed(0)}%
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!data || data.length === 0) && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ color: 'text.secondary', py: 3 }}>
                    No inventory data available.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Box>
      )}
    </GlassCard>
  );
}

// =============================================================================
// AI Executive Summary panel
// =============================================================================
function ClaudeSummaryPanel({ summary, isLoading, isFetching, onRegenerate }) {
  const narrative = summary?.narrative || {};
  const generatedAt = summary?.generated_at;
  const sections = [
    {
      key: 'highlights',
      title: 'Highlights',
      color: '#1B5E20',
      bg: 'rgba(46,125,50,0.08)',
      icon: <EmojiEventsIcon sx={{ fontSize: 18 }} />,
      items: narrative.highlights || [],
    },
    {
      key: 'concerns',
      title: 'Concerns',
      color: '#B71C1C',
      bg: 'rgba(198,40,40,0.08)',
      icon: <WarningAmberIcon sx={{ fontSize: 18 }} />,
      items: narrative.concerns || [],
    },
    {
      key: 'recommendations',
      title: 'Recommendations',
      color: '#8C5A14',
      bg: 'rgba(232,163,61,0.12)',
      icon: <LightbulbOutlinedIcon sx={{ fontSize: 18 }} />,
      items: narrative.recommendations || [],
    },
  ];

  return (
    <GlassCard sx={{ p: 2.5, height: '100%' }} hover={false}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
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
          <AutoAwesomeIcon />
        </Box>
        <Box sx={{ flex: 1 }}>
          <Typography variant="subtitle1" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
            AI Executive Summary
          </Typography>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            {generatedAt
              ? `Generated ${formatDate(generatedAt, 'MMM d, h:mm a')}`
              : 'AI-generated executive briefing'}
          </Typography>
        </Box>
        <Tooltip title="Regenerate summary">
          <span>
            <IconButton
              onClick={onRegenerate}
              disabled={isFetching}
              size="small"
              sx={{
                background: 'rgba(212,165,42,0.10)',
                border: '1px solid rgba(212,165,42,0.30)',
                '&:hover': { background: 'rgba(212,165,42,0.18)' },
              }}
            >
              <motion.div
                animate={isFetching ? { rotate: 360 } : { rotate: 0 }}
                transition={
                  isFetching
                    ? { duration: 1, repeat: Infinity, ease: 'linear' }
                    : { duration: 0.3 }
                }
                style={{ display: 'inline-flex' }}
              >
                <RefreshIcon fontSize="small" />
              </motion.div>
            </IconButton>
          </span>
        </Tooltip>
      </Stack>

      {isLoading ? (
        <Stack spacing={1}>
          <Skeleton variant="rounded" height={70} />
          <Skeleton variant="rounded" height={50} />
          <Skeleton variant="rounded" height={50} />
          <Skeleton variant="rounded" height={50} />
        </Stack>
      ) : (
        <>
          {/* Summary mini-section */}
          <Box
            sx={{
              p: 1.5,
              mb: 1.5,
              borderRadius: 2,
              background: goldGradientSoft,
              border: '1px solid rgba(212,165,42,0.25)',
            }}
          >
            <Typography variant="body2" sx={{ lineHeight: 1.55, color: 'text.primary' }}>
              {narrative.summary || 'Executive summary will appear here once generated.'}
            </Typography>
          </Box>

          {/* Mini-sections */}
          <Stack spacing={1.25}>
            {sections.map((sec) => (
              <Box
                key={sec.key}
                sx={{
                  p: 1.25,
                  borderRadius: 2,
                  background: sec.bg,
                  border: `1px solid ${sec.color}33`,
                }}
              >
                <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mb: 0.5 }}>
                  <Box sx={{ color: sec.color, display: 'inline-flex' }}>{sec.icon}</Box>
                  <Typography
                    variant="caption"
                    sx={{
                      fontWeight: 800,
                      color: sec.color,
                      letterSpacing: '0.14em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {sec.title}
                  </Typography>
                </Stack>
                {sec.items && sec.items.length > 0 ? (
                  <Box component="ul" sx={{ m: 0, pl: 2.25 }}>
                    {sec.items.slice(0, 5).map((item, i) => (
                      <Typography
                        key={i}
                        component="li"
                        variant="body2"
                        sx={{ mb: 0.35, lineHeight: 1.5 }}
                      >
                        {item}
                      </Typography>
                    ))}
                  </Box>
                ) : (
                  <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                    No {sec.title.toLowerCase()} to report.
                  </Typography>
                )}
              </Box>
            ))}
          </Stack>

          <Button
            onClick={onRegenerate}
            disabled={isFetching}
            fullWidth
            color="secondary"
            variant="contained"
            startIcon={<AutoAwesomeIcon />}
            sx={{ mt: 1.5 }}
          >
            {isFetching ? 'Regenerating…' : 'Regenerate Summary'}
          </Button>
        </>
      )}
    </GlassCard>
  );
}

// =============================================================================
// Main page
// =============================================================================
export default function ExecutiveAnalytics() {
  const [range, setRange] = useState('ytd');
  const queryClient = useQueryClient();

  const POLL = 30_000;

  const kpisQ = useQuery({ queryKey: ['exec', 'kpis'], queryFn: fetchKPIs, refetchInterval: POLL });
  const revenueQ = useQuery({ queryKey: ['exec', 'revenueTrend'], queryFn: fetchRevenueTrend, refetchInterval: POLL });
  const ordersQ = useQuery({ queryKey: ['exec', 'ordersTrend'], queryFn: fetchOrdersTrend, refetchInterval: POLL });
  const marketQ = useQuery({ queryKey: ['exec', 'market'], queryFn: fetchMarket, refetchInterval: POLL });
  const inventoryQ = useQuery({ queryKey: ['exec', 'inventory'], queryFn: fetchInventoryHealth, refetchInterval: POLL });
  const creditQ = useQuery({ queryKey: ['exec', 'credit'], queryFn: fetchCreditDistribution, refetchInterval: POLL });
  const summaryQ = useQuery({
    queryKey: ['exec', 'aiSummary'],
    queryFn: fetchExecSummary,
    refetchInterval: 120_000, // AI summary cheaper to refresh more slowly
    staleTime: 60_000,
  });

  const k = kpisQ.data || {};
  const ordersThisYear = k.orders_total || 0;

  // Market index = weighted average growth surrogate; here we surface revenue / customers ratio
  const marketIndex = useMemo(() => {
    const list = k.market_performance || [];
    if (!list.length) return 0;
    const totalRevenue = list.reduce((s, m) => s + Number(m.revenue || 0), 0);
    // Express as $K per market on average
    return Math.round(totalRevenue / list.length / 1000);
  }, [k]);

  const filteredRevenue = useMemo(
    () => filterRevenueByRange(revenueQ.data, range),
    [revenueQ.data, range]
  );
  const filteredOrders = useMemo(
    () => filterOrdersByRange(ordersQ.data, range),
    [ordersQ.data, range]
  );

  const handleRegenerate = () => {
    // Invalidate so the AI summary is re-fetched
    queryClient.invalidateQueries({ queryKey: ['exec', 'aiSummary'] });
  };

  const anyError =
    kpisQ.error ||
    revenueQ.error ||
    ordersQ.error ||
    marketQ.error ||
    inventoryQ.error ||
    creditQ.error;

  return (
    <Box>
      <Hero />

      {/* Toolbar */}
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={1.25}
        alignItems={{ xs: 'flex-start', sm: 'center' }}
        justifyContent="space-between"
        sx={{ mb: 2 }}
      >
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '0.18em' }}>
            Range
          </Typography>
          <DateRangePicker value={range} onChange={setRange} />
        </Stack>
        <Stack direction="row" alignItems="center" spacing={1}>
          <Typography variant="caption" sx={{ color: 'text.secondary' }}>
            Auto-refreshing every 30s
          </Typography>
          <Button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ['exec'] });
            }}
            size="small"
            variant="outlined"
            color="secondary"
            startIcon={<RefreshIcon />}
          >
            Refresh
          </Button>
        </Stack>
      </Stack>

      {anyError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Some analytics could not be loaded. Live data may be incomplete.
        </Alert>
      )}

      {/* ===================== Main grid: charts + AI summary ===================== */}
      <Grid container spacing={2.5}>
        {/* LEFT 8 cols: KPIs + 2x2 charts + table */}
        <Grid item xs={12} lg={8}>
          {/* KPI row */}
          <Grid container spacing={2} sx={{ mb: 2.5 }}>
            <Grid item xs={12} sm={6} md={6} lg={4} xl={3}>
              <KPICard
                label="Revenue (YTD)"
                value={k.revenue || 0}
                icon={<AttachMoneyIcon />}
                format={(v) => formatCurrency(v)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6} lg={4} xl={3}>
              <KPICard
                label="Orders (YTD)"
                value={ordersThisYear}
                icon={<ReceiptLongIcon />}
                format={(v) => formatNumber(v)}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6} lg={4} xl={3}>
              <KPICard
                label="Inventory Utilization"
                value={k.inventory_utilization_pct || 0}
                icon={<Inventory2OutlinedIcon />}
                format={(v) => `${Number(v).toFixed(1)}%`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6} lg={4} xl={3}>
              <KPICard
                label="Credit Risk Score"
                value={k.credit_risk_score || 0}
                icon={<CreditScoreIcon />}
                format={(v) => `${Number(v).toFixed(1)}`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6} lg={4} xl={3}>
              <KPICard
                label="Market Index ($K avg)"
                value={marketIndex}
                icon={<PublicIcon />}
                format={(v) => `$${formatNumber(v)}K`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6} lg={4} xl={3}>
              <KPICard
                label="Fulfillment Rate"
                value={k.fulfillment_rate || 0}
                icon={<LocalShippingIcon />}
                format={(v) => `${Number(v).toFixed(1)}%`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={6} lg={4} xl={3}>
              <KPICard
                label="Approval SLA (hrs)"
                value={k.approval_sla_avg_hours || 0}
                icon={<HourglassBottomIcon />}
                format={(v) => Number(v).toFixed(1)}
              />
            </Grid>
          </Grid>

          {/* 2x2 Chart grid */}
          <Grid container spacing={2.5}>
            <Grid item xs={12} md={6}>
              <RevenueTrendsChart data={filteredRevenue} isLoading={revenueQ.isLoading} />
            </Grid>
            <Grid item xs={12} md={6}>
              <OrderTrendsChart data={filteredOrders} isLoading={ordersQ.isLoading} />
            </Grid>
            <Grid item xs={12} md={6}>
              <MarketComparisonChart data={marketQ.data} isLoading={marketQ.isLoading} />
            </Grid>
            <Grid item xs={12} md={6}>
              <CreditDistributionChart data={creditQ.data} isLoading={creditQ.isLoading} />
            </Grid>
          </Grid>

          {/* Inventory health table */}
          <Box sx={{ mt: 2.5 }}>
            <InventoryHealthTable data={inventoryQ.data} isLoading={inventoryQ.isLoading} />
          </Box>
        </Grid>

        {/* RIGHT 4 cols: AI Summary */}
        <Grid item xs={12} lg={4}>
          <Box sx={{ position: { lg: 'sticky' }, top: { lg: 84 } }}>
            <ClaudeSummaryPanel
              summary={summaryQ.data}
              isLoading={summaryQ.isLoading}
              isFetching={summaryQ.isFetching}
              onRegenerate={handleRegenerate}
            />
          </Box>
        </Grid>
      </Grid>
    </Box>
  );
}
