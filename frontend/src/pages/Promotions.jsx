import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Stack,
  Typography,
  Button,
  Chip,
  Grid,
  CircularProgress,
  Alert,
  Divider,
} from '@mui/material';
import CampaignIcon from '@mui/icons-material/Campaign';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import AcUnitIcon from '@mui/icons-material/AcUnit';
import WbSunnyIcon from '@mui/icons-material/WbSunny';
import LocalFloristIcon from '@mui/icons-material/LocalFlorist';
import ParkIcon from '@mui/icons-material/Park';
import CelebrationIcon from '@mui/icons-material/Celebration';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import EventBusyIcon from '@mui/icons-material/EventBusy';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';

import PageHeader from '../components/common/PageHeader.jsx';
import ProductImage from '../components/common/ProductImage.jsx';
import CountdownTimer from '../components/common/CountdownTimer.jsx';
import { getActivePromotions, getPromotions } from '../api/client.js';
import { formatDate } from '../utils/format.js';
import { goldGradient, goldGradientSoft } from '../theme.js';

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

// =====================================================================
// Seasonal classification
// =====================================================================
const SEASONS = [
  {
    key: 'spring',
    label: 'Spring',
    icon: LocalFloristIcon,
    months: [2, 3, 4],
    gradient: 'linear-gradient(135deg, #A8D5BA 0%, #F2C849 100%)',
  },
  {
    key: 'summer',
    label: 'Summer',
    icon: WbSunnyIcon,
    months: [5, 6, 7],
    gradient: 'linear-gradient(135deg, #F2C849 0%, #E8A33D 100%)',
  },
  {
    key: 'autumn',
    label: 'Autumn',
    icon: ParkIcon,
    months: [8, 9, 10],
    gradient: 'linear-gradient(135deg, #E8A33D 0%, #8B5A1F 100%)',
  },
  {
    key: 'winter',
    label: 'Winter',
    icon: AcUnitIcon,
    months: [11, 0, 1],
    gradient: 'linear-gradient(135deg, #5A5A5A 0%, #B5891F 100%)',
  },
];

const KEYWORD_SEASONS = {
  spring: ['spring', 'easter', 'bloom'],
  summer: ['summer', 'sun', 'beach', 'festival', 'world cup', 'olympic'],
  autumn: ['autumn', 'fall', 'harvest', 'oktoberfest'],
  winter: ['winter', 'christmas', 'holiday', 'new year', 'lunar', 'carnival'],
};

function seasonFor(promo) {
  const blob = `${promo.title || ''} ${promo.description || ''}`.toLowerCase();
  for (const [season, kws] of Object.entries(KEYWORD_SEASONS)) {
    if (kws.some((k) => blob.includes(k))) return season;
  }
  if (promo.start_date) {
    const m = new Date(promo.start_date).getMonth();
    const def = SEASONS.find((s) => s.months.includes(m));
    if (def) return def.key;
  }
  return null;
}

function isBundle(promo) {
  const blob = `${promo.title || ''} ${promo.description || ''}`.toLowerCase();
  return (
    blob.includes('bundle') ||
    blob.includes('combo') ||
    blob.includes('pack') ||
    blob.includes('mix') ||
    blob.includes('+')
  );
}

