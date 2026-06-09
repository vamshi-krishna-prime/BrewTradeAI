import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  Stack,
  IconButton,
  Button,
  Chip,
  Divider,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  LinearProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Avatar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RemoveIcon from '@mui/icons-material/Remove';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import RemoveShoppingCartIcon from '@mui/icons-material/RemoveShoppingCart';
import { motion, AnimatePresence } from 'framer-motion';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import OrderConfirmation from '../components/common/OrderConfirmation.jsx';
import { useCart } from '../contexts/CartContext.jsx';
import {
  validateCart as validateCartApi,
  submitOrder as submitOrderApi,
} from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import { goldGradient, goldGradientSoft } from '../theme.js';

const MotionRow = motion(TableRow);

// ----------------------------------------------------------------------
// Confidence / risk helpers
// ----------------------------------------------------------------------
function chipStyles(level) {
  switch (level) {
    case 'high':
      // For inventory_confidence 'high' means GOOD; for risk_indicator 'high'
      // means BAD.  The caller picks the right semantics by passing a
      // pre-computed level - here we just style.
      return {
        background: 'rgba(46,125,50,0.12)',
        color: '#1B5E20',
        border: '1px solid rgba(46,125,50,0.35)',
      };
    case 'medium':
      return {
        background: 'rgba(232,163,61,0.15)',
        color: '#9C5A12',
        border: '1px solid rgba(232,163,61,0.4)',
      };
    case 'low':
      return {
        background: 'rgba(198,40,40,0.12)',
        color: '#B71C1C',
        border: '1px solid rgba(198,40,40,0.35)',
      };
    default:
      return {
        background: 'rgba(26,26,26,0.06)',
        color: '#5A5A5A',
        border: '1px solid rgba(26,26,26,0.12)',
      };
  }
}

// For risk indicators we invert the semantic: high risk = red.
function riskChipStyles(level) {
  switch (level) {
    case 'low':
      return chipStyles('high'); // green
    case 'medium':
      return chipStyles('medium');
    case 'high':
      return chipStyles('low'); // red
    default:
      return chipStyles();
  }
}

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

// Default estimated delivery if backend hasn't yet returned one.
function defaultExpectedDelivery() {
  const d = new Date();
  d.setDate(d.getDate() + 14);
  return d.toISOString();
}

