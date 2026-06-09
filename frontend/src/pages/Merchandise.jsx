import React, { useMemo, useState } from 'react';
import {
  Box,
  Stack,
  Chip,
  TextField,
  InputAdornment,
  MenuItem,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Grid,
  Tabs,
  Tab,
  Alert,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCartOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import RedeemIcon from '@mui/icons-material/Redeem';
import LiquorIcon from '@mui/icons-material/Liquor';
import StoreIcon from '@mui/icons-material/Store';
import CampaignIcon from '@mui/icons-material/Campaign';
import CategoryIcon from '@mui/icons-material/Category';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import PageHeader from '../components/common/PageHeader.jsx';
import ProductImage from '../components/common/ProductImage.jsx';
import CategorySidebar from '../components/common/CategorySidebar.jsx';
import { getMerchandise } from '../api/client.js';
import { formatCurrency } from '../utils/format.js';
import { useCart, merchandiseToCartItem } from '../contexts/CartContext.jsx';
import { goldGradient, goldGradientSoft } from '../theme.js';

// Canonical category order (matches the brief)
const CATEGORY_DEFS = [
  { key: 'Apparel', label: 'Apparel', icon: CheckroomIcon },
  { key: 'Accessories', label: 'Accessories', icon: RedeemIcon },
  { key: 'Barware', label: 'Barware', icon: LiquorIcon },
  { key: 'Trade Materials', label: 'Trade Materials', icon: StoreIcon },
  { key: 'Campaign Merchandise', label: 'Campaign Merchandise', icon: CampaignIcon },
];

const TABS = [
  { key: 'all', label: 'All Items' },
  { key: 'featured', label: 'Featured' },
  { key: 'new', label: 'New Arrivals' },
];

// Heuristics so the Featured / New tabs feel populated even without a
// dedicated backend flag.
function isFeatured(m) {
  // Highest-margin items that pair well with beer orders
  return ['Barware', 'Apparel'].includes(m.category) && (m.stock || 0) > 0;
}

function isNewArrival(m) {
  // Created in the last 60 days (or just pick the newest items)
  if (!m.created_at) return false;
  const created = new Date(m.created_at).getTime();
  const sixtyDays = 60 * 24 * 60 * 60 * 1000;
  return Date.now() - created <= sixtyDays;
}

function availabilityFor(stock) {
  const s = Number(stock || 0);
  if (s <= 0) return { label: 'Out of stock', dot: '#C62828' };
  if (s < 50) return { label: 'Low stock', dot: '#ED6C02' };
  return { label: 'In stock', dot: '#2E7D32' };
}

// =====================================================================
// Merchandise card
// =====================================================================
function MerchCard({ item, onAdd }) {
  const moq = item.moq || 1;
  const stock = item.stock || 0;
  const [qty, setQty] = useState(moq);
  const avail = availabilityFor(stock);
  const belowMoq = qty < moq;
  const overStock = qty > stock;
  const disabled = stock <= 0;

  const handleAdd = () => {
    const useQty = Math.max(qty, moq);
    onAdd(item, useQty);
    setQty(moq);
  };

  return (
    <Box
      component={motion.div}
      layout
      whileHover={{
        y: -6,
        boxShadow:
          '0 22px 50px rgba(26,26,26,0.12), 0 0 0 1px rgba(212,165,42,0.45)',
      }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(212,165,42,0.22)',
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(26,26,26,0.06)',
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <ProductImage
          name={item.name}
          category={item.category}
          imageUrl={item.image_url}
          height={172}
          rounded={false}
        />
        <Box
          sx={{
            position: 'absolute',
            top: 10,
            right: 10,
            display: 'flex',
            gap: 0.75,
          }}
        >
          <Chip
            size="small"
            label={`MOQ ${moq}`}
            sx={{
              fontWeight: 700,
              fontSize: '0.7rem',
              background: 'rgba(26,26,26,0.78)',
              color: '#F2C849',
              border: '1px solid rgba(242,200,73,0.35)',
            }}
          />
        </Box>
      </Box>

      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 1.25, flex: 1 }}>
        <Box>
          <Typography
            variant="h6"
            sx={{
              fontWeight: 700,
              fontSize: '1.02rem',
              lineHeight: 1.2,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontFamily: 'monospace', letterSpacing: '0.04em' }}
          >
            SKU {item.sku}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            label={item.category}
            sx={{
              height: 22,
              fontWeight: 600,
              fontSize: '0.7rem',
              background: 'rgba(212,165,42,0.10)',
              border: '1px solid rgba(212,165,42,0.30)',
              color: '#1A1A1A',
            }}
          />
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 0.6,
              px: 1,
              py: 0.3,
              borderRadius: 1.5,
              background: `${avail.dot}1A`,
              border: `1px solid ${avail.dot}33`,
            }}
          >
            <Box
              sx={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: avail.dot,
                boxShadow: `0 0 8px ${avail.dot}80`,
              }}
            />
            <Typography sx={{ fontSize: '0.7rem', fontWeight: 600, color: avail.dot }}>
              {avail.label} ({stock})
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ mt: 'auto' }}>
          <Typography
            sx={{
              fontWeight: 800,
              fontSize: '1.45rem',
              background: goldGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              lineHeight: 1,
            }}
          >
            {formatCurrency(item.price)}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Per unit
          </Typography>
        </Box>

        {/* MOQ warning chip */}
        {belowMoq && (
          <Chip
            size="small"
            icon={<WarningAmberIcon style={{ color: '#ED6C02' }} />}
            label={`Minimum order qty is ${moq}`}
            sx={{
              alignSelf: 'flex-start',
              height: 24,
              fontSize: '0.7rem',
              fontWeight: 600,
              background: 'rgba(237,108,2,0.10)',
              border: '1px solid rgba(237,108,2,0.30)',
              color: '#9C4A02',
            }}
          />
        )}
        {!belowMoq && overStock && (
          <Chip
            size="small"
            icon={<WarningAmberIcon style={{ color: '#C62828' }} />}
            label={`Only ${stock} in stock`}
            sx={{
              alignSelf: 'flex-start',
              height: 24,
              fontSize: '0.7rem',
              fontWeight: 600,
              background: 'rgba(198,40,40,0.10)',
              border: '1px solid rgba(198,40,40,0.30)',
              color: '#8E1F1F',
            }}
          />
        )}

        {/* Quantity stepper + Add */}
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mt: 0.5 }}>
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              border: '1px solid rgba(212,165,42,0.30)',
              borderRadius: 2,
              overflow: 'hidden',
              height: 38,
            }}
          >
            <IconButton
              size="small"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
              aria-label="decrease quantity"
            >
              <RemoveIcon fontSize="small" />
            </IconButton>
            <TextField
              value={qty}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (Number.isFinite(v)) setQty(Math.max(1, Math.floor(v)));
              }}
              size="small"
              variant="standard"
              inputProps={{
                style: { textAlign: 'center', width: 38, fontWeight: 700 },
                inputMode: 'numeric',
              }}
              sx={{
                '& .MuiInput-root:before, & .MuiInput-root:after': { display: 'none' },
              }}
            />
            <IconButton size="small" onClick={() => setQty((q) => q + 1)} aria-label="increase quantity">
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            disabled={disabled}
            startIcon={<ShoppingCartIcon fontSize="small" />}
            onClick={handleAdd}
            sx={{ height: 38 }}
          >
            Add
          </Button>
        </Stack>
      </Box>
    </Box>
  );
}

