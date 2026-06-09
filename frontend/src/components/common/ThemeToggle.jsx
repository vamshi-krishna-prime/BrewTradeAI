import React, { useState } from 'react';
import {
  IconButton,
  Tooltip,
  Menu,
  MenuItem,
  ListItemIcon,
  ListItemText,
  Box,
  Typography,
} from '@mui/material';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';

import { useThemeMode } from '../../contexts/ThemeContext.jsx';

/**
 * Theme switcher — a palette icon button that opens a menu of every available
 * theme (with a colour swatch + active check).  Works on any page.
 *
 *  - `floating`: fixes it to the top-right of the viewport (for full-bleed
 *    pages such as Login / Opening that have no app bar).
 */
export default function ThemeToggle({ floating = false, sx = {} }) {
  const { themeKey, setThemeKey, themeList } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState(null);
  const open = Boolean(anchorEl);

  return (
    <>
      <Tooltip title="Change theme">
        <IconButton
          aria-label="Change theme"
          onClick={(e) => setAnchorEl(e.currentTarget)}
          sx={{
            color: '#D4A52A',
            border: '1px solid rgba(212,165,42,0.4)',
            borderRadius: 2,
            '&:hover': { background: 'rgba(212,165,42,0.12)' },
            ...(floating
              ? {
                  position: 'fixed',
                  top: 16,
                  right: 16,
                  zIndex: 1400,
                  background: 'rgba(10,12,20,0.55)',
                  backdropFilter: 'blur(8px)',
                  WebkitBackdropFilter: 'blur(8px)',
                  boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
                }
              : {}),
            ...sx,
          }}
        >
          <PaletteRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={open}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { minWidth: 220, mt: 0.5 } } }}
      >
        <Typography
          variant="caption"
          sx={{
            px: 2,
            py: 1,
            display: 'block',
            fontWeight: 700,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'text.secondary',
          }}
        >
          Theme
        </Typography>
        {themeList.map((t) => {
          const active = t.key === themeKey;
          return (
            <MenuItem
              key={t.key}
              selected={active}
              onClick={() => {
                setThemeKey(t.key);
                setAnchorEl(null);
              }}
            >
              <ListItemIcon sx={{ minWidth: 34 }}>
                <Box
                  sx={{
                    width: 18,
                    height: 18,
                    borderRadius: '50%',
                    background: t.swatch,
                    border: '2px solid',
                    borderColor: t.accent,
                    boxShadow: '0 0 8px rgba(0,0,0,0.25)',
                  }}
                />
              </ListItemIcon>
              <ListItemText
                primary={t.name}
                primaryTypographyProps={{ fontWeight: active ? 700 : 500 }}
              />
              {active && (
                <CheckRoundedIcon fontSize="small" sx={{ ml: 1, color: '#D4A52A' }} />
              )}
            </MenuItem>
          );
        })}
      </Menu>
    </>
  );
}
