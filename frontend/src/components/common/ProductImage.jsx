import React, { useState, useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import LocalDrinkIcon from '@mui/icons-material/LocalDrink';
import EmojiFoodBeverageIcon from '@mui/icons-material/EmojiFoodBeverage';
import CheckroomIcon from '@mui/icons-material/Checkroom';
import LiquorIcon from '@mui/icons-material/Liquor';
import CelebrationIcon from '@mui/icons-material/Celebration';
import CampaignIcon from '@mui/icons-material/Campaign';
import RedeemIcon from '@mui/icons-material/Redeem';
import StoreIcon from '@mui/icons-material/Store';

/**
 * ProductImage
 * --------------------------------------------------------------------
 * Tries to load the supplied image_url; on failure (or when none is
 * provided) falls back to a deterministic gradient with the product's
 * initials and a category icon overlay.  Used uniformly across catalog,
 * merchandise, and promotion cards so the UI never shows a broken image.
 */

const CATEGORY_GRADIENTS = {
  beer: 'linear-gradient(135deg, #D4A52A 0%, #8B5A1F 100%)',
  stout: 'linear-gradient(135deg, #2C1810 0%, #5C3A21 100%)',
  malta: 'linear-gradient(135deg, #6B3410 0%, #B5891F 100%)',
  shandy: 'linear-gradient(135deg, #F2C849 0%, #E8A33D 100%)',
  apparel: 'linear-gradient(135deg, #1A1A1A 0%, #4A4A4A 100%)',
  accessories: 'linear-gradient(135deg, #B5891F 0%, #D4A52A 100%)',
  barware: 'linear-gradient(135deg, #5A5A5A 0%, #2C2C2C 100%)',
  'trade materials': 'linear-gradient(135deg, #8B5A1F 0%, #2C1810 100%)',
  'campaign merchandise': 'linear-gradient(135deg, #D4A52A 0%, #F2C849 100%)',
  default: 'linear-gradient(135deg, #D4A52A 0%, #E8A33D 50%, #8B5A1F 100%)',
};

function gradientFor(category) {
  if (!category) return CATEGORY_GRADIENTS.default;
  return CATEGORY_GRADIENTS[String(category).toLowerCase()] || CATEGORY_GRADIENTS.default;
}

function iconFor(category) {
  const c = String(category || '').toLowerCase();
  if (c === 'beer') return SportsBarIcon;
  if (c === 'stout') return LocalBarIcon;
  if (c === 'malta') return EmojiFoodBeverageIcon;
  if (c === 'shandy') return LocalDrinkIcon;
  if (c === 'apparel') return CheckroomIcon;
  if (c === 'accessories') return RedeemIcon;
  if (c === 'barware') return LiquorIcon;
  if (c === 'trade materials') return StoreIcon;
  if (c === 'campaign merchandise') return CampaignIcon;
  if (c.includes('promo')) return CelebrationIcon;
  return SportsBarIcon;
}

function initialsFor(name) {
  if (!name) return 'BT';
  const parts = String(name).trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() || '').join('') || 'BT';
}

export default function ProductImage({
  name,
  category,
  imageUrl,
  height = 180,
  rounded = true,
  showInitials = true,
  iconSize = 56,
}) {
  const [imgFailed, setImgFailed] = useState(false);

  const gradient = useMemo(() => gradientFor(category), [category]);
  const Icon = useMemo(() => iconFor(category), [category]);
  const initials = useMemo(() => initialsFor(name), [name]);

  const showImage = imageUrl && !imgFailed;

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: rounded ? 2 : 0,
        overflow: 'hidden',
        background: gradient,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow:
          'inset 0 0 0 1px rgba(255,255,255,0.10), 0 4px 14px rgba(26,26,26,0.10)',
      }}
    >
      {showImage ? (
        <Box
          component="img"
          src={imageUrl}
          alt={name}
          onError={() => setImgFailed(true)}
          sx={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
          }}
        />
      ) : (
        <>
          {/* radial highlight */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(circle at 30% 25%, rgba(255,255,255,0.22), transparent 55%)',
              pointerEvents: 'none',
            }}
          />
          {/* subtle pattern */}
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              opacity: 0.12,
              background:
                'repeating-linear-gradient(45deg, rgba(255,255,255,0.18) 0 2px, transparent 2px 14px)',
              pointerEvents: 'none',
            }}
          />
          <Box
            sx={{
              position: 'relative',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              color: 'rgba(255,255,255,0.95)',
              textShadow: '0 2px 10px rgba(0,0,0,0.35)',
            }}
          >
            <Icon sx={{ fontSize: iconSize, opacity: 0.95 }} />
            {showInitials && (
              <Typography
                sx={{
                  fontWeight: 800,
                  fontSize: '1.6rem',
                  letterSpacing: '0.06em',
                  lineHeight: 1,
                }}
              >
                {initials}
              </Typography>
            )}
          </Box>
        </>
      )}
    </Box>
  );
}
