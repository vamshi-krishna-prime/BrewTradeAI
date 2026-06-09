import React, { useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import {
  RadialBarChart,
  RadialBar,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';
import { motion } from 'framer-motion';

/**
 * Risk gauge - radial chart taking a 0-100 score.
 *
 * Color zones:
 *   0-39   Gold     (low risk)
 *   40-69  Amber    (medium risk)
 *   70-100 Red      (high risk)
 *
 * Props:
 *   score: number  (0-100)
 *   size?: number  (px, default 280)
 *   label?: string
 */
export default function RiskGauge({ score = 0, size = 280, label = 'Risk Score' }) {
  const clamped = Math.max(0, Math.min(100, Number(score) || 0));

  const { fill, zone, glow } = useMemo(() => {
    if (clamped >= 70) {
      return {
        fill: 'url(#riskGradientRed)',
        zone: 'HIGH RISK',
        glow: 'rgba(198,40,40,0.45)',
      };
    }
    if (clamped >= 40) {
      return {
        fill: 'url(#riskGradientAmber)',
        zone: 'MODERATE RISK',
        glow: 'rgba(232,163,61,0.45)',
      };
    }
    return {
      fill: 'url(#riskGradientGold)',
      zone: 'LOW RISK',
      glow: 'rgba(212,165,42,0.45)',
    };
  }, [clamped]);

  const data = [{ name: 'risk', value: clamped, fill }];

  return (
    <Box
      sx={{
        position: 'relative',
        width: size,
        height: size,
        mx: 'auto',
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        <RadialBarChart
          cx="50%"
          cy="50%"
          innerRadius="72%"
          outerRadius="100%"
          barSize={18}
          data={data}
          startAngle={210}
          endAngle={-30}
        >
          <defs>
            <linearGradient id="riskGradientGold" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F2C849" />
              <stop offset="100%" stopColor="#D4A52A" />
            </linearGradient>
            <linearGradient id="riskGradientAmber" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#F2C849" />
              <stop offset="100%" stopColor="#E8A33D" />
            </linearGradient>
            <linearGradient id="riskGradientRed" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#E8A33D" />
              <stop offset="100%" stopColor="#C62828" />
            </linearGradient>
          </defs>
          <PolarAngleAxis
            type="number"
            domain={[0, 100]}
            angleAxisId={0}
            tick={false}
          />
          <RadialBar
            background={{ fill: 'rgba(26,26,26,0.06)' }}
            dataKey="value"
            cornerRadius={12}
            isAnimationActive
            animationDuration={1400}
            animationEasing="ease-out"
          />
        </RadialBarChart>
      </ResponsiveContainer>

      {/* Center value overlay */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <Stack alignItems="center" spacing={0.25}>
            <Typography
              variant="caption"
              sx={{
                letterSpacing: '0.18em',
                color: 'text.secondary',
                fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              {label}
            </Typography>
            <Typography
              sx={{
                fontWeight: 800,
                fontSize: size * 0.22,
                lineHeight: 1,
                background:
                  clamped >= 70
                    ? 'linear-gradient(135deg, #C62828, #E8A33D)'
                    : clamped >= 40
                    ? 'linear-gradient(135deg, #E8A33D, #F2C849)'
                    : 'linear-gradient(135deg, #D4A52A, #F2C849)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                textShadow: `0 0 30px ${glow}`,
                filter: `drop-shadow(0 4px 18px ${glow})`,
              }}
            >
              {Math.round(clamped)}
            </Typography>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: clamped >= 70 ? '#B71C1C' : clamped >= 40 ? '#8A5A12' : '#8A6A12',
              }}
            >
              {zone}
            </Typography>
          </Stack>
        </motion.div>
      </Box>
    </Box>
  );
}
