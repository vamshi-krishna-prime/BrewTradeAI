import React from 'react';
import { Box, Typography, Avatar, Stack, Chip } from '@mui/material';
import { motion } from 'framer-motion';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonIcon from '@mui/icons-material/Person';

import { goldGradient } from '../../theme.js';

/**
 * ChatBubble - luxury message bubble for the AI Order Assistant.
 *
 * Props:
 *  - role: 'user' | 'assistant' | 'system'
 *  - children: bubble body (text or rich content)
 *  - timestamp: optional ISO string or Date
 *  - meta: optional small label rendered above the bubble (e.g. "Claude Opus 4.5")
 *  - dense: boolean - tighter padding
 *  - status: 'thinking' | 'done' (assistant only - shows shimmer when thinking)
 */
export default function ChatBubble({
  role = 'assistant',
  children,
  timestamp,
  meta,
  dense = false,
  status = 'done',
}) {
  const isUser = role === 'user';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        width: '100%',
      }}
    >
      <Stack
        direction={isUser ? 'row-reverse' : 'row'}
        spacing={1.5}
        alignItems="flex-start"
        sx={{ maxWidth: { xs: '94%', md: '82%' } }}
      >
        {/* Avatar */}
        <Avatar
          sx={{
            width: 38,
            height: 38,
            flexShrink: 0,
            background: isUser
              ? 'linear-gradient(135deg, #1A1A1A 0%, #3a3a3a 100%)'
              : goldGradient,
            color: isUser ? '#F2C849' : '#1A1A1A',
            boxShadow: isUser
              ? '0 4px 14px rgba(26,26,26,0.30)'
              : '0 6px 18px rgba(212,165,42,0.40)',
            border: '1.5px solid rgba(255,255,255,0.7)',
          }}
        >
          {isUser ? <PersonIcon fontSize="small" /> : <AutoAwesomeIcon fontSize="small" />}
        </Avatar>

        {/* Bubble + meta column */}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          {/* Meta line */}
          {(meta || timestamp) && (
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              justifyContent={isUser ? 'flex-end' : 'flex-start'}
              sx={{ mb: 0.5, px: 0.5 }}
            >
              {meta && !isUser && (
                <Chip
                  size="small"
                  label={meta}
                  sx={{
                    height: 18,
                    fontSize: '0.65rem',
                    fontWeight: 700,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    background: 'rgba(212,165,42,0.12)',
                    color: '#8a5a10',
                    border: '1px solid rgba(212,165,42,0.3)',
                  }}
                />
              )}
              {timestamp && (
                <Typography
                  variant="caption"
                  sx={{
                    color: 'text.secondary',
                    fontSize: '0.7rem',
                    letterSpacing: '0.02em',
                  }}
                >
                  {formatTime(timestamp)}
                </Typography>
              )}
            </Stack>
          )}

          {/* Bubble surface */}
          <Box
            sx={{
              position: 'relative',
              px: dense ? 1.75 : 2.25,
              py: dense ? 1.25 : 1.5,
              borderRadius: 3,
              ...(isUser
                ? {
                    background: goldGradient,
                    color: '#1A1A1A',
                    boxShadow:
                      '0 1px 0 rgba(255,255,255,0.45) inset, 0 10px 28px rgba(212,165,42,0.30)',
                    borderTopRightRadius: 6,
                  }
                : {
                    background: 'rgba(255,255,255,0.78)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(212,165,42,0.22)',
                    boxShadow:
                      '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 28px rgba(26,26,26,0.06)',
                    borderTopLeftRadius: 6,
                    color: 'text.primary',
                  }),
            }}
          >
            {status === 'thinking' ? (
              <ThinkingDots />
            ) : typeof children === 'string' ? (
              <Typography
                variant="body1"
                sx={{
                  whiteSpace: 'pre-wrap',
                  lineHeight: 1.55,
                  fontWeight: isUser ? 600 : 500,
                }}
              >
                {children}
              </Typography>
            ) : (
              children
            )}
          </Box>
        </Box>
      </Stack>
    </motion.div>
  );
}

function ThinkingDots() {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center" sx={{ py: 0.5 }}>
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          animate={{ y: [0, -5, 0], opacity: [0.4, 1, 0.4] }}
          transition={{
            duration: 1.1,
            repeat: Infinity,
            delay: i * 0.18,
            ease: 'easeInOut',
          }}
          style={{
            display: 'inline-block',
            width: 8,
            height: 8,
            borderRadius: '50%',
            background:
              'linear-gradient(135deg, #D4A52A 0%, #F2C849 50%, #E8A33D 100%)',
            boxShadow: '0 2px 8px rgba(212,165,42,0.4)',
          }}
        />
      ))}
      <Typography
        variant="caption"
        sx={{ ml: 1, color: 'text.secondary', fontStyle: 'italic' }}
      >
        Thinking...
      </Typography>
    </Stack>
  );
}

function formatTime(ts) {
  try {
    const d = ts instanceof Date ? ts : new Date(ts);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '';
  }
}
