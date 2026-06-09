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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Divider,
  Alert,
} from '@mui/material';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import HourglassBottomIcon from '@mui/icons-material/HourglassBottom';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import HealthAndSafetyIcon from '@mui/icons-material/HealthAndSafety';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import DescriptionIcon from '@mui/icons-material/Description';
import StorefrontIcon from '@mui/icons-material/Storefront';
import CampaignIcon from '@mui/icons-material/Campaign';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import KPICard from '../components/common/KPICard.jsx';
import TrafficLight from '../components/common/TrafficLight.jsx';
import { getCustomerDashboard } from '../api/client.js';
import { formatCurrency, formatDate, statusColor } from '../utils/format.js';
import { goldGradient } from '../theme.js';

// ---------- helpers ----------
const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.05 },
  },
};
const item = {
  hidden: { opacity: 0, y: 14 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 180, damping: 20 } },
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

// ---------- main page ----------
export default function DistributorDashboard() {
  const navigate = useNavigate();
  const customerId =
    (typeof window !== 'undefined' && localStorage.getItem('customerId')) || '1';
  const customerName =
    (typeof window !== 'undefined' && localStorage.getItem('customerName')) ||
    (typeof window !== 'undefined' && localStorage.getItem('userName')) ||
    'Distributor';

  const { data, isLoading, isError, error } = useQuery({
    queryKey: ['customer-dashboard', customerId],
    queryFn: () => getCustomerDashboard(customerId),
    retry: 1,
    staleTime: 60_000,
  });

  const dashboard = data || {};
  const customer = dashboard.customer || {};
  const creditLimit = Number(customer.credit_limit ?? 0);
  const outstanding = Number(dashboard.outstanding_balance ?? customer.outstanding_balance ?? 0);
  const available = Number(
    dashboard.available_credit ?? Math.max(0, creditLimit - outstanding)
  );
  const utilization =
    creditLimit > 0 ? Math.min(100, Math.round((outstanding / creditLimit) * 100)) : 0;
  const healthRaw = dashboard.credit_health || customer.credit_health || utilizationStatus(utilization);
  const recentOrders = Array.isArray(dashboard.recent_orders) ? dashboard.recent_orders.slice(0, 5) : [];
  const promotions = Array.isArray(dashboard.active_promotions) ? dashboard.active_promotions : [];
  const displayName = customer.name || customerName;

  const kpis = useMemo(
    () => [
      {
        label: 'Open Orders',
        value: Number(dashboard.open_orders ?? 0),
        icon: <LocalShippingIcon />,
      },
      {
        label: 'Pending Approval',
        value: Number(dashboard.pending_approval ?? 0),
        icon: <HourglassBottomIcon />,
      },
      {
        label: 'Outstanding Balance',
        value: outstanding,
        icon: <AccountBalanceWalletIcon />,
        format: (n) => formatCurrency(n),
      },
      {
        label: 'Credit Health',
        value: utilization,
        icon: <HealthAndSafetyIcon />,
        format: (n) => `${Math.round(n)}%`,
        traffic: healthRaw,
      },
      {
        label: 'Active Promotions',
        value: promotions.length,
        icon: <LocalOfferIcon />,
      },
      {
        label: 'Documents',
        value: Number(dashboard.documents_count ?? dashboard.documents ?? 0),
        icon: <DescriptionIcon />,
      },
    ],
    [dashboard, outstanding, utilization, healthRaw, promotions.length]
  );

  // ---------- loading state ----------
  if (isLoading) {
    return (
      <Box>
        <PageHeader title="Welcome back" subtitle="Loading your dashboard..." />
        <Grid container spacing={2.5}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <Skeleton variant="rounded" height={120} />
            </Grid>
          ))}
          <Grid item xs={12} md={8}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
          <Grid item xs={12} md={4}>
            <Skeleton variant="rounded" height={320} />
          </Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title={`Welcome back, ${displayName}`}
        subtitle={
          customer.market
            ? `${customer.market} market - here's your snapshot for today`
            : "Here's your snapshot for today"
        }
        actions={
          <Stack direction="row" spacing={1}>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<StorefrontIcon />}
              component={RouterLink}
              to="/distributor/catalog"
            >
              Browse Catalog
            </Button>
            <Button
              variant="contained"
              color="secondary"
              startIcon={<AddShoppingCartIcon />}
              component={RouterLink}
              to="/distributor/cart"
            >
              New Order
            </Button>
          </Stack>
        }
      />

      {isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Couldn't load live dashboard data ({error?.message || 'unknown error'}). Showing
          available info.
        </Alert>
      )}

      {/* KPI grid */}
      <motion.div variants={container} initial="hidden" animate="show">
        <Grid container spacing={2.5}>
          {kpis.map((k, i) => (
            <Grid item xs={12} sm={6} md={4} lg={2} key={i}>
              <motion.div variants={item}>
                {k.traffic ? (
                  <GlassCard sx={{ p: 2.5 }}>
                    <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                      <Box
                        sx={{
                          width: 44,
                          height: 44,
                          borderRadius: 2,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          background: goldGradient,
                          color: '#1A1A1A',
                          boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
                          flexShrink: 0,
                        }}
                      >
                        {k.icon}
                      </Box>
                      <Box sx={{ flex: 1, minWidth: 0 }}>
                        <Stack direction="row" alignItems="center" spacing={1}>
                          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
                            {k.label}
                          </Typography>
                          <TrafficLight status={k.traffic} title={healthLabel(k.traffic)} />
                        </Stack>
                        <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, lineHeight: 1.1 }}>
                          {k.format ? k.format(k.value) : k.value}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {healthLabel(k.traffic)} - utilization
                        </Typography>
                      </Box>
                    </Box>
                  </GlassCard>
                ) : (
                  <KPICard label={k.label} value={k.value} icon={k.icon} format={k.format} />
                )}
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </motion.div>

      {/* 2-column section */}
      <Grid container spacing={2.5} sx={{ mt: 0.5 }}>
        {/* Recent orders */}
        <Grid item xs={12} md={8}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard sx={{ p: 0 }}>
              <Box sx={{ p: 2.5, pb: 1.5, display: 'flex', alignItems: 'center' }}>
                <Box sx={{ flex: 1 }}>
                  <Typography variant="h6" sx={{ fontWeight: 700 }}>
                    Recent Orders
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Your last 5 orders and their status
                  </Typography>
                </Box>
                <Button
                  size="small"
                  color="secondary"
                  endIcon={<ChevronRightIcon />}
                  component={RouterLink}
                  to="/distributor/my-orders"
                >
                  View all
                </Button>
              </Box>
              <Divider />
              {recentOrders.length === 0 ? (
                <Box sx={{ p: 4, textAlign: 'center' }}>
                  <Typography color="text.secondary">No recent orders yet.</Typography>
                  <Button
                    component={RouterLink}
                    to="/distributor/catalog"
                    color="secondary"
                    variant="contained"
                    startIcon={<StorefrontIcon />}
                    sx={{ mt: 2 }}
                  >
                    Browse Catalog
                  </Button>
                </Box>
              ) : (
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ fontWeight: 700 }}>Order #</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Total</TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right">Expected</TableCell>
                      <TableCell sx={{ fontWeight: 700 }} align="right" />
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {recentOrders.map((o) => (
                      <TableRow
                        key={o.id || o.order_number}
                        hover
                        sx={{ '&:last-child td, &:last-child th': { border: 0 } }}
                      >
                        <TableCell sx={{ fontWeight: 600 }}>
                          {o.order_number || `#${o.id}`}
                        </TableCell>
                        <TableCell>{formatDate(o.created_at)}</TableCell>
                        <TableCell align="right">
                          {formatCurrency(o.total_value ?? 0)}
                        </TableCell>
                        <TableCell>
                          <Chip
                            size="small"
                            color={statusColor(o.status)}
                            label={String(o.status || '').replace('_', ' ')}
                            sx={{ textTransform: 'capitalize' }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          {o.expected_delivery ? formatDate(o.expected_delivery) : '-'}
                        </TableCell>
                        <TableCell align="right">
                          <Button
                            size="small"
                            color="secondary"
                            endIcon={<OpenInNewIcon fontSize="small" />}
                            onClick={() => navigate(`/distributor/order/${o.id}`)}
                          >
                            Track
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Credit health card */}
        <Grid item xs={12} md={4}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1}>
                <HealthAndSafetyIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Credit Health
                </Typography>
                <Box sx={{ flex: 1 }} />
                <TrafficLight status={healthRaw} size={16} title={healthLabel(healthRaw)} />
              </Stack>

              <Box sx={{ height: 180, position: 'relative' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="70%"
                    outerRadius="100%"
                    barSize={16}
                    data={[{ name: 'util', value: utilization, fill: 'url(#goldGrad)' }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <defs>
                      <linearGradient id="goldGrad" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#D4A52A" />
                        <stop offset="50%" stopColor="#F2C849" />
                        <stop offset="100%" stopColor="#E8A33D" />
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
                      cornerRadius={10}
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
                  <Typography variant="h3" sx={{ fontWeight: 800, lineHeight: 1 }}>
                    {utilization}%
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    utilization
                  </Typography>
                </Box>
              </Box>

              <Stack spacing={0.5} sx={{ mt: 1.5 }}>
                <Row label="Credit limit" value={formatCurrency(creditLimit)} />
                <Row label="Outstanding" value={formatCurrency(outstanding)} strong />
                <Row label="Available" value={formatCurrency(available)} />
              </Stack>

              <Divider sx={{ my: 2 }} />

              <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
                Quick Actions
              </Typography>
              <Stack spacing={1}>
                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  startIcon={<StorefrontIcon />}
                  component={RouterLink}
                  to="/distributor/catalog"
                >
                  Browse Catalog
                </Button>
                <Button
                  fullWidth
                  variant="outlined"
                  color="secondary"
                  startIcon={<CampaignIcon />}
                  component={RouterLink}
                  to="/distributor/promotions"
                >
                  View Promotions
                </Button>
                <Button
                  fullWidth
                  variant="contained"
                  color="secondary"
                  startIcon={<AddShoppingCartIcon />}
                  component={RouterLink}
                  to="/distributor/cart"
                >
                  Submit Order
                </Button>
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>
      </Grid>

      {/* What's new carousel */}
      <Box sx={{ mt: 3.5 }}>
        <Stack direction="row" alignItems="center" spacing={1.2} mb={1.5}>
          <CampaignIcon sx={{ color: '#B5891F' }} />
          <Typography variant="h5" sx={{ fontWeight: 800 }}>
            What's New
          </Typography>
          <Box sx={{ flex: 1 }} />
          <Button
            size="small"
            color="secondary"
            endIcon={<ChevronRightIcon />}
            component={RouterLink}
            to="/distributor/promotions"
          >
            See all promotions
          </Button>
        </Stack>

        {promotions.length === 0 ? (
          <GlassCard>
            <Typography color="text.secondary">
              No active promotions right now. Check back soon!
            </Typography>
          </GlassCard>
        ) : (
          <Box
            sx={{
              display: 'flex',
              gap: 2,
              overflowX: 'auto',
              pb: 1.5,
              scrollSnapType: 'x mandatory',
              '&::-webkit-scrollbar': { height: 8 },
              '&::-webkit-scrollbar-thumb': {
                backgroundColor: 'rgba(212,165,42,0.35)',
                borderRadius: 4,
              },
            }}
          >
            {promotions.map((p, idx) => (
              <motion.div
                key={p.id || idx}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.06, duration: 0.4, ease: 'easeOut' }}
                style={{ flex: '0 0 auto', scrollSnapAlign: 'start' }}
              >
                <GlassCard
                  sx={{
                    width: 320,
                    p: 0,
                    overflow: 'hidden',
                    cursor: 'pointer',
                  }}
                  onClick={() => navigate('/distributor/promotions')}
                >
                  <Box
                    sx={{
                      height: 120,
                      background:
                        p.image_url
                          ? `linear-gradient(135deg, rgba(0,0,0,0.05), rgba(0,0,0,0.4)), url(${p.image_url})`
                          : goldGradient,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      display: 'flex',
                      alignItems: 'flex-end',
                      p: 1.5,
                    }}
                  >
                    {Number(p.discount_percent) > 0 && (
                      <Chip
                        label={`${Math.round(Number(p.discount_percent))}% OFF`}
                        sx={{
                          background: 'rgba(26,26,26,0.85)',
                          color: '#F2C849',
                          fontWeight: 800,
                        }}
                      />
                    )}
                  </Box>
                  <Box sx={{ p: 2 }}>
                    <Typography variant="subtitle1" sx={{ fontWeight: 700 }}>
                      {p.title || 'Promotion'}
                    </Typography>
                    {p.description && (
                      <Typography
                        variant="body2"
                        color="text.secondary"
                        sx={{
                          mt: 0.5,
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {p.description}
                      </Typography>
                    )}
                    <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>
                      {p.start_date ? formatDate(p.start_date) : ''}
                      {p.end_date ? ` - ${formatDate(p.end_date)}` : ''}
                    </Typography>
                  </Box>
                </GlassCard>
              </motion.div>
            ))}
          </Box>
        )}
      </Box>
    </Box>
  );
}

function Row({ label, value, strong }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="body2"
        sx={{ fontWeight: strong ? 800 : 600 }}
      >
        {value}
      </Typography>
    </Stack>
  );
}
