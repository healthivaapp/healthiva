// ====================================================================
// HEALTHIVA GLOBAL THEME & BRAND DESIGN TOKENS
// Shared across Web (Next.js) and Mobile (React Native / Expo)
// ====================================================================

export const HealthivaTheme = {
  brand: {
    name: 'Healthiva',
    tagline: 'Run Your Clinic Smarter.',
    subtitle: 'All-in-One Clinic Management Software',
  },
  colors: {
    // Primary Cyan/Sky Blue Brand Colors
    primary: '#009fe3',
    primaryHover: '#008bc7',
    primaryDark: '#0284c7',
    primaryLight: '#e0f2fe',
    primaryBg: '#f0f9ff',
    primaryUltraLight: '#f8fafc',

    // Dark Navy & Charcoal (Stats Strip, Sidebars & Headings)
    darkNavy: '#042451',
    darkNavyCard: '#08326e',
    sidebarBg: '#042451',
    textDark: '#0f172a',
    textMuted: '#64748b',
    textLight: '#94a3b8',

    // Card & Borders
    cardBg: '#ffffff',
    borderLight: '#e2e8f0',
    borderMuted: '#cbd5e1',

    // Semantic Accents
    success: '#10b981',
    successBg: '#ecfdf5',
    warning: '#f59e0b',
    warningBg: '#fffbeb',
    danger: '#ef4444',
    dangerBg: '#fef2f2',
  },
  fonts: {
    sans: "'Plus Jakarta Sans', 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    mono: "'JetBrains Mono', monospace",
  },
  shadows: {
    card: '0 4px 20px rgba(0, 0, 0, 0.05)',
    cardHover: '0 10px 30px rgba(0, 159, 227, 0.12)',
    dropdown: '0 10px 25px rgba(10, 25, 49, 0.15)',
  },
  radii: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    xl: '20px',
    pill: '9999px',
  },
} as const;

export type ThemeColors = typeof HealthivaTheme.colors;
