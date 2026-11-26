/**
 * จัดรูปแบบวันเวลาด้วยเขตเวลาไทยเสมอ
 *
 * เซิร์ฟเวอร์ (Vercel/Cloud Run) ทำงานด้วย UTC ส่วนเบราว์เซอร์ผู้ใช้เป็นเวลาไทย
 * ถ้าไม่ระบุ timeZone ข้อความที่ render บนเซิร์ฟเวอร์จะต่างจากฝั่ง client 7 ชั่วโมง
 * → React hydration error #418 และหน้าที่ render บนเซิร์ฟเวอร์แสดงเวลาผิด
 */
export const TH_TIME_ZONE = 'Asia/Bangkok';
export const TH_LOCALE = 'th-TH';

const cache = new Map<string, Intl.DateTimeFormat>();

/** คืน Intl.DateTimeFormat (cache ไว้ใช้ซ้ำ) ที่ล็อกเขตเวลาไทย */
export function thDateFormat(options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  const key = JSON.stringify(options);
  let fmt = cache.get(key);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat(TH_LOCALE, { ...options, timeZone: TH_TIME_ZONE });
    cache.set(key, fmt);
  }
  return fmt;
}

/** จัดรูปแบบวันเวลาเป็นภาษาไทยตามเวลาไทย */
export function formatThai(date: Date, options: Intl.DateTimeFormatOptions): string {
  return thDateFormat(options).format(date);
}
