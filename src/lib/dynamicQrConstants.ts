/** ความยาวหน้าต่างเวลาต่อหนึ่ง QR (วินาที) — จอ Rolling หมุนตามค่านี้ */
export const DYNAMIC_QR_WINDOW_SECONDS = 45;

/**
 * จำนวนหน้าต่างก่อนหน้าที่ยอมรับได้ (นอกจากหน้าต่างปัจจุบัน)
 * ต้องสอดคล้องกับ dynamicQrToken.ts
 */
export const DYNAMIC_QR_ACCEPT_PREVIOUS_WINDOWS = 3;

/** อายุสิทธิ์หลังสแกนสำเร็จ (วินาที) — ข้ามช่วง login / เน็ตช้า */
export const DYNAMIC_QR_CLAIM_TTL_SECONDS = 15 * 60;

export const dynamicQrClaimStorageKey = (activityCode: string) =>
  `dqr_claim_v1_${String(activityCode || '').trim().toUpperCase()}`;
