import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Typography,
  TextField,
  Button,
  Stack,
  InputAdornment,
  IconButton,
  Alert,
  CircularProgress,
  Divider,
  Tooltip,
} from '@mui/material';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import StorefrontIcon from '@mui/icons-material/Storefront';
import SupervisorAccountIcon from '@mui/icons-material/SupervisorAccount';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import PublicIcon from '@mui/icons-material/Public';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import Inventory2Icon from '@mui/icons-material/Inventory2';
import VerifiedIcon from '@mui/icons-material/Verified';
import LocalBreweryIcon from '@mui/icons-material/LocalBrewery';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

import { goldGradient } from '../theme.js';
import GlassCard from '../components/common/GlassCard.jsx';
import client, { login as apiLogin, getExecutiveKPIs } from '../api/client.js';

// ------------------------------------------------------------------
// Animated Brewing Equipment (Interactive Fermentation Tank)
// ------------------------------------------------------------------
function BrewingTank({ delay = 0 }) {
  const [isHovered, setIsHovered] = useState(false);
  
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, duration: 0.8, ease: 'easeOut' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        cursor: 'pointer',
      }}
    >
      <svg width="80" height="120" viewBox="0 0 80 120" style={{ filter: 'drop-shadow(0 4px 12px rgba(212,165,42,0.3))' }}>
        {/* Tank body */}
        <motion.rect
          x="20"
          y="15"
          width="40"
          height="70"
          rx="4"
          fill="none"
          stroke={isHovered ? '#FFD700' : '#D4A52A'}
          strokeWidth="2"
          animate={{
            boxShadow: isHovered ? '0 0 16px rgba(212,165,42,0.8)' : '0 0 8px rgba(212,165,42,0.4)',
          }}
        />
        
        {/* Liquid level animation */}
        <motion.rect
          x="22"
          y={isHovered ? '35' : '60'}
          width="36"
          height={isHovered ? '50' : '25'}
          rx="2"
          fill="url(#liquidGradient)"
          opacity="0.6"
          animate={{
            y: isHovered ? 35 : 60,
          }}
          transition={{ duration: 0.6, ease: 'easeInOut' }}
        />
        
        {/* Tap/valve at bottom */}
        <circle cx="40" cy="95" r="3" fill={isHovered ? '#FFD700' : '#D4A52A'} />
        <line x1="40" y1="98" x2="40" y2="108" stroke={isHovered ? '#FFD700' : '#D4A52A'} strokeWidth="2" />
        
        {/* Bubbles when hovered */}
        {isHovered && (
          <>
            <motion.circle
              cx="30"
              cy="50"
              r="2"
              fill="#FFD700"
              opacity="0.7"
              animate={{ cy: [50, 20], opacity: [0.7, 0] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <motion.circle
              cx="50"
              cy="55"
              r="2"
              fill="#FFD700"
              opacity="0.7"
              animate={{ cy: [55, 15], opacity: [0.7, 0] }}
              transition={{ duration: 1.4, repeat: Infinity, delay: 0.3 }}
            />
            <motion.circle
              cx="40"
              cy="60"
              r="1.5"
              fill="#FFE89A"
              opacity="0.6"
              animate={{ cy: [60, 20], opacity: [0.6, 0] }}
              transition={{ duration: 1.3, repeat: Infinity, delay: 0.1 }}
            />
          </>
        )}
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="liquidGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="#FFE89A" stopOpacity="0.8" />
            <stop offset="100%" stopColor="#D4A52A" stopOpacity="0.9" />
          </linearGradient>
        </defs>
      </svg>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// Floating Bubble Particles (Brewing Activity)
// ------------------------------------------------------------------
function BubbleParticles() {
  const bubbles = useMemo(() => {
    return Array.from({ length: 12 }, (_, i) => ({
      id: i,
      x: Math.random() * 80,
      delay: Math.random() * 2,
      duration: 3 + Math.random() * 2,
      size: 2 + Math.random() * 4,
    }));
  }, []);

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 0,
      }}
    >
      {bubbles.map((bubble) => (
        <motion.div
          key={bubble.id}
          initial={{ y: '100vh', x: `${bubble.x}%`, opacity: 0 }}
          animate={{ y: '-20vh', opacity: [0, 0.6, 0] }}
          transition={{
            duration: bubble.duration,
            delay: bubble.delay,
            repeat: Infinity,
            ease: 'easeIn',
          }}
          style={{
            position: 'fixed',
            width: bubble.size,
            height: bubble.size,
            borderRadius: '50%',
            background: `radial-gradient(circle at 30% 30%, rgba(255,232,154,0.4), rgba(212,165,42,0.1))`,
            border: '1px solid rgba(212,165,42,0.3)',
            boxShadow: '0 0 8px rgba(212,165,42,0.2)',
          }}
        />
      ))}
    </Box>
  );
}

