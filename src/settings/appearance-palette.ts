/**
 * Approved authenticated-shell appearance backup.
 * Keep this snapshot unchanged unless the user explicitly asks to revise it.
 * The CSS values mirrored from this file live in frontend/src/app/globals.css.
 */
export const ORGANIZATION_ACCENT_COLORS = {
  blue: ['#60a5fa', '#3b82f6'],
  green: ['#4ade80', '#22c55e'],
  red: ['#f87171', '#ef4444'],
  amber: ['#fde047', '#facc15'],
  violet: ['#a78bfa', '#8b5cf6'],
} as const;

type SurfacePalette = {
  background: string;
  foreground: string;
  surface: string;
  surfaceElevated: string;
  surfaceMuted: string;
  surfaceHover: string;
  card: string;
  cardForeground: string;
  mutedForeground: string;
  border: string;
  borderStrong: string;
  input: string;
  sidebar: string;
  sidebarElevated: string;
  sidebarForeground: string;
  sidebarMuted: string;
  sidebarBorder: string;
};

export const APPROVED_SHELL_APPEARANCE_BACKUP = {
  light: {
    soft: {
      background: '#e9edf1', foreground: '#687381', surface: '#f0f2f5',
      surfaceElevated: '#f4f6f8', surfaceMuted: '#e7ebef', surfaceHover: '#e1e6eb',
      card: '#f2f4f6', cardForeground: '#687381', mutedForeground: '#7b8590',
      border: '#e2e6eb', borderStrong: '#d5dce4', input: '#dfe4ea',
      sidebar: '#f0f2f5', sidebarElevated: '#f4f6f8', sidebarForeground: '#687381',
      sidebarMuted: '#7b8590', sidebarBorder: '#e2e6eb',
    } satisfies SurfacePalette,
    balanced: {
      background: '#f1f3f5', foreground: '#5e6874', surface: '#f8f9fb',
      surfaceElevated: '#f5f6f8', surfaceMuted: '#eceff3', surfaceHover: '#e6eaf0',
      card: '#f8f9fb', cardForeground: '#5e6874', mutedForeground: '#707b88',
      border: '#dce1e8', borderStrong: '#cbd2dc', input: '#d6dde7',
      sidebar: '#f8f9fb', sidebarElevated: '#f1f3f5', sidebarForeground: '#5e6874',
      sidebarMuted: '#707b88', sidebarBorder: '#dce1e8',
    } satisfies SurfacePalette,
    strong: {
      background: '#f7f8fa', foreground: '#505d6b', surface: '#ffffff',
      surfaceElevated: '#ffffff', surfaceMuted: '#edf0f4', surfaceHover: '#e6eaf0',
      card: '#ffffff', cardForeground: '#505d6b', mutedForeground: '#626e7b',
      border: '#cfd6de', borderStrong: '#bac4d0', input: '#c2ccd7',
      sidebar: '#ffffff', sidebarElevated: '#f5f6f8', sidebarForeground: '#505d6b',
      sidebarMuted: '#626e7b', sidebarBorder: '#cfd6de',
    } satisfies SurfacePalette,
  },
  dark: {
    soft: {
      background: '#25292e', foreground: '#9aa3ad', surface: '#2a2f35',
      surfaceElevated: '#30363d', surfaceMuted: '#32383f', surfaceHover: '#3a4149',
      card: '#2a2f35', cardForeground: '#9aa3ad', mutedForeground: '#858f99',
      border: '#303740', borderStrong: '#39424c', input: '#343d47',
      sidebar: '#292e34', sidebarElevated: '#30363d', sidebarForeground: '#9aa3ad',
      sidebarMuted: '#858f99', sidebarBorder: '#303740',
    } satisfies SurfacePalette,
    balanced: {
      background: '#1b2026', foreground: '#a8afb7', surface: '#22272e',
      surfaceElevated: '#282e36', surfaceMuted: '#2a3038', surfaceHover: '#333a43',
      card: '#22272e', cardForeground: '#a8afb7', mutedForeground: '#929aa4',
      border: '#353c45', borderStrong: '#48515c', input: '#3a424d',
      sidebar: '#20252c', sidebarElevated: '#282e36', sidebarForeground: '#a8afb7',
      sidebarMuted: '#929aa4', sidebarBorder: '#353c45',
    } satisfies SurfacePalette,
    strong: {
      background: '#101419', foreground: '#b8c0c9', surface: '#171c22',
      surfaceElevated: '#1e242b', surfaceMuted: '#20262e', surfaceHover: '#29313a',
      card: '#171c22', cardForeground: '#b8c0c9', mutedForeground: '#a4adb7',
      border: '#414a55', borderStrong: '#4d5865', input: '#424d59',
      sidebar: '#171c22', sidebarElevated: '#1e242b', sidebarForeground: '#b8c0c9',
      sidebarMuted: '#a4adb7', sidebarBorder: '#414a55',
    } satisfies SurfacePalette,
  },
  backgroundStyle: {
    lightGray: { soft: '#e9edf1', balanced: '#f1f3f5', strong: '#f7f8fa' },
    darkGray: { soft: '#25292e', balanced: '#1b2026', strong: '#101419' },
    themeAccentMixPercent: { light: 2, dark: 3 },
  },
  gradients: {
    light: {
      soft: 'linear-gradient(135deg, rgba(255,255,255,.12), rgba(255,255,255,0) 56%, rgba(82,96,112,.02))',
      balanced: 'linear-gradient(135deg, rgba(255,255,255,.16), rgba(255,255,255,0) 56%, rgba(82,96,112,.025))',
      strong: 'linear-gradient(135deg, rgba(255,255,255,.2), rgba(255,255,255,0) 56%, rgba(82,96,112,.03))',
    },
    dark: {
      soft: 'linear-gradient(135deg, rgba(255,255,255,.02), rgba(255,255,255,0) 56%, rgba(0,0,0,.05))',
      balanced: 'linear-gradient(135deg, rgba(255,255,255,.03), rgba(255,255,255,0) 56%, rgba(0,0,0,.07))',
      strong: 'linear-gradient(135deg, rgba(255,255,255,.04), rgba(255,255,255,0) 56%, rgba(0,0,0,.09))',
    },
    themeAccentOverlay: { light: 2, dark: 3 },
  },
} as const;
