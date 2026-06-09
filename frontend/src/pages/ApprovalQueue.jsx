import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
  TextField,
  MenuItem,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TableSortLabel,
  Checkbox,
  Tooltip,
  IconButton,
  InputAdornment,
  TableContainer,
} from '@mui/material';
import { AnimatePresence, motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import SearchIcon from '@mui/icons-material/Search';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import RefreshIcon from '@mui/icons-material/Refresh';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import FilterAltOutlinedIcon from '@mui/icons-material/FilterAltOutlined';
import EventIcon from '@mui/icons-material/Event';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import TrafficLight from '../components/common/TrafficLight.jsx';
import { getPendingApprovals } from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';

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
    border: `1px solid ${color}55`,
    fontWeight: 700,
    textTransform: 'capitalize',
  };
}

function inventoryStatusFromCoverage(items = []) {
  // Used when payload doesn't include availability per line.
  // Fallback to "OK" if we have no insight.
  if (!items || items.length === 0) return 'ok';
  return 'ok';
}

function creditTrafficStatus(healthRaw) {
  const s = String(healthRaw || 'green').toLowerCase();
  if (['red', 'yellow', 'green'].includes(s)) return s;
  return 'green';
}

const RISK_FILTERS = [
  { key: 'all', label: 'All Risk', color: '#5A5A5A' },
  { key: 'high', label: 'High', color: RISK_COLORS.high },
  { key: 'medium', label: 'Medium', color: RISK_COLORS.medium },
  { key: 'low', label: 'Low', color: RISK_COLORS.low },
];

