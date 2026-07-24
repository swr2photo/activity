import { createHmac, timingSafeEqual } from 'crypto';

/** ต้องตรงกับ src/lib/dynamicQrConstants.ts (แยกไฟล์เพื่อให้ client import ได้โดยไม่ดึง crypto) */
export const DYNAMIC_QR_WINDOW_SECONDS = 45;

/**
 * จำนวนหน้าต่างก่อนหน้าที่ยอมรับได้ (นอกเหนือจากหน้าต่างปัจจุบัน)
 * เช่น 3 = รับได้สูงสุด ~4×45s ≈ 3 นาที (กันโหลดหน้ารอบแรกช้า)
 */
export const DYNAMIC_QR_ACCEPT_PREVIOUS_WINDOWS = 3;

/**
 * อายุ “สิทธิ์หลังสแกน” (วินาที) — ใช้ข้ามช่วง login / เน็ตช้าโดยไม่ต้องสแกนใหม่
 * ผูกกับ token ที่เคย validate ผ่านแล้วเท่านั้น
 */
export const DYNAMIC_QR_CLAIM_TTL_SECONDS = 15 * 60;

const TOKEN_LEN = 16;
const CLAIM_SIG_LEN = 20;

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

/** ตรวจ token — รับช่วงปัจจุบันและช่วงก่อนหน้าหลายรอบ (กันโหลดช้า / ใกล้หมดรอบ) */
export function verifyDynamicQrToken(
  secret: string,
  activityCode: string,
  token: string,
  nowMs = Date.now()
): boolean {
  const dt = String(token || '').trim();
  if (dt.length < 8) return false;

  const idx = getWindowIndex(nowMs);
  const maxPrev = Math.max(0, Math.floor(DYNAMIC_QR_ACCEPT_PREVIOUS_WINDOWS));
  for (let back = 0; back <= maxPrev; back++) {
    const w = idx - back;
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

function claimPayload(activityCode: string, dt: string, expiresAtSec: number): string {
  const code = String(activityCode || '').trim().toUpperCase();
  const token = String(dt || '').trim();
  return `claim|v1|${code}|${token}|${expiresAtSec}`;
}

/** ออกสิทธิ์ชั่วคราวหลังสแกน QR ผ่านแล้ว (ใช้ข้ามช่วง login) */
export function makeDynamicQrClaim(
  secret: string,
  activityCode: string,
  dt: string,
  nowMs = Date.now(),
  ttlSeconds = DYNAMIC_QR_CLAIM_TTL_SECONDS
): { claim: string; expiresAt: number } {
  const ttl = Math.max(60, Math.floor(ttlSeconds || DYNAMIC_QR_CLAIM_TTL_SECONDS));
  const expiresAtSec = Math.floor(nowMs / 1000) + ttl;
  const sig = createHmac('sha256', secret)
    .update(claimPayload(activityCode, dt, expiresAtSec))
    .digest('base64url')
    .slice(0, CLAIM_SIG_LEN);
  return {
    claim: `${expiresAtSec}.${sig}`,
    expiresAt: expiresAtSec * 1000,
  };
}

/** ตรวจสิทธิ์หลังสแกน — ต้องตรง activity + dt เดิม และยังไม่หมดอายุ */
export function verifyDynamicQrClaim(
  secret: string,
  activityCode: string,
  dt: string,
  claim: string,
  nowMs = Date.now()
): boolean {
  const raw = String(claim || '').trim();
  const token = String(dt || '').trim();
  if (!raw || token.length < 8) return false;

  const [expStr, sig] = raw.split('.');
  const expiresAtSec = Number(expStr);
  if (!Number.isFinite(expiresAtSec) || !sig || sig.length < 8) return false;
  if (Math.floor(nowMs / 1000) > expiresAtSec) return false;

  const expected = createHmac('sha256', secret)
    .update(claimPayload(activityCode, token, expiresAtSec))
    .digest('base64url')
    .slice(0, CLAIM_SIG_LEN);

  return safeEqualToken(expected, sig);
}