// =====================================================================
// Promo hero card
// =====================================================================
function PromoCard({ promo, onView, index }) {
  const endDate = promo.end_date;

  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, delay: index * 0.06, ease: [0.22, 0.61, 0.36, 1] }}
      whileHover={{
        y: -6,
        boxShadow:
          '0 28px 60px rgba(26,26,26,0.18), 0 0 0 1px rgba(212,165,42,0.55)',
      }}
      sx={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        background: 'rgba(255,255,255,0.78)',
        backdropFilter: 'blur(22px)',
        WebkitBackdropFilter: 'blur(22px)',
        border: '1px solid rgba(212,165,42,0.30)',
        borderRadius: 3,
        overflow: 'hidden',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.6) inset, 0 14px 38px rgba(26,26,26,0.08)',
      }}
    >
      <Box sx={{ position: 'relative' }}>
        <ProductImage
          name={promo.title}
          category="promo"
          imageUrl={promo.image_url}
          height={196}
          rounded={false}
          iconSize={64}
          showInitials={false}
        />
        {/* discount badge */}
        {promo.discount_percent > 0 && (
          <Box
            sx={{
              position: 'absolute',
              top: 14,
              right: 14,
              minWidth: 70,
              px: 1.5,
              py: 1,
              borderRadius: 2,
              background: goldGradient,
              color: '#1A1A1A',
              textAlign: 'center',
              boxShadow: '0 10px 24px rgba(212,165,42,0.45)',
              transform: 'rotate(3deg)',
            }}
          >
            <Typography sx={{ fontWeight: 900, fontSize: '1.45rem', lineHeight: 1 }}>
              -{Math.round(promo.discount_percent)}%
            </Typography>
            <Typography
              sx={{
                fontSize: '0.6rem',
                fontWeight: 700,
                letterSpacing: '0.14em',
                lineHeight: 1,
                mt: 0.3,
              }}
            >
              OFF
            </Typography>
          </Box>
        )}
        {/* market chip */}
        {promo.market && (
          <Chip
            size="small"
            label={promo.market.toUpperCase()}
            sx={{
              position: 'absolute',
              top: 14,
              left: 14,
              height: 24,
              fontWeight: 700,
              fontSize: '0.7rem',
              letterSpacing: '0.10em',
              background: 'rgba(26,26,26,0.78)',
              color: '#F2C849',
              border: '1px solid rgba(242,200,73,0.35)',
            }}
          />
        )}
        {/* dark overlay for legibility */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, transparent 50%, rgba(0,0,0,0.45) 100%)',
            pointerEvents: 'none',
          }}
        />
        <Typography
          sx={{
            position: 'absolute',
            left: 14,
            right: 14,
            bottom: 12,
            color: '#FFFFFF',
            fontWeight: 800,
            fontSize: '1.25rem',
            lineHeight: 1.15,
            textShadow: '0 2px 12px rgba(0,0,0,0.5)',
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {promo.title}
        </Typography>
      </Box>

      <Box sx={{ p: 2.25, display: 'flex', flexDirection: 'column', gap: 1.5, flex: 1 }}>
        {promo.description && (
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              display: '-webkit-box',
              WebkitLineClamp: 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {promo.description}
          </Typography>
        )}

        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
          <Chip
            size="small"
            icon={<LocalOfferIcon style={{ color: '#B5891F' }} />}
            label={`Ends ${formatDate(promo.end_date)}`}
            sx={{
              height: 24,
              fontSize: '0.72rem',
              fontWeight: 600,
              background: goldGradientSoft,
              border: '1px solid rgba(212,165,42,0.30)',
            }}
          />
        </Stack>

        <Box>
          <Typography
            variant="overline"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.14em',
              color: 'text.secondary',
              display: 'block',
              mb: 0.75,
            }}
          >
            Offer ends in
          </Typography>
          <CountdownTimer endDate={endDate} size="small" />
        </Box>

        <Box sx={{ mt: 'auto' }}>
          <Button
            fullWidth
            variant="contained"
            color="secondary"
            endIcon={<ArrowForwardIcon />}
            onClick={() => onView && onView(promo)}
          >
            View Products
          </Button>
        </Box>
      </Box>
    </Box>
  );
}

