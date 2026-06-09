import { createTheme } from '@mui/material/styles';

// Signature gold gradient used across BrewTrade AI surfaces.
export const goldGradient =
  'linear-gradient(135deg, #D4A52A 0%, #F2C849 50%, #E8A33D 100%)';

export const goldGradientSoft =
  'linear-gradient(135deg, rgba(212,165,42,0.15) 0%, rgba(242,200,73,0.10) 50%, rgba(232,163,61,0.15) 100%)';

// Brand gold secondary palette shared by every theme so CTAs stay on-brand.
const SECONDARY = {
  main: '#D4A52A',
  light: '#F2C849',
  dark: '#B5891F',
  contrastText: '#1A1A1A',
};

const SHARED_TYPOGRAPHY = {
  fontFamily: "'Inter', system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
  h1: { fontWeight: 800, fontSize: '3.25rem', letterSpacing: '-0.02em' },
  h2: { fontWeight: 800, fontSize: '2.5rem', letterSpacing: '-0.02em' },
  h3: { fontWeight: 700, fontSize: '2rem', letterSpacing: '-0.015em' },
  h4: { fontWeight: 700, fontSize: '1.5rem', letterSpacing: '-0.01em' },
  h5: { fontWeight: 600, fontSize: '1.25rem' },
  h6: { fontWeight: 600, fontSize: '1.05rem' },
  button: { fontWeight: 600, letterSpacing: '0.01em' },
  body1: { fontSize: '0.975rem' },
  body2: { fontSize: '0.875rem' },
};

/**
 * Build a full MUI theme from a compact token set.  Typography, shape and the
 * component *structure* are identical across every theme (so layout / spacing /
 * UX never change) — only the palette and surface colours differ.
 */
function buildTheme(t) {
  return createTheme({
    palette: {
      mode: t.mode,
      primary: t.primary,
      secondary: SECONDARY,
      background: t.background,
      text: t.text,
      accent: t.accent,
      amber: t.amber,
      success: { main: '#2E7D32' },
      warning: { main: '#ED6C02' },
      error: { main: '#C62828' },
      info: { main: '#0288D1' },
      divider: t.divider,
    },
    shape: { borderRadius: 14 },
    typography: SHARED_TYPOGRAPHY,
    // Custom token bag consumed by GlassCard and other shared surfaces.
    surfaces: t.surfaces,
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            background: t.surfaces.bodyBg,
            color: t.text.primary,
            minHeight: '100vh',
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: t.surfaces.cardBg,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: `1px solid ${t.surfaces.cardBorder}`,
            borderRadius: 16,
            boxShadow: t.surfaces.cardShadow,
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          rounded: { borderRadius: 14 },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            textTransform: 'none',
            borderRadius: 12,
            fontWeight: 600,
            paddingInline: 18,
            paddingBlock: 9,
          },
          containedSecondary: {
            background: goldGradient,
            color: '#1A1A1A',
            boxShadow: '0 6px 20px rgba(212,165,42,0.35)',
            '&:hover': {
              background: goldGradient,
              filter: 'brightness(1.05)',
              boxShadow: '0 10px 26px rgba(212,165,42,0.45)',
            },
          },
          outlinedSecondary: {
            borderColor: 'rgba(212,165,42,0.5)',
            color: t.mode === 'dark' ? t.text.primary : '#1A1A1A',
            '&:hover': {
              borderColor: '#D4A52A',
              background: 'rgba(212,165,42,0.10)',
            },
          },
        },
      },
      MuiAppBar: {
        defaultProps: { elevation: 0, color: 'transparent' },
        styleOverrides: {
          root: {
            backgroundColor: t.surfaces.appbarBg,
            backdropFilter: 'blur(18px)',
            WebkitBackdropFilter: 'blur(18px)',
            borderBottom: `1px solid ${t.surfaces.appbarBorder}`,
            color: t.surfaces.appbarText,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: t.surfaces.drawerBg,
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            borderRight: `1px solid ${t.surfaces.drawerBorder}`,
          },
        },
      },
      MuiChip: {
        styleOverrides: { root: { fontWeight: 500 } },
      },
      MuiTextField: {
        defaultProps: { variant: 'outlined', size: 'small' },
      },
    },
  });
}

// ---------------------------------------------------------------------------
// Theme token sets
// ---------------------------------------------------------------------------

// 1) Classic Light — the original BrewTrade look (unchanged).
const LIGHT = {
  mode: 'light',
  primary: { main: '#FFFFFF', contrastText: '#1A1A1A' },
  background: { default: '#FAFAF7', paper: '#FFFFFF' },
  text: { primary: '#1A1A1A', secondary: '#5A5A5A' },
  accent: { main: '#F2C849', contrastText: '#1A1A1A' },
  amber: { main: '#E8A33D', contrastText: '#1A1A1A' },
  divider: 'rgba(26,26,26,0.08)',
  surfaces: {
    bodyBg:
      'radial-gradient(1200px 600px at 100% -10%, rgba(242,200,73,0.18), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(212,165,42,0.10), transparent 60%), #FAFAF7',
    cardBg: 'rgba(255,255,255,0.7)',
    cardBorder: 'rgba(212,165,42,0.22)',
    cardShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 10px 30px rgba(26,26,26,0.06)',
    appbarBg: 'rgba(255,255,255,0.65)',
    appbarBorder: 'rgba(212,165,42,0.18)',
    appbarText: '#1A1A1A',
    drawerBg: 'rgba(255,255,255,0.85)',
    drawerBorder: 'rgba(212,165,42,0.18)',
  },
};

