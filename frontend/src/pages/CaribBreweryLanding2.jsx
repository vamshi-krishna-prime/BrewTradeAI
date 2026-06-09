/**
 * CaribBreweryLanding.jsx
 * -----------------------------------------------------------------------------
 * Futuristic premium brewery landing page — the public entry point of the app
 * (mounted at "/").  Built with the project's existing stack (MUI `sx` /
 * emotion + framer-motion) plus dependency-free Canvas 2D for the live
 * holographic globe, floating particles / droplets, bokeh and the cursor glow.
 *
 * Tailwind is intentionally NOT used: its global preflight reset would alter
 * every existing MUI page.  The neon-luxury look is achieved with gradients,
 * text-stroke, layered box-shadows and canvas.
 *
 * The "Distributor Portal" button and primary CTAs route to /login (LoginPage).
 */
import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
  forwardRef,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography, IconButton } from '@mui/material';
import { motion, useInView } from 'framer-motion';

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import SportsBarRoundedIcon from '@mui/icons-material/SportsBarRounded';
import WorkspacePremiumRoundedIcon from '@mui/icons-material/WorkspacePremiumRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';

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
const DISPLAY_FONT =
  "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

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
        const col =
          b.hue === 'gold' ? '212,165,42' : '0,229,255';
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

      // Cursor golden glow + trail
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
// Holographic globe (Canvas 2D — projected sphere of nodes + arcs)
// ===========================================================================
function HoloGlobe({ size = 460 }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return undefined;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    ctx.scale(dpr, dpr);
    const R = size * 0.36;
    const cx = size / 2;
    const cy = size / 2;

    // distribute points on a sphere (fibonacci)
    const N = 320;
    const pts = [];
    for (let i = 0; i < N; i++) {
      const phi = Math.acos(1 - (2 * (i + 0.5)) / N);
      const theta = Math.PI * (1 + Math.sqrt(5)) * i;
      pts.push({
        x: Math.sin(phi) * Math.cos(theta),
        y: Math.cos(phi),
        z: Math.sin(phi) * Math.sin(theta),
      });
    }
    // a few "hub" nodes that pulse + arcs between them
    const hubs = [0, 40, 95, 150, 210, 260, 300].map((i) => pts[i]);

    let rot = 0;
    let raf;
    const draw = () => {
      ctx.clearRect(0, 0, size, size);
      rot += 0.0035;
      const cosR = Math.cos(rot);
      const sinR = Math.sin(rot);
      const proj = (p) => {
        const x = p.x * cosR - p.z * sinR;
        const z = p.x * sinR + p.z * cosR;
        const scale = 1; // orthographic
        return {
          sx: cx + x * R * scale,
          sy: cy + p.y * R * scale,
          depth: z, // -1..1
        };
      };

      // halo
      const halo = ctx.createRadialGradient(cx, cy, R * 0.2, cx, cy, R * 1.5);
      halo.addColorStop(0, 'rgba(0,229,255,0.10)');
      halo.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = halo;
      ctx.fillRect(0, 0, size, size);

      // outline ring
      ctx.strokeStyle = 'rgba(0,229,255,0.35)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, R, 0, Math.PI * 2);
      ctx.stroke();

      // nodes
      pts.forEach((p) => {
        const pr = proj(p);
        const front = (pr.depth + 1) / 2; // 0 back .. 1 front
        const a = 0.15 + front * 0.7;
        const rad = 0.6 + front * 1.6;
        ctx.fillStyle = `rgba(${front > 0.6 ? '120,225,255' : '0,170,210'},${a})`;
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, rad, 0, Math.PI * 2);
        ctx.fill();
      });

      // arcs between hubs (great-circle-ish quadratic)
      ctx.lineWidth = 1.2;
      for (let i = 0; i < hubs.length; i++) {
        const a = proj(hubs[i]);
        const b = proj(hubs[(i + 2) % hubs.length]);
        const front = ((a.depth + b.depth) / 2 + 1) / 2;
        const mx = (a.sx + b.sx) / 2 + (cy - (a.sy + b.sy) / 2) * 0.18;
        const my = (a.sy + b.sy) / 2 - R * 0.18;
        ctx.strokeStyle = `rgba(242,200,73,${0.12 + front * 0.4})`;
        ctx.beginPath();
        ctx.moveTo(a.sx, a.sy);
        ctx.quadraticCurveTo(mx, my, b.sx, b.sy);
        ctx.stroke();
      }

      // pulsing hub glow
      const t = Date.now() / 600;
      hubs.forEach((hp, i) => {
        const pr = proj(hp);
        const front = (pr.depth + 1) / 2;
        const pulse = 0.5 + 0.5 * Math.sin(t + i);
        const g = ctx.createRadialGradient(
          pr.sx,
          pr.sy,
          0,
          pr.sx,
          pr.sy,
          6 + pulse * 6
        );
        g.addColorStop(0, `rgba(242,200,73,${0.5 * front})`);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(pr.sx, pr.sy, 6 + pulse * 6, 0, Math.PI * 2);
        ctx.fill();
      });

      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => cancelAnimationFrame(raf);
  }, [size]);

  return (
    <Box
      component="canvas"
      ref={ref}
      aria-hidden
      sx={{ width: size, height: size, maxWidth: '100%' }}
    />
  );
}

// ===========================================================================
// Count-up hook
// ===========================================================================
function useCountUp(target, run, duration = 1700) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!run) return undefined;
    let raf;
    const t0 = performance.now();
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(target * eased);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run, target, duration]);
  return val;
}

