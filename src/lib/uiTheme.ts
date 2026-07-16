/** Design tokens — อ่านจาก CSS variables เพื่อรองรับ light / dark */

export const pageColors = {
  bg: 'var(--page-bg)',
  textPrimary: 'var(--page-text)',
  textSecondary: 'var(--page-text-secondary)',
  border: 'var(--page-border)',
  cardBg: 'var(--page-card)',
  cardBgSolid: 'var(--page-card-solid)',
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
  boxShadow: 'var(--page-shadow)',
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
  boxShadow: 'var(--page-shadow)',
} as const;

export const pageLayoutSx = {
  display: 'flex',
  flexDirection: 'column',
  bgcolor: pageColors.bg,
  minHeight: '100vh',
  overflowX: 'hidden',
  color: pageColors.textPrimary,
  transition: 'background-color .2s ease, color .2s ease',
} as const;

/** Card with colored left accent — for status / alert panels */
export const accentCardSx = (accentColor: string) => ({
  ...glassCardSx,
  borderLeft: `4px solid ${accentColor}`,
});