// ------------------------------------------------------------------
// Mouse-tracking Interactive Element
// ------------------------------------------------------------------
function InteractiveBreweryGlow() {
  const ref = useRef(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      setMousePos({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top,
      });
    };

    const element = ref.current;
    element?.addEventListener('mousemove', handleMouseMove);
    return () => element?.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <Box
      ref={ref}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: '40vh',
        pointerEvents: 'none',
        zIndex: -1,
        background: `radial-gradient(1000px at ${mousePos.x}px ${mousePos.y}px, rgba(255,213,107,0.15), transparent 80%)`,
        transition: 'background 0.05s linear',
      }}
    />
  );
}

// ------------------------------------------------------------------
// Enhanced StatTile with brewing indicator
// ------------------------------------------------------------------
function EnhancedStatTile({ icon, label, children, delay = 0, breweryType = 'orders' }) {
  const [isHovered, setIsHovered] = useState(false);
  const indicatorColors = {
    orders: '#FFD700',
    inventory: '#D4A52A',
    fulfillment: '#8FD14F',
    markets: '#FF6B6B',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: 1, minWidth: 180 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <motion.div
        animate={{
          boxShadow: isHovered
            ? '0 8px 32px rgba(212,165,42,0.4), inset 0 1px 0 rgba(255,255,255,0.7)'
            : '0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 24px rgba(26,26,26,0.05)',
        }}
        transition={{ duration: 0.3 }}
      >
        <Box
          sx={{
            px: 2.5,
            py: 1.75,
            borderRadius: 3,
            background: isHovered
              ? 'rgba(255,255,255,0.65)'
              : 'rgba(255,255,255,0.55)',
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            border: `1.5px solid ${isHovered ? 'rgba(212,165,42,0.5)' : 'rgba(212,165,42,0.28)'}`,
            display: 'flex',
            alignItems: 'center',
            gap: 1.5,
            position: 'relative',
            overflow: 'hidden',
            transition: 'all 0.3s ease',
          }}
        >
          {/* Animated brewing indicator */}
          <motion.div
            animate={{ opacity: isHovered ? 1 : 0.3 }}
            transition={{ duration: 0.3 }}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: '2px',
              background: `linear-gradient(90deg, transparent, ${indicatorColors[breweryType]}, transparent)`,
            }}
          />

          <Box
            sx={{
              width: 38,
              height: 38,
              borderRadius: '50%',
              background: isHovered
                ? `linear-gradient(135deg, ${indicatorColors[breweryType]}, #FFD700)`
                : goldGradient,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#1A1A1A',
              boxShadow: isHovered
                ? `0 8px 20px ${indicatorColors[breweryType]}40`
                : '0 6px 18px rgba(212,165,42,0.35)',
              transition: 'all 0.3s ease',
            }}
          >
            {icon}
          </Box>
          <Box sx={{ minWidth: 0 }}>
            <Typography
              variant="caption"
              sx={{
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'text.secondary',
                fontWeight: 600,
                display: 'block',
                lineHeight: 1.1,
              }}
            >
              {label}
            </Typography>
            <Typography
              variant="h5"
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.01em',
                background: isHovered
                  ? `linear-gradient(135deg, ${indicatorColors[breweryType]}, #FFD700)`
                  : goldGradient,
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                mt: 0.25,
              }}
            >
              {children}
            </Typography>
          </Box>
        </Box>
      </motion.div>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// Count-up animated number (Framer Motion useMotionValue + animate)
