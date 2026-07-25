/**
 * Lean payload for activity cards (หน้าแรก / /activities)
 * เอกสารจริงมี description (HTML), surveyConfig, sessions, files ซึ่งไม่ได้ใช้บนการ์ด
 * — ดึงมาทั้งก้อนทำให้โหลดช้ามาก
 */

/** ฟิลด์ที่การ์ดใช้จริง — ใช้กับ Admin SDK .select() */
export const ACTIVITY_LIST_FIELDS = [
  'activityCode',
  'activityName',
  'location',
  'startDateTime',
  'endDateTime',
  'isActive',
  'maxParticipants',
  'currentParticipants',
  'bannerUrl',
  'bannerColor',
  'bannerAspect',
  'closeReason',
  'department',
] as const;

export type ActivityListItem = {
  id: string;
  activityCode: string;
  activityName: string;
  location?: string;
  /** epoch ms — serialize ได้ ไม่ต้องแปลง Timestamp ซ้ำ */
  startDateTime?: number;
  endDateTime?: number;
  isActive?: boolean;
  maxParticipants?: number;
  currentParticipants?: number;
  bannerUrl?: string;
  bannerColor?: string;
  bannerAspect?: string;
  closeReason?: string;
  department?: string;
};

export function toMillis(value: unknown): number | undefined {
  if (value == null) return undefined;
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? undefined : parsed;
  }
  if (value instanceof Date) return value.getTime();

  const candidate = value as {
    toDate?: () => Date;
    seconds?: number;
    _seconds?: number;
  };
  if (typeof candidate.toDate === 'function') return candidate.toDate().getTime();
  if (typeof candidate.seconds === 'number') return candidate.seconds * 1000;
  if (typeof candidate._seconds === 'number') return candidate._seconds * 1000;
  return undefined;
}

/**
 * เลือกเฉพาะฟิลด์การ์ด + normalize เวลาเป็น epoch ms
 * (base64 banner ถูกตัดทิ้ง เพราะทำให้ payload บวมและ Next/Image ใช้ไม่ได้อยู่แล้ว)
 */
export function toActivityListItem(
  id: string,
  data: Record<string, unknown>
): ActivityListItem | null {
  const activityCode = String(data.activityCode ?? '').trim();
  if (!activityCode) return null;

  const bannerUrl = typeof data.bannerUrl === 'string' ? data.bannerUrl : undefined;

  return {
    id,
    activityCode,
    activityName: String(data.activityName ?? activityCode),
    location: typeof data.location === 'string' ? data.location : undefined,
    startDateTime: toMillis(data.startDateTime),
    endDateTime: toMillis(data.endDateTime),
    isActive: data.isActive !== false,
    maxParticipants: typeof data.maxParticipants === 'number' ? data.maxParticipants : 0,
    currentParticipants:
      typeof data.currentParticipants === 'number' ? data.currentParticipants : 0,
    bannerUrl: bannerUrl && !bannerUrl.startsWith('data:') ? bannerUrl : undefined,
    bannerColor: typeof data.bannerColor === 'string' ? data.bannerColor : undefined,
    bannerAspect: typeof data.bannerAspect === 'string' ? data.bannerAspect : 'cover',
    closeReason: typeof data.closeReason === 'string' ? data.closeReason : undefined,
    department: typeof data.department === 'string' ? data.department : undefined,
  };
}