// ===========================================================================
// Reusable presentational atoms
// ===========================================================================
function NeonButton({
  children,
  variant = 'solid',
  onClick,
  startIcon,
  endIcon,
  sx = {},
}) {
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

function SectionTitle({ small, big, sx }) {
  return (
    <Box sx={sx}>
      {small && (
        <Typography
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            letterSpacing: '0.18em',
            fontSize: { xs: '1.4rem', md: '1.9rem' },
            color: C.gold,
            textShadow: '0 0 18px rgba(212,165,42,0.5)',
            lineHeight: 1,
          }}
        >
          {small}
        </Typography>
      )}
      {big && (
        <Typography
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            letterSpacing: '0.12em',
            fontSize: { xs: '2.4rem', md: '3.4rem' },
            color: '#fff',
            lineHeight: 1,
            mt: 0.5,
          }}
        >
          {big}
        </Typography>
      )}
    </Box>
  );
}

// A glassy chambered panel used by several sections
const Glass = forwardRef(function Glass({ children, sx = {}, ...rest }, ref) {
  return (
    <Box
      ref={ref}
      sx={{
        position: 'relative',
        borderRadius: 4,
        background:
          'linear-gradient(160deg, rgba(20,26,38,0.72) 0%, rgba(7,17,31,0.72) 100%)',
        border: '1px solid rgba(212,165,42,0.22)',
        backdropFilter: 'blur(14px)',
        WebkitBackdropFilter: 'blur(14px)',
        boxShadow:
          '0 1px 0 rgba(255,255,255,0.06) inset, 0 30px 60px rgba(0,0,0,0.5)',
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  );
});

// ---------------------------------------------------------------------------
// Carib sun logo (SVG)
// ---------------------------------------------------------------------------
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
            <line
              key={i}
              x1={x1}
              y1={y1}
              x2={x2}
              y2={y2}
              stroke="#F2C849"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          );
        })}
      </Box>
      <Box sx={{ lineHeight: 0.9 }}>
        <Typography
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            fontSize: '1.5rem',
            color: '#fff',
            lineHeight: 0.9,
          }}
        >
          Carib
        </Typography>
        <Typography
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 700,
            fontSize: '0.6rem',
            letterSpacing: '0.42em',
            color: C.gold,
          }}
        >
          BREWERY
        </Typography>
      </Box>
    </Stack>
  );
}

// ---------------------------------------------------------------------------
// Stylised beer bottle (SVG) with colour variants
// ---------------------------------------------------------------------------
const BOTTLE_VARIANTS = {
  lager: { body: '#C9871F', glass: '#7a4f12', accent: '#F2C849', name: 'LAGER' },
  pilsner: { body: '#2E6FB0', glass: '#163a5e', accent: '#7FC4FF', name: 'PILSNER' },
  lite: { body: '#3FA535', glass: '#1d5a18', accent: '#9BE88F', name: 'LITE' },
  shandy: { body: '#E06A1E', glass: '#7a3410', accent: '#FFB36B', name: 'SHANDY' },
  stout: { body: '#1A1A1A', glass: '#0a0a0a', accent: '#D4A52A', name: 'STOUT' },
};