// =====================================================================
// Page
// =====================================================================
export default function Merchandise() {
  const [categoryKey, setCategoryKey] = useState('__all__');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');
  const [tab, setTab] = useState('all');

  const { addItem } = useCart();

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['merchandise'],
    queryFn: () => getMerchandise(),
  });

  const items = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  // Build category counts from the canonical list, with a fallback to
  // any backend categories we haven't pre-declared.
  const categories = useMemo(() => {
    const countByKey = {};
    for (const m of items) {
      const k = m.category || 'Other';
      countByKey[k] = (countByKey[k] || 0) + 1;
    }
    const declared = CATEGORY_DEFS.map((c) => ({
      key: c.key,
      label: c.label,
      icon: c.icon,
      count: countByKey[c.key] || 0,
    }));
    const extras = Object.keys(countByKey)
      .filter((k) => !CATEGORY_DEFS.find((c) => c.key === k))
      .map((k) => ({ key: k, label: k, icon: CategoryIcon, count: countByKey[k] }));
    return [...declared, ...extras];
  }, [items]);

  const filtered = useMemo(() => {
    let list = items;

    // Tab filter
    if (tab === 'featured') list = list.filter(isFeatured);
    if (tab === 'new') list = list.filter(isNewArrival);

    // Category filter
    if (categoryKey && categoryKey !== '__all__') {
      list = list.filter((m) => m.category === categoryKey);
    }

    // Search
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (m) =>
          m.name?.toLowerCase().includes(q) ||
          m.sku?.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q)
      );
    }

    const sorted = [...list];
    switch (sortBy) {
      case 'name_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'price_asc':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price_desc':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'stock_desc':
        sorted.sort((a, b) => (b.stock || 0) - (a.stock || 0));
        break;
      case 'name_asc':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [items, tab, categoryKey, search, sortBy]);

  const handleAdd = (m, qty) => {
    addItem(merchandiseToCartItem(m, qty));
  };

  return (
    <Box>
      <PageHeader
        title="Merchandise Portal"
        subtitle="Branded apparel, barware, and trade materials for your venues"
        breadcrumbs={[
          { label: 'Distributor', to: '/distributor/dashboard' },
          { label: 'Merchandise' },
        ]}
        actions={
          <Box
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1,
              px: 1.5,
              py: 0.75,
              borderRadius: 2,
              background: goldGradientSoft,
              border: '1px solid rgba(212,165,42,0.30)',
            }}
          >
            <RedeemIcon sx={{ fontSize: 18, color: '#B5891F' }} />
            <Typography
              sx={{
                fontSize: '0.72rem',
                fontWeight: 700,
                letterSpacing: '0.12em',
                color: '#1A1A1A',
              }}
            >
              RETAIL COLLECTION
            </Typography>
          </Box>
        }
      />

      {/* Tabs */}
      <Box
        sx={{
          mb: 2,
          borderBottom: '1px solid rgba(212,165,42,0.20)',
        }}
      >
        <Tabs
          value={tab}
          onChange={(_, v) => setTab(v)}
          textColor="inherit"
          TabIndicatorProps={{
            sx: {
              height: 3,
              borderRadius: '3px 3px 0 0',
              background: goldGradient,
            },
          }}
        >
          {TABS.map((t) => (
            <Tab
              key={t.key}
              value={t.key}
              label={t.label}
              sx={{
                fontWeight: 700,
                letterSpacing: '0.02em',
                textTransform: 'none',
                fontSize: '0.92rem',
              }}
            />
          ))}
        </Tabs>
      </Box>

      <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
        {/* Sidebar */}
        <CategorySidebar
          title="Categories"
          categories={categories}
          value={categoryKey}
          onChange={setCategoryKey}
          width={240}
        />

        {/* Main content */}
        <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
          {/* Toolbar */}
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={2}
            alignItems={{ xs: 'stretch', sm: 'center' }}
            sx={{ mb: 2.5 }}
          >
            <TextField
              placeholder="Search merchandise"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              sx={{ flex: 1 }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              select
              label="Sort"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              sx={{ minWidth: 200 }}
            >
              <MenuItem value="name_asc">Name A-Z</MenuItem>
              <MenuItem value="name_desc">Name Z-A</MenuItem>
              <MenuItem value="price_asc">Price (low to high)</MenuItem>
              <MenuItem value="price_desc">Price (high to low)</MenuItem>
              <MenuItem value="stock_desc">Most in stock</MenuItem>
            </TextField>
          </Stack>

          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
              <CircularProgress color="secondary" />
            </Box>
          ) : isError ? (
            <Alert
              severity="error"
              action={
                <Button color="inherit" size="small" onClick={() => refetch()}>
                  Retry
                </Button>
              }
            >
              {error?.response?.data?.detail ||
                error?.message ||
                'Failed to load merchandise.'}
            </Alert>
          ) : filtered.length === 0 ? (
            <Box
              sx={{
                py: 7,
                px: 3,
                textAlign: 'center',
                borderRadius: 3,
                border: '1px dashed rgba(212,165,42,0.35)',
                background: goldGradientSoft,
              }}
            >
              <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
                No merchandise matches
              </Typography>
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                Try a different category or clear your search.
              </Typography>
              <Button
                variant="outlined"
                color="secondary"
                onClick={() => {
                  setCategoryKey('__all__');
                  setSearch('');
                  setTab('all');
                }}
              >
                Show all items
              </Button>
            </Box>
          ) : (
            <Grid container spacing={2.5}>
              <AnimatePresence mode="popLayout">
                {filtered.map((m) => (
                  <Grid item xs={12} sm={6} md={4} key={m.id}>
                    <motion.div
                      layout
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.25 }}
                      style={{ height: '100%' }}
                    >
                      <MerchCard item={m} onAdd={handleAdd} />
                    </motion.div>
                  </Grid>
                ))}
              </AnimatePresence>
            </Grid>
          )}
        </Box>
      </Stack>
    </Box>
  );
}