export default function Cart() {
  const navigate = useNavigate();
  const { items, updateQuantity, removeItem, clearCart } = useCart();
  const customerId = useMemo(readCustomerId, []);

  const [validation, setValidation] = useState(null);
  const [validating, setValidating] = useState(false);
  const [validationError, setValidationError] = useState(null);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState(null);
  const [submittedOrder, setSubmittedOrder] = useState(null);
  const [confirmHighRiskOpen, setConfirmHighRiskOpen] = useState(false);

  // ------------------------------------------------------------------
  // Cart -> backend validation payload
  // ------------------------------------------------------------------
  const validatablePayload = useMemo(
    () =>
      items
        .filter((i) => i.kind === 'product' && Number.isFinite(Number(i.refId)))
        .map((i) => ({ product_id: i.refId, quantity: i.quantity })),
    [items]
  );

  // Debounce so rapid +/- clicks don't fire a request per stroke.
  useEffect(() => {
    if (!customerId) {
      setValidation(null);
      return undefined;
    }
    if (validatablePayload.length === 0) {
      setValidation(null);
      setValidationError(null);
      return undefined;
    }
    let cancelled = false;
    const handle = setTimeout(async () => {
      setValidating(true);
      setValidationError(null);
      try {
        const v = await validateCartApi(customerId, validatablePayload);
        if (!cancelled) setValidation(v);
      } catch (err) {
        if (!cancelled) {
          setValidationError(
            err?.response?.data?.detail || err?.message || 'Validation failed'
          );
        }
      } finally {
        if (!cancelled) setValidating(false);
      }
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [customerId, validatablePayload]);

  // Look up validation row by product id so we can decorate each table row.
  const lineValidationByProductId = useMemo(() => {
    if (!validation?.items) return new Map();
    const m = new Map();
    for (const row of validation.items) {
      m.set(row.product_id, row);
    }
    return m;
  }, [validation]);

  // ------------------------------------------------------------------
  // Totals
  // ------------------------------------------------------------------
  const totals = useMemo(() => {
    // Subtotal from cart-local pricing for instant feedback.
    let subtotal = 0;
    for (const i of items) {
      subtotal += (i.unit_price || 0) * (i.quantity || 0);
    }
    // Discounts = sum of (base - unit_price) per qty for items where promo active.
    let discounts = 0;
    for (const i of items) {
      const base = i.base_price ?? i.unit_price;
      if (base > (i.unit_price || 0)) {
        discounts += (base - i.unit_price) * (i.quantity || 0);
      }
    }
    return {
      subtotal,
      discounts,
      total: validation?.total_value ?? subtotal,
    };
  }, [items, validation]);

  const riskIndicator = validation?.risk_indicator || 'low';
  const overCreditLimit = !!validation?.over_credit_limit;
  const financialHealth = validation?.financial_health;
  const financialHealthLevel = financialHealth?.credit_health
    ? financialHealth.credit_health === 'green'
      ? 'low'
      : financialHealth.credit_health === 'yellow'
      ? 'medium'
      : 'high'
    : 'low';

  // ------------------------------------------------------------------
  // Handlers
  // ------------------------------------------------------------------
  const handleQty = useCallback(
    (id, current, delta) => {
      const next = Math.max(0, (current || 0) + delta);
      updateQuantity(id, next);
    },
    [updateQuantity]
  );

  const handleQtyInput = useCallback(
    (id, raw) => {
      const n = parseInt(raw, 10);
      if (Number.isFinite(n) && n >= 0) {
        updateQuantity(id, n);
      }
    },
    [updateQuantity]
  );

  const doSubmit = useCallback(async () => {
    if (!customerId) {
      setSubmitError('No customer is signed in.');
      return;
    }
    if (validatablePayload.length === 0) {
      setSubmitError('Add at least one product before submitting.');
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      const order = await submitOrderApi(customerId, validatablePayload);
      setSubmittedOrder({
        ...order,
        expected_delivery: order?.expected_delivery || defaultExpectedDelivery(),
      });
      // Don't clear the cart until the modal is dismissed - we want callers
      // who close abruptly to keep their items as a safety net.  Actually,
      // the spec says "Clear cart" on success — so do it now.
      clearCart();
    } catch (err) {
      setSubmitError(
        err?.response?.data?.detail || err?.message || 'Submission failed'
      );
    } finally {
      setSubmitting(false);
    }
  }, [customerId, validatablePayload, clearCart]);

  const handleSubmitClick = useCallback(() => {
    if (riskIndicator === 'high') {
      setConfirmHighRiskOpen(true);
      return;
    }
    doSubmit();
  }, [riskIndicator, doSubmit]);

  const handleConfirmHighRisk = useCallback(() => {
    setConfirmHighRiskOpen(false);
    doSubmit();
  }, [doSubmit]);

  const closeConfirmation = useCallback(() => {
    setSubmittedOrder(null);
  }, []);

  const goToMyOrders = useCallback(() => {
    setSubmittedOrder(null);
    navigate('/distributor/my-orders');
  }, [navigate]);

  // ------------------------------------------------------------------
  // Empty state
  // ------------------------------------------------------------------
  if (items.length === 0 && !submittedOrder) {
    return (
      <Box>
        <PageHeader
          title="Cart"
          subtitle="Review and submit your order"
          breadcrumbs={[{ label: 'Distributor', to: '/distributor/dashboard' }, { label: 'Cart' }]}
        />
        <GlassCard sx={{ p: 6, textAlign: 'center' }}>
          <RemoveShoppingCartIcon sx={{ fontSize: 64, color: 'rgba(212,165,42,0.55)' }} />
          <Typography variant="h5" sx={{ mt: 2, fontWeight: 700 }}>
            Your cart is empty
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            Add products from the catalog to start an order.
          </Typography>
          <Button
            variant="contained"
            color="secondary"
            size="large"
            sx={{ mt: 3 }}
            onClick={() => navigate('/distributor/catalog')}
            startIcon={<ShoppingCartIcon />}
          >
            Browse Catalog
          </Button>
        </GlassCard>
      </Box>
    );
  }

  // ------------------------------------------------------------------
  // Main layout
  // ------------------------------------------------------------------
  return (
    <Box>
      <PageHeader
        title="Cart"
        subtitle="Review your line items, confirm pricing, then submit for approval"
        breadcrumbs={[
          { label: 'Distributor', to: '/distributor/dashboard' },
          { label: 'Cart' },
        ]}
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              size="small"
              icon={<ShoppingCartIcon />}
              label={`${items.length} line${items.length === 1 ? '' : 's'}`}
              sx={{ background: goldGradientSoft, border: '1px solid rgba(212,165,42,0.35)' }}
            />
            <Button
              size="small"
              color="inherit"
              startIcon={<DeleteOutlineIcon />}
              onClick={() => {
                if (window.confirm('Clear all items from cart?')) clearCart();
              }}
            >
              Clear
            </Button>
          </Stack>
        }
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 360px' },
          gap: 3,
          alignItems: 'flex-start',
        }}
      >
        {/* Left: line items */}
        <GlassCard sx={{ p: 0, overflow: 'hidden' }}>
          {validating && (
            <LinearProgress color="secondary" sx={{ height: 2 }} />
          )}
          {validationError && (
            <Alert
              severity="warning"
              icon={<WarningAmberIcon />}
              sx={{ m: 2 }}
            >
              {validationError}
            </Alert>
          )}
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Product</TableCell>
                  <TableCell align="center" sx={{ width: 160 }}>
                    Quantity
                  </TableCell>
                  <TableCell align="right">Unit Price</TableCell>
                  <TableCell align="right">Line Total</TableCell>
                  <TableCell align="center" sx={{ width: 150 }}>
                    Inventory
                  </TableCell>
                  <TableCell align="center" sx={{ width: 48 }} />
                </TableRow>
              </TableHead>
              <TableBody>
                <AnimatePresence initial={false}>
                  {items.map((i) => {
                    const lv = lineValidationByProductId.get(i.refId);
                    const confidence = lv?.inventory_confidence;
                    const lineTotal = lv?.line_total ?? i.unit_price * i.quantity;
                    const unitPrice = lv?.unit_price ?? i.unit_price;
                    const promo = lv?.promo_active ?? i.promo_active;
                    const moqOk = lv?.moq_ok ?? i.quantity >= (i.moq || 1);
                    const marketOk = lv?.market_approved ?? true;
                    return (
                      <MotionRow
                        key={i.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, x: -10 }}
                        transition={{ duration: 0.22 }}
                        hover
                      >
                        <TableCell>
                          <Stack direction="row" spacing={1.5} alignItems="center">
                            <Avatar
                              src={i.image_url || undefined}
                              variant="rounded"
                              sx={{
                                width: 56,
                                height: 56,
                                background: i.image_url
                                  ? 'transparent'
                                  : goldGradientSoft,
                                color: '#1A1A1A',
                                border: '1px solid rgba(212,165,42,0.25)',
                                fontWeight: 700,
                              }}
                            >
                              {(i.name || '?').slice(0, 1)}
                            </Avatar>
                            <Box sx={{ minWidth: 0 }}>
                              <Typography
                                variant="body2"
                                sx={{ fontWeight: 700 }}
                                noWrap
                              >
                                {i.name}
                              </Typography>
                              <Stack
                                direction="row"
                                spacing={0.75}
                                alignItems="center"
                                sx={{ mt: 0.25 }}
                              >
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                >
                                  {i.sku}
                                </Typography>
                                {i.category && (
                                  <Chip
                                    size="small"
                                    label={i.category}
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      background: 'rgba(212,165,42,0.08)',
                                      border: '1px solid rgba(212,165,42,0.2)',
                                    }}
                                  />
                                )}
                                {promo && (
                                  <Chip
                                    size="small"
                                    label="PROMO"
                                    sx={{
                                      height: 18,
                                      fontSize: '0.65rem',
                                      fontWeight: 700,
                                      background: goldGradient,
                                      color: '#1A1A1A',
                                    }}
                                  />
                                )}
                                {!moqOk && (
                                  <Tooltip title={`Minimum order quantity is ${i.moq}`}>
                                    <Chip
                                      size="small"
                                      icon={<WarningAmberIcon />}
                                      label={`MOQ ${i.moq}`}
                                      sx={{
                                        height: 18,
                                        fontSize: '0.65rem',
                                        background: 'rgba(232,163,61,0.15)',
                                        color: '#9C5A12',
                                      }}
                                    />
                                  </Tooltip>
                                )}
                                {!marketOk && (
                                  <Tooltip title="Not approved for your market">
                                    <Chip
                                      size="small"
                                      icon={<ReportProblemIcon />}
                                      label="Market"
                                      sx={{
                                        height: 18,
                                        fontSize: '0.65rem',
                                        background: 'rgba(198,40,40,0.10)',
                                        color: '#B71C1C',
                                      }}
                                    />
                                  </Tooltip>
                                )}
                              </Stack>
                            </Box>
                          </Stack>
                        </TableCell>

                        <TableCell align="center">
                          <Stack
                            direction="row"
                            alignItems="center"
                            spacing={0.5}
                            justifyContent="center"
                            sx={{
                              border: '1px solid rgba(212,165,42,0.3)',
                              borderRadius: 2,
                              px: 0.5,
                              py: 0.25,
                              display: 'inline-flex',
                              background: 'rgba(255,255,255,0.6)',
                            }}
                          >
                            <IconButton
                              size="small"
                              onClick={() => handleQty(i.id, i.quantity, -1)}
                              aria-label="decrease quantity"
                            >
                              <RemoveIcon fontSize="small" />
                            </IconButton>
                            <TextField
                              value={i.quantity}
                              onChange={(e) => handleQtyInput(i.id, e.target.value)}
                              variant="standard"
                              sx={{
                                width: 50,
                                '& input': {
                                  textAlign: 'center',
                                  fontWeight: 700,
                                  py: 0.5,
                                },
                              }}
                              InputProps={{ disableUnderline: true }}
                              inputProps={{
                                inputMode: 'numeric',
                                pattern: '[0-9]*',
                                'aria-label': 'quantity',
                              }}
                            />
                            <IconButton
                              size="small"
                              onClick={() => handleQty(i.id, i.quantity, +1)}
                              aria-label="increase quantity"
                            >
                              <AddIcon fontSize="small" />
                            </IconButton>
                          </Stack>
                        </TableCell>

                        <TableCell align="right">
                          {promo && i.base_price > unitPrice ? (
                            <Stack alignItems="flex-end">
                              <Typography
                                variant="caption"
                                color="text.secondary"
                                sx={{ textDecoration: 'line-through' }}
                              >
                                {formatCurrency(i.base_price)}
                              </Typography>
                              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                                {formatCurrency(unitPrice)}
                              </Typography>
                            </Stack>
                          ) : (
                            <Typography variant="body2" sx={{ fontWeight: 700 }}>
                              {formatCurrency(unitPrice)}
                            </Typography>
                          )}
                        </TableCell>

                        <TableCell align="right">
                          <Typography variant="body2" sx={{ fontWeight: 700 }}>
                            {formatCurrency(lineTotal)}
                          </Typography>
                        </TableCell>

                        <TableCell align="center">
                          {confidence ? (
                            <Tooltip
                              title={
                                lv
                                  ? `Available: ${lv.available} / Requested: ${lv.quantity_requested}`
                                  : 'Inventory status'
                              }
                            >
                              <Chip
                                size="small"
                                icon={
                                  confidence === 'high' ? (
                                    <CheckCircleIcon />
                                  ) : confidence === 'medium' ? (
                                    <WarningAmberIcon />
                                  ) : (
                                    <ReportProblemIcon />
                                  )
                                }
                                label={confidence.toUpperCase()}
                                sx={{
                                  fontWeight: 700,
                                  ...chipStyles(confidence),
                                }}
                              />
                            </Tooltip>
                          ) : i.kind === 'merchandise' ? (
                            <Chip
                              size="small"
                              label="MERCH"
                              sx={chipStyles()}
                            />
                          ) : (
                            <Chip size="small" label="—" sx={chipStyles()} />
                          )}
                        </TableCell>

                        <TableCell align="center">
                          <Tooltip title="Remove">
                            <IconButton
                              size="small"
                              color="error"
                              onClick={() => removeItem(i.id)}
                              aria-label="remove line"
                            >
                              <DeleteOutlineIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        </TableCell>
                      </MotionRow>
                    );
                  })}
                </AnimatePresence>
              </TableBody>
            </Table>
          </TableContainer>
        </GlassCard>

        {/* Right: order summary */}
        <Box sx={{ position: { md: 'sticky' }, top: { md: 96 } }}>
          <GlassCard sx={{ p: 3 }}>
            <Typography variant="h6" sx={{ fontWeight: 800 }}>
              Order Summary
            </Typography>
            <Divider sx={{ my: 1.5 }} />

            <Stack spacing={1}>
              <Row label="Subtotal" value={formatCurrency(totals.subtotal)} />
              {totals.discounts > 0 && (
                <Row
                  label="Discounts"
                  value={`- ${formatCurrency(totals.discounts)}`}
                  accent="#1B5E20"
                />
              )}
              <Row
                label="Order Total"
                value={formatCurrency(totals.total)}
                strong
              />
              <Row
                label="Estimated Delivery"
                value={formatDate(defaultExpectedDelivery())}
                muted
              />
            </Stack>

            <Divider sx={{ my: 2 }} />

            <Typography
              variant="overline"
              color="text.secondary"
              sx={{ letterSpacing: '0.08em' }}
            >
              AI Validation
            </Typography>
            <Stack spacing={1} sx={{ mt: 1 }}>
              <SummaryChip
                label="Customer Financial Health"
                level={financialHealthLevel}
                value={
                  financialHealth?.credit_health
                    ? financialHealth.credit_health.toUpperCase()
                    : 'OK'
                }
                semantics="health"
                sub={
                  financialHealth
                    ? `Available credit ${formatCurrency(
                        financialHealth.available_credit
                      )} • ${(financialHealth.utilization * 100).toFixed(0)}% used`
                    : null
                }
              />
              <SummaryChip
                label="Risk Indicator"
                level={riskIndicator}
                value={riskIndicator.toUpperCase()}
                semantics="risk"
                sub={
                  overCreditLimit
                    ? 'Order exceeds available credit limit'
                    : null
                }
              />
            </Stack>

            {submitError && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {submitError}
              </Alert>
            )}

            <Button
              variant="contained"
              color="secondary"
              fullWidth
              size="large"
              sx={{ mt: 2.5, py: 1.4, fontWeight: 800 }}
              disabled={
                items.length === 0 ||
                submitting ||
                !customerId ||
                validatablePayload.length === 0
              }
              onClick={handleSubmitClick}
            >
              {submitting
                ? 'Submitting…'
                : riskIndicator === 'high'
                ? 'Submit Order (High Risk)'
                : 'Submit Order'}
            </Button>
            {!customerId && (
              <Typography
                variant="caption"
                color="error"
                sx={{ mt: 1, display: 'block' }}
              >
                No customer is signed in.
              </Typography>
            )}
          </GlassCard>
        </Box>
      </Box>

      {/* High-risk confirmation */}
      <Dialog
        open={confirmHighRiskOpen}
        onClose={() => setConfirmHighRiskOpen(false)}
      >
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <ReportProblemIcon color="error" />
          Submit Order Despite High Risk?
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" sx={{ mb: 1 }}>
            BrewTrade AI has flagged this order as <strong>high risk</strong>.
            This can happen when:
          </Typography>
          <Box component="ul" sx={{ pl: 2.5, m: 0 }}>
            <li>One or more items lack sufficient inventory.</li>
            <li>The customer&apos;s credit utilisation is above safe limits.</li>
            <li>The order exceeds the remaining credit line.</li>
          </Box>
          <Alert severity="warning" icon={<WarningAmberIcon />} sx={{ mt: 2 }}>
            The order will still be submitted but will likely require manager
            approval before it is processed.
          </Alert>
        </DialogContent>
        <DialogActions sx={{ p: 2 }}>
          <Button onClick={() => setConfirmHighRiskOpen(false)} color="inherit">
            Cancel
          </Button>
          <Button
            onClick={handleConfirmHighRisk}
            variant="contained"
            color="secondary"
          >
            Submit Anyway
          </Button>
        </DialogActions>
      </Dialog>

      <OrderConfirmation
        open={!!submittedOrder}
        order={submittedOrder}
        onClose={closeConfirmation}
        onViewOrders={goToMyOrders}
      />
    </Box>
  );
}

