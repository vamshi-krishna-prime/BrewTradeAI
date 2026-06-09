import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Grid,
  Typography,
  Stack,
  TextField,
  Button,
  Divider,
  Switch,
  FormControlLabel,
  Snackbar,
  Alert,
  Skeleton,
  Chip,
  Avatar,
  LinearProgress,
} from '@mui/material';
import { motion } from 'framer-motion';
import { useQuery } from '@tanstack/react-query';

import LogoutIcon from '@mui/icons-material/Logout';
import SaveIcon from '@mui/icons-material/Save';
import EditIcon from '@mui/icons-material/Edit';
import PlaceIcon from '@mui/icons-material/Place';
import EmailIcon from '@mui/icons-material/Email';
import PhoneIcon from '@mui/icons-material/Phone';
import PersonIcon from '@mui/icons-material/Person';
import CreditScoreIcon from '@mui/icons-material/CreditScore';
import AccountBalanceWalletIcon from '@mui/icons-material/AccountBalanceWallet';
import NotificationsIcon from '@mui/icons-material/Notifications';
import VerifiedIcon from '@mui/icons-material/Verified';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import TrafficLight from '../components/common/TrafficLight.jsx';
import { getCustomerDashboard } from '../api/client.js';
import { formatCurrency, formatDate } from '../utils/format.js';
import { goldGradient } from '../theme.js';

const item = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 200, damping: 22 } },
};

function initialsOf(name) {
  if (!name) return 'BT';
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || '')
    .join('') || 'BT';
}

