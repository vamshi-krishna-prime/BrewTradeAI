/**
 * OpeningPage.jsx
 * -----------------------------------------------------------------------------
 * Cinematic splash shown the moment the app starts (mounted at "/").
 *
 *  - Displays the opening artwork (the CEO-message image).
 *  - A glow continuously trails around the image borders (rotating neon beam).
 *  - A futuristic animated background: drifting gold/blue particles + a
 *    perspective grid + ambient bokeh.
 *  - Gentle, professional ambient music (synthesised via the Web Audio API,
 *    low volume) plays for ~8 seconds.  Browser autoplay policies block sound
 *    until a user gesture, so it also starts on the first pointer move / key.
 *  - An "ENTER" button (matching the gold neon design) sits right below the
 *    message and redirects to the Carib Brewery landing page (/home).
 *
 * On repeat in-app visits within the same load (e.g. after logout, which
 * navigates to "/"), this page instantly forwards to /home — so existing
 * flows are preserved and the splash only plays on a genuine fresh start.
 *
 * NOTE: drop the attached opening artwork at:  frontend/public/opening.png
 */
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Stack, Typography } from '@mui/material';
import { motion } from 'framer-motion';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import ThemeToggle from '../components/common/ThemeToggle.jsx';

// Module-level flag: lives for the lifetime of a page load. Reset on a real
// reload (fresh app start) but persists across in-app navigations.
let hasShownOpening = false;

const C = {
  gold: '#D4A52A',
  amber: '#F0A500',
  blue: '#fdfdfd',
  goldGrad: 'linear-gradient(135deg, #F2C849 0%, #D4A52A 45%, #B87333 100%)',
};
const DISPLAY_FONT = "'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif";

// Place the attached opening artwork here -> frontend/public/opening.png
const OPENING_IMAGE = '/opening.png';