// ------------------------------------------------------------------
function CountUp({ value, prefix = '', suffix = '', decimals = 0, duration = 2.2 }) {
  const mv = useMotionValue(0);
  const rounded = useTransform(mv, (latest) => {
    const n = Number(latest);
    const fixed = decimals > 0 ? n.toFixed(decimals) : Math.round(n).toLocaleString();
    return `${prefix}${fixed}${suffix}`;
  });

  useEffect(() => {
    const controls = animate(mv, value, { duration, ease: 'easeOut' });
    return controls.stop;
  }, [value, duration, mv]);

  return <motion.span>{rounded}</motion.span>;
}

function StatTile({ icon, label, children, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, delay, ease: [0.22, 1, 0.36, 1] }}
      style={{ flex: 1, minWidth: 180 }}
    >
      <Box
        sx={{
          px: 2.5,
          py: 1.75,
          borderRadius: 3,
          background: 'rgba(255,255,255,0.55)',
          backdropFilter: 'blur(18px)',
          WebkitBackdropFilter: 'blur(18px)',
          border: '1px solid rgba(212,165,42,0.28)',
          boxShadow:
            '0 1px 0 rgba(255,255,255,0.7) inset, 0 8px 24px rgba(26,26,26,0.05)',
          display: 'flex',
          alignItems: 'center',
          gap: 1.5,
        }}
      >
        <Box
          sx={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1A1A1A',
            boxShadow: '0 6px 18px rgba(212,165,42,0.35)',
          }}
        >
          {icon}
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Typography
            variant="caption"
            sx={{
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: 'text.secondary',
              fontWeight: 600,
              display: 'block',
              lineHeight: 1.1,
            }}
          >
            {label}
          </Typography>
          <Typography
            variant="h5"
            sx={{
              fontWeight: 800,
              letterSpacing: '-0.01em',
              background: goldGradient,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              mt: 0.25,
            }}
          >
            {children}
          </Typography>
        </Box>
      </Box>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// Enhanced LoginCard with futuristic brewery theme
