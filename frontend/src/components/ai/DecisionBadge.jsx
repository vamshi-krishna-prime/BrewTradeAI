import React, { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import CancelRoundedIcon from '@mui/icons-material/CancelRounded';
import HourglassBottomRoundedIcon from '@mui/icons-material/HourglassBottomRounded';
import { motion } from 'framer-motion';

/**
 * Large decision badge.
 *
 * Accepts loose backend strings: "approve", "approved", "approve_with_modification",
 * "modify", "reject", "rejected", "review", "hold" ...
 *
 * Props:
 *   decision: string
 *   size?: 'small' | 'medium' | 'large'  (default 'large')
 */
export default function DecisionBadge({ decision, size = 'large' }) {
  const normalized = (decision || 'review').toString().trim().toLowerCase();

  const config = useMemo(() => {
    if (/modif|modify|with.?mod|conditional/i.test(normalized)) {
      return {
        label: 'APPROVE WITH MODIFICATION',
        icon: <EditNoteRoundedIcon />,
        bg: 'linear-gradient(135deg, #E8A33D 0%, #F2C849 100%)',
        border: 'rgba(232,163,61,0.55)',
        glow: '0 14px 36px rgba(232,163,61,0.40)',
        color: '#1A1A1A',
      };
    }
    if (/reject|deny|decline/i.test(normalized)) {
      return {
        label: 'REJECT',
        icon: <CancelRoundedIcon />,
        bg: 'linear-gradient(135deg, #C62828 0%, #E8A33D 100%)',
        border: 'rgba(198,40,40,0.55)',
        glow: '0 14px 36px rgba(198,40,40,0.40)',
        color: '#FFFFFF',
      };
    }
    if (/approve|approved|ok|pass/i.test(normalized)) {
      return {
        label: 'APPROVE',
        icon: <CheckCircleRoundedIcon />,
        bg: 'linear-gradient(135deg, #D4A52A 0%, #F2C849 100%)',
        border: 'rgba(212,165,42,0.55)',
        glow: '0 14px 36px rgba(212,165,42,0.45)',
        color: '#1A1A1A',
      };
    }
    return {
      label: 'NEEDS REVIEW',
      icon: <HourglassBottomRoundedIcon />,
      bg: 'linear-gradient(135deg, #5A5A5A 0%, #1A1A1A 100%)',
      border: 'rgba(26,26,26,0.4)',
      glow: '0 14px 36px rgba(26,26,26,0.25)',
      color: '#FFFFFF',
    };
  }, [normalized]);

  const dimensions =
    size === 'small'
      ? { px: 1.5, py: 0.75, fontSize: '0.8rem', iconSize: 18, radius: 1.5 }
      : size === 'medium'
      ? { px: 2, py: 1, fontSize: '0.95rem', iconSize: 22, radius: 2 }
      : { px: 3, py: 1.5, fontSize: '1.15rem', iconSize: 28, radius: 2.5 };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 6 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 220, damping: 18 }}
      style={{ display: 'inline-block' }}
    >
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: 1.25,
          px: dimensions.px,
          py: dimensions.py,
          borderRadius: dimensions.radius,
          background: config.bg,
          border: `1px solid ${config.border}`,
          boxShadow: config.glow,
          color: config.color,
          fontWeight: 800,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
        }}
      >
        {React.cloneElement(config.icon, {
          sx: { fontSize: dimensions.iconSize, color: 'inherit' },
        })}
        <Typography
          component="span"
          sx={{
            fontWeight: 800,
            letterSpacing: '0.08em',
            fontSize: dimensions.fontSize,
            color: 'inherit',
            lineHeight: 1,
          }}
        >
          {config.label}
        </Typography>
      </Box>
    </motion.div>
  );
}
