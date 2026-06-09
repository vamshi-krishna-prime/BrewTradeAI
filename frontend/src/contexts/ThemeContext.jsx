import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';

import { themes, THEME_LIST } from '../theme.js';

const STORAGE_KEY = 'brewtrade.theme';

const ThemeModeContext = createContext({
  themeKey: 'light',
  setThemeKey: () => {},
  themeList: THEME_LIST,
});

export const useThemeMode = () => useContext(ThemeModeContext);

/**
 * App-wide theme provider: holds the active theme key, persists it to
 * localStorage, and applies the matching MUI theme.  Exposes the key + setter
 * + theme list via context so a switcher can live on any page.
 */
export function ThemeModeProvider({ children }) {
  const [themeKey, setThemeKey] = useState(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved && themes[saved]) return saved;
    } catch (_) {
      /* localStorage unavailable */
    }
    return 'light';
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, themeKey);
    } catch (_) {
      /* ignore */
    }
  }, [themeKey]);

  const theme = useMemo(() => themes[themeKey] || themes.light, [themeKey]);
  const value = useMemo(
    () => ({ themeKey, setThemeKey, themeList: THEME_LIST }),
    [themeKey]
  );

  return (
    <ThemeModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ThemeModeContext.Provider>
  );
}

export default ThemeModeProvider;
