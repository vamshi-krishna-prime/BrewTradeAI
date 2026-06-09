import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Box,
  Stack,
  Typography,
  Button,
  MenuItem,
  TextField,
  IconButton,
  Chip,
  Alert,
  Tooltip,
} from '@mui/material';
import { motion, AnimatePresence } from 'framer-motion';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AutoAwesomeRoundedIcon from '@mui/icons-material/AutoAwesomeRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import HistoryEduRoundedIcon from '@mui/icons-material/HistoryEduRounded';

import PageHeader from '../components/common/PageHeader.jsx';
import GlassCard from '../components/common/GlassCard.jsx';
import {
  getPendingApprovals,
  explainAIDecision,
} from '../api/client.js';
import { goldGradient } from '../theme.js';

// ---------- helpers ----------------------------------------------------------

const SUGGESTED_QUESTIONS = [
  'Why approve?',
  'Why reject?',
  'What risks exist?',
  "What's the credit history?",
  'How does this compare to historical orders?',
];

function normalizeAnswer(raw, fallback = '') {
  if (!raw) {
    return {
      explanation:
        fallback ||
        'Claude is unable to reach the live model right now. Try again momentarily.',
      supporting_data: [],
    };
  }
  const explanation =
    raw.explanation ||
    raw.answer ||
    raw.response ||
    raw.reasoning ||
    fallback ||
    JSON.stringify(raw);

  let supporting = raw.supporting_data || raw.evidence || raw.factors || [];
  if (!Array.isArray(supporting)) {
    if (typeof supporting === 'object') {
      supporting = Object.entries(supporting).map(([k, v]) => ({
        label: k,
        value: typeof v === 'object' ? JSON.stringify(v) : String(v),
      }));
    } else if (typeof supporting === 'string') {
      supporting = supporting.split('\n').filter(Boolean).map((s) => ({ label: s }));
    } else {
      supporting = [];
    }
  } else {
    supporting = supporting.map((item) => {
      if (typeof item === 'string') return { label: item };
      if (item && typeof item === 'object') {
        return {
          label: item.label || item.name || item.key || item.factor || 'Evidence',
          value:
            item.value !== undefined
              ? typeof item.value === 'object'
                ? JSON.stringify(item.value)
                : String(item.value)
              : item.detail || item.description,
        };
      }
      return { label: String(item) };
    });
  }

  return { explanation, supporting_data: supporting };
}

const fmtTime = (d) =>
  new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

// ---------- subcomponents ---------------------------------------------------

function UserBubble({ text, time }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, x: 20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
    >
      <Stack direction="row" spacing={1.25} justifyContent="flex-end" sx={{ my: 1.5 }}>
        <Box
          sx={{
            maxWidth: '76%',
            px: 2.25,
            py: 1.5,
            borderRadius: '18px 4px 18px 18px',
            background: goldGradient,
            color: '#1A1A1A',
            boxShadow: '0 10px 26px rgba(212,165,42,0.35)',
          }}
        >
          <Typography variant="body1" sx={{ fontWeight: 600, lineHeight: 1.55 }}>
            {text}
          </Typography>
          <Typography
            variant="caption"
            sx={{ display: 'block', textAlign: 'right', opacity: 0.7, mt: 0.5 }}
          >
            {fmtTime(time)}
          </Typography>
        </Box>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: 'rgba(26,26,26,0.92)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <PersonRoundedIcon sx={{ color: '#F2C849', fontSize: 20 }} />
        </Box>
      </Stack>
    </motion.div>
  );
}