function Bottle({ variant = 'lager', h = 230 }) {
  const v = BOTTLE_VARIANTS[variant] || BOTTLE_VARIANTS.lager;
  const w = h * 0.36;
  return (
    <Box
      component="svg"
      viewBox="0 0 90 260"
      sx={{
        width: w,
        height: h,
        filter: `drop-shadow(0 14px 18px rgba(0,0,0,0.6))`,
      }}
    >
      <defs>
        <linearGradient id={`bg-${variant}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={v.glass} />
          <stop offset="42%" stopColor={v.body} />
          <stop offset="58%" stopColor={v.body} />
          <stop offset="100%" stopColor={v.glass} />
        </linearGradient>
      </defs>
      {/* cap */}
      <rect x="36" y="2" width="18" height="12" rx="2" fill={v.accent} />
      {/* neck */}
      <path d="M38 14 h14 v22 q10 6 10 24 v176 a10 10 0 0 1 -10 10 h-14 a10 10 0 0 1 -10 -10 v-176 q0 -18 10 -24 z" fill={`url(#bg-${variant})`} stroke="rgba(255,255,255,0.18)" strokeWidth="1" />
      {/* glossy highlight */}
      <rect x="33" y="70" width="5" height="150" rx="2.5" fill="rgba(255,255,255,0.30)" />
      {/* label */}
      <rect x="24" y="120" width="42" height="74" rx="6" fill="#0d1626" stroke={v.accent} strokeWidth="1.4" opacity="0.96" />
      <circle cx="45" cy="142" r="9" fill={v.accent} opacity="0.9" />
      <text x="45" y="166" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="11" fontWeight="800" fill="#fff">Carib</text>
      <text x="45" y="182" textAnchor="middle" fontFamily="Inter, sans-serif" fontSize="6.5" fontWeight="700" letterSpacing="1.5" fill={v.accent}>{v.name}</text>
    </Box>
  );
}

// ---------------------------------------------------------------------------
// Award medal (SVG)
// ---------------------------------------------------------------------------
function Medal({ tone = 'gold' }) {
  const map = {
    gold: ['#FCE9A0', '#D4A52A', '#9C7517'],
    silver: ['#F3F5F8', '#C7CDD6', '#8A93A0'],
  };
  const [a, b, c] = map[tone] || map.gold;
  return (
    <Box
      component={motion.div}
      whileHover={{ scale: 1.12, rotate: 4 }}
      sx={{ position: 'relative', display: 'inline-flex' }}
    >
      <Box
        component="svg"
        viewBox="0 0 64 64"
        sx={{ width: 54, height: 54, filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.5))' }}
      >
        <defs>
          <radialGradient id={`m-${tone}`} cx="40%" cy="35%" r="70%">
            <stop offset="0%" stopColor={a} />
            <stop offset="55%" stopColor={b} />
            <stop offset="100%" stopColor={c} />
          </radialGradient>
        </defs>
        <path d="M22 6 l8 22 h4 l8-22 z" fill={b} opacity="0.7" />
        <circle cx="32" cy="40" r="20" fill={`url(#m-${tone})`} stroke="rgba(255,255,255,0.5)" strokeWidth="1" />
        <path
          d="M32 28 l3.2 6.6 7.3 1 -5.3 5.1 1.3 7.2 -6.5-3.4 -6.5 3.4 1.3-7.2 -5.3-5.1 7.3-1 z"
          fill="#fff"
          opacity="0.92"
        />
      </Box>
      {/* shine sweep on hover */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background:
            'linear-gradient(115deg, transparent 35%, rgba(255,255,255,0.65) 50%, transparent 65%)',
          backgroundSize: '250% 250%',
          backgroundPosition: '120% 0',
          transition: 'background-position .6s',
          pointerEvents: 'none',
          '*:hover > &': { backgroundPosition: '-40% 0' },
        }}
      />
    </Box>
  );
}

// ===========================================================================
// HEADER
// ===========================================================================
const NAV = [
  ['HOME', 'home'],
  ['OUR STORY', 'home'],
  ['PRODUCTS', 'products'],
  ['MERCH', 'merch'],
  ['PROMOTIONS', 'promotions'],
  ['EVENTS', 'events'],
  ['RECOGNITIONS', 'recognitions'],
  ['PARTNERS', 'partners'],
];

function Header({ onPortal }) {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const go = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };
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
        background: scrolled
          ? 'rgba(5,8,14,0.78)'
          : 'rgba(5,8,14,0.32)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(212,165,42,0.18)',
        boxShadow: scrolled ? '0 10px 30px rgba(0,0,0,0.5)' : 'none',
        transition: 'all .35s',
      }}
    >
      <Box sx={{ cursor: 'pointer' }} onClick={() => go('home')}>
        <CaribLogo />
      </Box>
      <Stack
        direction="row"
        spacing={2.4}
        sx={{
          flex: 1,
          justifyContent: 'center',
          display: { xs: 'none', lg: 'flex' },
        }}
      >
        {NAV.map(([label, id]) => (
          <Typography
            key={label}
            component={motion.span}
            whileHover={{ y: -2 }}
            onClick={() => go(id)}
            sx={{
              cursor: 'pointer',
              fontFamily: DISPLAY_FONT,
              fontWeight: 600,
              fontSize: '0.74rem',
              letterSpacing: '0.12em',
              color: label === 'HOME' ? C.gold : 'rgba(255,255,255,0.78)',
              textShadow:
                label === 'HOME' ? '0 0 12px rgba(212,165,42,0.6)' : 'none',
              '&:hover': { color: C.gold },
            }}
          >
            {label}
          </Typography>
        ))}
      </Stack>
      <Box sx={{ ml: 'auto' }}>
        <NeonButton
          variant="outline"
          onClick={onPortal}
          endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}
        >
          Distributor Portal
        </NeonButton>
      </Box>
    </Box>
  );
}

