import React from 'react';
import {
  Box,
  Typography,
  List,
  ListItemButton,
  ListItemText,
  Chip,
  Divider,
} from '@mui/material';
import { motion } from 'framer-motion';

import { goldGradient } from '../../theme.js';

/**
 * CategorySidebar
 * --------------------------------------------------------------------
 * Reusable left rail used by Merchandise (and any other catalog-style
 * page).  Categories is a list of { key, label, count, icon? } and the
 * currently-selected key is highlighted.  Renders as a glass card with
 * gold accent for the active row.
 *
 * Props:
 *   title        - header label (e.g. "Categories")
 *   categories   - [{ key, label, count, icon? }]
 *   value        - currently selected key (use '__all__' to mean show all)
 *   onChange(k)  - called when user clicks a row
 *   width        - sidebar width in px (default 240)
 *   footer       - optional ReactNode rendered under the list
 */
export default function CategorySidebar({
  title = 'Categories',
  categories = [],
  value,
  onChange,
  width = 240,
  footer,
}) {
  const totalCount = categories.reduce((acc, c) => acc + (c.count || 0), 0);

  const allRow = {
    key: '__all__',
    label: 'All Items',
    count: totalCount,
  };

  const rows = [allRow, ...categories];

  return (
    <Box
      component={motion.aside}
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      sx={{
        width,
        flexShrink: 0,
        position: 'sticky',
        top: 88,
        alignSelf: 'flex-start',
        background: 'rgba(255,255,255,0.7)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid rgba(212,165,42,0.22)',
        borderRadius: 3,
        p: 2,
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(26,26,26,0.06)',
      }}
    >
      <Typography
        variant="overline"
        sx={{
          fontWeight: 700,
          letterSpacing: '0.14em',
          color: 'text.secondary',
          display: 'block',
          mb: 1,
        }}
      >
        {title}
      </Typography>

      <List dense disablePadding sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        {rows.map((cat) => {
          const selected = value === cat.key || (value == null && cat.key === '__all__');
          const Icon = cat.icon;
          return (
            <ListItemButton
              key={cat.key}
              onClick={() => onChange && onChange(cat.key)}
              selected={selected}
              sx={{
                borderRadius: 2,
                py: 1,
                pl: 1.25,
                pr: 1,
                position: 'relative',
                transition: 'all 180ms ease',
                '&.Mui-selected': {
                  background: 'rgba(212,165,42,0.12)',
                  border: '1px solid rgba(212,165,42,0.45)',
                },
                '&:hover': {
                  background: 'rgba(212,165,42,0.08)',
                },
                '&.Mui-selected:hover': {
                  background: 'rgba(212,165,42,0.16)',
                },
              }}
            >
              {selected && (
                <Box
                  sx={{
                    position: 'absolute',
                    left: 0,
                    top: 8,
                    bottom: 8,
                    width: 3,
                    borderRadius: 4,
                    background: goldGradient,
                  }}
                />
              )}
              {Icon && (
                <Box
                  sx={{
                    mr: 1,
                    display: 'flex',
                    color: selected ? '#B5891F' : 'text.secondary',
                  }}
                >
                  <Icon fontSize="small" />
                </Box>
              )}
              <ListItemText
                primary={cat.label}
                primaryTypographyProps={{
                  fontWeight: selected ? 700 : 500,
                  fontSize: '0.92rem',
                }}
              />
              <Chip
                size="small"
                label={cat.count ?? 0}
                sx={{
                  height: 22,
                  fontWeight: 700,
                  fontSize: '0.72rem',
                  background: selected
                    ? goldGradient
                    : 'rgba(212,165,42,0.10)',
                  color: '#1A1A1A',
                  border: selected ? 'none' : '1px solid rgba(212,165,42,0.25)',
                }}
              />
            </ListItemButton>
          );
        })}
      </List>

      {footer && (
        <>
          <Divider sx={{ my: 1.5 }} />
          <Box>{footer}</Box>
        </>
      )}
    </Box>
  );
}
