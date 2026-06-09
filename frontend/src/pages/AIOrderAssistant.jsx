import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Typography,
  Stack,
  Button,
  TextField,
  IconButton,
  Chip,
  Grid,
  Alert,
  CircularProgress,
  Tooltip,
  Divider,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import {
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as ReTooltip,
  ResponsiveContainer,
  Area,
  AreaChart,
} from 'recharts';

import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import SendIcon from '@mui/icons-material/Send';
import CelebrationIcon from '@mui/icons-material/Celebration';
import SportsBarIcon from '@mui/icons-material/SportsBar';
import EventIcon from '@mui/icons-material/Event';
import EmojiEventsIcon from '@mui/icons-material/EmojiEvents';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import AddShoppingCartIcon from '@mui/icons-material/AddShoppingCart';
import LocalBarIcon from '@mui/icons-material/LocalBar';
import StorefrontIcon from '@mui/icons-material/Storefront';
import TimelineIcon from '@mui/icons-material/Timeline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import BoltIcon from '@mui/icons-material/Bolt';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import ChatBubble from '../components/ai/ChatBubble.jsx';
import AIRecommendationCard from '../components/ai/AIRecommendationCard.jsx';
import { askAIAssistant } from '../api/client.js';
import { goldGradient } from '../theme.js';
import { formatNumber } from '../utils/format.js';

// -----------------------------------------------------------------------------
// Suggested prompt chips
// -----------------------------------------------------------------------------
const SUGGESTED_PROMPTS = [
  {
    label: 'I am planning a Stag promotion',
    icon: <SportsBarIcon fontSize="small" />,
    prompt:
      'I am planning a Stag promotion next month. What products and merchandise should I order, and how much?',
  },
  {
    label: 'Help me plan a Carnival campaign',
    icon: <CelebrationIcon fontSize="small" />,
    prompt:
      'Help me plan a Carnival campaign. Recommend the best mix of products and promotional items for the season.',
  },
  {
    label: 'What should I order this month?',
    icon: <EventIcon fontSize="small" />,
    prompt:
      'What should I order this month based on my recent sales and inventory levels?',
  },
  {
    label: 'Best products for the World Cup',
    icon: <EmojiEventsIcon fontSize="small" />,
    prompt:
      'What are the best products to stock for the World Cup, and how much demand should I expect?',
  },
];

// -----------------------------------------------------------------------------
// Cart helpers - graceful fallback if no CartContext exists
// -----------------------------------------------------------------------------
function useCartFallback() {
  // Lightweight cart shim backed by localStorage. If a real CartContext is wired
  // up later, swap this hook out without changing the page.
  const [count, setCount] = useState(() => {
    try {
      const raw = localStorage.getItem('brewtrade_cart');
      const arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr.length : 0;
    } catch {
      return 0;
    }
  });

  const addItem = (item) => {
    try {
      const raw = localStorage.getItem('brewtrade_cart');
      const arr = raw ? JSON.parse(raw) : [];
      const safe = Array.isArray(arr) ? arr : [];
      safe.push({
        id: item.id || item.product_id || item.sku || `ai-${Date.now()}`,
        name: item.name || item.product_name || item.title,
        quantity: Number(item.suggested_quantity ?? item.quantity ?? 1),
        unit_price: Number(item.unit_price ?? item.price ?? 0),
        source: 'ai_assistant',
        added_at: new Date().toISOString(),
      });
      localStorage.setItem('brewtrade_cart', JSON.stringify(safe));
      setCount(safe.length);
    } catch (_) {
      // ignore
    }
  };

  return { addItem, count };
}