export default function ApprovalQueue() {
  const navigate = useNavigate();
  const [market, setMarket] = useState('all');
  const [risk, setRisk] = useState('all');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortBy, setSortBy] = useState('risk_score');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState(new Set());
  const [exitingId, setExitingId] = useState(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['approval-queue'],
    queryFn: () => getPendingApprovals(),
    staleTime: 30_000,
    retry: 1,
  });

  const rows = data || [];

  const markets = useMemo(() => {
    const s = new Set();
    rows.forEach((r) => {
      if (r.customer?.market) s.add(r.customer.market);
    });
    return ['all', ...Array.from(s).sort()];
  }, [rows]);

  // ---------- filter + sort ----------
  const filtered = useMemo(() => {
    return rows.filter((r) => {
      const m = r.customer?.market || '';
      if (market !== 'all' && m !== market) return false;
      if (risk !== 'all' && String(r.risk_level).toLowerCase() !== risk)
        return false;
      if (search) {
        const q = search.toLowerCase();
        const hay =
          `${r.order_number || ''} ${r.customer?.name || ''} ${m}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (dateFrom) {
        if (!r.created_at || new Date(r.created_at) < new Date(dateFrom))
          return false;
      }
      if (dateTo) {
        const to = new Date(dateTo);
        to.setHours(23, 59, 59, 999);
        if (!r.created_at || new Date(r.created_at) > to) return false;
      }
      return true;
    });
  }, [rows, market, risk, search, dateFrom, dateTo]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    const dir = sortDir === 'asc' ? 1 : -1;
    arr.sort((a, b) => {
      const get = (o) => {
        switch (sortBy) {
          case 'customer':
            return o.customer?.name || '';
          case 'market':
            return o.customer?.market || '';
          case 'order_number':
            return o.order_number || '';
          case 'total_value':
            return Number(o.total_value || 0);
          case 'created_at':
            return o.created_at ? new Date(o.created_at).getTime() : 0;
          case 'risk_score':
          default:
            return Number(o.risk_score || 0);
        }
      };
      const A = get(a);
      const B = get(b);
      if (typeof A === 'string') return A.localeCompare(B) * dir;
      return (A - B) * dir;
    });
    return arr;
  }, [filtered, sortBy, sortDir]);

  const handleSort = (key) => {
    if (sortBy === key) setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSortBy(key);
      setSortDir('desc');
    }
  };

  const allSelected =
    sorted.length > 0 && sorted.every((r) => selected.has(r.id));
  const someSelected =
    sorted.some((r) => selected.has(r.id)) && !allSelected;

  const toggleAll = () => {
    if (allSelected) setSelected(new Set());
    else setSelected(new Set(sorted.map((r) => r.id)));
  };
  const toggleOne = (id) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleRowClick = (orderId) => {
    setExitingId(orderId);
    setTimeout(() => navigate(`/manager/review/${orderId}`), 250);
  };

  return (
    <Box>
      <PageHeader
        title="Approval Queue"
        subtitle={`${rows.length} orders awaiting your review — sorted by risk score`}
        breadcrumbs={[
          { label: 'Manager', to: '/manager/dashboard' },
          { label: 'Approval Queue' },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Refresh">
              <IconButton
                onClick={() => refetch()}
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
              disabled={selected.size === 0}
              onClick={() => {
                // POC: visual only — show toast-ish info via alert
                alert(
                  `Bulk approve queued for ${selected.size} order(s).\n(Confirmation flow is wired into the OrderReview workspace.)`
                );
              }}
            >
              Bulk Approve {selected.size > 0 ? `(${selected.size})` : ''}
            </Button>
          </Stack>
        }
      />

      {/* Filter bar */}
      <GlassCard sx={{ mb: 2.5, p: 2 }}>
        <Grid container spacing={1.5} alignItems="center">
          <Grid item xs={12} md={3}>
            <TextField
              placeholder="Search order #, customer, market"
              fullWidth
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              select
              fullWidth
              label="Market"
              value={market}
              onChange={(e) => setMarket(e.target.value)}
            >
              {markets.map((m) => (
                <MenuItem key={m} value={m}>
                  {m === 'all' ? 'All Markets' : m}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              type="date"
              fullWidth
              label="From"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EventIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={6} md={2}>
            <TextField
              type="date"
              fullWidth
              label="To"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              InputLabelProps={{ shrink: true }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <EventIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
          </Grid>
          <Grid item xs={12} md={3}>
            <Stack direction="row" spacing={0.8} sx={{ flexWrap: 'wrap', gap: 0.8 }}>
              <FilterAltOutlinedIcon
                sx={{ color: 'text.secondary', alignSelf: 'center', fontSize: 18 }}
              />
              {RISK_FILTERS.map((f) => {
                const active = risk === f.key;
                return (
                  <Chip
                    key={f.key}
                    label={f.label}
                    onClick={() => setRisk(f.key)}
                    sx={{
                      cursor: 'pointer',
                      fontWeight: 700,
                      borderWidth: 1,
                      borderStyle: 'solid',
                      borderColor: active ? f.color : 'rgba(0,0,0,0.12)',
                      background: active ? `${f.color}18` : 'transparent',
                      color: active ? f.color : 'text.secondary',
                      '&:hover': { background: `${f.color}10` },
                    }}
                  />
                );
              })}
            </Stack>
          </Grid>
        </Grid>
      </GlassCard>

      {isError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          Couldn't load approval queue ({error?.message || 'unknown error'}).
        </Alert>
      )}

      <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
        {isLoading ? (
          <Box sx={{ p: 2 }}>
            <Skeleton variant="rounded" height={48} sx={{ mb: 1 }} />
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} variant="rounded" height={56} sx={{ mb: 0.6 }} />
            ))}
          </Box>
        ) : (
          <TableContainer>
            <Table size="medium" stickyHeader>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox" sx={headCellSx}>
                    <Checkbox
                      indeterminate={someSelected}
                      checked={allSelected}
                      onChange={toggleAll}
                      color="secondary"
                    />
                  </TableCell>
                  <TableCell sx={headCellSx}>
                    <TableSortLabel
                      active={sortBy === 'customer'}
                      direction={sortBy === 'customer' ? sortDir : 'asc'}
                      onClick={() => handleSort('customer')}
                    >
                      Customer
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={headCellSx}>
                    <TableSortLabel
                      active={sortBy === 'market'}
                      direction={sortBy === 'market' ? sortDir : 'asc'}
                      onClick={() => handleSort('market')}
                    >
                      Market
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={headCellSx}>
                    <TableSortLabel
                      active={sortBy === 'order_number'}
                      direction={sortBy === 'order_number' ? sortDir : 'asc'}
                      onClick={() => handleSort('order_number')}
                    >
                      Order #
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={headCellSx} align="right">
                    <TableSortLabel
                      active={sortBy === 'total_value'}
                      direction={sortBy === 'total_value' ? sortDir : 'asc'}
                      onClick={() => handleSort('total_value')}
                    >
                      Order Value
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={headCellSx} align="center">
                    Financial
                  </TableCell>
                  <TableCell sx={headCellSx} align="center">
                    Inventory
                  </TableCell>
                  <TableCell sx={headCellSx} align="center">
                    <TableSortLabel
                      active={sortBy === 'risk_score'}
                      direction={sortBy === 'risk_score' ? sortDir : 'asc'}
                      onClick={() => handleSort('risk_score')}
                    >
                      Risk Level
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={headCellSx}>
                    <TableSortLabel
                      active={sortBy === 'created_at'}
                      direction={sortBy === 'created_at' ? sortDir : 'asc'}
                      onClick={() => handleSort('created_at')}
                    >
                      Order Date
                    </TableSortLabel>
                  </TableCell>
                  <TableCell sx={headCellSx} align="right">
                    Actions
                  </TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence initial={false}>
                  {sorted.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10}>
                        <Box sx={{ p: 6, textAlign: 'center' }}>
                          <Typography color="text.secondary">
                            No orders match your filters.
                          </Typography>
                        </Box>
                      </TableCell>
                    </TableRow>
                  ) : (
                    sorted.map((r, idx) => {
                      const cust = r.customer || {};
                      const checked = selected.has(r.id);
                      const isExiting = exitingId === r.id;
                      const invStatus = inventoryStatusFromCoverage(r.items);
                      return (
                        <motion.tr
                          key={r.id}
                          layout
                          initial={{ opacity: 0, y: 8 }}
                          animate={
                            isExiting
                              ? { opacity: 0, x: 60 }
                              : { opacity: 1, y: 0 }
                          }
                          exit={{ opacity: 0, x: 60 }}
                          transition={{
                            duration: 0.22,
                            delay: isExiting ? 0 : idx * 0.015,
                            ease: 'easeOut',
                          }}
                          whileHover={{
                            backgroundColor: 'rgba(212,165,42,0.06)',
                          }}
                          style={{
                            cursor: 'pointer',
                            display: 'table-row',
                          }}
                          onClick={() => handleRowClick(r.id)}
                        >
                          <TableCell
                            padding="checkbox"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Checkbox
                              checked={checked}
                              onChange={() => toggleOne(r.id)}
                              color="secondary"
                            />
                          </TableCell>
                          <TableCell sx={{ fontWeight: 700 }}>
                            {cust.name || '—'}
                          </TableCell>
                          <TableCell>
                            <Chip
                              size="small"
                              label={cust.market || '—'}
                              sx={{
                                background: 'rgba(212,165,42,0.10)',
                                color: '#8a6b1a',
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {r.order_number || `#${r.id}`}
                          </TableCell>
                          <TableCell align="right" sx={{ fontWeight: 700 }}>
                            {formatCurrency(r.total_value)}
                          </TableCell>
                          <TableCell align="center">
                            <Tooltip
                              title={`Credit health: ${cust.credit_health || 'unknown'}`}
                            >
                              <Box sx={{ display: 'inline-block' }}>
                                <TrafficLight
                                  status={creditTrafficStatus(cust.credit_health)}
                                  size={14}
                                />
                              </Box>
                            </Tooltip>
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={
                                r.item_count > 0
                                  ? `${r.item_count} items`
                                  : 'No items'
                              }
                              sx={{
                                background:
                                  invStatus === 'ok'
                                    ? 'rgba(46,125,50,0.10)'
                                    : 'rgba(232,163,61,0.14)',
                                color:
                                  invStatus === 'ok' ? '#1B5E20' : '#8a6b1a',
                                fontWeight: 600,
                              }}
                            />
                          </TableCell>
                          <TableCell align="center">
                            <Chip
                              size="small"
                              label={r.risk_level || 'low'}
                              sx={riskChipStyles(r.risk_level)}
                            />
                          </TableCell>
                          <TableCell>{formatDate(r.created_at)}</TableCell>
                          <TableCell
                            align="right"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Button
                              size="small"
                              variant="contained"
                              color="secondary"
                              endIcon={<OpenInNewIcon fontSize="small" />}
                              onClick={() => handleRowClick(r.id)}
                            >
                              Review
                            </Button>
                          </TableCell>
                        </motion.tr>
                      );
                    })
                  )}
                </AnimatePresence>
              </TableBody>
            </Table>
          </TableContainer>
        )}
        <Divider />
        <Box
          sx={{
            p: 1.5,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <Typography variant="caption" color="text.secondary">
            Showing {sorted.length} of {rows.length} orders
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Sorted by {sortBy.replace('_', ' ')} ({sortDir})
          </Typography>
        </Box>
      </GlassCard>
    </Box>
  );
}

const headCellSx = {
  fontWeight: 800,
  background: 'rgba(255,255,255,0.85)',
  backdropFilter: 'blur(10px)',
  borderBottom: '1px solid rgba(212,165,42,0.25)',
};
