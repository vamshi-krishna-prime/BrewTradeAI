import React from 'react';
import { Box, Typography, CircularProgress } from '@mui/material';
import { motion } from 'framer-motion';

import { goldGradient } from '../../theme.js';

const MotionBox = motion(Box);

/**
 * Reusable glass action button for the Simulation Lab.
 *
 * Props:
 *   icon         ReactNode  - large MUI icon
 *   label        string     - main button label
 *   description  string     - one-line subtitle
 *   onClick      fn
 *   loading      boolean    - shows spinner overlay
 *   disabled     boolean
 *   accent       string     - optional CSS gradient/color override for icon tile
 */
export default function SimulationButton({
  icon,
  label,
  description,
  onClick,
  loading = false,
  disabled = false,
  accent,
}) {
  const isLocked = disabled || loading;

  return (
    <MotionBox
      role="button"
      tabIndex={0}
      aria-disabled={isLocked}
      onClick={isLocked ? undefined : onClick}
      onKeyDown={(e) => {
        if (isLocked) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick && onClick();
        }
      }}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={
        isLocked
          ? undefined
          : {
              y: -4,
              boxShadow: '0 22px 50px rgba(212,165,42,0.32)',
            }
      }
      whileTap={isLocked ? undefined : { scale: 0.985 }}
      transition={{ type: 'spring', stiffness: 240, damping: 22 }}
      sx={{
        position: 'relative',
        overflow: 'hidden',
        cursor: isLocked ? 'not-allowed' : 'pointer',
        userSelect: 'none',
        p: 2.25,
        minHeight: 150,
        borderRadius: 3,
        background:
          'linear-gradient(180deg, rgba(255,255,255,0.85) 0%, rgba(255,255,255,0.62) 100%)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(212,165,42,0.28)',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.65) inset, 0 10px 30px rgba(26,26,26,0.07)',
        display: 'flex',
        flexDirection: 'column',
        gap: 1.25,
        opacity: isLocked && !loading ? 0.55 : 1,
        outline: 'none',
        transition: 'background 200ms ease',
        '&:focus-visible': {
          boxShadow:
            '0 0 0 3px rgba(212,165,42,0.45), 0 10px 30px rgba(26,26,26,0.07)',
        },
        '&::before': {
          content: '""',
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: goldGradient,
          opacity: 0.85,
        },
      }}
    >
      {/* Icon tile */}
      <Box
        sx={{
          width: 48,
          height: 48,
          borderRadius: 2,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: accent || goldGradient,
          color: '#1A1A1A',
          boxShadow: '0 8px 22px rgba(212,165,42,0.35)',
          '& svg': { fontSize: 26 },
        }}
      >
        {icon}
      </Box>

      {/* Label */}
      <Typography
        variant="subtitle1"
        sx={{ fontWeight: 800, lineHeight: 1.15, letterSpacing: '-0.005em' }}
      >
        {label}
      </Typography>

      {/* Description */}
      {description && (
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary', lineHeight: 1.35 }}
        >
          {description}
        </Typography>
      )}

      {/* Loading overlay */}
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background:
              'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
            backdropFilter: 'blur(2px)',
          }}
        >
          <CircularProgress size={28} color="secondary" thickness={5} />
        </Box>
      )}
    </MotionBox>
  );
}