// -----------------------------------------------------------------------------
// Demand chart - synthesizes a 12-month trend from forecast meta if backend
// does not return a series.
// -----------------------------------------------------------------------------
function buildDemandSeries(forecast) {
  // forecast may be:
  //   - { series: [{month, value}] }
  //   - { history: [...], forecast: [...] }
  //   - { trend: 'up' | 'flat' | 'down', baseline: number }
  //   - undefined  -> generate a smooth seasonal pattern
  const months = [
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  ];

  if (forecast && Array.isArray(forecast.series) && forecast.series.length > 0) {
    return forecast.series.map((p) => ({
      month: p.month || p.label || '',
      actual: p.actual ?? p.value ?? null,
      forecast: p.forecast ?? null,
    }));
  }

  const baseline = Number(forecast?.baseline ?? 1200);
  const trend = forecast?.trend || 'up';
  const slope = trend === 'down' ? -25 : trend === 'flat' ? 4 : 38;
  const series = months.map((m, i) => {
    const seasonal = Math.sin((i / 12) * Math.PI * 2) * 140;
    const noise = (Math.sin(i * 3.7) + Math.cos(i * 1.9)) * 35;
    const actual = i < 8 ? Math.round(baseline + slope * i + seasonal + noise) : null;
    const forecastV =
      i >= 7 ? Math.round(baseline + slope * (i + 0.5) + seasonal + 60) : null;
    return { month: m, actual, forecast: forecastV };
  });
  return series;
}

