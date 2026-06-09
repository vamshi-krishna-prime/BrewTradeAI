import React from 'react';
import { Box, Typography, Chip } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';

import GlassCard from './GlassCard.jsx';
import AnimatedNumber from './AnimatedNumber.jsx';
import { goldGradient } from '../../theme.js';

/**
 * Animated KPI tile.
 * Props: label, value, icon (ReactNode), trend (number, %), format (fn).
 */
export default function KPICard({
  label,
  value,
  icon,
  trend,
  format,
  sx,
}) {
  const positive = (trend ?? 0) >= 0;
  return (
    <GlassCard sx={{ p: 2.5, ...sx }}>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
        {icon && (
          <Box
            sx={{
              width: 44,
              height: 44,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: goldGradient,
              color: '#1A1A1A',
              boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
              flexShrink: 0,
            }}
          >
            {icon}
          </Box>
        )}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="body2" color="text.secondary" sx={{ fontWeight: 500 }}>
            {label}
          </Typography>
          <Typography variant="h4" sx={{ fontWeight: 800, mt: 0.5, lineHeight: 1.1 }}>
            <AnimatedNumber value={value} format={format} />
          </Typography>
          {typeof trend === 'number' && (
            <Chip
              size="small"
              icon={positive ? <TrendingUpIcon /> : <TrendingDownIcon />}
              label={`${positive ? '+' : ''}${trend.toFixed(1)}%`}
              sx={{
                mt: 1,
                background: positive ? 'rgba(46,125,50,0.10)' : 'rgba(198,40,40,0.10)',
                color: positive ? '#1B5E20' : '#B71C1C',
                fontWeight: 600,
              }}
            />
          )}
        </Box>
      </Box>
    </GlassCard>
  );
}