// ===========================================================================
// HERO
// ===========================================================================
function FloatingTag({ title, value, sub, sx }) {
  return (
    <Box
      component={motion.div}
      animate={{ y: [0, -10, 0] }}
      transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
      sx={{
        position: 'absolute',
        px: 1.8,
        py: 1.2,
        borderRadius: 2,
        minWidth: 130,
        background: 'rgba(7,17,31,0.7)',
        border: '1px solid rgba(0,229,255,0.4)',
        boxShadow: '0 0 24px rgba(0,229,255,0.25)',
        backdropFilter: 'blur(10px)',
        ...sx,
      }}
    >
      <Typography sx={{ fontSize: '0.55rem', letterSpacing: '0.18em', color: C.blue, fontWeight: 700 }}>
        {title}
      </Typography>
      <Typography sx={{ fontSize: '1.5rem', fontWeight: 900, color: C.gold, lineHeight: 1, fontFamily: DISPLAY_FONT }}>
        {value}
      </Typography>
      <Typography sx={{ fontSize: '0.55rem', letterSpacing: '0.16em', color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>
        {sub}
      </Typography>
    </Box>
  );
}

function Hero({ onExplore }) {
  return (
    <Box
      id="home"
      sx={{
        position: 'relative',
        zIndex: 1,
        pt: { xs: 16, md: 18 },
        pb: { xs: 8, md: 10 },
        px: { xs: 2, md: 6 },
        maxWidth: 1320,
        mx: 'auto',
        display: 'flex',
        alignItems: 'center',
        flexWrap: { xs: 'wrap', md: 'nowrap' },
        gap: { xs: 4, md: 2 },
        minHeight: { md: '92vh' },
      }}
    >
      {/* LEFT — bottle */}
      <Box
        sx={{
          flex: { xs: '1 1 100%', md: '0 0 22%' },
          display: 'flex',
          justifyContent: 'center',
          position: 'relative',
          order: { xs: 2, md: 1 },
        }}
      >
        <Box
          component={motion.div}
          animate={{ y: [0, -14, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          sx={{ position: 'relative' }}
        >
          <Box
            sx={{
              position: 'absolute',
              inset: '-10% -30%',
              background:
                'radial-gradient(circle, rgba(212,165,42,0.35) 0%, transparent 65%)',
              filter: 'blur(10px)',
            }}
          />
          <Box sx={{ position: 'relative' }}>
            <Bottle variant="lager" h={360} />
          </Box>
        </Box>
        {/* mini analytics card */}
        <Glass
          component={motion.div}
          animate={{ y: [0, -8, 0] }}
          transition={{ duration: 5.5, repeat: Infinity, ease: 'easeInOut' }}
          sx={{
            position: 'absolute',
            bottom: '12%',
            right: { md: '-6%' },
            p: 1.4,
            width: 130,
            display: { xs: 'none', md: 'block' },
          }}
        >
          <Typography sx={{ fontSize: '0.52rem', letterSpacing: '0.16em', color: C.blue, fontWeight: 800 }}>
            CARIB. UNITED. WORLDWIDE.
          </Typography>
          <Stack direction="row" spacing={0.5} alignItems="flex-end" sx={{ mt: 1, height: 36 }}>
            {[14, 22, 16, 28, 20, 32, 24, 30].map((v, i) => (
              <Box
                key={i}
                component={motion.div}
                animate={{ scaleY: [0.6, 1, 0.6] }}
                transition={{ duration: 2 + i * 0.2, repeat: Infinity }}
                sx={{
                  width: 6,
                  height: v,
                  transformOrigin: 'bottom',
                  borderRadius: 0.5,
                  background: C.goldGrad,
                }}
              />
            ))}
          </Stack>
        </Glass>
      </Box>

      {/* CENTER — copy */}
      <Box
        sx={{
          flex: { xs: '1 1 100%', md: '1 1 46%' },
          textAlign: 'center',
          order: { xs: 1, md: 2 },
          px: { md: 2 },
        }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
        >
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              letterSpacing: '0.4em',
              fontSize: { xs: '0.9rem', md: '1.25rem' },
              color: C.gold,
              textShadow: '0 0 16px rgba(212,165,42,0.6)',
            }}
          >
            WELCOME TO
          </Typography>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 900,
              fontSize: { xs: '3.6rem', sm: '5rem', md: '7rem' },
              lineHeight: 0.92,
              letterSpacing: { xs: '0.06em', md: '0.12em' },
              color: 'transparent',
              WebkitTextStroke: '2px #F0A500',
              textShadow:
                '0 0 22px rgba(240,165,0,0.85), 0 0 55px rgba(212,165,42,0.5)',
              mt: 0.5,
            }}
          >
            CARIB
          </Typography>
          <Typography
            sx={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 800,
              fontSize: { xs: '1.6rem', md: '2.6rem' },
              letterSpacing: { xs: '0.4em', md: '0.62em' },
              color: '#fff',
              textShadow: '0 0 18px rgba(255,255,255,0.35)',
              ml: { md: '0.5em' },
            }}
          >
            BREWERY
          </Typography>

          <Typography
            sx={{
              mt: 2.5,
              fontFamily: DISPLAY_FONT,
              fontWeight: 700,
              letterSpacing: '0.18em',
              fontSize: { xs: '0.9rem', md: '1.05rem' },
              color: C.amber,
            }}
          >
            BREWED FOR THE BOLD. ENJOYED WORLDWIDE.
          </Typography>
          <Typography
            sx={{
              mt: 1.5,
              color: 'rgba(255,255,255,0.72)',
              fontSize: { xs: '0.85rem', md: '0.95rem' },
              lineHeight: 1.8,
              maxWidth: 560,
              mx: 'auto',
            }}
          >
            From the heart of the Caribbean to the world,
            <br />
            Carib Brewery is a symbol of quality, heritage and innovation.
            <br />
            Proudly brewing excellence since 1950.
          </Typography>

          <Stack
            direction="row"
            spacing={2}
            justifyContent="center"
            sx={{ mt: 4, flexWrap: 'wrap', gap: 1.5 }}
          >
            <NeonButton onClick={onExplore}>Explore Our World</NeonButton>
            <NeonButton
              variant="outline"
              startIcon={<PlayArrowRoundedIcon sx={{ fontSize: 18 }} />}
            >
              Watch Our Story
            </NeonButton>
          </Stack>
        </motion.div>
      </Box>

      {/* RIGHT — globe */}
      <Box
        sx={{
          flex: { xs: '1 1 100%', md: '0 0 30%' },
          position: 'relative',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          order: 3,
          minHeight: { xs: 360, md: 460 },
        }}
      >
        <HoloGlobe size={440} />
        <FloatingTag
          title="GLOBAL REACH"
          value="45+"
          sub="COUNTRIES"
          sx={{ top: '6%', right: { xs: '4%', md: '0%' } }}
        />
        <FloatingTag
          title="ANNUAL PRODUCTION"
          value="2.5M+"
          sub="HECTOLITERS"
          sx={{ bottom: '14%', left: { xs: '2%', md: '-4%' } }}
        />
        {/* full beer glass */}
        <Box
          component={motion.div}
          animate={{ y: [0, -10, 0] }}
          transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
          sx={{
            position: 'absolute',
            bottom: { md: '-4%' },
            right: { md: '-10%' },
            display: { xs: 'none', md: 'block' },
          }}
        >
          <BeerGlass />
        </Box>
      </Box>
    </Box>
  );
}

function BeerGlass({ scale = 1 }) {
  return (
    <Box
      component="svg"
      viewBox="0 0 120 150"
      sx={{ width: 120 * scale, height: 150 * scale, filter: 'drop-shadow(0 0 22px rgba(212,165,42,0.5))' }}
    >
      <defs>
        <linearGradient id="beer" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F8D77A" />
          <stop offset="100%" stopColor="#C9871F" />
        </linearGradient>
      </defs>
      {/* foam */}
      <ellipse cx="55" cy="28" rx="38" ry="16" fill="#FFF6E0" />
      <circle cx="34" cy="24" r="11" fill="#FFF6E0" />
      <circle cx="74" cy="22" r="13" fill="#FFF9EA" />
      {/* glass body */}
      <path d="M22 30 h66 l-6 104 a8 8 0 0 1 -8 7 h-34 a8 8 0 0 1 -8-7 z" fill="url(#beer)" opacity="0.92" />
      {/* handle */}
      <path d="M88 44 q26 4 24 34 q-2 26 -28 28" fill="none" stroke="url(#beer)" strokeWidth="9" strokeLinecap="round" />
      {/* highlight */}
      <rect x="30" y="44" width="6" height="80" rx="3" fill="rgba(255,255,255,0.4)" />
    </Box>
  );
}

// ===========================================================================
// KPI STRIP
// ===========================================================================
const KPIS = [
  { icon: <WorkspacePremiumRoundedIcon />, end: 65, fmt: (n) => `${Math.round(n)}+`, label: 'YEARS OF\nEXCELLENCE' },
  { icon: <PublicRoundedIcon />, end: 45, fmt: (n) => `${Math.round(n)}+`, label: 'COUNTRIES\nSERVED' },
  { icon: <GroupsRoundedIcon />, end: 5000, fmt: (n) => `${Math.round(n)}+`, label: 'PASSIONATE\nPARTNERS' },
  { icon: <SportsBarRoundedIcon />, end: 2.5, fmt: (n) => `${n.toFixed(1)}M+`, label: 'HECTOLITERS\nANNUALLY' },
  { icon: <FavoriteRoundedIcon />, end: 100, fmt: (n) => `${Math.round(n)}%`, label: 'CARIBBEAN\nPRIDE' },
];

function KpiItem({ kpi, run }) {
  const v = useCountUp(kpi.end, run);
  return (
    <Stack
      component={motion.div}
      whileHover={{ y: -6 }}
      alignItems="center"
      spacing={0.6}
      sx={{ flex: 1, minWidth: 120, px: 1 }}
    >
      <Box
        sx={{
          color: C.gold,
          fontSize: 30,
          filter: 'drop-shadow(0 0 10px rgba(212,165,42,0.7))',
          '& svg': { fontSize: 34 },
        }}
      >
        {kpi.icon}
      </Box>
      <Typography
        sx={{
          fontFamily: DISPLAY_FONT,
          fontWeight: 900,
          fontSize: '1.7rem',
          color: '#fff',
          lineHeight: 1,
        }}
      >
        {kpi.fmt(v)}
      </Typography>
      <Typography
        sx={{
          whiteSpace: 'pre-line',
          textAlign: 'center',
          fontSize: '0.62rem',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: 'rgba(255,255,255,0.6)',
          lineHeight: 1.3,
        }}
      >
        {kpi.label}
      </Typography>
    </Stack>
  );
}

function KpiStrip() {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  return (
    <Box id="kpis" sx={{ position: 'relative', zIndex: 2, px: { xs: 2, md: 6 }, mt: { xs: -2, md: -4 } }}>
      <Glass
        ref={ref}
        component={motion.div}
        initial={{ opacity: 0, y: 30 }}
        animate={inView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.7 }}
        sx={{
          maxWidth: 1180,
          mx: 'auto',
          px: { xs: 2, md: 4 },
          py: 3,
          border: '1px solid rgba(212,165,42,0.4)',
          boxShadow: '0 0 50px rgba(212,165,42,0.18), 0 30px 60px rgba(0,0,0,0.5)',
        }}
      >
        <Stack
          direction="row"
          divider={
            <Box sx={{ width: '1px', alignSelf: 'stretch', background: 'rgba(212,165,42,0.25)' }} />
          }
          spacing={{ xs: 1, md: 2 }}
          sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: { xs: 2, md: 0 } }}
        >
          {KPIS.map((k) => (
            <KpiItem key={k.label} kpi={k} run={inView} />
          ))}
        </Stack>
      </Glass>
    </Box>
  );
}

