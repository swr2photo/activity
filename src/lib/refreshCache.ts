/**
 * Cache ข้ามรีเฟรชหน้า (sessionStorage)
 * — ส่วนที่ยังสดอยู่ไม่ต้องโหลด/ประมวลผลใหม่ทั้งก้อน
 * — หมดอายุแล้วค่อย revalidate เบื้องหลัง
 */

const PREFIX = "psu:rc:";

type Envelope<T> = {
  v: 1;
  at: number;
  data: T;
};

function canUseStorage(): boolean {
  return typeof window !== "undefined" && typeof sessionStorage !== "undefined";
}

export function readRefreshCache<T>(key: string): { data: T; at: number; ageMs: number } | null {
  if (!canUseStorage()) return null;
  try {
    const raw = sessionStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Envelope<T>;
    if (!parsed || parsed.v !== 1 || parsed.data === undefined) return null;
    const at = Number(parsed.at) || 0;
    return { data: parsed.data, at, ageMs: Date.now() - at };
  } catch {
    return null;
  }
}

export function writeRefreshCache<T>(key: string, data: T): void {
  if (!canUseStorage()) return;
  try {
    const envelope: Envelope<T> = { v: 1, at: Date.now(), data };
    sessionStorage.setItem(PREFIX + key, JSON.stringify(envelope));
  } catch {
    // quota / private mode — เงียบไว้
  }
}

export function clearRefreshCache(key: string): void {
  if (!canUseStorage()) return;
  try {
    sessionStorage.removeItem(PREFIX + key);
  } catch {
    /* ignore */
  }
}

export function clearAllRefreshCache(): void {
  if (!canUseStorage()) return;
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const k = sessionStorage.key(i);
      if (k?.startsWith(PREFIX)) keys.push(k);
    }
    keys.forEach((k) => sessionStorage.removeItem(k));
  } catch {
    /* ignore */
  }
}

/** ข้อมูลยังสดอยู่หรือไม่ */
export function isRefreshCacheFresh(key: string, ttlMs: number): boolean {
  const hit = readRefreshCache(key);
  return Boolean(hit && hit.ageMs < ttlMs);
}

/** คีย์มาตรฐาน */
export const RefreshCacheKey = {
  auth: "auth-shell",
  homeActivities: "home-activities",
} as const;

/** TTL แนะนำ */
export const RefreshCacheTtl = {
  /** โปรไฟล์ / เชลล์ auth — ข้ามดึง Firestore ถ้ายังไม่เกิน */
  auth: 5 * 60 * 1000,
  /** รายการกิจกรรมหน้าแรก */
  homeActivities: 2 * 60 * 1000,
} as const;
