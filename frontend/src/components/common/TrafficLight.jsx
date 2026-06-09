import React from 'react';
import { Box, Tooltip } from '@mui/material';

const COLORS = {
  green: { fill: '#2E7D32', glow: 'rgba(46,125,50,0.55)' },
  yellow: { fill: '#E8A33D', glow: 'rgba(232,163,61,0.55)' },
  red: { fill: '#C62828', glow: 'rgba(198,40,40,0.55)' },
};

/**
 * Traffic-light status indicator (credit health, risk, etc.).
 * Props: status ('green'|'yellow'|'red'), size, title.
 */
export default function TrafficLight({ status = 'green', size = 14, title }) {
  const c = COLORS[status] || COLORS.green;
  const dot = (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius: '50%',
        backgroundColor: c.fill,
        boxShadow: `0 0 0 3px rgba(255,255,255,0.6), 0 0 14px ${c.glow}`,
        display: 'inline-block',
      }}
    />
  );
  return title ? <Tooltip title={title}>{dot}</Tooltip> : dot;
}