// ===========================================================================
// SECTION WRAPPER (scroll reveal)
// ===========================================================================
function Reveal({ children, sx, id, delay = 0 }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-100px' });
  return (
    <Box
      id={id}
      ref={ref}
      component={motion.div}
      initial={{ opacity: 0, y: 40 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.7, delay }}
      sx={sx}
    >
      {children}
    </Box>
  );
}

// ===========================================================================
// PRODUCTS
// ===========================================================================
function ProductChamber({ variant, delay }) {
  return (
    <Box
      component={motion.div}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.6, delay }}
      whileHover="hover"
      sx={{
        position: 'relative',
        flex: 1,
        minWidth: 140,
        height: 300,
        borderRadius: 3,
        overflow: 'hidden',
        background:
          'linear-gradient(180deg, rgba(212,165,42,0.06) 0%, rgba(7,17,31,0.6) 100%)',
        borderLeft: '1px solid rgba(212,165,42,0.4)',
        borderRight: '1px solid rgba(212,165,42,0.4)',
        boxShadow: 'inset 0 30px 60px rgba(212,165,42,0.08)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-end',
      }}
    >
      {/* top light */}
      <Box
        sx={{
          position: 'absolute',
          top: 0,
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: 60,
          background:
            'radial-gradient(ellipse at center top, rgba(242,200,73,0.55), transparent 70%)',
        }}
      />
      <Box
        component={motion.div}
        variants={{ hover: { y: -16 } }}
        transition={{ type: 'spring', stiffness: 200, damping: 16 }}
        sx={{ position: 'relative', zIndex: 2, mb: 3 }}
      >
        <Bottle variant={variant} h={200} />
      </Box>
      {/* neon base ring */}
      <Box
        component={motion.div}
        variants={{ hover: { opacity: 1 } }}
        sx={{
          position: 'absolute',
          bottom: 26,
          width: '64%',
          height: 18,
          borderRadius: '50%',
          background:
            'radial-gradient(ellipse at center, rgba(242,200,73,0.85), transparent 70%)',
          boxShadow: '0 0 26px rgba(242,200,73,0.8)',
          opacity: 0.75,
        }}
      />
      {/* reflective floor */}
      <Box
        sx={{
          position: 'absolute',
          bottom: 0,
          width: '100%',
          height: 30,
          background:
            'linear-gradient(180deg, rgba(212,165,42,0.18), transparent)',
        }}
      />
    </Box>
  );
}

