import React from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  Chip,
  Tooltip,
  IconButton,
} from '@mui/material';
import { motion } from 'framer-motion';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import { goldGradient } from '../../theme.js';
import { formatCurrency, formatNumber } from '../../utils/format.js';

/**
 * AIRecommendationCard - reusable product / merchandise recommendation card.
 *
 * Props:
 *  - item: {
 *      id, product_id, sku,
 *      name | product_name | title,
 *      category, brand, size, pack,
 *      unit_price | price,
 *      suggested_quantity | quantity,
 *      rationale | reason | explanation,
 *      confidence (0-1) | confidence_pct (0-100),
 *      image_url,
 *      tags: [string]
 *    }
 *  - variant: 'product' | 'merchandise'
 *  - onAddToCart: (item) => void
 *  - added: boolean   (controlled "in-cart" state)
 *  - delay: number    (stagger delay for entrance animation)
 */
export default function AIRecommendationCard({
  item = {},
  variant = 'product',
  onAddToCart,
  added = false,
  delay = 0,
}) {
  const name =
    item.name || item.product_name || item.title || item.sku || 'Recommended Item';
  const qty = Number(item.suggested_quantity ?? item.quantity ?? 0);
  const price = Number(item.unit_price ?? item.price ?? 0);
  const subtotal = qty > 0 && price > 0 ? qty * price : null;
  const confidence =
    item.confidence_pct != null
      ? Math.round(Number(item.confidence_pct))
      : item.confidence != null
      ? Math.round(Number(item.confidence) * 100)
      : null;
  const rationale =
    item.rationale || item.reason || item.explanation || item.justification || '';
  const tags = Array.isArray(item.tags) ? item.tags : [];

  const Icon = variant === 'merchandise' ? StorefrontIcon : LocalBarIcon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{
        duration: 0.5,
        delay,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={{ y: -4 }}
      style={{ height: '100%' }}
    >
      <Box
        sx={{
          position: 'relative',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          background: 'rgba(255,255,255,0.78)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(212,165,42,0.28)',
          borderRadius: 3,
          overflow: 'hidden',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 32px rgba(26,26,26,0.07)',
          transition: 'box-shadow 0.25s ease',
          '&:hover': {
            boxShadow:
              '0 1px 0 rgba(255,255,255,0.6) inset, 0 18px 42px rgba(212,165,42,0.18)',
          },
        }}
      >
        {/* Gold accent strip */}
        <Box
          sx={{
            height: 3,
            background: goldGradient,
            opacity: 0.95,
          }}
        />

        {/* AI-pick ribbon */}
        <Box
          sx={{
            position: 'absolute',
            top: 12,
            right: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 0.5,
            px: 1,
            py: 0.4,
            borderRadius: 99,
            background: 'rgba(26,26,26,0.85)',
            color: '#F2C849',
            fontSize: '0.65rem',
            fontWeight: 800,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            zIndex: 2,
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: '0.85rem' }} />
          AI Pick
        </Box>

        {/* Visual header */}
        <Box
          sx={{
            position: 'relative',
            height: 96,
            background: item.image_url
              ? `linear-gradient(135deg, rgba(0,0,0,0.05), rgba(0,0,0,0.25)), url(${item.image_url})`
              : 'linear-gradient(135deg, rgba(212,165,42,0.18) 0%, rgba(242,200,73,0.10) 50%, rgba(232,163,61,0.18) 100%)',
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            px: 2,
          }}
        >
          {!item.image_url && (
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                background: goldGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1A1A1A',
                boxShadow: '0 8px 22px rgba(212,165,42,0.4)',
              }}
            >
              <Icon />
            </Box>
          )}
        </Box>

        {/* Body */}
        <Box sx={{ p: 2, flex: 1, display: 'flex', flexDirection: 'column' }}>
          <Stack direction="row" alignItems="flex-start" spacing={1}>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle1"
                sx={{
                  fontWeight: 800,
                  lineHeight: 1.25,
                  letterSpacing: '-0.005em',
                }}
              >
                {name}
              </Typography>
              {(item.brand || item.size || item.pack || item.category) && (
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ display: 'block', mt: 0.25 }}
                >
                  {[item.brand, item.category, item.size, item.pack]
                    .filter(Boolean)
                    .join(' - ')}
                </Typography>
              )}
            </Box>
          </Stack>

          {/* Quantity & price row */}
          <Stack
            direction="row"
            alignItems="center"
            spacing={1.5}
            sx={{
              mt: 1.5,
              p: 1.25,
              borderRadius: 2,
              background: 'rgba(212,165,42,0.08)',
              border: '1px solid rgba(212,165,42,0.18)',
            }}
          >
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="caption"
                sx={{
                  color: 'text.secondary',
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  fontWeight: 700,
                  fontSize: '0.65rem',
                }}
              >
                Suggested
              </Typography>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 800,
                  lineHeight: 1.1,
                  background: goldGradient,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                {formatNumber(qty)} {qty === 1 ? 'unit' : 'units'}
              </Typography>
            </Box>
            {price > 0 && (
              <Box sx={{ textAlign: 'right' }}>
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    fontWeight: 700,
                    fontSize: '0.65rem',
                  }}
                >
                  {subtotal ? 'Subtotal' : 'Unit'}
                </Typography>
                <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.1 }}>
                  {formatCurrency(subtotal ?? price)}
                </Typography>
              </Box>
            )}
          </Stack>

          {/* Rationale */}
          {rationale && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="flex-start"
              sx={{ mt: 1.5 }}
            >
              <InfoOutlinedIcon sx={{ fontSize: 16, color: '#B5891F', mt: 0.25 }} />
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{
                  fontStyle: 'italic',
                  lineHeight: 1.45,
                  display: '-webkit-box',
                  WebkitLineClamp: 3,
                  WebkitBoxOrient: 'vertical',
                  overflow: 'hidden',
                }}
              >
                {rationale}
              </Typography>
            </Stack>
          )}

          {/* Tags + confidence */}
          {(tags.length > 0 || confidence != null) && (
            <Stack
              direction="row"
              spacing={0.75}
              flexWrap="wrap"
              useFlexGap
              sx={{ mt: 1.5 }}
            >
              {confidence != null && (
                <Tooltip title={`AI confidence: ${confidence}%`}>
                  <Chip
                    size="small"
                    icon={<TrendingUpIcon sx={{ fontSize: 14 }} />}
                    label={`${confidence}% confidence`}
                    sx={{
                      height: 22,
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      background: 'rgba(46,125,50,0.10)',
                      color: '#2E7D32',
                      border: '1px solid rgba(46,125,50,0.25)',
                      '& .MuiChip-icon': { color: '#2E7D32' },
                    }}
                  />
                </Tooltip>
              )}
              {tags.slice(0, 3).map((t, idx) => (
                <Chip
                  key={idx}
                  size="small"
                  label={t}
                  sx={{
                    height: 22,
                    fontSize: '0.7rem',
                    fontWeight: 600,
                    background: 'rgba(212,165,42,0.10)',
                    color: '#8a5a10',
                    border: '1px solid rgba(212,165,42,0.22)',
                  }}
                />
              ))}
            </Stack>
          )}

          <Box sx={{ flex: 1 }} />

          {/* Action */}
          <Button
            fullWidth
            variant={added ? 'outlined' : 'contained'}
            color="secondary"
            startIcon={added ? <CheckCircleIcon /> : <AddShoppingCartIcon />}
            onClick={() => onAddToCart && onAddToCart(item)}
            sx={{ mt: 2, fontWeight: 700 }}
          >
            {added ? 'Added to Cart' : 'Add to Cart'}
          </Button>
        </Box>
      </Box>
    </motion.div>
  );
}
