/**
 * Shared helpers for post-activity survey open windows.
 * Pure functions — safe for unit tests without Firebase.
 */

export type SurveyWindowInput = {
  enabled?: boolean;
  questionsLength?: number;
  /** @deprecated ใช้ openAt/closeAt แทน — คงไว้เพื่อกิจกรรมเก่า */
  surveyOpenMinutes?: number;
  /** วันเวลาเปิดแบบประเมิน (Date / Timestamp) */
  openAt?: unknown;
  /** วันเวลาปิดแบบประเมิน (Date / Timestamp) */
  closeAt?: unknown;
  /** Admin-forced reopen deadline ทั้งกิจกรรม (Date or Firestore Timestamp-like) */
  forceOpenUntil?: unknown;
  /** เปิดพิเศษรายบุคคล: map uid → deadline */
  userForceOpenUntil?: Record<string, unknown> | null;
  /** uid ผู้ใช้ปัจจุบัน — ใช้กับ userForceOpenUntil */
  userId?: string | null;
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
  openTime: Date | null;
  closeTime: Date | null;
  forceOpenUntil: Date | null;
  /** true ถ้าเปิดเพราะสิทธิ์รายบุคคล */
  userForced: boolean;
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

/** รวม deadline เปิดพิเศษทั้งกิจกรรม + รายบุคคล */
export function resolveEffectiveForceOpenUntil(input: {
  forceOpenUntil?: unknown;
  userForceOpenUntil?: Record<string, unknown> | null;
  userId?: string | null;
}): { until: Date | null; userForced: boolean } {
  const globalUntil = toDateSafe(input.forceOpenUntil);
  const userUntil =
    input.userId && input.userForceOpenUntil
      ? toDateSafe(input.userForceOpenUntil[input.userId])
      : null;

  if (globalUntil && userUntil) {
    if (userUntil.getTime() >= globalUntil.getTime()) {
      return { until: userUntil, userForced: true };
    }
    return { until: globalUntil, userForced: false };
  }
  if (userUntil) return { until: userUntil, userForced: true };
  if (globalUntil) return { until: globalUntil, userForced: false };
  return { until: null, userForced: false };
}

export function getSurveyWindowStatus(input: SurveyWindowInput): SurveyWindowStatus {
  const now = input.now ?? new Date();
  const openMinutes = Math.max(1, Number(input.surveyOpenMinutes ?? 1440) || 1440);
  const enabled = Boolean(input.enabled) && (input.questionsLength ?? 0) > 0;
  const endTime = resolveActivityEndTime(input);
  const { until: forceOpenUntil, userForced } = resolveEffectiveForceOpenUntil(input);

  const explicitOpen = toDateSafe(input.openAt);
  const explicitClose = toDateSafe(input.closeAt);
  const useExplicit = !!(explicitOpen || explicitClose);

  let openTime: Date | null = explicitOpen;
  let closeTime: Date | null = explicitClose;

  if (useExplicit) {
    if (!openTime && closeTime) {
      // มีแค่ปิด — เปิดตั้งแต่จบกิจกรรม หรือทันทีถ้าไม่มี end
      openTime = endTime ?? new Date(0);
    }
    if (!closeTime && openTime) {
      closeTime = new Date(openTime.getTime() + openMinutes * 60 * 1000);
    }
  } else {
    // โหมดเก่า: เปิดหลังจบกิจกรรม ตามนาที
    openTime = endTime;
    closeTime = endTime ? new Date(endTime.getTime() + openMinutes * 60 * 1000) : null;
  }

  if (!enabled) {
    return {
      enabled: false,
      open: false,
      expired: false,
      notStarted: false,
      endTime,
      openTime,
      closeTime: null,
      forceOpenUntil,
      userForced: false,
      openMinutes,
      label: 'disabled',
    };
  }

  const naturalOpen = !!(openTime && closeTime && now >= openTime && now <= closeTime);
  const forcedOpen = !!(forceOpenUntil && now <= forceOpenUntil);
  const open = naturalOpen || forcedOpen;
  const notStarted = !!(openTime && now < openTime && !forcedOpen);
  const expired =
    !open && !notStarted && !!(closeTime && now > closeTime && !forcedOpen);

  let label: SurveyWindowStatus['label'] = 'expired';
  if (forcedOpen && !naturalOpen) label = 'forced_open';
  else if (open) label = 'open';
  else if (notStarted) label = 'not_started';
  else if (!closeTime && !openTime) label = 'expired';
  else label = 'expired';

  return {
    enabled: true,
    open,
    expired,
    notStarted,
    endTime,
    openTime,
    closeTime,
    forceOpenUntil,
    userForced: forcedOpen && userForced && !naturalOpen,
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
      return status.userForced
        ? 'เปิดพิเศษ (แอดมินอนุญาตรายบุคคล)'
        : 'เปิดพิเศษ (แอดมินขยายเวลา)';
    case 'not_started':
      return 'ยังไม่ถึงเวลาทำแบบประเมิน';
    case 'expired':
      return 'หมดเวลาทำแบบประเมิน';
    default:
      return 'ไม่มีแบบประเมิน';
  }
}
