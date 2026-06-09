/**
 * CaribBreweryLanding.jsx
 * -----------------------------------------------------------------------------
 * Public entry point of the app (mounted at "/").
 *
 * Layout: a neon-glass Header, the full landing artwork as the body, and a
 * matching Footer.  The living-background effects (rising golden dust, falling
 * condensation droplets, drifting bokeh and a cursor glow that nearby particles
 * are attracted toward) are rendered on a fixed Canvas 2D layer behind it all.
 *
 * The "Distributor Portal" button and CTAs route to /login (LoginPage).
 *
 * NOTE: drop the landing artwork (the attached image) at:
 *       frontend/public/carib-landing.png
 *       (Vite serves /public at the site root, so it loads from /carib-landing.png)
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const C = {
  gold: '#D4A52A',
  amber: '#F0A500',
  copper: '#B87333',
  blue: '#00E5FF',
  black: '#050505',
  navy: '#07111F',
  goldGrad: 'linear-gradient(135deg, #F2C849 0%, #D4A52A 45%, #B87333 100%)',
};
const DISPLAY_FONT = "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Place the attached landing artwork here -> frontend/public/carib-landing.png
const LANDING_IMAGE = '/carib-landing.png';

// ===========================================================================
// Background field — bokeh, golden dust, droplets + cursor glow (Canvas 2D)
// ===========================================================================
function BackgroundFX() {
  const canvasRef = useRef(null);
  const mouse = useRef({ x: -9999, y: -9999, active: false });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    let raf;
    let w = 0;
    let h = 0;
    let dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    const rnd = (a, b) => a + Math.random() * (b - a);

    // Soft bokeh orbs
    const bokeh = Array.from({ length: 14 }, () => ({
      x: rnd(0, w),
      y: rnd(0, h),
      r: rnd(40, 150),
      vx: rnd(-0.12, 0.12),
      vy: rnd(-0.18, 0.06),
      hue: Math.random() > 0.35 ? 'gold' : 'blue',
      a: rnd(0.04, 0.12),
    }));

    // Fine golden dust particles
    const dust = Array.from({ length: 90 }, () => ({
      x: rnd(0, w),
      y: rnd(0, h),
      r: rnd(0.6, 2.2),
      vx: rnd(-0.15, 0.15),
      vy: rnd(-0.5, -0.08),
      a: rnd(0.2, 0.8),
    }));

    // Falling condensation droplets
    const drops = Array.from({ length: 26 }, () => ({
      x: rnd(0, w),
      y: rnd(0, h),
      len: rnd(8, 22),
      vy: rnd(0.6, 1.8),
      a: rnd(0.05, 0.22),
    }));

    const onMove = (e) => {
      mouse.current.x = e.clientX;
      mouse.current.y = e.clientY;
      mouse.current.active = true;
    };
    const onLeave = () => {
      mouse.current.active = false;
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseout', onLeave);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';

      // Bokeh
      bokeh.forEach((b) => {
        b.x += b.vx;
        b.y += b.vy;
        if (b.x < -200) b.x = w + 200;
        if (b.x > w + 200) b.x = -200;
        if (b.y < -200) b.y = h + 200;
        if (b.y > h + 200) b.y = -200;
        const g = ctx.createRadialGradient(b.x, b.y, 0, b.x, b.y, b.r);
        const col = b.hue === 'gold' ? '212,165,42' : '0,229,255';
        g.addColorStop(0, `rgba(${col},${b.a})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Dust + cursor attraction
      const m = mouse.current;
      dust.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;
        if (m.active) {
          const dx = m.x - p.x;
          const dy = m.y - p.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < 24000) {
            const f = (1 - d2 / 24000) * 0.06;
            p.x += dx * f;
            p.y += dy * f;
          }
        }
        if (p.y < -10) {
          p.y = h + 10;
          p.x = rnd(0, w);
        }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        ctx.fillStyle = `rgba(242,200,73,${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });

      // Droplets
      ctx.strokeStyle = 'rgba(0,229,255,0.25)';
      drops.forEach((d) => {
        d.y += d.vy;
        if (d.y > h + 20) {
          d.y = -20;
          d.x = rnd(0, w);
        }
        ctx.globalAlpha = d.a;
        ctx.beginPath();
        ctx.moveTo(d.x, d.y);
        ctx.lineTo(d.x, d.y + d.len);
        ctx.lineWidth = 1.4;
        ctx.stroke();
      });
      ctx.globalAlpha = 1;

      // Cursor golden glow
      if (m.active) {
        const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, 160);
        g.addColorStop(0, 'rgba(242,200,73,0.16)');
        g.addColorStop(0.4, 'rgba(212,165,42,0.07)');
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(m.x, m.y, 160, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, []);

  return (
    <Box
      component="canvas"
      ref={canvasRef}
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 0,
        pointerEvents: 'none',
      }}
    />
  );
}

// ===========================================================================
// Reusable atoms
// ===========================================================================
function NeonButton({ children, variant = 'solid', onClick, startIcon, endIcon, sx = {} }) {
  const solid = variant === 'solid';
  return (
    <Box
      component={motion.button}
      onClick={onClick}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.97 }}
      sx={{
        cursor: 'pointer',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 1,
        px: 3,
        py: 1.4,
        borderRadius: 999,
        fontFamily: DISPLAY_FONT,
        fontWeight: 700,
        letterSpacing: '0.06em',
        textTransform: 'uppercase',
        fontSize: '0.82rem',
        color: solid ? '#1A1208' : C.gold,
        background: solid ? C.goldGrad : 'rgba(212,165,42,0.04)',
        border: solid
          ? '1px solid rgba(242,200,73,0.6)'
          : '1px solid rgba(212,165,42,0.55)',
        boxShadow: solid
          ? '0 0 22px rgba(212,165,42,0.55), inset 0 0 12px rgba(255,255,255,0.25)'
          : '0 0 16px rgba(212,165,42,0.18)',
        backdropFilter: 'blur(6px)',
        transition: 'box-shadow .25s',
        '&:hover': {
          boxShadow: solid
            ? '0 0 34px rgba(242,200,73,0.8)'
            : '0 0 26px rgba(212,165,42,0.45)',
        },
        ...sx,
      }}
    >
      {startIcon}
      {children}
      {endIcon}
    </Box>
  );
}

function CaribLogo({ size = 40 }) {
  return (
    <Stack direction="row" spacing={1.2} alignItems="center">
      <Box
        component="svg"
        viewBox="0 0 64 64"
        sx={{ width: size, height: size, filter: 'drop-shadow(0 0 8px rgba(242,200,73,0.7))' }}
      >
        <defs>
          <radialGradient id="sun" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFE9A8" />
            <stop offset="100%" stopColor="#D4A52A" />
          </radialGradient>
        </defs>
        <circle cx="32" cy="34" r="12" fill="url(#sun)" />
        {Array.from({ length: 12 }).map((_, i) => {
          const ang = (i / 12) * Math.PI * 2;
          const x1 = 32 + Math.cos(ang) * 16;
          const y1 = 34 + Math.sin(ang) * 16;
          const x2 = 32 + Math.cos(ang) * 22;
          const y2 = 34 + Math.sin(ang) * 22;
          return (
            <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#F2C849" strokeWidth="2.4" strokeLinecap="round" />
          );
        })}
      </Box>
      <Box sx={{ lineHeight: 0.9 }}>
        <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 900, fontSize: '1.5rem', color: '#fff', lineHeight: 0.9 }}>
          Carib
        </Typography>
        <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: '0.6rem', letterSpacing: '0.42em', color: C.gold }}>
          BREWERY
        </Typography>
      </Box>
    </Stack>
  );
}

// ===========================================================================
// HEADER
// ===========================================================================
const NAV = ['HOME', 'OUR STORY', 'PRODUCTS', 'MERCH', 'PROMOTIONS', 'EVENTS', 'RECOGNITIONS', 'PARTNERS'];

function Header({ onPortal }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const toTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  return (
    <Box
      component={motion.header}
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.7, ease: 'easeOut' }}
      sx={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        px: { xs: 2, md: 5 },
        py: scrolled ? 1 : 1.6,
        display: 'flex',
        alignItems: 'center',
        gap: 2,
        background: scrolled ? 'rgba(5,8,14,0.78)' : 'rgba(5,8,14,0.32)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(212,165,42,0.18)',
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
        transition: 'all .35s',
      }}
    >
      <Box sx={{ cursor: 'pointer' }} onClick={toTop}>
        <CaribLogo />
      </Box>
      <Stack
        direction="row"
        spacing={2.4}
        sx={{ flex: 1, justifyContent: 'center', display: { xs: 'none', lg: 'flex' } }}
      >
        {NAV.map((label) => (
          <Typography
            key={label}
            component={motion.span}
            whileHover={{ y: -2 }}
            onClick={toTop}
            sx={{
              cursor: 'pointer',
              fontFamily: DISPLAY_FONT,
              fontWeight: 600,
              fontSize: '0.74rem',
              letterSpacing: '0.12em',
              color: label === 'HOME' ? C.gold : 'rgba(255,255,255,0.78)',
              textShadow: label === 'HOME' ? '0 0 12px rgba(212,165,42,0.6)' : 'none',
              '&:hover': { color: C.gold },
            }}
          >
            {label}
          </Typography>
        ))}
      </Stack>
      <Box sx={{ ml: 'auto' }}>
        <NeonButton variant="outline" onClick={onPortal} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}>
          Distributor Portal
        </NeonButton>
      </Box>
    </Box>
  );
}

// ===========================================================================
// FOOTER
// ===========================================================================
function Footer({ onPortal }) {
  const cols = [
    ['EXPLORE', ['Our Story', 'Products', 'Merch', 'Promotions', 'Events']],
    ['COMPANY', ['About Carib', 'Sustainability', 'Careers', 'Press', 'Partners']],
    ['CONNECT', ['Instagram', 'Facebook', 'X / Twitter', 'YouTube', 'LinkedIn']],
  ];
  return (
    <Box
      component="footer"
      sx={{
        position: 'relative',
        zIndex: 1,
        borderTop: '1px solid rgba(212,165,42,0.2)',
        background: 'rgba(4,6,10,0.85)',
        px: { xs: 3, md: 6 },
        py: 6,
      }}
    >
      <Box sx={{ maxWidth: 1320, mx: 'auto', display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'space-between' }}>
        <Box sx={{ maxWidth: 320 }}>
          <CaribLogo />
          <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.6)', fontSize: '0.82rem', lineHeight: 1.7 }}>
            Brewed for the bold, enjoyed worldwide. Proudly crafting Caribbean
            excellence since 1950.
          </Typography>
          <Box sx={{ mt: 2 }}>
            <NeonButton variant="outline" onClick={onPortal} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}>
              Distributor Portal
            </NeonButton>
          </Box>
        </Box>
        {cols.map(([head, items]) => (
          <Box key={head}>
            <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 800, letterSpacing: '0.16em', fontSize: '0.72rem', color: C.gold, mb: 1.5 }}>
              {head}
            </Typography>
            <Stack spacing={1}>
              {items.map((it) => (
                <Typography key={it} sx={{ color: 'rgba(255,255,255,0.62)', fontSize: '0.82rem', cursor: 'pointer', '&:hover': { color: C.gold } }}>
                  {it}
                </Typography>
              ))}
            </Stack>
          </Box>
        ))}
      </Box>
      <Box sx={{ maxWidth: 1320, mx: 'auto', mt: 5, pt: 3, borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 1 }}>
        <Typography sx={{ color: 'rgba(255,255,255,0.45)', fontSize: '0.72rem' }}>
          © {new Date().getFullYear()} Carib Brewery. All rights reserved.
        </Typography>
        <Typography sx={{ color: C.amber, fontSize: '0.72rem', letterSpacing: '0.14em', fontWeight: 700 }}>
          DRINK RESPONSIBLY · 100% CARIBBEAN PRIDE
        </Typography>
      </Box>
    </Box>
  );
}

// ===========================================================================
// PAGE — Header + full landing artwork + Footer (effects in the background)
// ===========================================================================
export default function CaribBreweryLanding() {
  const navigate = useNavigate();
  const goLogin = useCallback(() => navigate('/login'), [navigate]);

  return (
    <Box
      sx={{
        position: 'relative',
        width: '100%',
        minHeight: '100vh',
        overflowX: 'hidden',
        background:
          'radial-gradient(1200px 700px at 80% -5%, rgba(212,165,42,0.10), transparent 60%),' +
          'radial-gradient(900px 600px at 0% 30%, rgba(0,229,255,0.06), transparent 55%),' +
          'linear-gradient(180deg, #07111F 0%, #050505 60%, #050505 100%)',
        color: '#fff',
      }}
    >
      <BackgroundFX />
      <Header onPortal={goLogin} />

      {/* Body — the uploaded landing artwork */}
      <Box
        component={motion.div}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        sx={{
          position: 'relative',
          zIndex: 1,
          pt: { xs: 11, md: 13 },
          pb: { xs: 5, md: 7 },
          px: { xs: 1.5, md: 4 },
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        <Box
          component="img"
          src={LANDING_IMAGE}
          alt="Carib Brewery — Brewed for the bold. Enjoyed worldwide."
          sx={{
            width: '100%',
            maxWidth: 1280,
            height: 'auto',
            display: 'block',
            borderRadius: 3,
            border: '1px solid rgba(212,165,42,0.25)',
            boxShadow: '0 30px 90px rgba(0,0,0,0.6), 0 0 60px rgba(212,165,42,0.10)',
          }}
        />
      </Box>

      <Footer onPortal={goLogin} />
    </Box>
  );
}
