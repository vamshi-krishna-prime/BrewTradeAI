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
  Tooltip,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCartOutlined';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import StorefrontIcon from '@mui/icons-material/Storefront';
import InventoryIcon from '@mui/icons-material/Inventory2Outlined';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';

import PageHeader from '../components/common/PageHeader.jsx';
import ProductImage from '../components/common/ProductImage.jsx';
import { getCatalog } from '../api/client.js';
import { formatCurrency } from '../utils/format.js';
import { useCart, productToCartItem } from '../contexts/CartContext.jsx';
import { goldGradient, goldGradientSoft } from '../theme.js';

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'Beer', label: 'Beer' },
  { key: 'Stout', label: 'Stout' },
  { key: 'Malta', label: 'Malta' },
  { key: 'Shandy', label: 'Shandy' },
];

const SORT_OPTIONS = [
  { key: 'name_asc', label: 'Name A-Z' },
  { key: 'name_desc', label: 'Name Z-A' },
  { key: 'price_asc', label: 'Price (low to high)' },
  { key: 'price_desc', label: 'Price (high to low)' },
  { key: 'stock_desc', label: 'Most available' },
];

function getCustomerIdFromStorage() {
  try {
    const raw = localStorage.getItem('customerId');
    if (!raw) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : raw;
  } catch (_) {
    return null;
  }
}

function getCustomerMarket() {
  try {
    return localStorage.getItem('customerMarket') || null;
  } catch (_) {
    return null;
  }
}

function getCustomerName() {
  try {
    return localStorage.getItem('customerName') || null;
  } catch (_) {
    return null;
  }
}

function availabilityFor(qty) {
  const q = Number(qty || 0);
  if (q <= 0) return { label: 'Out of stock', color: 'error', dot: '#C62828' };
  if (q < 100) return { label: 'Low stock', color: 'warning', dot: '#ED6C02' };
  return { label: 'In stock', color: 'success', dot: '#2E7D32' };
}

function effectivePrice(p) {
  if (p.promo_active && p.promotional_price != null) return p.promotional_price;
  if (p.customer_price != null) return p.customer_price;
  return p.base_price;
}

function showStrikethrough(p) {
  const eff = effectivePrice(p);
  return p.promo_active && p.promotional_price != null && p.base_price > eff;
}

// =====================================================================
// Product card
// =====================================================================
function ProductCard({ product, onAdd }) {
  const [qty, setQty] = useState(product.moq || 1);
  const moq = product.moq || 1;
  const stock = product.available_quantity || 0;
  const avail = availabilityFor(stock);
  const price = effectivePrice(product);
  const strike = showStrikethrough(product);
  const disabled = stock <= 0;

  const dec = () => setQty((q) => Math.max(1, q - 1));
  const inc = () => setQty((q) => q + 1);
  const onQtyChange = (e) => {
    const v = Number(e.target.value);
    if (!Number.isFinite(v)) return;
    setQty(Math.max(1, Math.floor(v)));
  };

  const handleAdd = () => {
    const useQty = Math.max(qty, moq);
    onAdd(product, useQty);
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
      {/* Promo ribbon */}
      {product.promo_active && product.promotional_price != null && (
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            left: -34,
            transform: 'rotate(-38deg)',
            background: goldGradient,
            color: '#1A1A1A',
            fontWeight: 800,
            fontSize: '0.72rem',
            letterSpacing: '0.14em',
            px: 4,
            py: 0.4,
            zIndex: 3,
            boxShadow: '0 6px 16px rgba(212,165,42,0.45)',
          }}
        >
          PROMO
        </Box>
      )}

      <Box sx={{ position: 'relative' }}>
        <ProductImage
          name={product.name}
          category={product.category}
          imageUrl={product.image_url}
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
            {product.name}
          </Typography>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', fontFamily: 'monospace', letterSpacing: '0.04em' }}
          >
            SKU {product.sku}
          </Typography>
        </Box>

        <Stack direction="row" spacing={0.75} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            label={product.category}
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
              background:
                avail.color === 'success'
                  ? 'rgba(46,125,50,0.10)'
                  : avail.color === 'warning'
                  ? 'rgba(237,108,2,0.10)'
                  : 'rgba(198,40,40,0.10)',
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
            <Typography
              sx={{
                fontSize: '0.7rem',
                fontWeight: 600,
                color: avail.dot,
              }}
            >
              {avail.label}
            </Typography>
          </Box>
        </Stack>

        <Box sx={{ mt: 'auto' }}>
          <Stack direction="row" alignItems="baseline" spacing={1}>
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
              {formatCurrency(price)}
            </Typography>
            {strike && (
              <Typography
                sx={{
                  textDecoration: 'line-through',
                  color: 'text.secondary',
                  fontSize: '0.9rem',
                }}
              >
                {formatCurrency(product.base_price)}
              </Typography>
            )}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            Customer price / unit
          </Typography>
        </Box>

        {/* Quantity + Add */}
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
            <IconButton size="small" onClick={dec} aria-label="decrease quantity">
              <RemoveIcon fontSize="small" />
            </IconButton>
            <TextField
              value={qty}
              onChange={onQtyChange}
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
            <IconButton size="small" onClick={inc} aria-label="increase quantity">
              <AddIcon fontSize="small" />
            </IconButton>
          </Box>
          <Tooltip
            title={qty < moq ? `Will be raised to MOQ of ${moq}` : ''}
            placement="top"
            arrow
          >
            <span style={{ flex: 1 }}>
              <Button
                fullWidth
                variant="contained"
                color="secondary"
                disabled={disabled}
                startIcon={<ShoppingCartIcon fontSize="small" />}
                onClick={handleAdd}
                sx={{ height: 38 }}
              >
                Add to Cart
              </Button>
            </span>
          </Tooltip>
        </Stack>
        {qty < moq && (
          <Typography variant="caption" sx={{ color: 'warning.main', mt: -0.5 }}>
            Below MOQ ({moq}); quantity will be increased on add.
          </Typography>
        )}
      </Box>
    </Box>
  );
}

