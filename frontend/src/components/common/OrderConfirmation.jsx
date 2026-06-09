import React, { useEffect, useMemo } from 'react';
import {
  Dialog,
  Box,
  Typography,
  Button,
  Stack,
  Chip,
  Divider,
  IconButton,
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PaidIcon from '@mui/icons-material/Paid';
import CloseIcon from '@mui/icons-material/Close';
import { motion, AnimatePresence } from 'framer-motion';

import { goldGradient, goldGradientSoft } from '../../theme.js';
import { formatCurrency, formatDate } from '../../utils/format.js';

const MotionBox = motion(Box);

/**
 * OrderConfirmation
 * ----------------------------------------------------------------------
 * Celebratory confirmation modal shown after a successful order submission.
 *
 * Props:
 *   open: boolean
 *   order: { id, order_number, total_value, expected_delivery, status, ... }
 *   onClose: () => void
 *   onViewOrders: () => void
 */
export default function OrderConfirmation({
  open,
  order,
  onClose,
  onViewOrders,
}) {
  // Pre-build a small staggered burst of checkmarks for the celebration.
  const confetti = useMemo(() => {
    // Deterministic-ish set of positions around the circle so the animation
    // looks balanced rather than truly random across renders.
    const count = 14;
    const out = [];
    for (let i = 0; i < count; i += 1) {
      const angle = (i / count) * Math.PI * 2;
      const radius = 140 + (i % 3) * 18;
      out.push({
        id: i,
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        delay: 0.05 * i,
        rotate: (i * 47) % 360,
      });
    }
    return out;
  }, []);

  // Auto-close gracefully if user navigates away with Escape.  Dialog itself
  // wires onClose to backdrop/escape, but we keep a safety listener.
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);

  const orderNumber = order?.order_number || (order?.id ? `#${order.id}` : '—');
  const orderValue = order?.total_value ?? 0;
  const expected = order?.expected_delivery;
  const status = order?.status || 'submitted';

  return (
    <Dialog
      open={!!open}
      onClose={onClose}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: {
          overflow: 'visible',
          borderRadius: 4,
          background:
            'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,253,245,0.96) 100%)',
          border: '1px solid rgba(212,165,42,0.35)',
          boxShadow: '0 30px 80px rgba(26,26,26,0.18)',
        },
      }}
    >
      <AnimatePresence>
        {open && (
          <MotionBox
            key="confirmation"
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ type: 'spring', stiffness: 220, damping: 24 }}
            sx={{ p: { xs: 3, sm: 4 }, position: 'relative' }}
          >
            <IconButton
              onClick={onClose}
              size="small"
              sx={{ position: 'absolute', top: 12, right: 12 }}
              aria-label="close"
            >
              <CloseIcon fontSize="small" />
            </IconButton>

            {/* Hero check + staggered confetti checkmarks */}
            <Box
              sx={{
                position: 'relative',
                width: '100%',
                height: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                mb: 2,
              }}
            >
              {/* Confetti burst */}
              {confetti.map((c) => (
                <MotionBox
                  key={c.id}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0, rotate: 0 }}
                  animate={{
                    opacity: [0, 1, 1, 0],
                    x: c.x,
                    y: c.y,
                    scale: [0, 1.1, 1, 0.9],
                    rotate: c.rotate,
                  }}
                  transition={{
                    duration: 1.4,
                    delay: c.delay,
                    ease: 'easeOut',
                  }}
                  sx={{
                    position: 'absolute',
                    color: '#D4A52A',
                    pointerEvents: 'none',
                  }}
                >
                  <CheckCircleIcon sx={{ fontSize: 22 }} />
                </MotionBox>
              ))}

              {/* Pulsing halo */}
              <MotionBox
                initial={{ scale: 0.6, opacity: 0 }}
                animate={{ scale: [0.8, 1.05, 1], opacity: [0, 0.6, 0] }}
                transition={{ duration: 1.6, ease: 'easeOut' }}
                sx={{
                  position: 'absolute',
                  width: 130,
                  height: 130,
                  borderRadius: '50%',
                  background: goldGradient,
                  filter: 'blur(8px)',
                }}
              />

              {/* Hero check */}
              <MotionBox
                initial={{ scale: 0, rotate: -25 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: 'spring',
                  stiffness: 200,
                  damping: 12,
                  delay: 0.1,
                }}
                sx={{
                  position: 'relative',
                  width: 96,
                  height: 96,
                  borderRadius: '50%',
                  background: goldGradient,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 18px 40px rgba(212,165,42,0.55)',
                }}
              >
                <CheckCircleIcon sx={{ fontSize: 56, color: '#1A1A1A' }} />
              </MotionBox>
            </Box>

            <Stack spacing={0.5} alignItems="center" textAlign="center">
              <Typography
                variant="h4"
                sx={{
                  fontWeight: 800,
                  background: goldGradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Order Placed!
              </Typography>
              <Typography variant="body1" color="text.secondary">
                Thanks — we&apos;ve received your order and it&apos;s on its way to
                review.
              </Typography>
            </Stack>

            {/* Summary tiles */}
            <Box
              sx={{
                mt: 3,
                display: 'grid',
                gridTemplateColumns: { xs: '1fr 1fr', sm: 'repeat(4, 1fr)' },
                gap: 1.5,
              }}
            >
              <SummaryTile
                icon={<ReceiptLongIcon />}
                label="Order ID"
                value={orderNumber}
              />
              <SummaryTile
                icon={<PaidIcon />}
                label="Order Value"
                value={formatCurrency(orderValue)}
              />
              <SummaryTile
                icon={<LocalShippingIcon />}
                label="Expected"
                value={expected ? formatDate(expected) : '—'}
              />
              <SummaryTile
                label="Status"
                value={
                  <Chip
                    size="small"
                    label={String(status).replace('_', ' ').toUpperCase()}
                    sx={{
                      fontWeight: 700,
                      background: goldGradientSoft,
                      border: '1px solid rgba(212,165,42,0.35)',
                    }}
                  />
                }
              />
            </Box>

            <Divider sx={{ my: 3 }} />

            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={1.25}
              justifyContent="flex-end"
            >
              <Button onClick={onClose} color="inherit">
                Keep Shopping
              </Button>
              <Button
                onClick={onViewOrders}
                variant="contained"
                color="secondary"
                size="large"
                startIcon={<LocalShippingIcon />}
              >
                View My Orders
              </Button>
            </Stack>
          </MotionBox>
        )}
      </AnimatePresence>
    </Dialog>
  );
}

function SummaryTile({ icon, label, value }) {
  return (
    <Box
      sx={{
        borderRadius: 2,
        border: '1px solid rgba(212,165,42,0.25)',
        background: 'rgba(255,255,255,0.6)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        p: 1.25,
        display: 'flex',
        flexDirection: 'column',
        gap: 0.4,
      }}
    >
      <Stack direction="row" spacing={0.75} alignItems="center">
        {icon && (
          <Box
            sx={{
              width: 22,
              height: 22,
              borderRadius: 1,
              background: goldGradient,
              color: '#1A1A1A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              '& svg': { fontSize: 14 },
            }}
          >
            {icon}
          </Box>
        )}
        <Typography variant="caption" color="text.secondary" fontWeight={600}>
          {label}
        </Typography>
      </Stack>
      <Box sx={{ fontWeight: 700, fontSize: '0.95rem', mt: 0.25 }}>{value}</Box>
    </Box>
  );
}