function Products({ onViewAll }) {
  const variants = ['lager', 'pilsner', 'lite', 'shandy', 'stout'];
  return (
    <Box
      id="products"
      sx={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 1320,
        mx: 'auto',
        px: { xs: 2, md: 6 },
        mt: { xs: 8, md: 12 },
      }}
    >
      <Glass sx={{ p: { xs: 2.5, md: 4 } }}>
        <Box
          sx={{
            display: 'flex',
            gap: 3,
            alignItems: 'center',
            flexWrap: { xs: 'wrap', md: 'nowrap' },
          }}
        >
          {/* left copy */}
          <Box sx={{ flex: { xs: '1 1 100%', md: '0 0 23%' } }}>
            <SectionTitle small="OUR" big="PRODUCTS" />
            <Typography sx={{ mt: 2, color: 'rgba(255,255,255,0.65)', fontSize: '0.85rem', lineHeight: 1.7 }}>
              Crafted with the finest ingredients and Caribbean passion. Discover
              our range of award-winning beers.
            </Typography>
            <Box sx={{ mt: 3 }}>
              <NeonButton onClick={onViewAll} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}>
                View All Products
              </NeonButton>
            </Box>
          </Box>
          {/* chambers */}
          <Stack
            direction="row"
            spacing={1.5}
            sx={{ flex: 1, flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: { xs: 1.5, md: 1.5 } }}
          >
            {variants.map((v, i) => (
              <ProductChamber key={v} variant={v} delay={i * 0.08} />
            ))}
          </Stack>
          {/* nav arrows */}
          <Stack spacing={1.2} sx={{ display: { xs: 'none', md: 'flex' } }}>
            {[ChevronRightRoundedIcon, ChevronRightRoundedIcon].map((Ic, i) => (
              <IconButton
                key={i}
                sx={{
                  color: C.gold,
                  border: '1px solid rgba(212,165,42,0.5)',
                  boxShadow: '0 0 14px rgba(212,165,42,0.3)',
                  '&:hover': { background: 'rgba(212,165,42,0.12)' },
                }}
              >
                <Ic />
              </IconButton>
            ))}
          </Stack>
        </Box>
      </Glass>
    </Box>
  );
}

// ===========================================================================
// TRIO ROW — Merchandise / Promotions / Events
// ===========================================================================
function TrioCard({ id, eyebrow, title, lines, cta, icon, visual, onClick, delay }) {
  return (
    <Reveal id={id} delay={delay} sx={{ flex: 1, minWidth: 280 }}>
      <Glass
        component={motion.div}
        whileHover={{ y: -8 }}
        sx={{ p: 3, height: '100%', overflow: 'hidden', position: 'relative' }}
      >
        <Box sx={{ height: 150, position: 'relative', mb: 2 }}>{visual}</Box>
        <Typography
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 900,
            fontSize: '1.5rem',
            letterSpacing: '0.08em',
            color: C.gold,
            textShadow: '0 0 16px rgba(212,165,42,0.45)',
          }}
        >
          {title}
        </Typography>
        {lines.map((l) => (
          <Typography key={l} sx={{ color: 'rgba(255,255,255,0.66)', fontSize: '0.84rem', lineHeight: 1.55 }}>
            {l}
          </Typography>
        ))}
        <Box sx={{ mt: 2.5 }}>
          <NeonButton variant="outline" onClick={onClick} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}>
            {cta}
          </NeonButton>
        </Box>
      </Glass>
    </Reveal>
  );
}

function MerchVisual() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'flex-end' }}>
      {/* t-shirt */}
      <Box component="svg" viewBox="0 0 120 110" sx={{ width: 120, position: 'absolute', left: '18%', bottom: 18, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.5))' }}>
        <path d="M30 18 l18-10 q12 8 24 0 l18 10 -10 18 -8-4 v60 h-46 v-60 l-8 4 z" fill="#15181c" stroke="rgba(212,165,42,0.5)" strokeWidth="1.4" />
        <circle cx="60" cy="56" r="9" fill={C.gold} opacity="0.85" />
        <text x="60" y="78" textAnchor="middle" fontSize="9" fontWeight="800" fill="#fff" fontFamily="Inter">Carib</text>
      </Box>
      {/* cap */}
      <Box component="svg" viewBox="0 0 110 70" sx={{ width: 100, position: 'absolute', right: '14%', bottom: 6, filter: 'drop-shadow(0 8px 14px rgba(0,0,0,0.5))' }}>
        <path d="M14 46 q6-34 44-34 q34 0 38 30 q-40-12-82 4 z" fill="#15181c" stroke="rgba(212,165,42,0.5)" strokeWidth="1.4" />
        <path d="M12 46 q-6 4 -2 12 l34-4 q-10-6-32-8 z" fill="#0d0f12" />
        <circle cx="50" cy="30" r="6" fill={C.gold} />
      </Box>
      {/* neon pedestal */}
      <Box sx={{ position: 'absolute', bottom: 4, width: '70%', height: 10, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(0,229,255,0.7), transparent 70%)', boxShadow: '0 0 20px rgba(0,229,255,0.6)' }} />
    </Box>
  );
}