// =====================================================================
// Page
// =====================================================================
export default function ProductCatalog() {
  const customerId = getCustomerIdFromStorage();
  const customerMarket = getCustomerMarket();
  const customerName = getCustomerName();

  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState('name_asc');

  const { addItem } = useCart();

  const { data, isLoading, isError, error, refetch, isFetching } = useQuery({
    queryKey: ['catalog', customerId],
    queryFn: () => getCatalog(customerId),
    enabled: customerId != null,
  });

  const products = useMemo(() => (Array.isArray(data) ? data : []), [data]);

  const filtered = useMemo(() => {
    let list = products;
    if (category !== 'all') {
      list = list.filter(
        (p) => String(p.category).toLowerCase() === category.toLowerCase()
      );
    }
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.sku?.toLowerCase().includes(q) ||
          p.description?.toLowerCase().includes(q)
      );
    }
    const sorted = [...list];
    switch (sortBy) {
      case 'name_desc':
        sorted.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'price_asc':
        sorted.sort((a, b) => effectivePrice(a) - effectivePrice(b));
        break;
      case 'price_desc':
        sorted.sort((a, b) => effectivePrice(b) - effectivePrice(a));
        break;
      case 'stock_desc':
        sorted.sort(
          (a, b) => (b.available_quantity || 0) - (a.available_quantity || 0)
        );
        break;
      case 'name_asc':
      default:
        sorted.sort((a, b) => a.name.localeCompare(b.name));
        break;
    }
    return sorted;
  }, [products, category, search, sortBy]);

  const categoryCounts = useMemo(() => {
    const c = { all: products.length };
    for (const p of products) {
      const k = String(p.category || '').toLowerCase();
      c[k] = (c[k] || 0) + 1;
    }
    return c;
  }, [products]);

  const handleAdd = (product, qty) => {
    const moq = product.moq || 1;
    const useQty = Math.max(qty, moq);
    addItem(productToCartItem(product, useQty));
  };

  return (
    <Box>
      <PageHeader
        title="Product Catalog"
        subtitle={
          customerName
            ? `Curated SKUs available to ${customerName}`
            : 'Curated SKUs available for your account'
        }
        breadcrumbs={[
          { label: 'Distributor', to: '/distributor/dashboard' },
          { label: 'Product Catalog' },
        ]}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
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
              <StorefrontIcon sx={{ fontSize: 18, color: '#B5891F' }} />
              <Typography
                sx={{
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  color: '#1A1A1A',
                }}
              >
                CUSTOMER MARKET{customerMarket ? `: ${customerMarket.toUpperCase()}` : ''}
              </Typography>
            </Box>
          </Stack>
        }
      />

      {/* Filter bar */}
      <Box
        sx={{
          mb: 3,
          p: 2,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(212,165,42,0.22)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(26,26,26,0.04)',
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2}
          alignItems={{ xs: 'stretch', md: 'center' }}
        >
          <Stack
            direction="row"
            spacing={1}
            sx={{ flexWrap: 'wrap', rowGap: 1, flex: 1 }}
          >
            {CATEGORIES.map((c) => {
              const active = category === c.key;
              const count =
                c.key === 'all'
                  ? categoryCounts.all || 0
                  : categoryCounts[c.key.toLowerCase()] || 0;
              return (
                <Chip
                  key={c.key}
                  label={`${c.label} (${count})`}
                  onClick={() => setCategory(c.key)}
                  sx={{
                    fontWeight: 600,
                    height: 32,
                    cursor: 'pointer',
                    background: active ? goldGradient : 'rgba(255,255,255,0.5)',
                    color: '#1A1A1A',
                    border: active
                      ? '1px solid transparent'
                      : '1px solid rgba(212,165,42,0.30)',
                    boxShadow: active
                      ? '0 6px 18px rgba(212,165,42,0.35)'
                      : 'none',
                    '&:hover': {
                      background: active
                        ? goldGradient
                        : 'rgba(212,165,42,0.10)',
                    },
                  }}
                />
              );
            })}
          </Stack>

          <TextField
            placeholder="Search by name, SKU, or description"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: { md: 300 }, flex: { md: '0 0 320px' } }}
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
            {SORT_OPTIONS.map((s) => (
              <MenuItem key={s.key} value={s.key}>
                {s.label}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Box>

      {/* Body */}
      {isLoading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="secondary" />
        </Box>
      ) : isError ? (
        <Box
          sx={{
            p: 4,
            borderRadius: 3,
            textAlign: 'center',
            border: '1px dashed rgba(198,40,40,0.30)',
            background: 'rgba(198,40,40,0.06)',
          }}
        >
          <Typography color="error" fontWeight={700} gutterBottom>
            Couldn&apos;t load the catalog
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {error?.response?.data?.detail || error?.message || 'Unknown error.'}
          </Typography>
          <Button variant="outlined" color="secondary" onClick={() => refetch()}>
            Try again
          </Button>
        </Box>
      ) : filtered.length === 0 ? (
        <EmptyState
          hasProducts={products.length > 0}
          onClearFilters={() => {
            setCategory('all');
            setSearch('');
          }}
        />
      ) : (
        <Box sx={{ position: 'relative' }}>
          {isFetching && (
            <Box sx={{ position: 'absolute', top: -8, right: 0 }}>
              <CircularProgress size={16} color="secondary" />
            </Box>
          )}
          <Grid container spacing={2.5}>
            <AnimatePresence mode="popLayout">
              {filtered.map((product) => (
                <Grid item xs={12} sm={6} md={4} lg={3} key={product.id}>
                  <motion.div
                    layout
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25 }}
                    style={{ height: '100%' }}
                  >
                    <ProductCard product={product} onAdd={handleAdd} />
                  </motion.div>
                </Grid>
              ))}
            </AnimatePresence>
          </Grid>
        </Box>
      )}
    </Box>
  );
}

function EmptyState({ hasProducts, onClearFilters }) {
  return (
    <Box
      sx={{
        py: 8,
        px: 3,
        textAlign: 'center',
        borderRadius: 3,
        border: '1px dashed rgba(212,165,42,0.35)',
        background: goldGradientSoft,
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          width: 64,
          height: 64,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(212,165,42,0.30)',
          alignItems: 'center',
          justifyContent: 'center',
          mb: 2,
        }}
      >
        {hasProducts ? (
          <SearchIcon sx={{ fontSize: 30, color: '#B5891F' }} />
        ) : (
          <InventoryIcon sx={{ fontSize: 30, color: '#B5891F' }} />
        )}
      </Box>
      <Typography variant="h5" sx={{ fontWeight: 700, mb: 0.5 }}>
        {hasProducts ? 'No products match those filters' : 'No products available yet'}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {hasProducts
          ? 'Try adjusting the category, search, or clearing all filters.'
          : 'Your account hasn’t been granted access to any SKUs yet. Reach out to your account manager.'}
      </Typography>
      {hasProducts && (
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<LocalOfferIcon />}
          onClick={onClearFilters}
        >
          Clear filters
        </Button>
      )}
    </Box>
  );
}