// ------------------------------------------------------------------
function LoginCard({
  title,
  subtitle,
  icon,
  defaultUsername,
  defaultPassword,
  usernameHint,
  passwordHint,
  accent,
  onSubmit,
  loading,
  errorMessage,
  size = 'large',
  breweryType = 'distributor',
}) {
  const [username, setUsername] = useState(defaultUsername || '');
  const [password, setPassword] = useState(defaultPassword || '');
  const [showPw, setShowPw] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

  const handle = (e) => {
    e.preventDefault();
    if (!username || !password) return;
    onSubmit({ username, password });
  };

  const colorScheme = {
    distributor: '#FFD700',
    manager: '#8FD14F',
    executive: '#FF6B6B',
  };

  const cardAccent = colorScheme[breweryType] || accent || goldGradient;

  return (
    <motion.div
      animate={{
        y: isHovered ? -8 : 0,
      }}
      transition={{ duration: 0.3 }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <GlassCard
        hover={false}
        sx={{
          p: size === 'small' ? 3 : { xs: 3, md: 4 },
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          border: `1.5px solid ${isHovered ? cardAccent + '60' : 'rgba(212,165,42,0.2)'}`,
          transition: 'all 0.3s ease',
          boxShadow: isHovered
            ? `0 12px 48px ${typeof cardAccent === 'string' && cardAccent.includes('#') ? cardAccent + '30' : 'rgba(212,165,42,0.3)'}, inset 0 1px 0 rgba(255,255,255,0.7)`
            : '0 2px 8px rgba(0,0,0,0.1), inset 0 1px 0 rgba(255,255,255,0.7)',
        }}
      >
        {/* Accent strip with glow */}
        <motion.div
          animate={{
            height: isHovered ? 4 : 3,
            opacity: isHovered ? 1 : 0.8,
          }}
          transition={{ duration: 0.3 }}
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            background: cardAccent,
            opacity: 0.8,
            boxShadow: isHovered ? `0 0 16px ${cardAccent}` : 'none',
          }}
        />

        {/* Brewing equipment in corner when hovered */}
        {isHovered && (
          <Box sx={{ position: 'absolute', top: 8, right: 12, opacity: 0.6 }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 0.6, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <LocalBreweryIcon sx={{ fontSize: '2rem', color: cardAccent, opacity: 0.4 }} />
            </motion.div>
          </Box>
        )}

        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
          <motion.div
            animate={{
              boxShadow: isHovered
                ? `0 12px 24px ${cardAccent}50`
                : '0 8px 22px rgba(212,165,42,0.4)',
            }}
            transition={{ duration: 0.3 }}
          >
            <Box
              sx={{
                width: size === 'small' ? 40 : 48,
                height: size === 'small' ? 40 : 48,
                borderRadius: 2,
                background: cardAccent,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#1A1A1A',
              }}
            >
              {icon}
            </Box>
          </motion.div>
          <Box>
            <Typography
              variant={size === 'small' ? 'h6' : 'h5'}
              sx={{
                fontWeight: 800,
                letterSpacing: '-0.01em',
                background: isHovered ? cardAccent : 'inherit',
                WebkitBackgroundClip: isHovered ? 'text' : 'unset',
                WebkitTextFillColor: isHovered ? 'transparent' : 'unset',
                transition: 'all 0.3s ease',
              }}
            >
              {title}
            </Typography>
            <Typography variant="caption" sx={{ color: 'text.secondary' }}>
              {subtitle}
            </Typography>
          </Box>
        </Stack>

        <form onSubmit={handle} noValidate>
          <Stack spacing={1.75}>
            <TextField
              label="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={usernameHint}
              fullWidth
              size="medium"
              autoComplete="username"
              sx={{
                '& .MuiOutlinedInput-root:hover': {
                  borderColor: cardAccent,
                },
                '& .MuiOutlinedInput-root.Mui-focused': {
                  borderColor: cardAccent,
                  '& fieldset': {
                    borderColor: cardAccent,
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <PersonOutlineIcon sx={{ color: 'rgba(26,26,26,0.45)' }} />
                  </InputAdornment>
                ),
              }}
            />
            <TextField
              label="Password"
              type={showPw ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={passwordHint}
              fullWidth
              size="medium"
              autoComplete="current-password"
              sx={{
                '& .MuiOutlinedInput-root:hover': {
                  borderColor: cardAccent,
                },
                '& .MuiOutlinedInput-root.Mui-focused': {
                  borderColor: cardAccent,
                  '& fieldset': {
                    borderColor: cardAccent,
                  },
                },
              }}
              InputProps={{
                startAdornment: (
                  <InputAdornment position="start">
                    <LockOutlinedIcon sx={{ color: 'rgba(26,26,26,0.45)' }} />
                  </InputAdornment>
                ),
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      size="small"
                      onClick={() => setShowPw((s) => !s)}
                      aria-label="toggle password visibility"
                      edge="end"
                    >
                      {showPw ? <VisibilityOffIcon /> : <VisibilityIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />

            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
              >
                <Alert
                  severity="error"
                  variant="outlined"
                  sx={{
                    borderRadius: 2,
                    background: 'rgba(198,40,40,0.04)',
                    fontSize: '0.85rem',
                    py: 0.5,
                    borderColor: '#C62828',
                  }}
                >
                  {errorMessage}
                </Alert>
              </motion.div>
            )}

            <motion.div
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
            >
              <Button
                type="submit"
                variant="contained"
                color="secondary"
                size="large"
                disabled={loading}
                sx={{
                  mt: 0.5,
                  py: 1.25,
                  fontWeight: 700,
                  fontSize: '1rem',
                  letterSpacing: '0.02em',
                  background: cardAccent,
                  color: '#1A1A1A',
                  position: 'relative',
                  overflow: 'hidden',
                  '&:hover': {
                    background: cardAccent,
                    boxShadow: `0 8px 24px ${cardAccent}50`,
                  },
                  '&:disabled': {
                    background: `${cardAccent}80`,
                  },
                }}
              >
                {loading ? (
                  <CircularProgress size={22} sx={{ color: '#1A1A1A' }} />
                ) : (
                  <>Sign in</>
                )}
              </Button>
            </motion.div>

            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 0.25 }}>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                Demo: {usernameHint} / {passwordHint}
              </Typography>
              <Tooltip title="Single-sign-on coming soon">
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    cursor: 'help',
                    textDecoration: 'underline dotted',
                  }}
                >
                  SSO
                </Typography>
              </Tooltip>
            </Box>
          </Stack>
        </form>
      </GlassCard>
    </motion.div>
  );
}