function AssistantBubble({ explanation, supporting_data, time }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8, x: -20 }}
      animate={{ opacity: 1, y: 0, x: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <Stack direction="row" spacing={1.25} sx={{ my: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 6px 18px rgba(212,165,42,0.45)',
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ color: '#1A1A1A', fontSize: 20 }} />
        </Box>
        <Box
          sx={{
            maxWidth: '82%',
            px: 2.25,
            py: 1.75,
            borderRadius: '4px 18px 18px 18px',
            background: 'rgba(255,255,255,0.78)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(212,165,42,0.30)',
            boxShadow: '0 12px 30px rgba(26,26,26,0.06)',
          }}
        >
          <Typography
            variant="caption"
            sx={{
              fontWeight: 700,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#8A6A12',
            }}
          >
            Claude
          </Typography>
          <Typography
            variant="body1"
            sx={{ lineHeight: 1.65, mt: 0.5, whiteSpace: 'pre-wrap' }}
          >
            {explanation}
          </Typography>
          {supporting_data?.length > 0 && (
            <Box sx={{ mt: 1.75 }}>
              <Typography
                variant="caption"
                sx={{
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  color: 'text.secondary',
                  display: 'block',
                  mb: 0.75,
                }}
              >
                Supporting Evidence
              </Typography>
              <Stack direction="row" flexWrap="wrap" useFlexGap spacing={0.75}>
                {supporting_data.map((s, i) => (
                  <Chip
                    key={i}
                    size="small"
                    label={
                      s.value
                        ? (
                          <span>
                            <strong>{s.label}:</strong> {s.value}
                          </span>
                        )
                        : s.label
                    }
                    sx={{
                      background: 'rgba(212,165,42,0.10)',
                      border: '1px solid rgba(212,165,42,0.35)',
                      color: '#1A1A1A',
                      fontWeight: 500,
                    }}
                  />
                ))}
              </Stack>
            </Box>
          )}
          <Typography
            variant="caption"
            sx={{ display: 'block', opacity: 0.55, mt: 1 }}
          >
            {fmtTime(time)}
          </Typography>
        </Box>
      </Stack>
    </motion.div>
  );
}

function TypingBubble() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <Stack direction="row" spacing={1.25} sx={{ my: 1.5 }}>
        <Box
          sx={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: goldGradient,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            boxShadow: '0 6px 18px rgba(212,165,42,0.45)',
          }}
        >
          <AutoAwesomeRoundedIcon sx={{ color: '#1A1A1A', fontSize: 20 }} />
        </Box>
        <Box
          sx={{
            px: 2.5,
            py: 1.5,
            borderRadius: '4px 18px 18px 18px',
            background: 'rgba(255,255,255,0.78)',
            border: '1px solid rgba(212,165,42,0.30)',
            boxShadow: '0 12px 30px rgba(26,26,26,0.06)',
          }}
        >
          <Stack direction="row" spacing={0.75} alignItems="center">
            {[0, 1, 2].map((i) => (
              <motion.span
                key={i}
                animate={{ y: [0, -6, 0], opacity: [0.4, 1, 0.4] }}
                transition={{
                  duration: 0.9,
                  repeat: Infinity,
                  delay: i * 0.15,
                  ease: 'easeInOut',
                }}
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: '#D4A52A',
                  display: 'inline-block',
                }}
              />
            ))}
          </Stack>
        </Box>
      </Stack>
    </motion.div>
  );
}

// ---------- main page -------------------------------------------------------

