import React, { useState, useMemo } from 'react';
import { Outlet, useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Box,
  AppBar,
  Toolbar,
  Typography,
  IconButton,
  Drawer,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Divider,
  Avatar,
  Tooltip,
  Button,
  Stack,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import FactCheckIcon from '@mui/icons-material/FactCheck';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PsychologyIcon from '@mui/icons-material/Psychology';
import InsightsIcon from '@mui/icons-material/Insights';
import QueryStatsIcon from '@mui/icons-material/QueryStats';
import ScienceIcon from '@mui/icons-material/Science';
import LogoutIcon from '@mui/icons-material/Logout';
import PublicIcon from '@mui/icons-material/Public';
import { motion, AnimatePresence } from 'framer-motion';

import { goldGradient } from '../../theme.js';
import ThemeToggle from '../common/ThemeToggle.jsx';

const drawerWidth = 260;

const navItems = [
  { label: 'Dashboard', path: '/manager/dashboard', icon: <DashboardIcon /> },
  { label: 'Approvals', path: '/manager/approvals', icon: <FactCheckIcon /> },
  { label: 'Reports', path: '/manager/reports', icon: <AssessmentIcon /> },
  { label: 'AI Copilot', path: '/manager/copilot', icon: <PsychologyIcon /> },
  { label: 'Explainability', path: '/manager/explainability', icon: <InsightsIcon /> },
  { label: 'Executive Analytics', path: '/executive/analytics', icon: <QueryStatsIcon /> },
  { label: 'Simulation Lab', path: '/executive/simulation', icon: <ScienceIcon /> },
];

function readUser() {
  try {
    return {
      userId: localStorage.getItem('userId') || '',
      role: localStorage.getItem('role') || 'manager',
      userName: localStorage.getItem('userName') || '',
      customerName: localStorage.getItem('customerName') || '',
      market: localStorage.getItem('market') || '',
    };
  } catch (_) {
    return { userId: '', role: 'manager', userName: '', customerName: '', market: '' };
  }
}

export default function ManagerLayout() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useMemo(readUser, []);

  const displayName = user.userName || user.userId || 'Market Manager';
  const initial = (displayName[0] || 'M').toUpperCase();

  const handleLogout = () => {
    try {
      localStorage.clear();
    } catch (_) {}
    navigate('/');
  };

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar position="fixed" sx={{ zIndex: (t) => t.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: 2 }}>
          <IconButton onClick={() => setOpen((o) => !o)} edge="start" aria-label="toggle drawer">
            <MenuIcon />
          </IconButton>

          <Box
            sx={{ display: 'flex', alignItems: 'center', gap: 1.2, cursor: 'pointer' }}
            onClick={() => navigate('/manager/dashboard')}
          >
            <Box
              sx={{
                width: 34,
                height: 34,
                borderRadius: '50%',
                background: goldGradient,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 800,
                color: '#1A1A1A',
                boxShadow: '0 6px 18px rgba(212,165,42,0.45)',
              }}
            >
              B
            </Box>
            <Typography
              variant="h6"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.01em',
                background: goldGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
              }}
            >
              BrewTrade AI
            </Typography>
          </Box>

          <Box sx={{ flex: 1 }} />

          {/* USER INFO */}
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{
              px: 1.25,
              py: 0.5,
              borderRadius: 10,
              background: 'rgba(212,165,42,0.08)',
              border: '1px solid rgba(212,165,42,0.25)',
            }}
          >
            <Avatar
              sx={{
                width: 30,
                height: 30,
                background: goldGradient,
                color: '#1A1A1A',
                fontWeight: 700,
                fontSize: '0.85rem',
              }}
            >
              {initial}
            </Avatar>
            <Box sx={{ minWidth: 0, lineHeight: 1.1 }}>
              <Typography
                variant="body2"
                sx={{ fontWeight: 700, lineHeight: 1.1, maxWidth: 180 }}
                noWrap
              >
                {displayName}
              </Typography>
              {user.market && (
                <Stack direction="row" spacing={0.5} alignItems="center" sx={{ mt: 0.25 }}>
                  <PublicIcon sx={{ fontSize: 12, color: 'text.secondary' }} />
                  <Typography variant="caption" sx={{ color: 'text.secondary', lineHeight: 1 }}>
                    {user.market}
                  </Typography>
                </Stack>
              )}
            </Box>
          </Stack>

          <ThemeToggle sx={{ ml: 1 }} />

          <Button
            onClick={handleLogout}
            variant="outlined"
            color="secondary"
            size="small"
            startIcon={<LogoutIcon />}
            sx={{ ml: 1 }}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Drawer
        variant="persistent"
        open={open}
        sx={{
          width: open ? drawerWidth : 0,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: drawerWidth, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <Box sx={{ p: 1.5 }}>
          <List sx={{ display: 'flex', flexDirection: 'column', gap: 0.4 }}>
            {navItems.map((item) => {
              const selected = location.pathname.startsWith(item.path);
              return (
                <ListItem key={item.path} disablePadding>
                  <ListItemButton
                    component={RouterLink}
                    to={item.path}
                    selected={selected}
                    sx={{
                      borderRadius: 2,
                      '&.Mui-selected': {
                        background: 'rgba(212,165,42,0.12)',
                        border: '1px solid rgba(212,165,42,0.35)',
                      },
                      '&:hover': {
                        background: 'rgba(212,165,42,0.08)',
                      },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 38, color: selected ? '#B5891F' : 'inherit' }}>
                      {item.icon}
                    </ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontWeight: selected ? 700 : 500 }}
                    />
                  </ListItemButton>
                </ListItem>
              );
            })}
          </List>
          <Divider sx={{ my: 1.5 }} />
          <Typography variant="caption" sx={{ px: 1, color: 'text.secondary' }}>
            Manager portal
          </Typography>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: '100%',
          transition: 'margin 200ms ease',
        }}
      >
        <Toolbar />
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
          >
            <Outlet />
          </motion.div>
        </AnimatePresence>
      </Box>
    </Box>
  );
}