// =====================================================================
// Page
// =====================================================================
export default function Promotions() {
  const navigate = useNavigate();
  const customerId = getCustomerIdFromStorage();

  // Active promotions for this customer (filtered by date window + market)
  const activeQuery = useQuery({
    queryKey: ['promotions', 'active', customerId],
    queryFn: () => getActivePromotions(customerId),
    enabled: customerId != null,
  });

  // Full list — used to surface upcoming seasonal campaigns and bundles
  // that may sit outside the active window.
  const allQuery = useQuery({
    queryKey: ['promotions', 'all'],
    queryFn: () => getPromotions(),
  });

  const active = useMemo(
    () => (Array.isArray(activeQuery.data) ? activeQuery.data : []),
    [activeQuery.data]
  );
  const all = useMemo(
    () => (Array.isArray(allQuery.data) ? allQuery.data : []),
    [allQuery.data]
  );

  // Seasonal grouping
  const seasonal = useMemo(() => {
    const map = {};
    for (const p of all) {
      const s = seasonFor(p);
      if (!s) continue;
      if (!map[s]) map[s] = [];
      map[s].push(p);
    }
    return map;
  }, [all]);

  const bundles = useMemo(() => all.filter(isBundle), [all]);

  const handleView = (promo) => {
    // Land on the catalog; user can search for products tied to this promo.
    if (promo.product_id) {
      navigate(`/distributor/catalog`);
    } else {
      navigate(`/distributor/catalog`);
    }
  };

  const isLoading = activeQuery.isLoading || allQuery.isLoading;
  const isError = activeQuery.isError && allQuery.isError;

  return (
    <Box>
      {/* Hero banner */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45 }}
        sx={{
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          mb: 4,
          p: { xs: 3, md: 5 },
          background:
            'linear-gradient(135deg, #1A1A1A 0%, #2A2014 55%, #3A2810 100%)',
          color: '#FFFFFF',
          boxShadow:
            '0 30px 80px rgba(26,26,26,0.40), 0 0 0 1px rgba(212,165,42,0.35) inset',
        }}
      >
        {/* gold burst */}
        <Box
          sx={{
            position: 'absolute',
            top: -120,
            right: -120,
            width: 360,
            height: 360,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(242,200,73,0.55) 0%, rgba(212,165,42,0.20) 40%, transparent 70%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        <Box
          sx={{
            position: 'absolute',
            bottom: -100,
            left: -80,
            width: 260,
            height: 260,
            borderRadius: '50%',
            background:
              'radial-gradient(circle, rgba(232,163,61,0.40) 0%, transparent 70%)',
            filter: 'blur(8px)',
            pointerEvents: 'none',
          }}
        />
        {/* shimmer */}
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            opacity: 0.10,
            background:
              'repeating-linear-gradient(45deg, rgba(242,200,73,0.5) 0 2px, transparent 2px 22px)',
            pointerEvents: 'none',
          }}
        />

        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={3}
          alignItems={{ xs: 'flex-start', md: 'center' }}
          sx={{ position: 'relative', zIndex: 1 }}
        >
          <Box sx={{ flex: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1.5 }}>
              <CampaignIcon sx={{ color: '#F2C849' }} />
              <Typography
                sx={{
                  fontSize: '0.74rem',
                  fontWeight: 800,
                  letterSpacing: '0.22em',
                  color: '#F2C849',
                }}
              >
                BREWTRADE PROMOTIONS CENTER
              </Typography>
            </Stack>
            <Typography
              variant="h2"
              sx={{
                fontWeight: 900,
                lineHeight: 1.05,
                background: goldGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mb: 1,
              }}
            >
              Exclusive Offers, Crafted For You
            </Typography>
            <Typography
              sx={{
                color: 'rgba(255,255,255,0.82)',
                maxWidth: 640,
                fontSize: '1.02rem',
              }}
            >
              Limited-time campaigns, seasonal launches, and bundle savings on
              the premium SKUs in your customer catalog. The countdown is real
              — claim offers before they expire.
            </Typography>
            <Stack direction="row" spacing={1.25} sx={{ mt: 2.5 }}>
              <Chip
                label={`${active.length} active offer${active.length === 1 ? '' : 's'}`}
                sx={{
                  fontWeight: 700,
                  background: goldGradient,
                  color: '#1A1A1A',
                  border: 'none',
                  height: 30,
                }}
              />
              <Chip
                label={`${bundles.length} bundle${bundles.length === 1 ? '' : 's'}`}
                sx={{
                  fontWeight: 700,
                  background: 'rgba(255,255,255,0.10)',
                  color: '#F2C849',
                  border: '1px solid rgba(242,200,73,0.40)',
                  height: 30,
                }}
              />
            </Stack>
          </Box>
          <Box
            sx={{
              display: { xs: 'none', md: 'flex' },
              width: 130,
              height: 130,
              borderRadius: '50%',
              background: goldGradient,
              boxShadow: '0 20px 60px rgba(212,165,42,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1A1A1A',
              fontWeight: 900,
              fontSize: '0.85rem',
              letterSpacing: '0.14em',
              textAlign: 'center',
              transform: 'rotate(-8deg)',
            }}
          >
            <Box>
              <Typography sx={{ fontWeight: 900, fontSize: '0.78rem' }}>
                LIMITED
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '1.6rem', lineHeight: 1 }}>
                TIME
              </Typography>
              <Typography sx={{ fontWeight: 900, fontSize: '0.78rem' }}>
                ONLY
              </Typography>
            </Box>
          </Box>
        </Stack>
      </Box>

      {/* Loading / error */}
      {isLoading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
          <CircularProgress color="secondary" />
        </Box>
      )}

      {!isLoading && isError && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {activeQuery.error?.message ||
            allQuery.error?.message ||
            'Failed to load promotions.'}
        </Alert>
      )}

      {!isLoading && !isError && (
        <>
          {/* Active Promotions */}
          <SectionHeader
            icon={<LocalOfferIcon />}
            eyebrow="ACTIVE NOW"
            title="Active Promotions"
            subtitle="Offers available to your account today"
            count={active.length}
          />

          {active.length === 0 ? (
            <EmptyPanel
              icon={<EventBusyIcon />}
              title="No active promotions right now"
              subtitle="New campaigns drop every season — check back soon, or browse the bundles below."
            />
          ) : (
            <Grid container spacing={2.5} sx={{ mb: 5 }}>
              {active.map((p, idx) => (
                <Grid item xs={12} sm={6} md={4} key={p.id}>
                  <PromoCard promo={p} onView={handleView} index={idx} />
                </Grid>
              ))}
            </Grid>
          )}

          {/* Seasonal */}
          <SectionHeader
            icon={<CelebrationIcon />}
            eyebrow="BY SEASON"
            title="Seasonal Campaigns"
            subtitle="Curated launches mapped to the calendar"
          />

          {SEASONS.some((s) => (seasonal[s.key] || []).length > 0) ? (
            <Box sx={{ mb: 5 }}>
              {SEASONS.map((s) => {
                const list = seasonal[s.key] || [];
                if (list.length === 0) return null;
                const Icon = s.icon;
                return (
                  <Box key={s.key} sx={{ mb: 3 }}>
                    <Stack direction="row" spacing={1.25} alignItems="center" sx={{ mb: 1.5 }}>
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 2,
                          background: s.gradient,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#1A1A1A',
                          boxShadow: '0 6px 18px rgba(26,26,26,0.10)',
                        }}
                      >
                        <Icon fontSize="small" />
                      </Box>
                      <Typography sx={{ fontWeight: 800, fontSize: '1.05rem' }}>
                        {s.label}
                      </Typography>
                      <Chip
                        size="small"
                        label={`${list.length} campaign${list.length === 1 ? '' : 's'}`}
                        sx={{
                          fontWeight: 700,
                          background: 'rgba(212,165,42,0.10)',
                          border: '1px solid rgba(212,165,42,0.30)',
                          height: 22,
                        }}
                      />
                    </Stack>
                    <Grid container spacing={2.5}>
                      {list.map((p, idx) => (
                        <Grid item xs={12} sm={6} md={4} key={p.id}>
                          <PromoCard promo={p} onView={handleView} index={idx} />
                        </Grid>
                      ))}
                    </Grid>
                  </Box>
                );
              })}
            </Box>
          ) : (
            <EmptyPanel
              icon={<CelebrationIcon />}
              title="No seasonal campaigns yet"
              subtitle="Campaigns will appear here as soon as marketing publishes them."
            />
          )}

          {/* Bundles */}
          <Divider sx={{ my: 4, borderColor: 'rgba(212,165,42,0.20)' }} />
          <SectionHeader
            icon={<Inventory2Icon />}
            eyebrow="MULTI-SKU SAVINGS"
            title="Promotional Bundles"
            subtitle="Mix-and-match deals that ship as a single order line"
            count={bundles.length}
          />

          {bundles.length === 0 ? (
            <EmptyPanel
              icon={<Inventory2Icon />}
              title="No bundles available"
              subtitle="Pre-built mixed cases will appear here when active."
            />
          ) : (
            <Grid container spacing={2.5}>
              {bundles.map((p, idx) => (
                <Grid item xs={12} sm={6} md={4} key={p.id}>
                  <PromoCard promo={p} onView={handleView} index={idx} />
                </Grid>
              ))}
            </Grid>
          )}
        </>
      )}
    </Box>
  );
}

