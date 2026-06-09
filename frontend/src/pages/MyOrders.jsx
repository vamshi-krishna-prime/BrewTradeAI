import React, { useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  Chip,
  Button,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  CircularProgress,
  Alert,
  Snackbar,
  TextField,
  InputAdornment,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ReplayIcon from '@mui/icons-material/Replay';
import SearchIcon from '@mui/icons-material/Search';
import RefreshIcon from '@mui/icons-material/Refresh';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import InboxIcon from '@mui/icons-material/Inbox';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import { getOrders, reorderOrder } from '../api/client.js';
import { formatCurrency, formatDate, statusColor } from '../utils/format.js';
import { goldGradient, goldGradientSoft } from '../theme.js';

const MotionRow = motion(TableRow);

const STATUS_FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'pending_approval', label: 'Pending Approval' },
  { key: 'approved', label: 'Approved' },
  { key: 'processing', label: 'Processing' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'rejected', label: 'Rejected' },
];

function readCustomerId() {
  try {
    const raw = localStorage.getItem('customerId');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch (_) {
    return null;
  }
}

function statusLabel(s) {
  if (!s) return '—';
  return String(s).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function statusChipSx(status) {
  const key = statusColor(status);
  const palette = {
    success: { bg: 'rgba(46,125,50,0.12)', fg: '#1B5E20', border: '#2E7D32' },
    info: { bg: 'rgba(2,136,209,0.12)', fg: '#01579B', border: '#0288D1' },
    warning: { bg: 'rgba(232,163,61,0.18)', fg: '#9C5A12', border: '#E8A33D' },
    error: { bg: 'rgba(198,40,40,0.12)', fg: '#B71C1C', border: '#C62828' },
    default: { bg: 'rgba(26,26,26,0.06)', fg: '#5A5A5A', border: 'rgba(26,26,26,0.15)' },
  };
  const p = palette[key] || palette.default;
  return {
    background: p.bg,
    color: p.fg,
    border: `1px solid ${p.border}`,
    fontWeight: 700,
  };
}

export default function MyOrders() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const customerId = useMemo(readCustomerId, []);

  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [toast, setToast] = useState(null);

  const ordersQuery = useQuery({
    queryKey: ['orders', customerId],
    queryFn: () => getOrders(customerId),
    enabled: customerId !== null,
  });

  const reorderMutation = useMutation({
    mutationFn: ({ orderId }) => reorderOrder(orderId, customerId),
    onSuccess: (data) => {
      setToast(
        `Reorder created: ${data?.order_number || `#${data?.id}`}`
      );
      queryClient.invalidateQueries({ queryKey: ['orders', customerId] });
    },
    onError: (err) => {
      setToast(
        `Reorder failed: ${
          err?.response?.data?.detail || err?.message || 'Unknown error'
        }`
      );
    },
  });

  const filtered = useMemo(() => {
    const all = ordersQuery.data || [];
    const q = search.trim().toLowerCase();
    return all.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (!q) return true;
      const hay = [
        o.order_number,
        o.status,
        String(o.id),
        formatCurrency(o.total_value),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [ordersQuery.data, statusFilter, search]);

  // Per-status counts for the filter chips.
  const counts = useMemo(() => {
    const m = { all: 0 };
    for (const o of ordersQuery.data || []) {
      m.all += 1;
      m[o.status] = (m[o.status] || 0) + 1;
    }
    return m;
  }, [ordersQuery.data]);

  const handleReorder = useCallback(
    (e, orderId) => {
      e.stopPropagation();
      if (!customerId) {
        setToast('No customer is signed in.');
        return;
      }
      reorderMutation.mutate({ orderId });
    },
    [reorderMutation, customerId]
  );

  const handleView = useCallback(
    (orderId) => navigate(`/distributor/order/${orderId}`),
    [navigate]
  );

  return (
    <Box>
      <PageHeader
        title="My Orders"
        subtitle="Track every order you've placed and reorder favourites in one click"
        breadcrumbs={[
          { label: 'Distributor', to: '/distributor/dashboard' },
          { label: 'My Orders' },
        ]}
        actions={
          <Button
            startIcon={<RefreshIcon />}
            onClick={() => ordersQuery.refetch()}
            variant="outlined"
            color="secondary"
            size="small"
          >
            Refresh
          </Button>
        }
      />

      {/* Filters */}
      <GlassCard sx={{ p: 2, mb: 2 }}>
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
          justifyContent="space-between"
        >
          <Stack
            direction="row"
            spacing={0.75}
            flexWrap="wrap"
            useFlexGap
            sx={{ flex: 1, minWidth: 0 }}
          >
            {STATUS_FILTERS.map((f) => {
              const active = statusFilter === f.key;
              const c = counts[f.key] || 0;
              return (
                <Chip
                  key={f.key}
                  label={
                    <Stack direction="row" spacing={0.6} alignItems="center">
                      <Box component="span">{f.label}</Box>
                      <Box
                        component="span"
                        sx={{
                          fontWeight: 800,
                          fontSize: '0.7rem',
                          opacity: 0.8,
                        }}
                      >
                        {c}
                      </Box>
                    </Stack>
                  }
                  onClick={() => setStatusFilter(f.key)}
                  sx={{
                    cursor: 'pointer',
                    fontWeight: 600,
                    background: active ? goldGradient : 'rgba(255,255,255,0.6)',
                    color: '#1A1A1A',
                    border: active
                      ? '1px solid rgba(212,165,42,0.55)'
                      : '1px solid rgba(212,165,42,0.25)',
                    transition: 'all .15s ease',
                    '&:hover': {
                      background: active ? goldGradient : goldGradientSoft,
                    },
                  }}
                />
              );
            })}
          </Stack>

          <TextField
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order #, status..."
            size="small"
            sx={{ minWidth: 260 }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
        </Stack>
      </GlassCard>

      {/* Body */}
      {customerId === null && (
        <Alert severity="warning">No customer is signed in.</Alert>
      )}

      {ordersQuery.isError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {ordersQuery.error?.response?.data?.detail ||
            ordersQuery.error?.message ||
            'Failed to load orders.'}
        </Alert>
      )}

      <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
        {ordersQuery.isLoading ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <CircularProgress color="secondary" />
          </Box>
        ) : filtered.length === 0 ? (
          <Box sx={{ p: 6, textAlign: 'center' }}>
            <InboxIcon sx={{ fontSize: 56, color: 'rgba(212,165,42,0.5)' }} />
            <Typography variant="h6" sx={{ mt: 2, fontWeight: 700 }}>
              No orders match this view
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Adjust your filters or place a new order from the catalog.
            </Typography>
            <Button
              variant="contained"
              color="secondary"
              sx={{ mt: 2 }}
              startIcon={<LocalShippingIcon />}
              onClick={() => navigate('/distributor/catalog')}
            >
              Start an Order
            </Button>
          </Box>
        ) : (
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Order #</TableCell>
                  <TableCell>Date</TableCell>
                  <TableCell align="center">Items</TableCell>
                  <TableCell align="right">Total</TableCell>
                  <TableCell align="center">Status</TableCell>
                  <TableCell align="right" sx={{ width: 160 }}>
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence initial={false}>
                  {filtered.map((o) => {
                    const itemsCount = Array.isArray(o.items)
                      ? o.items.length
                      : 0;
                    return (
                      <MotionRow
                        key={o.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.18 }}
                        hover
                        onClick={() => handleView(o.id)}
                        sx={{
                          cursor: 'pointer',
                          '&:hover': {
                            background: 'rgba(212,165,42,0.06)',
                          },
                        }}
                      >
                        <TableCell>
                          <Typography
                            variant="body2"
                            sx={{ fontWeight: 800, letterSpacing: '0.01em' }}
                          >
                            {o.order_number || `#${o.id}`}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Stack>
                            <Typography variant="body2">
                              {formatDate(o.created_at, 'MMM d, yyyy')}
                            </Typography>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              {formatDate(o.created_at, 'p')}
                            </Typography>
                          </Stack>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={itemsCount}
                            sx={{
                              fontWeight: 700,
                              background: goldGradientSoft,
                              border: '1px solid rgba(212,165,42,0.25)',
                            }}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 800 }}>
                            {formatCurrency(o.total_value)}
                          </Typography>
                        </TableCell>
                        <TableCell align="center">
                          <Chip
                            size="small"
                            label={statusLabel(o.status)}
                            sx={statusChipSx(o.status)}
                          />
                        </TableCell>
                        <TableCell align="right">
                          <Stack
                            direction="row"
                            spacing={0.5}
                            justifyContent="flex-end"
                          >
                            <Tooltip title="View tracking">
                              <IconButton
                                size="small"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleView(o.id);
                                }}
                              >
                                <VisibilityIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="Reorder">
                              <span>
                                <IconButton
                                  size="small"
                                  color="secondary"
                                  disabled={
                                    reorderMutation.isPending &&
                                    reorderMutation.variables?.orderId === o.id
                                  }
                                  onClick={(e) => handleReorder(e, o.id)}
                                >
                                  <ReplayIcon fontSize="small" />
                                </IconButton>
                              </span>
                            </Tooltip>
                          </Stack>
                        </TableCell>
                      </MotionRow>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </GlassCard>

      <Snackbar
        open={!!toast}
        autoHideDuration={3500}
        onClose={() => setToast(null)}
        message={toast || ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