function PromoVisual() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      {[0, 1, 2].map((i) => (
        <Box
          key={i}
          component={motion.div}
          animate={{ rotate: i % 2 ? -360 : 360 }}
          transition={{ duration: 10 + i * 4, repeat: Infinity, ease: 'linear' }}
          sx={{
            position: 'absolute',
            width: 120 - i * 26,
            height: 120 - i * 26,
            borderRadius: '50%',
            border: `1.5px dashed ${i % 2 ? 'rgba(0,229,255,0.6)' : 'rgba(212,165,42,0.7)'}`,
          }}
        />
      ))}
      <Box sx={{ position: 'relative', zIndex: 2 }}>
        <Bottle variant="lager" h={120} />
      </Box>
      <Typography
        component={motion.div}
        animate={{ scale: [1, 1.12, 1] }}
        transition={{ duration: 2.2, repeat: Infinity }}
        sx={{
          position: 'absolute',
          fontFamily: DISPLAY_FONT,
          fontWeight: 900,
          fontSize: '2.6rem',
          color: C.amber,
          textShadow: '0 0 24px rgba(240,165,0,0.9)',
          zIndex: 3,
        }}
      >
        %
      </Typography>
    </Box>
  );
}

function EventsVisual() {
  return (
    <Box sx={{ position: 'absolute', inset: 0, borderRadius: 2, overflow: 'hidden', background: 'linear-gradient(180deg,#0a0014,#1a0a2e)' }}>
      {/* light beams */}
      {[20, 40, 60, 80].map((x, i) => (
        <Box
          key={x}
          component={motion.div}
          animate={{ opacity: [0.2, 0.7, 0.2], rotate: [(-8 + i * 5), (8 - i * 4), (-8 + i * 5)] }}
          transition={{ duration: 3 + i, repeat: Infinity }}
          sx={{
            position: 'absolute',
            top: -10,
            left: `${x}%`,
            width: 8,
            height: 120,
            transformOrigin: 'top center',
            background: `linear-gradient(180deg, ${i % 2 ? 'rgba(0,229,255,0.6)' : 'rgba(212,80,200,0.55)'}, transparent)`,
            filter: 'blur(2px)',
          }}
        />
      ))}
      {/* stage glow */}
      <Box sx={{ position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: '70%', height: 24, borderRadius: '50%', background: 'radial-gradient(ellipse, rgba(212,165,42,0.8), transparent 70%)' }} />
      {/* crowd silhouette */}
      <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 34, display: 'flex', alignItems: 'flex-end', gap: 0.4, px: 1 }}>
        {Array.from({ length: 22 }).map((_, i) => (
          <Box key={i} sx={{ flex: 1, height: 10 + ((i * 7) % 18), background: '#05060a', borderRadius: '4px 4px 0 0' }} />
        ))}
      </Box>
    </Box>
  );
}

function TrioRow({ onMerch, onPromos, onEvents }) {
  return (
    <Box sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 6 }, mt: { xs: 4, md: 5 } }}>
      <Stack direction="row" spacing={3} sx={{ flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 3 }}>
        <TrioCard
          id="merch"
          title="MERCHANDISE"
          lines={['Rep your pride.', 'Exclusive Carib gear', 'for true fans.']}
          cta="Shop Now"
          visual={<MerchVisual />}
          onClick={onMerch}
          delay={0}
        />
        <TrioCard
          id="promotions"
          title="PROMOTIONS"
          lines={['Exciting offers.', 'Refreshing rewards.', 'All year long.']}
          cta="See Promotions"
          visual={<PromoVisual />}
          onClick={onPromos}
          delay={0.1}
        />
        <TrioCard
          id="events"
          title="EVENTS"
          lines={['Good vibes.', 'Great people.', 'Unforgettable moments.']}
          cta="Upcoming Events"
          visual={<EventsVisual />}
          onClick={onEvents}
          delay={0.2}
        />
      </Stack>
    </Box>
  );
}

// ===========================================================================
// RECOGNITIONS
// ===========================================================================
const AWARDS = [
  { tone: 'gold', label: 'MONDE SELECTION\nGOLD AWARD\n2024' },
  { tone: 'gold', label: 'INTERNATIONAL\nBEER CHALLENGE\nGOLD 2023' },
  { tone: 'silver', label: 'WORLD BEER\nAWARDS\nSILVER 2023' },
  { tone: 'gold', label: 'CARIBBEAN BRAND\nAWARDS\nBRAND OF THE YEAR' },
  { tone: 'gold', label: 'GLOBAL BEER\nMASTERS\nGOLD 2024' },
];

