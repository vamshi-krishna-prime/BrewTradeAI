import React from 'react';
import { Card } from '@mui/material';
import { motion } from 'framer-motion';

const MotionCard = motion(Card);

/**
 * Glassmorphism card with subtle gold border, hover lift, and tap feedback.
 * Use anywhere a premium surface is required.
 */
export default function GlassCard({ children, sx, hover = true, ...rest }) {
  return (
    <MotionCard
      whileHover={hover ? { y: -3, boxShadow: '0 18px 42px rgba(26,26,26,0.10)' } : undefined}
      whileTap={hover ? { y: 0 } : undefined}
      transition={{ type: 'spring', stiffness: 260, damping: 22 }}
      sx={[
        // Theme-driven surface so the card re-skins with the active theme.
        (theme) => ({
          position: 'relative',
          overflow: 'hidden',
          background: theme.surfaces?.cardBg || 'rgba(255,255,255,0.7)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: `1px solid ${theme.surfaces?.cardBorder || 'rgba(212,165,42,0.22)'}`,
          borderRadius: 3,
          boxShadow:
            theme.surfaces?.cardShadow ||
            '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(26,26,26,0.06)',
          p: 2.5,
        }),
        ...(Array.isArray(sx) ? sx : [sx]),
      ]}
      {...rest}
    >
      {children}
    </MotionCard>
  );
}