// -----------------------------------------------------------------------------
// Main page
// -----------------------------------------------------------------------------
export default function AIOrderAssistant() {
  const customerId =
    (typeof window !== 'undefined' && localStorage.getItem('customerId')) || '1';

  const cart = useCartFallback();

  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [addedKeys, setAddedKeys] = useState(new Set());

  const scrollRef = useRef(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth',
      });
    }
  }, [messages, loading]);

  const send = async (text) => {
    const prompt = (text ?? input).trim();
    if (!prompt || loading) return;

    setError(null);
    setInput('');

    const userMsg = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date().toISOString(),
    };
    const thinkingMsg = {
      id: `a-${Date.now()}`,
      role: 'assistant',
      status: 'thinking',
      timestamp: new Date().toISOString(),
    };
    setMessages((m) => [...m, userMsg, thinkingMsg]);
    setLoading(true);

    try {
      const data = await askAIAssistant({
        customer_id: customerId,
        prompt,
      });

      const recommended = normalizeArray(
        data?.recommended_products || data?.products || data?.recommendations
      );
      const merch = normalizeArray(
        data?.merchandise_suggestions ||
          data?.merchandise ||
          data?.merchandise_recommendations
      );
      const forecast =
        data?.demand_forecast || data?.forecast || data?.historical_demand || null;
      const summary =
        data?.summary ||
        data?.response ||
        data?.message ||
        defaultSummary(prompt, recommended, merch);

      const aiMsg = {
        id: thinkingMsg.id,
        role: 'assistant',
        status: 'done',
        timestamp: new Date().toISOString(),
        content: summary,
        recommended,
        merchandise: merch,
        forecast,
        raw: data,
      };

      setMessages((m) => m.map((msg) => (msg.id === thinkingMsg.id ? aiMsg : msg)));
    } catch (err) {
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          'The AI assistant could not respond right now.'
      );
      setMessages((m) =>
        m.map((msg) =>
          msg.id === thinkingMsg.id
            ? {
                ...msg,
                status: 'done',
                content:
                  "I couldn't reach the AI service. Please try your question again in a moment.",
              }
            : msg
        )
      );
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleAddItem = (item) => {
    cart.addItem(item);
    const key = itemKey(item);
    setAddedKeys((prev) => {
      const next = new Set(prev);
      next.add(key);
      return next;
    });
  };

  const handleAddAll = (msg) => {
    const all = [...(msg.recommended || []), ...(msg.merchandise || [])];
    all.forEach((it) => cart.addItem(it));
    setAddedKeys((prev) => {
      const next = new Set(prev);
      all.forEach((it) => next.add(itemKey(it)));
      return next;
    });
  };

  const reset = () => {
    setMessages([]);
    setInput('');
    setError(null);
    setAddedKeys(new Set());
  };

  const hasConversation = messages.length > 0;

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        height: 'calc(100vh - 120px)',
        minHeight: 600,
      }}
    >
      <PageHeader
        title="AI Order Assistant"
        subtitle="Plan promotions, forecast demand, and build your next order with Claude"
        actions={
          <Stack direction="row" spacing={1} alignItems="center">
            <Chip
              icon={<AutoAwesomeIcon />}
              label="Powered by AI"
              sx={{
                fontWeight: 700,
                background: 'rgba(26,26,26,0.88)',
                color: '#F2C849',
                border: '1px solid rgba(212,165,42,0.4)',
                px: 1,
                '& .MuiChip-icon': { color: '#F2C849' },
              }}
            />
            {hasConversation && (
              <Tooltip title="Start a new conversation">
                <IconButton
                  onClick={reset}
                  sx={{
                    background: 'rgba(255,255,255,0.7)',
                    border: '1px solid rgba(212,165,42,0.25)',
                  }}
                >
                  <RestartAltIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>
        }
      />

      {error && (
        <Alert severity="warning" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* Chat surface */}
      <GlassCard
        hover={false}
        sx={{
          flex: 1,
          p: 0,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Scroll region */}
        <Box
          ref={scrollRef}
          sx={{
            flex: 1,
            overflowY: 'auto',
            px: { xs: 2, md: 4 },
            py: 3,
            background:
              'radial-gradient(800px 400px at 100% 0%, rgba(242,200,73,0.10), transparent 60%), radial-gradient(600px 300px at 0% 100%, rgba(212,165,42,0.06), transparent 60%)',
            '&::-webkit-scrollbar': { width: 8 },
            '&::-webkit-scrollbar-thumb': {
              backgroundColor: 'rgba(212,165,42,0.35)',
              borderRadius: 4,
            },
          }}
        >
          {!hasConversation ? (
            <WelcomePanel onPick={(p) => send(p)} />
          ) : (
            <Stack spacing={3}>
              <AnimatePresence initial={false}>
                {messages.map((msg) =>
                  msg.role === 'user' ? (
                    <ChatBubble
                      key={msg.id}
                      role="user"
                      timestamp={msg.timestamp}
                    >
                      {msg.content}
                    </ChatBubble>
                  ) : (
                    <AssistantTurn
                      key={msg.id}
                      msg={msg}
                      addedKeys={addedKeys}
                      onAddItem={handleAddItem}
                      onAddAll={() => handleAddAll(msg)}
                    />
                  )
                )}
              </AnimatePresence>
            </Stack>
          )}
        </Box>

        <Divider />

        {/* Input bar */}
        <Box sx={{ p: { xs: 1.5, md: 2 } }}>
          {hasConversation && (
            <Stack
              direction="row"
              spacing={1}
              sx={{
                mb: 1.25,
                overflowX: 'auto',
                pb: 0.5,
                '&::-webkit-scrollbar': { height: 4 },
              }}
            >
              {SUGGESTED_PROMPTS.map((s, i) => (
                <Chip
                  key={i}
                  size="small"
                  icon={s.icon}
                  label={s.label}
                  onClick={() => send(s.prompt)}
                  sx={{
                    fontWeight: 600,
                    fontSize: '0.78rem',
                    background: 'rgba(212,165,42,0.10)',
                    border: '1px solid rgba(212,165,42,0.25)',
                    color: '#8a5a10',
                    flexShrink: 0,
                    '&:hover': {
                      background: 'rgba(212,165,42,0.18)',
                    },
                    '& .MuiChip-icon': { color: '#B5891F' },
                  }}
                />
              ))}
            </Stack>
          )}
          <Stack direction="row" spacing={1.5} alignItems="flex-end">
            <TextField
              fullWidth
              multiline
              maxRows={4}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="Ask me anything about your order plan..."
              disabled={loading}
              InputProps={{
                sx: {
                  background: 'rgba(255,255,255,0.7)',
                  borderRadius: 3,
                  fontSize: '0.95rem',
                  '& fieldset': {
                    borderColor: 'rgba(212,165,42,0.28)',
                  },
                  '&:hover fieldset': {
                    borderColor: 'rgba(212,165,42,0.55) !important',
                  },
                  '&.Mui-focused fieldset': {
                    borderColor: '#D4A52A !important',
                    borderWidth: 1.5,
                  },
                },
              }}
            />
            <Button
              variant="contained"
              color="secondary"
              onClick={() => send()}
              disabled={loading || !input.trim()}
              sx={{
                minWidth: 56,
                height: 48,
                borderRadius: 3,
                p: 0,
              }}
            >
              {loading ? (
                <CircularProgress size={20} sx={{ color: '#1A1A1A' }} />
              ) : (
                <SendIcon />
              )}
            </Button>
          </Stack>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              mt: 0.75,
              textAlign: 'center',
              color: 'text.secondary',
              fontSize: '0.7rem',
            }}
          >
            <BoltIcon sx={{ fontSize: 12, verticalAlign: 'middle', mr: 0.5 }} />
            AI suggestions are starting points - always review against your local market knowledge.
          </Typography>
        </Box>
      </GlassCard>
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Welcome / empty state
// -----------------------------------------------------------------------------
function WelcomePanel({ onPick }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
    >
      <Box sx={{ textAlign: 'center', py: { xs: 3, md: 5 }, maxWidth: 760, mx: 'auto' }}>
        <Box
          sx={{
            width: 72,
            height: 72,
            mx: 'auto',
            mb: 2,
            borderRadius: '50%',
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1A1A1A',
            boxShadow: '0 10px 30px rgba(212,165,42,0.45)',
          }}
        >
          <AutoAwesomeIcon sx={{ fontSize: 36 }} />
        </Box>
        <Typography
          variant="h4"
          sx={{
            fontWeight: 800,
            mb: 1,
            background: goldGradient,
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            letterSpacing: '-0.01em',
          }}
        >
          How can I help you sell more this season?
        </Typography>
        <Typography
          variant="body1"
          color="text.secondary"
          sx={{ mb: 4, maxWidth: 580, mx: 'auto' }}
        >
          Ask about upcoming promotions, demand forecasts, or product mix. I'll
          surface recommendations, merchandise picks, and historical trends pulled
          from your account.
        </Typography>

        <Grid container spacing={1.5} sx={{ mb: 2 }}>
          {SUGGESTED_PROMPTS.map((s, i) => (
            <Grid item xs={12} sm={6} key={i}>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + i * 0.08, duration: 0.45 }}
                whileHover={{ y: -2 }}
                onClick={() => onPick(s.prompt)}
                style={{ cursor: 'pointer' }}
              >
                <Box
                  sx={{
                    p: 2,
                    borderRadius: 3,
                    textAlign: 'left',
                    background: 'rgba(255,255,255,0.78)',
                    border: '1px solid rgba(212,165,42,0.28)',
                    boxShadow:
                      '0 1px 0 rgba(255,255,255,0.6) inset, 0 8px 22px rgba(26,26,26,0.05)',
                    transition: 'all 0.25s ease',
                    '&:hover': {
                      borderColor: 'rgba(212,165,42,0.55)',
                      boxShadow:
                        '0 1px 0 rgba(255,255,255,0.6) inset, 0 14px 30px rgba(212,165,42,0.18)',
                    },
                  }}
                >
                  <Stack direction="row" spacing={1.5} alignItems="flex-start">
                    <Box
                      sx={{
                        width: 36,
                        height: 36,
                        borderRadius: 2,
                        background:
                          'linear-gradient(135deg, rgba(212,165,42,0.18) 0%, rgba(242,200,73,0.10) 100%)',
                        border: '1px solid rgba(212,165,42,0.3)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#B5891F',
                        flexShrink: 0,
                      }}
                    >
                      {s.icon}
                    </Box>
                    <Box>
                      <Typography
                        variant="subtitle2"
                        sx={{ fontWeight: 700, lineHeight: 1.3 }}
                      >
                        {s.label}
                      </Typography>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                          mt: 0.25,
                        }}
                      >
                        {s.prompt}
                      </Typography>
                    </Box>
                  </Stack>
                </Box>
              </motion.div>
            </Grid>
          ))}
        </Grid>
      </Box>
    </motion.div>
  );
}

