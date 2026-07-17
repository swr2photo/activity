/**
 * Shared helpers for post-activity survey open windows.
 * Pure functions — safe for unit tests without Firebase.
 */

export type SurveyWindowInput = {
  enabled?: boolean;
  questionsLength?: number;
  surveyOpenMinutes?: number;
  /** Admin-forced reopen deadline (Date or Firestore Timestamp-like) */
  forceOpenUntil?: unknown;
  endDateTime?: unknown;
  sessions?: Array<{ endDateTime?: unknown }>;
  now?: Date;
};

export type SurveyWindowStatus = {
  enabled: boolean;
  open: boolean;
  expired: boolean;
  notStarted: boolean;
  endTime: Date | null;
  closeTime: Date | null;
  forceOpenUntil: Date | null;
  openMinutes: number;
  /** Human label for UI */
  label: 'disabled' | 'not_started' | 'open' | 'expired' | 'forced_open';
};

const toDateSafe = (v: unknown): Date | null => {
  if (!v) return null;
  if (v instanceof Date) return Number.isNaN(+v) ? null : v;
  if (typeof (v as any)?.toDate === 'function') {
    const d = (v as any).toDate();
    return d instanceof Date && !Number.isNaN(+d) ? d : null;
  }
  const d = new Date(v as any);
  return Number.isNaN(+d) ? null : d;
};

export function resolveActivityEndTime(input: {
  endDateTime?: unknown;
  sessions?: Array<{ endDateTime?: unknown }>;
}): Date | null {
  const sessions = input.sessions || [];
  if (sessions.length > 0) {
    const times = sessions
      .map((s) => toDateSafe(s.endDateTime))
      .filter((d): d is Date => !!d)
      .sort((a, b) => b.getTime() - a.getTime());
    if (times.length) return times[0];
  }
  return toDateSafe(input.endDateTime);
}

export function getSurveyWindowStatus(input: SurveyWindowInput): SurveyWindowStatus {
  const now = input.now ?? new Date();
  const openMinutes = Math.max(1, Number(input.surveyOpenMinutes ?? 1440) || 1440);
  const enabled = Boolean(input.enabled) && (input.questionsLength ?? 0) > 0;
  const forceOpenUntil = toDateSafe(input.forceOpenUntil);
  const endTime = resolveActivityEndTime(input);

  if (!enabled) {
    return {
      enabled: false,
      open: false,
      expired: false,
      notStarted: false,
      endTime,
      closeTime: null,
      forceOpenUntil,
      openMinutes,
      label: 'disabled',
    };
  }

  const closeTime = endTime ? new Date(endTime.getTime() + openMinutes * 60 * 1000) : null;
  const naturalOpen = !!(endTime && closeTime && now >= endTime && now <= closeTime);
  const forcedOpen = !!(forceOpenUntil && now <= forceOpenUntil);
  const open = naturalOpen || forcedOpen;
  const notStarted = !!(endTime && now < endTime && !forcedOpen);
  const expired = !open && !notStarted && !!(endTime && closeTime && now > closeTime && !forcedOpen);

  let label: SurveyWindowStatus['label'] = 'expired';
  if (forcedOpen && !naturalOpen) label = 'forced_open';
  else if (open) label = 'open';
  else if (notStarted) label = 'not_started';
  else if (!endTime) label = 'expired';
  else label = 'expired';

  return {
    enabled: true,
    open,
    expired,
    notStarted,
    endTime,
    closeTime,
    forceOpenUntil,
    openMinutes,
    label,
  };
}

/** Hours from now → Date used as forceOpenUntil */
export function forceOpenUntilFromHours(hours: number, now = new Date()): Date {
  const h = Math.max(1, Math.min(24 * 14, Number(hours) || 24));
  return new Date(now.getTime() + h * 60 * 60 * 1000);
}

export function surveyStatusLabelTh(status: SurveyWindowStatus): string {
  switch (status.label) {
    case 'open':
      return 'เปิดทำแบบประเมิน';
    case 'forced_open':
      return 'เปิดพิเศษ (แอดมินขยายเวลา)';
    case 'not_started':
      return 'ยังไม่ถึงเวลาทำแบบประเมิน';
    case 'expired':
      return 'หมดเวลาทำแบบประเมิน';
    default:
      return 'ไม่มีแบบประเมิน';
  }
}