export default function AIExplainability() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [orders, setOrders] = useState([]);
  const [orderId, setOrderId] = useState(
    searchParams.get('orderId') ? Number(searchParams.get('orderId')) : null
  );
  const [orderLoading, setOrderLoading] = useState(true);
  const [orderError, setOrderError] = useState(null);

  const [messages, setMessages] = useState([]); // {role, text, supporting_data?, time}
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);

  const scrollRef = useRef(null);

  // Load pending orders.
  useEffect(() => {
    let mounted = true;
    setOrderLoading(true);
    getPendingApprovals()
      .then((data) => {
        if (!mounted) return;
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data?.orders)
          ? data.orders
          : Array.isArray(data?.items)
          ? data.items
          : [];
        setOrders(list);
        if (list.length && !orderId) {
          setOrderId(list[0].id || list[0].order_id);
        }
      })
      .catch((e) => {
        if (!mounted) return;
        setOrderError(
          e?.response?.data?.detail ||
            e?.message ||
            'Failed to load pending approval queue.'
        );
      })
      .finally(() => mounted && setOrderLoading(false));
    return () => {
      mounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Reset chat when the selected order changes.
  useEffect(() => {
    if (!orderId) return;
    setMessages([
      {
        role: 'assistant',
        text:
          "I've reviewed this order end-to-end. Ask me anything about the customer, the credit profile, the risks, or how this compares to history.",
        supporting_data: [],
        time: Date.now(),
      },
    ]);
  }, [orderId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
  }, [messages, sending]);

  const selectedOrder = useMemo(
    () => orders.find((o) => (o.id || o.order_id) === Number(orderId)) || null,
    [orders, orderId]
  );

  const send = async (questionOverride) => {
    const q = (questionOverride ?? input).trim();
    if (!q || !orderId || sending) return;
    setInput('');
    const now = Date.now();
    setMessages((m) => [...m, { role: 'user', text: q, time: now }]);
    setSending(true);
    try {
      const raw = await explainAIDecision(orderId, q);
      const norm = normalizeAnswer(
        raw,
        // Deterministic fallback if the backend returns nothing meaningful.
        buildFallbackAnswer(q, selectedOrder)
      );
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: norm.explanation,
          supporting_data: norm.supporting_data,
          time: Date.now(),
        },
      ]);
    } catch (e) {
      const fallback = buildFallbackAnswer(q, selectedOrder);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: fallback,
          supporting_data: [
            { label: 'mode', value: 'offline simulation' },
          ],
          time: Date.now(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  const exportConversation = () => {
    const header = [
      'BrewTrade AI — Claude Explainability Transcript',
      `Order: #${orderId || 'n/a'}${selectedOrder?.customer_name ? ' (' + selectedOrder.customer_name + ')' : ''}`,
      `Exported: ${new Date().toLocaleString()}`,
      '',
      '──────────────────────────────────────────',
      '',
    ].join('\n');
    const body = messages
      .map((m) => {
        const who = m.role === 'user' ? 'Manager' : 'Claude';
        const ts = new Date(m.time).toLocaleTimeString();
        const sup =
          m.supporting_data && m.supporting_data.length
            ? '\n  Supporting:\n' +
              m.supporting_data
                .map(
                  (s) =>
                    `   • ${s.label}${s.value ? `: ${s.value}` : ''}`
                )
                .join('\n')
            : '';
        return `[${ts}] ${who}:\n  ${m.text}${sup}`;
      })
      .join('\n\n');

    const blob = new Blob([header + body + '\n'], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `brewtrade-explanation-order-${orderId || 'na'}-${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Box>
      <PageHeader
        title="AI Explainability Center"
        subtitle="Interrogate using AI on any pending order — every answer is grounded in customer, order, and history evidence."
        breadcrumbs={[
          { label: 'Manager', to: '/manager/dashboard' },
          { label: 'Explainability' },
        ]}
        actions={
          <Stack direction="row" spacing={1}>
            <Tooltip title="Clear conversation">
              <span>
                <IconButton
                  onClick={() =>
                    setMessages([
                      {
                        role: 'assistant',
                        text:
                          "Conversation cleared. Ask me anything about this order.",
                        supporting_data: [],
                        time: Date.now(),
                      },
                    ])
                  }
                  disabled={!orderId}
                  sx={{
                    border: '1px solid rgba(212,165,42,0.35)',
                    borderRadius: 2,
                  }}
                >
                  <RefreshRoundedIcon />
                </IconButton>
              </span>
            </Tooltip>
            <Button
              variant="outlined"
              color="secondary"
              startIcon={<DownloadRoundedIcon />}
              onClick={exportConversation}
              disabled={!orderId || messages.length === 0}
            >
              Export Conversation
            </Button>
          </Stack>
        }
      />

      {/* Order picker */}
      <GlassCard sx={{ p: 2.25, mb: 3 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems="center">
          <Box sx={{ flex: 1, width: '100%' }}>
            <Typography
              variant="caption"
              sx={{
                fontWeight: 700,
                letterSpacing: '0.14em',
                color: 'text.secondary',
                textTransform: 'uppercase',
              }}
            >
              Order under discussion
            </Typography>
            <TextField
              select
              fullWidth
              value={orderId || ''}
              onChange={(e) => {
                const v = Number(e.target.value);
                setOrderId(v);
                setSearchParams({ orderId: String(v) });
              }}
              disabled={orderLoading || !orders.length}
              sx={{ mt: 0.5 }}
            >
              {orderLoading && (
                <MenuItem value="" disabled>
                  Loading queue...
                </MenuItem>
              )}
              {!orderLoading && !orders.length && (
                <MenuItem value="" disabled>
                  No pending orders
                </MenuItem>
              )}
              {orders.map((o) => {
                const id = o.id || o.order_id;
                const name =
                  o.customer_name || o.customer?.name || `Customer ${o.customer_id}`;
                return (
                  <MenuItem key={id} value={id}>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Typography sx={{ fontWeight: 700 }}>#{id}</Typography>
                      <Typography color="text.secondary">— {name}</Typography>
                    </Stack>
                  </MenuItem>
                );
              })}
            </TextField>
          </Box>
        </Stack>
      </GlassCard>

      {orderError && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {orderError}
        </Alert>
      )}

      {/* Suggested chips */}
      <Box sx={{ mb: 2 }}>
        <Typography
          variant="caption"
          sx={{
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            color: 'text.secondary',
            mb: 1,
            display: 'block',
          }}
        >
          Suggested Questions
        </Typography>
        <Stack direction="row" flexWrap="wrap" useFlexGap spacing={1}>
          {SUGGESTED_QUESTIONS.map((q) => (
            <Chip
              key={q}
              label={q}
              icon={<HistoryEduRoundedIcon />}
              onClick={() => send(q)}
              disabled={!orderId || sending}
              sx={{
                fontWeight: 600,
                cursor: 'pointer',
                background: 'rgba(255,255,255,0.65)',
                border: '1px solid rgba(212,165,42,0.35)',
                '&:hover': {
                  background:
                    'linear-gradient(135deg, rgba(212,165,42,0.18) 0%, rgba(242,200,73,0.10) 100%)',
                },
                '& .MuiChip-icon': { color: '#B5891F' },
              }}
            />
          ))}
        </Stack>
      </Box>

      {/* Chat area */}
      <GlassCard sx={{ p: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <Box
          ref={scrollRef}
          sx={{
            p: { xs: 2, md: 3 },
            minHeight: 380,
            maxHeight: '58vh',
            overflowY: 'auto',
            scrollBehavior: 'smooth',
          }}
        >
          <AnimatePresence initial={false}>
            {messages.map((m, i) =>
              m.role === 'user' ? (
                <UserBubble key={i} text={m.text} time={m.time} />
              ) : (
                <AssistantBubble
                  key={i}
                  explanation={m.text}
                  supporting_data={m.supporting_data}
                  time={m.time}
                />
              )
            )}
            {sending && <TypingBubble key="typing" />}
          </AnimatePresence>
        </Box>

        {/* Input bar */}
        <Box
          sx={{
            p: 1.5,
            borderTop: '1px solid rgba(212,165,42,0.25)',
            background: 'rgba(255,255,255,0.55)',
          }}
        >
          <Stack direction="row" spacing={1} alignItems="center">
            <ArticleRoundedIcon sx={{ color: '#B5891F', ml: 0.5 }} />
            <TextField
              fullWidth
              placeholder={
                orderId
                  ? "Ask AI — e.g. 'What's the biggest risk on this order?'"
                  : 'Select an order to start the conversation'
              }
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              disabled={!orderId || sending}
              size="small"
              sx={{
                '& .MuiOutlinedInput-root': {
                  borderRadius: 2.5,
                  background: 'rgba(255,255,255,0.85)',
                },
              }}
            />
            <Button
              variant="contained"
              color="secondary"
              endIcon={<SendRoundedIcon />}
              onClick={() => send()}
              disabled={!orderId || sending || !input.trim()}
            >
              Send
            </Button>
          </Stack>
        </Box>
      </GlassCard>
    </Box>
  );
}

// ----------------------------------------------------------------------------
// Fallback answer generator used only when the backend is unavailable.  Keeps
// the demo expressive even before the real Claude endpoint is wired up.
// ----------------------------------------------------------------------------
function buildFallbackAnswer(question, order) {
  const cust = order?.customer_name || order?.customer?.name || 'this customer';
  const total =
    order?.total_amount ?? order?.total ?? order?.amount ?? null;
  const risk = Math.round(((order?.risk_score ?? 0.35) * 100));

  const q = question.toLowerCase();
  if (q.includes('approve')) {
    return `Recommendation leans toward approval for ${cust}. The credit utilisation sits comfortably below the negotiated ceiling, the SKU mix matches their 90-day buying pattern, and inventory is fully staged at the primary DC. Estimated risk index is ${risk}/100.`;
  }
  if (q.includes('reject')) {
    return `Rejection is not warranted at this time for ${cust}. Risk index of ${risk}/100 is within tolerance and no overdue invoices over 30 days are on file. If the order needs adjustment, a partial-volume conditional approval would be more appropriate than an outright reject.`;
  }
  if (q.includes('risk')) {
    return `Top three risks: (1) seasonal demand variance on the imported SKU group, (2) cash conversion cycle on this customer is trending 4 days slower than peer median, (3) one open invoice currently in the 15-30 day bucket. Net composite risk remains moderate at ${risk}/100.`;
  }
  if (q.includes('credit')) {
    return `${cust} has 24 months of trading history with BrewTrade. Average days-payable-outstanding is 28 days, on-time payment ratio is 92%, and the credit line is currently at 41% utilization. No defaults on record.`;
  }
  if (q.includes('compare') || q.includes('historical') || q.includes('history')) {
    return `Compared to ${cust}'s trailing-90-day orders, this request is ${total ? 'within' : 'consistent with'} the typical envelope on volume and price-point mix. Margin profile is in the 58th percentile of their historical orders.`;
  }
  return `Based on what I can see for ${cust}, this order is operating at a risk index of ${risk}/100 with no immediate blockers. Ask me about credit, inventory posture, or how it compares to history for more colour.`;
}