// ---------------------------------------------------------------------------
// Futuristic particle background (Canvas 2D)
// ---------------------------------------------------------------------------
function FuturisticBG() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
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
    const bokeh = Array.from({ length: 12 }, () => ({
      x: rnd(0, w), y: rnd(0, h), r: rnd(50, 170),
      vx: rnd(-0.1, 0.1), vy: rnd(-0.14, 0.06),
      hue: Math.random() > 0.4 ? 'gold' : 'blue', a: rnd(0.04, 0.1),
    }));
    const dust = Array.from({ length: 110 }, () => ({
      x: rnd(0, w), y: rnd(0, h), r: rnd(0.5, 2.2),
      vx: rnd(-0.12, 0.12), vy: rnd(-0.55, -0.08), a: rnd(0.2, 0.85),
      hue: Math.random() > 0.5 ? 'gold' : 'blue',
    }));

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = 'lighter';
      bokeh.forEach((b) => {
        b.x += b.vx; b.y += b.vy;
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
      dust.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.y < -10) { p.y = h + 10; p.x = rnd(0, w); }
        if (p.x < -10) p.x = w + 10;
        if (p.x > w + 10) p.x = -10;
        const col = p.hue === 'gold' ? '242,200,73' : '120,225,255';
        ctx.fillStyle = `rgba(${col},${p.a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
      });
      ctx.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <Box
      component="canvas"
      ref={ref}
      aria-hidden
      sx={{ position: 'fixed', inset: 0, width: '100%', height: '100%', zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

// ===========================================================================
// PAGE
// ===========================================================================
export default function OpeningPage() {
  const navigate = useNavigate();
  const [redirecting] = useState(() => hasShownOpening);
  const stopAudioRef = useRef(null);

  // Skip the splash on repeat in-app visits (preserves logout/other flows).
  useEffect(() => {
    if (hasShownOpening) {
      navigate('/home', { replace: true });
    }
  }, [navigate]);

  // ---- ambient music (Web Audio API) -------------------------------------
  useEffect(() => {
    if (hasShownOpening) return undefined;
    let ctx = null;
    let cleanupGesture = () => {};

    const startAudio = () => {
      if (ctx) {
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        return;
      }
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();
        const master = ctx.createGain();
        master.gain.value = 0;
        master.connect(ctx.destination);

        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.value = 1300;
        filter.Q.value = 0.6;
        filter.connect(master);

        // open, airy chord — futuristic but warm (C / G / E spread)
        const freqs = [130.81, 196.0, 261.63, 329.63, 392.0, 523.25];
        const oscs = freqs.map((f, i) => {
          const o = ctx.createOscillator();
          o.type = i % 2 ? 'sine' : 'triangle';
          o.frequency.value = f;
          const g = ctx.createGain();
          g.gain.value = 0.14 / (i * 0.45 + 1);
          o.connect(g);
          g.connect(filter);
          o.start();
          return o;
        });

        // slow shimmer on the filter cutoff
        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.14;
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 450;
        lfo.connect(lfoGain);
        lfoGain.connect(filter.frequency);
        lfo.start();

        const now = ctx.currentTime;
        // gentle fade-in, sustain, fade-out — peak kept low (not too loud)
        master.gain.setValueAtTime(0.0001, now);
        master.gain.linearRampToValueAtTime(0.17, now + 1.8);
        master.gain.setValueAtTime(0.17, now + 6.5);
        master.gain.linearRampToValueAtTime(0.0001, now + 9);

        const hardStop = setTimeout(() => {
          try {
            oscs.forEach((o) => o.stop());
            lfo.stop();
            ctx.close();
          } catch (e) {
            /* noop */
          }
          ctx = null;
        }, 9400);

        stopAudioRef.current = () => {
          clearTimeout(hardStop);
          try {
            const t = ctx.currentTime;
            master.gain.cancelScheduledValues(t);
            master.gain.setValueAtTime(master.gain.value, t);
            master.gain.linearRampToValueAtTime(0.0001, t + 0.4);
            setTimeout(() => {
              try {
                oscs.forEach((o) => o.stop());
                lfo.stop();
                ctx && ctx.close();
              } catch (e) {
                /* noop */
              }
              ctx = null;
            }, 450);
          } catch (e) {
            /* noop */
          }
        };
      } catch (e) {
        /* audio unavailable — fail silently */
      }
    };

    // Attempt immediately; if the browser blocks it, start on first gesture.
    startAudio();
    const onGesture = () => {
      startAudio();
      cleanupGesture();
    };
    window.addEventListener('pointerdown', onGesture, { once: false });
    window.addEventListener('pointermove', onGesture, { once: false });
    window.addEventListener('keydown', onGesture, { once: false });
    cleanupGesture = () => {
      window.removeEventListener('pointerdown', onGesture);
      window.removeEventListener('pointermove', onGesture);
      window.removeEventListener('keydown', onGesture);
    };

    return () => {
      cleanupGesture();
      try {
        ctx && ctx.close();
      } catch (e) {
        /* noop */
      }
    };
  }, []);

  const enter = useCallback(() => {
    hasShownOpening = true;
    if (stopAudioRef.current) stopAudioRef.current();
    navigate('/home');
  }, [navigate]);

  if (redirecting) return null;

  return (
    <Box
      sx={{
        position: 'fixed',
        inset: 0,
        overflow: 'auto',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        px: 2,
        py: 4,
        background:
          'radial-gradient(1100px 700px at 50% -10%, rgba(212,165,42,0.12), transparent 60%),' +
          'radial-gradient(900px 600px at 10% 110%, rgba(0,229,255,0.08), transparent 55%),' +
          'linear-gradient(180deg, #07111F 0%, #050505 70%)',
        color: '#fff',
      }}
    >
      <FuturisticBG />

      <ThemeToggle floating />

      {/* futuristic perspective grid */}
      <Box
        component={motion.div}
        aria-hidden
        animate={{ backgroundPositionY: ['0px', '44px'] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
        sx={{
          position: 'fixed',
          inset: 0,
          zIndex: 1,
          pointerEvents: 'none',
          backgroundImage:
            'linear-gradient(rgba(0,229,255,0.06) 1px, transparent 1px),' +
            'linear-gradient(90deg, rgba(0,229,255,0.06) 1px, transparent 1px)',
          backgroundSize: '44px 44px',
          WebkitMaskImage: 'radial-gradient(circle at 50% 42%, black, transparent 72%)',
          maskImage: 'radial-gradient(circle at 50% 42%, black, transparent 72%)',
        }}
      />

      {/* Content */}
      <Box sx={{ position: 'relative', zIndex: 2, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        {/* Image with rotating border-glow trail */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, scale: 0.92, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 1, ease: 'easeOut' }}
          sx={{
            position: 'relative',
            display: 'inline-flex',
            p: '3px',
            borderRadius: 4,
            overflow: 'hidden',
            // boxShadow: '0 0 60px rgba(212,165,42,0.35), 0 30px 90px rgba(0,0,0,0.7)',
            boxShadow: '0 0 20px rgba(212,165,42,0.15)',
          }}
        >
          {/* rotating gold beam */}
          {/* <Box
            component={motion.div}
            aria-hidden
            animate={{ rotate: 360 }}
            transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
            sx={{
              position: 'absolute',
              inset: '-60%',
              zIndex: 0,
              background:
                'conic-gradient(from 0deg, transparent 0deg, transparent 250deg, rgba(242,200,73,0.15) 300deg, #F2C849 345deg, #FFF6D8 358deg, #F2C849 360deg)',
            }}
          /> */}
          {/* counter-rotating electric-blue beam */}
          {/* <Box
            component={motion.div}
            aria-hidden
            animate={{ rotate: -360 }}
            transition={{ duration: 9, repeat: Infinity, ease: 'linear' }}
            sx={{
              position: 'absolute',
              inset: '-60%',
              zIndex: 0,
              background:
                'conic-gradient(from 0deg, transparent 0deg, transparent 270deg, rgba(0,229,255,0.10) 320deg, #00E5FF 352deg, transparent 360deg)',
              mixBlendMode: 'screen',
            }}
          /> */}
          {/* the artwork */}
          <Box
            component="img"
            src={OPENING_IMAGE}
            alt="Carib Brewery — A message from our CEO"
            sx={{
              position: 'relative',
              zIndex: 1,
              display: 'block',
              width: 'auto',
              // maxWidth: 'min(92vw, 720px)',
              // maxHeight: '72vh',
              maxWidth: 'min(98vw, 1200px)',
              maxHeight: '85vh',
              height: 'auto',
              borderRadius: 3.5,
              background: '#050505',
            }}
          />
        </Box>

        {/* connector — visually ties the button to the message above */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, scaleY: 0 }}
          animate={{ opacity: 1, scaleY: 1 }}
          transition={{ delay: 1, duration: 0.5 }}
          sx={{
            width: '2px',
            height: 26,
            transformOrigin: 'top',
            background: 'linear-gradient(180deg, rgba(242,200,73,0.9), rgba(242,200,73,0))',
            boxShadow: '0 0 12px rgba(242,200,73,0.8)',
          }}
        />

        {/* ENTER button — right below the CEO message */}
        <Box
          component={motion.div}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.15, duration: 0.6, ease: 'easeOut' }}
          sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 1.2 }}
        >
          <Box
            component={motion.button}
            onClick={enter}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.96 }}
            animate={{
              boxShadow: [
                '0 0 22px rgba(212,165,42,0.5), inset 0 0 12px rgba(255,255,255,0.25)',
                '0 0 40px rgba(242,200,73,0.85), inset 0 0 14px rgba(255,255,255,0.35)',
                '0 0 22px rgba(212,165,42,0.5), inset 0 0 12px rgba(255,255,255,0.25)',
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            sx={{
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 1.2,
              px: 5,
              py: 1.6,
              borderRadius: 999,
              fontFamily: DISPLAY_FONT,
              fontWeight: 800,
              letterSpacing: '0.22em',
              textTransform: 'uppercase',
              fontSize: '0.95rem',
              color: '#1A1208',
              background: C.goldGrad,
              border: '1px solid rgba(242,200,73,0.65)',
            }}
          >
            Enter
            <ArrowForwardRoundedIcon sx={{ fontSize: 20 }} />
          </Box>
          <Typography
            component={motion.p}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 2.6, repeat: Infinity }}
            sx={{ fontSize: '0.66rem', letterSpacing: '0.32em', color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', m: 0 }}
          >
            Click to enter the experience
          </Typography>
        </Box>
      </Box>
    </Box>
  );
}
