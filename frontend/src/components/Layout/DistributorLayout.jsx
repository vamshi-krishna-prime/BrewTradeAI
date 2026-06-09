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
  Badge,
  Button,
  Chip,
  Stack,
} from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';
import DashboardIcon from '@mui/icons-material/SpaceDashboard';
import StorefrontIcon from '@mui/icons-material/Storefront';
import RedeemIcon from '@mui/icons-material/Redeem';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import LocalShippingIcon from '@mui/icons-material/LocalShipping';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import DescriptionIcon from '@mui/icons-material/Description';
import CampaignIcon from '@mui/icons-material/Campaign';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import PersonIcon from '@mui/icons-material/Person';
import LogoutIcon from '@mui/icons-material/Logout';
import PublicIcon from '@mui/icons-material/Public';
import { motion, AnimatePresence } from 'framer-motion';

import { goldGradient } from '../../theme.js';
import ThemeToggle from '../common/ThemeToggle.jsx';

const drawerWidth = 248;

const navItems = [
  { label: 'Dashboard', path: '/distributor/dashboard', icon: <DashboardIcon /> },
  { label: 'Product Catalog', path: '/distributor/catalog', icon: <StorefrontIcon /> },
  { label: 'Merchandise', path: '/distributor/merchandise', icon: <RedeemIcon /> },
  { label: 'Cart', path: '/distributor/cart', icon: <ShoppingCartIcon /> },
  { label: 'My Orders', path: '/distributor/my-orders', icon: <LocalShippingIcon /> },
  { label: 'AR', path: '/distributor/ar', icon: <AccountBalanceWalletIcon /> },
  { label: 'Documents', path: '/distributor/documents', icon: <DescriptionIcon /> },
  { label: 'Promotions', path: '/distributor/promotions', icon: <CampaignIcon /> },
  { label: 'AI Assistant', path: '/distributor/ai-assistant', icon: <SmartToyIcon /> },
  { label: 'Profile', path: '/distributor/profile', icon: <PersonIcon /> },
];

function readUser() {
  try {
    return {
      userId: localStorage.getItem('userId') || '',
      role: localStorage.getItem('role') || 'distributor',
      userName: localStorage.getItem('userName') || '',
      customerName: localStorage.getItem('customerName') || '',
      market: localStorage.getItem('market') || '',
    };
  } catch (_) {
    return { userId: '', role: 'distributor', userName: '', customerName: '', market: '' };
  }
}

export default function DistributorLayout() {
  const [open, setOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();
  const user = useMemo(readUser, []);

  const displayName =
    user.userName || user.customerName || user.userId || 'Distributor';
  const initial = (displayName[0] || 'D').toUpperCase();

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
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.2,
              cursor: 'pointer',
            }}
            onClick={() => navigate('/distributor/dashboard')}
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

          <Tooltip title="Cart">
            <IconButton component={RouterLink} to="/distributor/cart">
              <Badge color="secondary" variant="dot">
                <ShoppingCartIcon />
              </Badge>
            </IconButton>
          </Tooltip>

          {/* USER INFO — name + market chip */}
          <Stack
            direction="row"
            spacing={1.25}
            alignItems="center"
            sx={{
              px: 1.25,
              py: 0.5,
              ml: 0.5,
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
            Distributor portal
          </Typography>
        </Box>
      </Drawer>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          p: { xs: 2, md: 3 },
          width: '100%',
          ml: open ? `0px` : 0,
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