// ------------------------------------------------------------------
// Main page
// ------------------------------------------------------------------
export default function LoginPage() {
  const navigate = useNavigate();

  // Live KPI fetch (graceful fallback)
  const [stats, setStats] = useState({
    markets: 6,
    activeOrders: 247,
    inventoryValue: 48.2, // $M
    fulfillment: 96.4, // %
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        // Try the documented endpoint first, then fall back to a direct fetch
        let data;
        try {
          data = await getExecutiveKPIs();
        } catch (_) {
          const resp = await client.get('/analytics/executive/kpis');
          data = resp.data;
        }
        if (cancelled || !data) return;
        const k = data.kpis || data;
        setStats((prev) => ({
          markets: k.markets_served ?? k.markets ?? prev.markets,
          activeOrders:
            k.active_orders ?? k.activeOrders ?? k.orders_active ?? prev.activeOrders,
          inventoryValue:
            (k.inventory_value_musd ??
              k.inventoryValueMUSD ??
              (k.inventory_value ? k.inventory_value / 1_000_000 : null)) ??
            prev.inventoryValue,
          fulfillment:
            (k.fulfillment_rate_pct ??
              k.fulfillmentRate ??
              (k.fulfillment_rate ? k.fulfillment_rate * 100 : null)) ??
            prev.fulfillment,
        }));
      } catch (_) {
        /* keep graceful fallback */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Login handling
  const [submitting, setSubmitting] = useState(null); // 'distributor' | 'manager' | 'executive'
  const [errors, setErrors] = useState({});

  const handleLogin = async (which, creds) => {
    setSubmitting(which);
    setErrors((e) => ({ ...e, [which]: null }));
    try {
      const data = await apiLogin(creds.username, creds.password);
      // Persist identity for the API interceptor + downstream UI
      try {
        const user = data.user || data;
        const role = (user.role || data.role || which || '').toLowerCase();
        localStorage.setItem('userId', user.id || user.user_id || creds.username);
        localStorage.setItem('role', role);
        localStorage.setItem('userName', user.name || user.full_name || creds.username);
        if (user.customer_id || user.customerId)
          localStorage.setItem('customerId', user.customer_id || user.customerId);
        if (user.customer_name || user.customerName)
          localStorage.setItem('customerName', user.customer_name || user.customerName);
        if (user.market) localStorage.setItem('market', user.market);
      } catch (_) {}

      // Route by role
      const role = (
        (data.user && data.user.role) ||
        data.role ||
        which ||
        ''
      ).toLowerCase();
      if (role.includes('exec')) navigate('/executive');
      else if (role.includes('manager')) navigate('/manager');
      else navigate('/distributor');
    } catch (err) {
      const status = err?.response?.status;
      const detail = err?.response?.data?.detail || err?.response?.data?.message;
      let msg;
      if (status === 401) msg = 'Invalid username or password.';
      else if (status === 403) msg = 'Access denied for this role.';
      else if (!err?.response) msg = 'Cannot reach the BrewTrade AI service. Check your connection.';
      else msg = detail || 'Login failed. Please try again.';
      setErrors((e) => ({ ...e, [which]: msg }));
    } finally {
      setSubmitting(null);
    }
  };

  // ------------------------------------------------------------------
  // Background — luxury brewery scene built purely from CSS gradients
  // ------------------------------------------------------------------
  const heroBg = useMemo(
    () => ({
      position: 'fixed',
      inset: 0,
      zIndex: -1,
      background: [
        // Sun-glow radial top-right
        'radial-gradient(900px 600px at 92% 8%, rgba(255,213,107,0.55), transparent 60%)',
        // Amber pool bottom-left
        'radial-gradient(700px 500px at 6% 96%, rgba(212,140,40,0.45), transparent 65%)',
        // Cream wash center
        'radial-gradient(1200px 700px at 50% 60%, rgba(255,248,225,0.6), transparent 70%)',
        // Subtle copper kettle highlight
        'radial-gradient(400px 260px at 70% 78%, rgba(184,115,51,0.30), transparent 70%)',
        // Base luxury gradient — deep gold to cream
        'linear-gradient(135deg, #FFF6D8 0%, #F5D77E 25%, #E8A33D 55%, #B5740F 100%)',
      ].join(','),
      // Subtle moving sheen layer is added below as a sibling
    }),
    []
  );

  return (
    <Box
      sx={{
        minHeight: '100vh',
        width: '100%',
        position: 'relative',
        overflowX: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Animated floating bubbles */}
      <BubbleParticles />

      {/* Interactive mouse-tracking glow */}
      <InteractiveBreweryGlow />

      {/* Hero background (fixed) */}
      <Box sx={heroBg} />

      {/* Moving sheen overlay */}
      <Box
        component={motion.div}
        initial={{ x: '-30%' }}
        animate={{ x: '30%' }}
        transition={{ duration: 18, repeat: Infinity, repeatType: 'reverse', ease: 'easeInOut' }}
        sx={{
          position: 'fixed',
          top: '-20%',
          bottom: '-20%',
          left: 0,
          right: 0,
          zIndex: -1,
          pointerEvents: 'none',
          background:
            'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.25) 50%, transparent 65%)',
          mixBlendMode: 'overlay',
          filter: 'blur(30px)',
        }}
      />

      {/* Decorative bottle silhouettes (CSS only) */}
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          left: -80,
          bottom: -40,
          width: 280,
          height: 520,
          background:
            'radial-gradient(closest-side, rgba(70,40,10,0.22), transparent 70%)',
          filter: 'blur(20px)',
          zIndex: -1,
        }}
      />
      <Box
        aria-hidden
        sx={{
          position: 'fixed',
          right: -100,
          top: -60,
          width: 320,
          height: 480,
          background:
            'radial-gradient(closest-side, rgba(255,240,180,0.45), transparent 70%)',
          filter: 'blur(30px)',
          zIndex: -1,
        }}
      />

      {/* MAIN CONTENT */}
      <Box
        sx={{
          flex: 1,
          width: '100%',
          maxWidth: 1400,
          mx: 'auto',
          px: { xs: 2.5, md: 5 },
          py: { xs: 3, md: 4 },
          display: 'flex',
          flexDirection: 'column',
          position: 'relative',
          zIndex: 1,
        }}
      >
        {/* TOP — wordmark + subtitle with brewery accent */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          sx={{ textAlign: 'center', mb: { xs: 3, md: 4 }, position: 'relative' }}
        >
          {/* Animated brewing tank decoration */}
          <Box
            sx={{
              position: 'absolute',
              left: { xs: '5%', md: '10%' },
              top: '50%',
              transform: 'translateY(-50%)',
              opacity: 0.8,
            }}
          >
            <BrewingTank delay={0.2} />
          </Box>
          
          {/* Mirrored brewing tank on right */}
          <Box
            sx={{
              position: 'absolute',
              right: { xs: '5%', md: '10%' },
              top: '50%',
              transform: 'translateY(-50%) scaleX(-1)',
              opacity: 0.8,
            }}
          >
            <BrewingTank delay={0.4} />
          </Box>

          <Typography
            component={motion.h1}
            initial={{ backgroundPosition: '0% 50%' }}
            animate={{ backgroundPosition: '100% 50%' }}
            transition={{ duration: 8, repeat: Infinity, repeatType: 'reverse', ease: 'linear' }}
            sx={{
              fontSize: { xs: '2.6rem', md: '4rem' },
              fontWeight: 900,
              letterSpacing: '-0.035em',
              lineHeight: 1.0,
              backgroundImage:
                'linear-gradient(90deg, #8a5a10 0%, #D4A52A 25%, #FFE89A 50%, #D4A52A 75%, #8a5a10 100%)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              textShadow: '0 2px 20px rgba(212,165,42,0.25)',
              m: 0,
            }}
          >
            BrewTrade AI
          </Typography>
          <Typography
            variant="subtitle1"
            sx={{
              mt: 1,
              color: 'rgba(40,28,8,0.78)',
              fontWeight: 500,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              fontSize: { xs: '0.78rem', md: '0.92rem' },
            }}
          >
            Carib Brewery International Ordering Intelligence
          </Typography>
        </Box>

        {/* STAT STRIP with brewery types */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.75}
          sx={{ mb: { xs: 3, md: 5 } }}
        >
          <EnhancedStatTile
            icon={<PublicIcon fontSize="small" />}
            label="Markets Served"
            breweryType="markets"
            delay={0.05}
          >
            <CountUp value={stats.markets} duration={1.6} />
          </EnhancedStatTile>
          <EnhancedStatTile
            icon={<ReceiptLongIcon fontSize="small" />}
            label="Active Orders"
            breweryType="orders"
            delay={0.15}
          >
            <CountUp value={stats.activeOrders} duration={2.4} />
          </EnhancedStatTile>
          <EnhancedStatTile
            icon={<Inventory2Icon fontSize="small" />}
            label="Inventory Value"
            breweryType="inventory"
            delay={0.25}
          >
            <CountUp
              value={stats.inventoryValue}
              prefix="$"
              suffix="M"
              decimals={1}
              duration={2.2}
            />
          </EnhancedStatTile>
          <EnhancedStatTile
            icon={<VerifiedIcon fontSize="small" />}
            label="Fulfillment Rate"
            breweryType="fulfillment"
            delay={0.35}
          >
            <CountUp
              value={stats.fulfillment}
              suffix="%"
              decimals={1}
              duration={2.4}
            />
          </EnhancedStatTile>
        </Stack>

        {/* LOGIN CARDS with brewery types */}
        <Box
          component={motion.div}
          initial="hidden"
          animate="show"
          variants={{
            hidden: {},
            show: { transition: { staggerChildren: 0.15, delayChildren: 0.2 } },
          }}
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' },
            gap: { xs: 2, md: 3 },
          }}
        >
          <motion.div
            variants={{
              hidden: { opacity: 0, y: 24 },
              show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
            }}
          >
            <LoginCard
              title="Distributor Login"
              subtitle="Place orders, track shipments, manage AR"
              icon={<StorefrontIcon />}
              defaultUsername=""
              defaultPassword=""
              usernameHint="caribbean_imports"
              passwordHint="demo123"
              breweryType="distributor"
              onSubmit={(c) => handleLogin('distributor', c)}
              loading={submitting === 'distributor'}
              errorMessage={errors.distributor}
            />
          </motion.div>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 24 },
              show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.22, 1, 0.36, 1] } },
            }}
          >
            <LoginCard
              title="Market Manager Login"
              subtitle="Approve orders with AI copilot insights"
              icon={<SupervisorAccountIcon />}
              defaultUsername=""
              defaultPassword=""
              usernameHint="manager_demo"
              passwordHint="demo123"
              breweryType="manager"
              onSubmit={(c) => handleLogin('manager', c)}
              loading={submitting === 'manager'}
              errorMessage={errors.manager}
            />
          </motion.div>
        </Box>

        {/* EXECUTIVE DEMO CARD */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.55, ease: [0.22, 1, 0.36, 1] }}
          sx={{
            mt: { xs: 2.5, md: 3 },
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          <Box sx={{ width: '100%', maxWidth: 560 }}>
            <LoginCard
              size="small"
              title="Executive Demo Login"
              subtitle="Executive analytics, simulation & AI summary"
              icon={<RocketLaunchIcon />}
              defaultUsername=""
              defaultPassword=""
              usernameHint="exec_demo"
              passwordHint="demo123"
              breweryType="executive"
              onSubmit={(c) => handleLogin('executive', c)}
              loading={submitting === 'executive'}
              errorMessage={errors.executive}
            />
          </Box>
        </Box>

        <Divider
          sx={{
            mt: { xs: 4, md: 6 },
            mb: 2,
            borderColor: 'rgba(70,40,10,0.18)',
          }}
        />

        {/* FOOTER */}
        <Box
          component="footer"
          sx={{
            textAlign: 'center',
            pb: 1.5,
            color: 'rgba(40,28,8,0.7)',
          }}
        >
          <Typography variant="caption" sx={{ letterSpacing: '0.06em' }}>
            © Carib Brewery — Designed by Excel Global Solutions
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