// ---------------------------------------------------------------------
// Local helpers
// ---------------------------------------------------------------------
function SectionHeader({ icon, eyebrow, title, subtitle, count }) {
  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      alignItems={{ xs: 'flex-start', sm: 'flex-end' }}
      justifyContent="space-between"
      spacing={1}
      sx={{ mb: 2 }}
    >
      <Box>
        <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
          <Box
            sx={{
              width: 30,
              height: 30,
              borderRadius: 1.5,
              background: goldGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1A1A1A',
            }}
          >
            {icon}
          </Box>
          <Typography
            sx={{
              fontSize: '0.7rem',
              fontWeight: 800,
              letterSpacing: '0.18em',
              color: 'text.secondary',
            }}
          >
            {eyebrow}
          </Typography>
        </Stack>
        <Typography sx={{ fontWeight: 800, fontSize: '1.6rem', lineHeight: 1.1 }}>
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="body2" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>
      {typeof count === 'number' && (
        <Chip
          label={`${count} total`}
          sx={{
            fontWeight: 700,
            background: goldGradientSoft,
            border: '1px solid rgba(212,165,42,0.30)',
          }}
        />
      )}
    </Stack>
  );
}

function EmptyPanel({ icon, title, subtitle }) {
  return (
    <Box
      sx={{
        py: 6,
        px: 3,
        mb: 5,
        textAlign: 'center',
        borderRadius: 3,
        border: '1px dashed rgba(212,165,42,0.35)',
        background: goldGradientSoft,
      }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.6)',
          border: '1px solid rgba(212,165,42,0.30)',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#B5891F',
          mb: 1.5,
        }}
      >
        {icon}
      </Box>
      <Typography sx={{ fontWeight: 700, fontSize: '1.15rem' }}>{title}</Typography>
      <Typography color="text.secondary" sx={{ mt: 0.5 }}>
        {subtitle}
      </Typography>
    </Box>
  );
}