// -----------------------------------------------------------------------------
// Assistant turn (chat bubble + structured response panel)
// -----------------------------------------------------------------------------
function AssistantTurn({ msg, addedKeys, onAddItem, onAddAll }) {
  const isThinking = msg.status === 'thinking';
  const recommended = msg.recommended || [];
  const merchandise = msg.merchandise || [];
  const showStructured =
    !isThinking && (recommended.length > 0 || merchandise.length > 0 || msg.forecast);

  const allAdded = useMemo(() => {
    const all = [...recommended, ...merchandise];
    if (all.length === 0) return false;
    return all.every((it) => addedKeys.has(itemKey(it)));
  }, [recommended, merchandise, addedKeys]);

  return (
    <Stack spacing={2}>
      <ChatBubble
        role="assistant"
        meta={isThinking ? undefined : 'Claude Opus 4.5'}
        timestamp={isThinking ? undefined : msg.timestamp}
        status={isThinking ? 'thinking' : 'done'}
      >
        {!isThinking && msg.content && (
          <TypewriterText text={String(msg.content)} />
        )}
      </ChatBubble>

      {showStructured && (
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.15, ease: [0.22, 1, 0.36, 1] }}
        >
          <Box sx={{ pl: { xs: 0, md: 6.5 } }}>
            {recommended.length > 0 && (
              <Section
                title="Recommended Products"
                subtitle={`${recommended.length} curated for your next order`}
                icon={<LocalBarIcon />}
              >
                <Grid container spacing={2}>
                  {recommended.map((p, i) => (
                    <Grid item xs={12} sm={6} md={4} key={itemKey(p) || i}>
                      <AIRecommendationCard
                        item={p}
                        variant="product"
                        added={addedKeys.has(itemKey(p))}
                        onAddToCart={onAddItem}
                        delay={i * 0.05}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Section>
            )}

            {merchandise.length > 0 && (
              <Section
                title="Merchandise Recommendations"
                subtitle="Branded items to amplify the campaign"
                icon={<StorefrontIcon />}
              >
                <Grid container spacing={2}>
                  {merchandise.map((p, i) => (
                    <Grid item xs={12} sm={6} md={4} key={itemKey(p) || i}>
                      <AIRecommendationCard
                        item={p}
                        variant="merchandise"
                        added={addedKeys.has(itemKey(p))}
                        onAddToCart={onAddItem}
                        delay={i * 0.05}
                      />
                    </Grid>
                  ))}
                </Grid>
              </Section>
            )}

            <Section
              title="Historical Demand"
              subtitle="Trailing 8 months with 4-month forecast"
              icon={<TimelineIcon />}
            >
              <DemandChart forecast={msg.forecast} />
            </Section>

            {(recommended.length > 0 || merchandise.length > 0) && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  startIcon={
                    allAdded ? <CheckCircleIcon /> : <AddShoppingCartIcon />
                  }
                  onClick={onAddAll}
                  disabled={allAdded}
                  sx={{ fontWeight: 700, px: 3 }}
                >
                  {allAdded
                    ? 'All recommendations added'
                    : 'Add all recommendations to cart'}
                </Button>
              </Box>
            )}
          </Box>
        </motion.div>
      )}
    </Stack>
  );
}

