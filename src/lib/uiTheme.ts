/** Design tokens — CSS variables for light / dark */

export const pageColors = {
  bg: "var(--page-bg)",
  textPrimary: "var(--page-text)",
  textSecondary: "var(--page-text-secondary)",
  border: "var(--page-border)",
  cardBg: "var(--page-card)",
  cardBgSolid: "var(--page-card-solid)",
  appleGreen: "#248a3d",
  appleGreenBg: "rgba(52, 199, 89, 0.15)",
  accentError: "#ff3b30",
  accentWarning: "#ff9500",
  accentSuccess: "#34c759",
  accentInfo: "#007aff",
} as const;

/** Tailwind class helpers (replaces former MUI sx objects) */
export const glassCardClass =
  "rounded-[20px] border border-[var(--page-border)] bg-[var(--page-card-solid)] shadow-[var(--page-shadow)] backdrop-blur-[20px]";

export const glassCardLargeClass =
  "rounded-[24px] border border-[var(--page-border)] bg-[var(--page-card)] shadow-[var(--page-shadow)] backdrop-blur-[30px]";

export const glassNavClass =
  "border border-[var(--page-border)] bg-[var(--page-card)] shadow-[var(--page-shadow)] backdrop-blur-[20px] backdrop-saturate-180";

export const pageLayoutClass =
  "flex min-h-screen flex-col overflow-x-hidden bg-[var(--page-bg)] text-[var(--page-text)] transition-[background-color,color] duration-200";

/** @deprecated use glassCardClass — kept briefly for any leftover imports */
export const glassCardSx = {
  elevation: 0,
  borderRadius: "20px",
  border: `1px solid ${pageColors.border}`,
  bgcolor: pageColors.cardBgSolid,
  backdropFilter: "blur(20px)",
  boxShadow: "var(--page-shadow)",
} as const;

export const glassCardLargeSx = {
  ...glassCardSx,
  borderRadius: "24px",
  bgcolor: pageColors.cardBg,
  backdropFilter: "blur(30px)",
} as const;

export const glassNavSx = {
  backdropFilter: "blur(20px) saturate(180%)",
  WebkitBackdropFilter: "blur(20px) saturate(180%)",
  backgroundColor: pageColors.cardBg,
  border: `1px solid ${pageColors.border}`,
  boxShadow: "var(--page-shadow)",
} as const;

export const pageLayoutSx = {
  display: "flex",
  flexDirection: "column",
  bgcolor: pageColors.bg,
  minHeight: "100vh",
  overflowX: "hidden",
  color: pageColors.textPrimary,
  transition: "background-color .2s ease, color .2s ease",
} as const;

/** Tailwind helper — pass accent via style={{ borderLeftColor: color }} */
export const accentCardClass = `${glassCardClass} border-l-4`;

export const accentCardSx = (accentColor: string) => ({
  ...glassCardSx,
  borderLeft: `4px solid ${accentColor}`,
});