function Row({ label, value, strong, muted, accent }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center">
      <Typography
        variant={strong ? 'body1' : 'body2'}
        sx={{
          fontWeight: strong ? 700 : 500,
          color: muted ? 'text.secondary' : 'text.primary',
        }}
      >
        {label}
      </Typography>
      <Typography
        variant={strong ? 'h6' : 'body2'}
        sx={{
          fontWeight: strong ? 800 : 600,
          color: accent || (strong ? '#1A1A1A' : 'text.primary'),
        }}
      >
        {value}
      </Typography>
    </Stack>
  );
}

function SummaryChip({ label, level, value, sub, semantics }) {
  const styles = semantics === 'risk' ? riskChipStyles(level) : chipStyles(level);
  return (
    <Box
      sx={{
        borderRadius: 2,
        p: 1.25,
        ...styles,
      }}
    >
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Typography
          variant="caption"
          sx={{ fontWeight: 600, color: 'inherit', opacity: 0.85 }}
        >
          {label}
        </Typography>
        <Typography variant="body2" sx={{ fontWeight: 800, color: 'inherit' }}>
          {value}
        </Typography>
      </Stack>
      {sub && (
        <Typography
          variant="caption"
          sx={{ color: 'inherit', opacity: 0.85, display: 'block', mt: 0.25 }}
        >
          {sub}
        </Typography>
      )}
    </Box>
  );
}