function Section({ title, subtitle, icon, children }) {
  return (
    <Box sx={{ mt: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1.25} sx={{ mb: 1.5 }}>
        <Box
          sx={{
            width: 30,
            height: 30,
            borderRadius: 1.5,
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#1A1A1A',
            boxShadow: '0 4px 12px rgba(212,165,42,0.35)',
          }}
        >
          {React.cloneElement(icon, { fontSize: 'small' })}
        </Box>
        <Box>
          <Typography variant="h6" sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {title}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        </Box>
      </Stack>
      {children}
    </Box>
  );
}

// -----------------------------------------------------------------------------
// Demand chart
// -----------------------------------------------------------------------------
function DemandChart({ forecast }) {
  const data = useMemo(() => buildDemandSeries(forecast), [forecast]);
  const peak = useMemo(
    () =>
      data.reduce(
        (acc, p) => Math.max(acc, p.actual || 0, p.forecast || 0),
        0
      ),
    [data]
  );

  return (
    <GlassCard hover={false} sx={{ p: 2.5 }}>
      <Stack
        direction="row"
        alignItems="center"
        justifyContent="space-between"
        sx={{ mb: 1.5 }}
      >
        <Stack direction="row" spacing={2}>
          <LegendDot color="#1A1A1A" label="Actual" />
          <LegendDot color="#D4A52A" label="Forecast" />
        </Stack>
        <Typography variant="caption" color="text.secondary">
          Peak {formatNumber(peak)} units
        </Typography>
      </Stack>

      <Box sx={{ height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, bottom: 0, left: -10 }}>
            <defs>
              <linearGradient id="actualGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#1A1A1A" stopOpacity={0.18} />
                <stop offset="100%" stopColor="#1A1A1A" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="forecastGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#D4A52A" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#F2C849" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(26,26,26,0.07)"
              vertical={false}
            />
            <XAxis
              dataKey="month"
              tick={{ fill: '#5A5A5A', fontSize: 11 }}
              axisLine={{ stroke: 'rgba(26,26,26,0.12)' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#5A5A5A', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <ReTooltip
              contentStyle={{
                background: 'rgba(255,255,255,0.95)',
                border: '1px solid rgba(212,165,42,0.35)',
                borderRadius: 12,
                boxShadow: '0 10px 30px rgba(26,26,26,0.10)',
                fontSize: 12,
              }}
              labelStyle={{ fontWeight: 700, color: '#1A1A1A' }}
              formatter={(v, name) => [formatNumber(v), name]}
            />
            <Area
              type="monotone"
              dataKey="actual"
              stroke="#1A1A1A"
              strokeWidth={2.5}
              fill="url(#actualGrad)"
              connectNulls
              dot={{ r: 3, fill: '#1A1A1A', stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              name="Actual"
            />
            <Area
              type="monotone"
              dataKey="forecast"
              stroke="#D4A52A"
              strokeWidth={2.5}
              strokeDasharray="5 4"
              fill="url(#forecastGrad)"
              connectNulls
              dot={{ r: 3, fill: '#D4A52A', stroke: '#fff', strokeWidth: 1.5 }}
              activeDot={{ r: 5 }}
              name="Forecast"
            />
          </AreaChart>
        </ResponsiveContainer>
      </Box>
    </GlassCard>
  );
}

function LegendDot({ color, label }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box
        sx={{
          width: 10,
          height: 10,
          borderRadius: '50%',
          background: color,
          boxShadow: `0 2px 6px ${color}55`,
        }}
      />
      <Typography variant="caption" sx={{ fontWeight: 600, color: 'text.secondary' }}>
        {label}
      </Typography>
    </Stack>
  );
}

// -----------------------------------------------------------------------------
// Typewriter text component
// -----------------------------------------------------------------------------
function TypewriterText({ text, speed = 12 }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 2;
      if (i >= text.length) {
        setDisplayed(text);
        clearInterval(id);
      } else {
        setDisplayed(text.slice(0, i));
      }
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);

  return (
    <Typography
      variant="body1"
      sx={{
        whiteSpace: 'pre-wrap',
        lineHeight: 1.6,
      }}
    >
      {displayed}
      {displayed.length < (text?.length || 0) && (
        <Box
          component="span"
          sx={{
            display: 'inline-block',
            width: 7,
            height: 16,
            ml: 0.25,
            verticalAlign: 'middle',
            background: goldGradient,
            borderRadius: 0.5,
            animation: 'blink 0.9s steps(2) infinite',
            '@keyframes blink': {
              '0%, 100%': { opacity: 1 },
              '50%': { opacity: 0 },
            },
          }}
        />
      )}
    </Typography>
  );
}

// -----------------------------------------------------------------------------
// Utilities
// -----------------------------------------------------------------------------
function normalizeArray(v) {
  if (Array.isArray(v)) return v;
  if (v && Array.isArray(v.items)) return v.items;
  return [];
}

function itemKey(item) {
  if (!item) return '';
  return String(
    item.id || item.product_id || item.sku || item.name || item.title || ''
  );
}

function defaultSummary(prompt, recommended, merch) {
  const counts = [];
  if (recommended.length) counts.push(`${recommended.length} product${recommended.length === 1 ? '' : 's'}`);
  if (merch.length) counts.push(`${merch.length} merchandise item${merch.length === 1 ? '' : 's'}`);
  const tail = counts.length ? counts.join(' and ') : 'a curated set of recommendations';
  return `Based on your question and recent ordering patterns, I've put together ${tail} for you. Review the cards below, adjust quantities to match your local plan, and add what you want directly to your cart.`;
}