function Recognitions() {
  return (
    <Box id="recognitions" sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 6 }, mt: { xs: 8, md: 12 } }}>
      <Glass sx={{ p: { xs: 3, md: 4 }, position: 'relative', overflow: 'hidden' }}>
        <SectionTitle small="RECOGNITIONS" />
        <Typography sx={{ mt: 0.5, fontFamily: DISPLAY_FONT, fontWeight: 700, letterSpacing: '0.12em', color: '#fff', fontSize: { xs: '1rem', md: '1.3rem' } }}>
          AWARDING EXCELLENCE. WORLDWIDE.
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mt: 4, flexWrap: { xs: 'wrap', md: 'nowrap' } }}>
          <IconButton sx={{ color: C.gold, border: '1px solid rgba(212,165,42,0.5)', display: { xs: 'none', md: 'inline-flex' } }}>
            <ChevronLeftRoundedIcon />
          </IconButton>
          <Stack direction="row" spacing={2} sx={{ flex: 1, justifyContent: 'space-around', flexWrap: { xs: 'wrap', md: 'nowrap' }, gap: 3 }}>
            {AWARDS.map((a, i) => (
              <Stack
                key={i}
                component={motion.div}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                alignItems="center"
                spacing={1}
                sx={{ minWidth: 120 }}
              >
                <Medal tone={a.tone} />
                <Typography sx={{ whiteSpace: 'pre-line', textAlign: 'center', fontSize: '0.58rem', fontWeight: 700, letterSpacing: '0.08em', color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                  {a.label}
                </Typography>
              </Stack>
            ))}
          </Stack>
        </Box>

        {/* mug with orbit rings */}
        <Box sx={{ position: 'absolute', top: '6%', right: '3%', display: { xs: 'none', lg: 'block' } }}>
          <Box component={motion.div} animate={{ rotate: 360 }} transition={{ duration: 24, repeat: Infinity, ease: 'linear' }} sx={{ position: 'absolute', inset: '-26px', borderRadius: '50%', border: '1px solid rgba(212,165,42,0.4)' }} />
          <Box component={motion.div} animate={{ rotate: -360 }} transition={{ duration: 18, repeat: Infinity, ease: 'linear' }} sx={{ position: 'absolute', inset: '-12px', borderRadius: '50%', border: '1px dashed rgba(242,200,73,0.5)' }} />
          <BeerGlass scale={1.1} />
        </Box>
      </Glass>
    </Box>
  );
}

// ===========================================================================
// STRONGER TOGETHER
// ===========================================================================
function StrongerTogether({ onGrow }) {
  return (
    <Box id="partners" sx={{ maxWidth: 1320, mx: 'auto', px: { xs: 2, md: 6 }, mt: { xs: 8, md: 12 }, mb: 8 }}>
      <Glass sx={{ p: { xs: 3, md: 6 }, position: 'relative', overflow: 'hidden', minHeight: 300 }}>
        {/* neon skyline bg right */}
        <Box sx={{ position: 'absolute', inset: 0, right: 0, opacity: 0.5 }}>
          <Box sx={{ position: 'absolute', right: 0, bottom: 0, width: { xs: '100%', md: '55%' }, height: '100%', display: 'flex', alignItems: 'flex-end', gap: 0.6, px: 2 }}>
            {Array.from({ length: 26 }).map((_, i) => (
              <Box
                key={i}
                component={motion.div}
                animate={{ opacity: [0.4, 0.9, 0.4] }}
                transition={{ duration: 3 + (i % 5), repeat: Infinity }}
                sx={{
                  flex: 1,
                  height: `${30 + ((i * 13) % 60)}%`,
                  background: 'linear-gradient(180deg, rgba(0,229,255,0.25), rgba(212,165,42,0.12))',
                  borderTop: '2px solid rgba(0,229,255,0.6)',
                  borderRadius: '2px 2px 0 0',
                }}
              />
            ))}
          </Box>
          {/* handshake glow */}
          <Box sx={{ position: 'absolute', right: { md: '14%' }, top: '50%', transform: 'translateY(-50%)', display: { xs: 'none', md: 'block' } }}>
            <Box sx={{ position: 'absolute', inset: '-40%', background: 'radial-gradient(circle, rgba(242,200,73,0.4), transparent 65%)' }} />
            <HandshakeRoundedIcon sx={{ fontSize: 150, color: C.gold, filter: 'drop-shadow(0 0 26px rgba(242,200,73,0.9))', position: 'relative' }} />
          </Box>
        </Box>

        <Box sx={{ position: 'relative', zIndex: 2, maxWidth: 560 }}>
          <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 900, fontSize: { xs: '2rem', md: '3rem' }, color: C.gold, textShadow: '0 0 22px rgba(212,165,42,0.5)', lineHeight: 1 }}>
            STRONGER TOGETHER.
          </Typography>
          <Typography sx={{ fontFamily: DISPLAY_FONT, fontWeight: 700, fontSize: { xs: '1rem', md: '1.3rem' }, color: '#fff', letterSpacing: '0.06em', mt: 1 }}>
            BREWING SUCCESS. BUILDING FUTURES.
          </Typography>
          <Typography sx={{ color: 'rgba(255,255,255,0.7)', fontSize: '0.9rem', lineHeight: 1.8, mt: 2 }}>
            At Carib Brewery, we believe in partnership, trust and growth.
            Together with our distributors, we raise the standard, expand horizons
            and create a legacy we're all proud of.
          </Typography>
          <Box sx={{ mt: 4 }}>
            <NeonButton onClick={onGrow} endIcon={<ArrowForwardRoundedIcon sx={{ fontSize: 16 }} />}>
              Let's Grow Together
            </NeonButton>
          </Box>
        </Box>
      </Glass>
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
// PAGE
// ===========================================================================
export default function CaribBreweryLanding() {
  const navigate = useNavigate();
  const goLogin = useCallback(() => navigate('/login'), [navigate]);
  const scrollTo = useCallback((id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

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
      <Hero onExplore={() => scrollTo('products')} />
      <KpiStrip />
      <Products onViewAll={goLogin} />
      <TrioRow onMerch={goLogin} onPromos={goLogin} onEvents={goLogin} />
      <Recognitions />
      <StrongerTogether onGrow={goLogin} />
      <Footer onPortal={goLogin} />
    </Box>
  );
}