function healthLabel(h) {
  const s = String(h || 'green').toLowerCase();
  if (s === 'red') return 'At Risk';
  if (s === 'yellow') return 'Watch';
  return 'Healthy';
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const customerId =
    (typeof window !== 'undefined' && localStorage.getItem('customerId')) || '1';
  const fallbackName =
    (typeof window !== 'undefined' && localStorage.getItem('customerName')) ||
    (typeof window !== 'undefined' && localStorage.getItem('userName')) ||
    'Distributor';

  const { data, isLoading } = useQuery({
    queryKey: ['customer-dashboard', customerId],
    queryFn: () => getCustomerDashboard(customerId),
    retry: 1,
    staleTime: 60_000,
  });

  const customer = data?.customer || {};
  const name = customer.name || fallbackName;
  const market = customer.market || '-';
  const creditLimit = Number(customer.credit_limit ?? 0);
  const outstanding = Number(data?.outstanding_balance ?? customer.outstanding_balance ?? 0);
  const available = Number(
    data?.available_credit ?? Math.max(0, creditLimit - outstanding)
  );
  const utilization =
    creditLimit > 0 ? Math.min(100, Math.round((outstanding / creditLimit) * 100)) : 0;
  const health = customer.credit_health || (utilization >= 85 ? 'red' : utilization >= 60 ? 'yellow' : 'green');

  // Editable contact fields (visual only)
  const [contact, setContact] = useState({
    contact_name: customer.contact_name || '',
    contact_email: customer.contact_email || '',
    contact_phone: customer.contact_phone || '',
  });
  React.useEffect(() => {
    setContact({
      contact_name: customer.contact_name || '',
      contact_email: customer.contact_email || '',
      contact_phone: customer.contact_phone || '',
    });
  }, [customer.contact_name, customer.contact_email, customer.contact_phone]);

  // Preferences (visual)
  const [prefs, setPrefs] = useState({
    emailOrders: true,
    emailPromos: true,
    smsApprovals: false,
    weeklyDigest: true,
  });

  const [snack, setSnack] = useState(null);

  const handleSave = () => {
    setSnack({ severity: 'info', message: 'Demo: changes not persisted to the backend.' });
  };

  const handleLogout = () => {
    try {
      localStorage.clear();
    } catch (_) {}
    navigate('/');
  };

  if (isLoading) {
    return (
      <Box>
        <PageHeader title="Profile" subtitle="Loading your account..." />
        <Grid container spacing={2.5}>
          <Grid item xs={12} md={4}><Skeleton variant="rounded" height={300} /></Grid>
          <Grid item xs={12} md={8}><Skeleton variant="rounded" height={300} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={220} /></Grid>
          <Grid item xs={12} md={6}><Skeleton variant="rounded" height={220} /></Grid>
        </Grid>
      </Box>
    );
  }

  return (
    <Box>
      <PageHeader
        title="Profile"
        subtitle="Your account, credit summary, and preferences"
        actions={
          <Button color="error" variant="outlined" startIcon={<LogoutIcon />} onClick={handleLogout}>
            Logout
          </Button>
        }
      />

      <Grid container spacing={2.5}>
        {/* Identity card */}
        <Grid item xs={12} md={4}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard sx={{ textAlign: 'center', p: 3 }}>
              <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
                <Avatar
                  sx={{
                    width: 96,
                    height: 96,
                    background: goldGradient,
                    color: '#1A1A1A',
                    fontWeight: 800,
                    fontSize: '2rem',
                    boxShadow: '0 8px 28px rgba(212,165,42,0.45)',
                  }}
                >
                  {initialsOf(name)}
                </Avatar>
              </Box>
              <Typography variant="h5" sx={{ fontWeight: 800 }}>
                {name}
              </Typography>
              <Stack direction="row" justifyContent="center" alignItems="center" spacing={0.6} mt={0.5}>
                <PlaceIcon fontSize="small" sx={{ color: '#B5891F' }} />
                <Typography variant="body2" color="text.secondary">
                  {market}
                </Typography>
              </Stack>
              <Stack direction="row" justifyContent="center" spacing={1} mt={2}>
                <Chip
                  size="small"
                  icon={<VerifiedIcon sx={{ color: '#1A1A1A !important' }} />}
                  label="Verified Distributor"
                  sx={{
                    background: 'rgba(212,165,42,0.18)',
                    border: '1px solid rgba(212,165,42,0.35)',
                    fontWeight: 600,
                  }}
                />
                <Chip
                  size="small"
                  label={healthLabel(health)}
                  icon={<TrafficLight status={health} size={10} />}
                  sx={{
                    fontWeight: 600,
                    background:
                      health === 'red'
                        ? 'rgba(198,40,40,0.12)'
                        : health === 'yellow'
                        ? 'rgba(232,163,61,0.15)'
                        : 'rgba(46,125,50,0.12)',
                  }}
                />
              </Stack>

              <Divider sx={{ my: 2.5 }} />

              <Stack spacing={1.2} alignItems="flex-start" textAlign="left">
                <Row icon={<PersonIcon fontSize="small" />} label="Customer ID" value={`#${customer.id ?? customerId}`} />
                <Row
                  icon={<EmailIcon fontSize="small" />}
                  label="Email"
                  value={contact.contact_email || '-'}
                />
                <Row
                  icon={<PhoneIcon fontSize="small" />}
                  label="Phone"
                  value={contact.contact_phone || '-'}
                />
                {customer.created_at && (
                  <Row
                    icon={<VerifiedIcon fontSize="small" />}
                    label="Member since"
                    value={formatDate(customer.created_at)}
                  />
                )}
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Editable contact info */}
        <Grid item xs={12} md={8}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1.5}>
                <EditIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Contact Information
                </Typography>
              </Stack>
              <Alert severity="info" sx={{ mb: 2 }}>
                Demo: changes are not persisted. UI shows how editing would work.
              </Alert>
              <Grid container spacing={2}>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Contact Name"
                    value={contact.contact_name}
                    onChange={(e) => setContact({ ...contact, contact_name: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Email"
                    type="email"
                    value={contact.contact_email}
                    onChange={(e) => setContact({ ...contact, contact_email: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField
                    fullWidth
                    label="Phone"
                    value={contact.contact_phone}
                    onChange={(e) => setContact({ ...contact, contact_phone: e.target.value })}
                  />
                </Grid>
                <Grid item xs={12} md={6}>
                  <TextField fullWidth label="Market" value={market} disabled />
                </Grid>
              </Grid>
              <Stack direction="row" justifyContent="flex-end" spacing={1.2} mt={2}>
                <Button color="inherit" onClick={() =>
                  setContact({
                    contact_name: customer.contact_name || '',
                    contact_email: customer.contact_email || '',
                    contact_phone: customer.contact_phone || '',
                  })
                }>
                  Reset
                </Button>
                <Button color="secondary" variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
                  Save Changes
                </Button>
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Credit summary */}
        <Grid item xs={12} md={6}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1.5}>
                <CreditScoreIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Credit Summary
                </Typography>
                <Box sx={{ flex: 1 }} />
                <TrafficLight status={health} size={14} title={healthLabel(health)} />
              </Stack>

              <Stack spacing={1.5}>
                <Box>
                  <Stack direction="row" justifyContent="space-between" mb={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      Utilization
                    </Typography>
                    <Typography variant="body2" sx={{ fontWeight: 700 }}>
                      {utilization}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={utilization}
                    sx={{
                      height: 10,
                      borderRadius: 6,
                      backgroundColor: 'rgba(212,165,42,0.15)',
                      '& .MuiLinearProgress-bar': {
                        borderRadius: 6,
                        background:
                          health === 'red'
                            ? 'linear-gradient(90deg,#C62828,#ED6C02)'
                            : health === 'yellow'
                            ? 'linear-gradient(90deg,#E8A33D,#F2C849)'
                            : 'linear-gradient(90deg,#2E7D32,#66BB6A)',
                      },
                    }}
                  />
                </Box>

                <SummaryRow icon={<CreditScoreIcon fontSize="small" />} label="Credit Limit" value={formatCurrency(creditLimit)} />
                <SummaryRow icon={<AccountBalanceWalletIcon fontSize="small" />} label="Outstanding" value={formatCurrency(outstanding)} strong />
                <SummaryRow icon={<CreditScoreIcon fontSize="small" />} label="Available Credit" value={formatCurrency(available)} />
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Button
                fullWidth
                color="secondary"
                variant="outlined"
                onClick={() => navigate('/distributor/ar')}
              >
                View AR Dashboard
              </Button>
            </GlassCard>
          </motion.div>
        </Grid>

        {/* Preferences */}
        <Grid item xs={12} md={6}>
          <motion.div variants={item} initial="hidden" animate="show">
            <GlassCard>
              <Stack direction="row" alignItems="center" spacing={1.2} mb={1.5}>
                <NotificationsIcon sx={{ color: '#B5891F' }} />
                <Typography variant="h6" sx={{ fontWeight: 700 }}>
                  Notification Preferences
                </Typography>
              </Stack>
              <Alert severity="info" sx={{ mb: 2 }}>
                Demo: preferences are not persisted.
              </Alert>
              <Stack spacing={1}>
                <FormControlLabel
                  control={
                    <Switch
                      color="secondary"
                      checked={prefs.emailOrders}
                      onChange={(e) => setPrefs({ ...prefs, emailOrders: e.target.checked })}
                    />
                  }
                  label="Email me when an order status changes"
                />
                <FormControlLabel
                  control={
                    <Switch
                      color="secondary"
                      checked={prefs.emailPromos}
                      onChange={(e) => setPrefs({ ...prefs, emailPromos: e.target.checked })}
                    />
                  }
                  label="Email me about new promotions"
                />
                <FormControlLabel
                  control={
                    <Switch
                      color="secondary"
                      checked={prefs.smsApprovals}
                      onChange={(e) => setPrefs({ ...prefs, smsApprovals: e.target.checked })}
                    />
                  }
                  label="SMS me when an order needs approval"
                />
                <FormControlLabel
                  control={
                    <Switch
                      color="secondary"
                      checked={prefs.weeklyDigest}
                      onChange={(e) => setPrefs({ ...prefs, weeklyDigest: e.target.checked })}
                    />
                  }
                  label="Send me a weekly AR digest"
                />
              </Stack>

              <Divider sx={{ my: 2 }} />
              <Stack direction="row" justifyContent="flex-end">
                <Button color="secondary" variant="contained" startIcon={<SaveIcon />} onClick={handleSave}>
                  Save Preferences
                </Button>
              </Stack>
            </GlassCard>
          </motion.div>
        </Grid>
      </Grid>

      <Snackbar
        open={!!snack}
        autoHideDuration={3500}
        onClose={() => setSnack(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        {snack ? (
          <Alert severity={snack.severity} onClose={() => setSnack(null)} variant="filled">
            {snack.message}
          </Alert>
        ) : null}
      </Snackbar>
    </Box>
  );
}

function Row({ icon, label, value }) {
  return (
    <Stack direction="row" spacing={1.2} alignItems="center" sx={{ width: '100%' }}>
      <Box sx={{ color: '#B5891F', display: 'flex' }}>{icon}</Box>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="caption" color="text.secondary" display="block">
          {label}
        </Typography>
        <Typography
          variant="body2"
          sx={{
            fontWeight: 600,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {value}
        </Typography>
      </Box>
    </Stack>
  );
}

function SummaryRow({ icon, label, value, strong }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.2}>
      <Box sx={{ color: '#B5891F', display: 'flex' }}>{icon}</Box>
      <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
        {label}
      </Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 800 : 700 }}>
        {value}
      </Typography>
    </Stack>
  );
}
