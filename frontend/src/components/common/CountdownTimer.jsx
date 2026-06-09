import React, { useEffect, useState, useMemo } from 'react';
import { Box, Typography, Stack } from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CountdownTimer
 * --------------------------------------------------------------------
 * Animated DD HH MM SS countdown to a target date.  Re-computes once
 * per second via setInterval; each segment pulses on tick.  The end
 * date can be supplied as an ISO string, epoch ms number, or a Date.
 */

const SEGMENTS = [
  { key: 'days', label: 'DAYS' },
  { key: 'hours', label: 'HRS' },
  { key: 'minutes', label: 'MIN' },
  { key: 'seconds', label: 'SEC' },
];

function getRemaining(endDate) {
  if (!endDate) return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  const target =
    endDate instanceof Date
      ? endDate.getTime()
      : typeof endDate === 'number'
      ? endDate
      : new Date(endDate).getTime();
  const diff = target - Date.now();
  if (Number.isNaN(target) || diff <= 0) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, expired: true };
  }
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);
  return { days, hours, minutes, seconds, expired: false };
}

const pad = (n) => String(n).padStart(2, '0');

function Segment({ value, label, size }) {
  const isSmall = size === 'small';
  return (
    <Stack alignItems="center" spacing={0.5}>
      <Box
        sx={{
          position: 'relative',
          minWidth: isSmall ? 44 : 64,
          px: isSmall ? 1 : 1.5,
          py: isSmall ? 0.75 : 1.25,
          borderRadius: 2,
          background:
            'linear-gradient(135deg, rgba(26,26,26,0.92) 0%, rgba(42,42,42,0.92) 100%)',
          border: '1px solid rgba(212,165,42,0.45)',
          boxShadow:
            '0 0 0 1px rgba(212,165,42,0.10) inset, 0 6px 18px rgba(26,26,26,0.25)',
          overflow: 'hidden',
        }}
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={value}
            initial={{ y: -8, opacity: 0, scale: 0.96 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 8, opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.32, ease: [0.22, 0.61, 0.36, 1] }}
            style={{ textAlign: 'center' }}
          >
            <Typography
              sx={{
                fontFamily:
                  "'Inter', 'SF Mono', ui-monospace, monospace",
                fontWeight: 800,
                fontSize: isSmall ? '1.1rem' : '1.6rem',
                lineHeight: 1,
                letterSpacing: '-0.02em',
                background:
                  'linear-gradient(135deg, #F2C849 0%, #E8A33D 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              {pad(value)}
            </Typography>
          </motion.div>
        </AnimatePresence>
      </Box>
      <Typography
        sx={{
          fontSize: isSmall ? '0.6rem' : '0.65rem',
          fontWeight: 700,
          letterSpacing: '0.12em',
          color: 'text.secondary',
        }}
      >
        {label}
      </Typography>
    </Stack>
  );
}

export default function CountdownTimer({
  endDate,
  size = 'medium',
  expiredLabel = 'OFFER ENDED',
}) {
  const [remaining, setRemaining] = useState(() => getRemaining(endDate));

  useEffect(() => {
    setRemaining(getRemaining(endDate));
    const id = setInterval(() => {
      setRemaining(getRemaining(endDate));
    }, 1000);
    return () => clearInterval(id);
  }, [endDate]);

  const segments = useMemo(() => SEGMENTS, []);

  if (remaining.expired) {
    return (
      <Box
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          px: 1.5,
          py: 0.6,
          borderRadius: 2,
          background: 'rgba(198,40,40,0.10)',
          border: '1px solid rgba(198,40,40,0.30)',
        }}
      >
        <Typography
          sx={{
            fontSize: '0.72rem',
            fontWeight: 700,
            letterSpacing: '0.14em',
            color: '#C62828',
          }}
        >
          {expiredLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <Stack direction="row" spacing={1.25} alignItems="flex-start">
      {segments.map((s, idx) => (
        <React.Fragment key={s.key}>
          <Segment value={remaining[s.key]} label={s.label} size={size} />
          {idx < segments.length - 1 && (
            <Box
              sx={{
                alignSelf: 'flex-start',
                pt: size === 'small' ? 0.6 : 1.2,
                color: 'rgba(212,165,42,0.55)',
                fontWeight: 800,
                fontSize: size === 'small' ? '1rem' : '1.4rem',
                lineHeight: 1,
              }}
            >
              :
            </Box>
          )}
        </React.Fragment>
      ))}
    </Stack>
  );
}
