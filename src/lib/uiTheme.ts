/** Design tokens — Apple/minimal theme (shared with home page) */
export const pageColors = {
  bg: '#f5f5f7',
  textPrimary: '#1d1d1f',
  textSecondary: '#86868b',
  border: 'rgba(0, 0, 0, 0.08)',
  cardBg: 'rgba(255, 255, 255, 0.85)',
  cardBgSolid: 'rgba(255, 255, 255, 0.8)',
  appleGreen: '#248a3d',
  appleGreenBg: 'rgba(52, 199, 89, 0.15)',
  accentError: '#ff3b30',
  accentWarning: '#ff9500',
  accentSuccess: '#34c759',
  accentInfo: '#007aff',
} as const;

export const glassCardSx = {
  elevation: 0,
  borderRadius: '20px',
  border: `1px solid ${pageColors.border}`,
  bgcolor: pageColors.cardBgSolid,
  backdropFilter: 'blur(20px)',
  boxShadow: '0 20px 40px rgba(0,0,0,0.04)',
} as const;

export const glassCardLargeSx = {
  ...glassCardSx,
  borderRadius: '24px',
  bgcolor: pageColors.cardBg,
  backdropFilter: 'blur(30px)',
} as const;

export const glassNavSx = {
  backdropFilter: 'blur(20px) saturate(180%)',
  WebkitBackdropFilter: 'blur(20px) saturate(180%)',
  backgroundColor: pageColors.cardBg,
  border: `1px solid ${pageColors.border}`,
  boxShadow: '0 8px 32px rgba(0,0,0,0.04)',
} as const;

export const pageLayoutSx = {
  display: 'flex',
  flexDirection: 'column',
  bgcolor: pageColors.bg,
  minHeight: '100vh',
  overflowX: 'hidden',
} as const;

/** Card with colored left accent — for status / alert panels */
export const accentCardSx = (accentColor: string) => ({
  ...glassCardSx,
  borderLeft: `4px solid ${accentColor}`,
});
