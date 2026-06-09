import React, { useEffect, useMemo, useState } from 'react';
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
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';

import { goldGradient } from '../theme.js';
import ThemeToggle from '../components/common/ThemeToggle.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import client, { login as apiLogin, getExecutiveKPIs } from '../api/client.js';

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
// Reusable login card
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
}) {
  const [username, setUsername] = useState(defaultUsername || '');
  const [password, setPassword] = useState(defaultPassword || '');
  const [showPw, setShowPw] = useState(false);

  const handle = (e) => {
    e.preventDefault();
    if (!username || !password) return;
    onSubmit({ username, password });
  };

  return (
    <GlassCard
      hover={false}
      sx={{
        p: size === 'small' ? 3 : { xs: 3, md: 4 },
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {/* Accent strip */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: 3,
          background: accent || goldGradient,
          opacity: 0.9,
        }}
      />

      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Box
          sx={{
            width: size === 'small' ? 40 : 48,
            height: size === 'small' ? 40 : 48,
            borderRadius: 2,
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1A1A1A',
            boxShadow: '0 8px 22px rgba(212,165,42,0.4)',
          }}
        >
          {icon}
        </Box>
        <Box>
          <Typography
            variant={size === 'small' ? 'h6' : 'h5'}
            sx={{ fontWeight: 800, letterSpacing: '-0.01em' }}
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
            <Alert
              severity="error"
              variant="outlined"
              sx={{
                borderRadius: 2,
                background: 'rgba(198,40,40,0.04)',
                fontSize: '0.85rem',
                py: 0.5,
              }}
            >
              {errorMessage}
            </Alert>
          )}

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
            }}
          >
            {loading ? (
              <CircularProgress size={22} sx={{ color: '#1A1A1A' }} />
            ) : (
              <>Sign in</>
            )}
          </Button>

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
      {/* Hero background (fixed) */}
      <Box sx={heroBg} />

      <ThemeToggle floating />

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
            'radial-gradient(closest-side, rgba(180, 204, 255, 0.45), transparent 70%)',
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
        }}
      >
        {/* TOP — wordmark + subtitle */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: -14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          sx={{ textAlign: 'center', mb: { xs: 3, md: 4 } }}
        >
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
                'linear-gradient(90deg, #8a5a10 0%, #062d54 25%, #FFE89A 50%, #D4A52A 75%, #8a5a10 100%)',
              backgroundSize: '200% 100%',
              WebkitBackgroundClip: 'text',
              backgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              color: 'transparent',
              textShadow: '0 2px 20px rgba(212,165,42,0.25)',
              m: 0,
            }}
          >
            Carib BrewTrade AI 
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

        {/* STAT STRIP */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.75}
          sx={{ mb: { xs: 3, md: 5 } }}
        >
          <StatTile
            icon={<PublicIcon fontSize="small" />}
            label="Markets Served"
            delay={0.05}
          >
            <CountUp value={33} duration={1.6} 
            suffix="+"/>
          </StatTile>
          <StatTile
            icon={<ReceiptLongIcon fontSize="small" />}
            label="Green Breweries"
            delay={0.15}
          >
            <CountUp value={4} duration={2.4} />
          </StatTile>
          <StatTile
            icon={<Inventory2Icon fontSize="small" />}
            label="Brands"
            delay={0.25}
          >
            <CountUp
              value={20}
              prefix=""
              suffix="+"
              decimals={0}
              duration={2.2}
            />
          </StatTile>
          <StatTile
            icon={<VerifiedIcon fontSize="small" />}
            label="Years in Market"
            delay={0.35}
          >
            <CountUp
              value={70}
              suffix="+ Years"
              decimals={0}
              duration={2.4}
            />
          </StatTile>
        </Stack>

        {/* LOGIN CARDS */}
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
              title="Carib Executive Login"
              subtitle="Approve orders with AI copilot insights"
              icon={<SupervisorAccountIcon />}
              defaultUsername=""
              defaultPassword=""
              usernameHint="manager_demo"
              passwordHint="demo123"
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
              title="Management Login"
              subtitle="Executive analytics, simulation & AI summary"
              icon={<RocketLaunchIcon />}
              defaultUsername=""
              defaultPassword=""
              usernameHint="exec_demo"
              passwordHint="demo123"
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
