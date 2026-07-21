/**
 * ข้อความเมื่อ Dynamic QR หมดอายุ / ไม่ถูกต้อง
 * แยกตามจุดลงทะเบียนหน้างานที่แอดมินตั้งไว้
 */

export type DynamicQrExpiredContext = {
  /** ชื่อจุดลงทะเบียนหน้างานที่แอดมินตั้ง (เช่น "โต๊ะลงทะเบียน หน้าหอประชุม") */
  onsiteRegistrationPoint?: string | null;
  /** สถานที่กิจกรรม (fallback ถ้ายังไม่ตั้งจุดเฉพาะ) */
  location?: string | null;
  /** เปิด Dynamic QR / ลงทะเบียนหน้างานด้วยจอ Rolling */
  dynamicQREnabled?: boolean;
  /** สาเหตุจาก validate API หรือ client */
  reason?: "missing_dt" | "invalid" | "expired" | string | null;
};

export function resolveOnsiteRegistrationPoint(
  ctx: Pick<DynamicQrExpiredContext, "onsiteRegistrationPoint" | "location">
): string | null {
  const point = String(ctx.onsiteRegistrationPoint || "").trim();
  if (point) return point;
  const loc = String(ctx.location || "").trim();
  if (loc) return loc;
  return null;
}

/** หัวข้อเต็มหน้า */
export function dynamicQrExpiredTitle(ctx: DynamicQrExpiredContext): string {
  const point = resolveOnsiteRegistrationPoint(ctx);
  if (ctx.dynamicQREnabled && point) {
    return `QR หมดอายุ — สแกนใหม่ที่ ${point}`;
  }
  if (ctx.reason === "missing_dt") {
    return "ต้องสแกน QR จากจุดลงทะเบียน";
  }
  return "QR Code หมดอายุแล้ว";
}

/** ข้อความอธิบาย */
export function dynamicQrExpiredMessage(ctx: DynamicQrExpiredContext): string {
  const point = resolveOnsiteRegistrationPoint(ctx);

  if (ctx.reason === "missing_dt") {
    if (point) {
      return `ลิงก์นี้ใช้ไม่ได้โดยตรง กรุณาสแกน QR จากจอที่จุดลงทะเบียนหน้างาน: ${point}`;
    }
    return "ลิงก์นี้ใช้ไม่ได้โดยตรง กรุณาสแกน QR จากหน้าจอจุดลงทะเบียนที่จัดไว้หน้างาน";
  }

  if (ctx.dynamicQREnabled && point) {
    return `QR Code หมดอายุ หรือไม่ถูกต้อง กรุณาสแกนใหม่จากจอที่จุดลงทะเบียน: ${point}`;
  }

  if (ctx.dynamicQREnabled) {
    return "QR Code หมดอายุ หรือไม่ถูกต้อง กรุณาสแกนใหม่จากหน้าจอจุดลงทะเบียนที่จัดไว้หน้างาน (ผู้จัดตั้งชื่อจุดได้ในระบบแอดมิน)";
  }

  return "QR Code หมดอายุ หรือไม่ถูกต้อง กรุณาสแกนใหม่อีกครั้ง";
}