// 2) Midnight — deep indigo dark theme (base #1d1a3d).
const MIDNIGHT = {
  mode: 'dark',
  primary: { main: '#C9C4FF', contrastText: '#16132e' },
  background: { default: '#14122b', paper: '#1d1a3d' },
  text: { primary: '#F1EEFF', secondary: 'rgba(241,238,255,0.66)' },
  accent: { main: '#F2C849', contrastText: '#1A1A1A' },
  amber: { main: '#E8A33D', contrastText: '#1A1A1A' },
  divider: 'rgba(255,255,255,0.10)',
  surfaces: {
    bodyBg:
      'radial-gradient(1200px 600px at 100% -10%, rgba(212,165,42,0.12), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(124,92,255,0.18), transparent 60%), #14122b',
    cardBg: 'rgba(40,36,78,0.55)',
    cardBorder: 'rgba(212,165,42,0.22)',
    cardShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 16px 40px rgba(0,0,0,0.45)',
    appbarBg: 'rgba(20,18,43,0.72)',
    appbarBorder: 'rgba(212,165,42,0.20)',
    appbarText: '#F1EEFF',
    drawerBg: 'rgba(29,26,61,0.92)',
    drawerBorder: 'rgba(212,165,42,0.18)',
  },
};

// 3) Stout — warm espresso dark theme (beer-inspired, amber & copper).
const STOUT = {
  mode: 'dark',
  primary: { main: '#F0C792', contrastText: '#1c1009' },
  background: { default: '#160f0c', paper: '#20140f' },
  text: { primary: '#F7ECDD', secondary: 'rgba(247,236,221,0.62)' },
  accent: { main: '#E8A33D', contrastText: '#1A1A1A' },
  amber: { main: '#E8A33D', contrastText: '#1A1A1A' },
  divider: 'rgba(255,236,210,0.10)',
  surfaces: {
    bodyBg:
      'radial-gradient(1200px 600px at 100% -10%, rgba(232,163,61,0.14), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(184,115,51,0.16), transparent 60%), #160f0c',
    cardBg: 'rgba(44,28,18,0.6)',
    cardBorder: 'rgba(184,115,51,0.30)',
    cardShadow: '0 1px 0 rgba(255,255,255,0.05) inset, 0 16px 40px rgba(0,0,0,0.5)',
    appbarBg: 'rgba(26,16,10,0.75)',
    appbarBorder: 'rgba(184,115,51,0.28)',
    appbarText: '#F7ECDD',
    drawerBg: 'rgba(32,20,15,0.94)',
    drawerBorder: 'rgba(184,115,51,0.25)',
  },
};

// 4) Caribbean — bright aqua + sand light theme (sea-meets-gold).
const CARIBBEAN = {
  mode: 'light',
  primary: { main: '#012225', contrastText: '#FFFFFF' },
  background: { default: '#065d56', paper: '#FFFFFF' },
  text: { primary: '#06302E', secondary: '#3C605E' },
  accent: { main: '#17C1C7', contrastText: '#06302E' },
  amber: { main: '#E8A33D', contrastText: '#1A1A1A' },
  divider: 'rgba(6,48,46,0.10)',
  surfaces: {
    bodyBg:
      'radial-gradient(1200px 600px at 100% -10%, rgba(23,193,199,0.16), transparent 60%), radial-gradient(900px 500px at -10% 110%, rgba(212,165,42,0.12), transparent 60%), #bee3e0',
    cardBg: 'rgba(255,255,255,0.74)',
    cardBorder: 'rgba(14,124,134,0.22)',
    cardShadow: '0 1px 0 rgba(255,255,255,0.6) inset, 0 12px 32px rgba(6,48,46,0.08)',
    appbarBg: 'rgba(255,255,255,0.7)',
    appbarBorder: 'rgba(14,124,134,0.20)',
    appbarText: '#06302E',
    drawerBg: 'rgba(240,253,252,0.9)',
    drawerBorder: 'rgba(14,124,134,0.18)',
  },
};

export const themes = {
  light: buildTheme(LIGHT),
  midnight: buildTheme(MIDNIGHT),
  stout: buildTheme(STOUT),
  caribbean: buildTheme(CARIBBEAN),
};

// Metadata for the theme switcher (swatch shown as a colour dot).
export const THEME_LIST = [
  { key: 'light', name: 'Classic Light', swatch: '#FAFAF7', accent: '#D4A52A' },
  { key: 'midnight', name: 'Midnight', swatch: '#1d1a3d', accent: '#C9C4FF' },
  { key: 'stout', name: 'Stout', swatch: '#20140f', accent: '#E8A33D' },
  { key: 'caribbean', name: 'Caribbean', swatch: '#0E7C86', accent: '#17C1C7' },
];

// Default export kept for backwards compatibility (light theme).
export default themes.light;
