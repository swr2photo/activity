import { createHmac, timingSafeEqual } from 'crypto';

/** ต้องตรงกับ src/lib/dynamicQrConstants.ts (แยกไฟล์เพื่อให้ client import ได้โดยไม่ดึง crypto) */
export const DYNAMIC_QR_WINDOW_SECONDS = 45;

const TOKEN_LEN = 16;

export function getDynamicQrSecret(): string {
  const fromEnv = (process.env.DYNAMIC_QR_SECRET || '').trim();
  if (fromEnv.length >= 16) return fromEnv;

  if (process.env.NODE_ENV !== 'production') {
    return 'dev-dynamic-qr-secret-change-me';
  }

  throw new Error('DYNAMIC_QR_SECRET ยังไม่ได้ตั้งค่า (ต้องยาวอย่างน้อย 16 ตัวอักษร)');
}

export function getWindowIndex(nowMs = Date.now()): number {
  return Math.floor(nowMs / (DYNAMIC_QR_WINDOW_SECONDS * 1000));
}

/** วินาทีที่เหลือก่อนจบหน้าต่างปัจจุบัน (อย่างน้อย 1) */
export function secondsUntilWindowEnd(nowMs = Date.now()): number {
  const windowMs = DYNAMIC_QR_WINDOW_SECONDS * 1000;
  const rem = windowMs - (nowMs % windowMs);
  return Math.max(1, Math.ceil(rem / 1000));
}

export function makeDynamicQrToken(
  secret: string,
  activityCode: string,
  windowIndex: number
): string {
  const code = String(activityCode || '').trim().toUpperCase();
  const msg = `v1|${code}|${windowIndex}`;
  return createHmac('sha256', secret).update(msg).digest('base64url').slice(0, TOKEN_LEN);
}

function safeEqualToken(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
  } catch {
    return false;
  }
}

/** ตรวจ token — รับช่วงเวลาปัจจุบันและช่วงก่อนหน้า (กันสแกนตอนใกล้หมดรอบ) */
export function verifyDynamicQrToken(
  secret: string,
  activityCode: string,
  token: string,
  nowMs = Date.now()
): boolean {
  const dt = String(token || '').trim();
  if (dt.length < 8) return false;

  const idx = getWindowIndex(nowMs);
  for (const w of [idx, idx - 1]) {
    if (w < 0) continue;
    const expected = makeDynamicQrToken(secret, activityCode, w);
    if (safeEqualToken(expected, dt)) return true;
  }
  return false;
}

export function currentDynamicQrToken(secret: string, activityCode: string, nowMs = Date.now()) {
  const windowIndex = getWindowIndex(nowMs);
  return {
    token: makeDynamicQrToken(secret, activityCode, windowIndex),
    windowIndex,
    windowSeconds: DYNAMIC_QR_WINDOW_SECONDS,
    expiresIn: secondsUntilWindowEnd(nowMs),
  };
}
