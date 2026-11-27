/**
 * ฟังก์ชันบริสุทธิ์สำหรับสำรวจ แปลง และแทนที่ data: URL (base64)
 * แยกออกจาก firebase-admin เพื่อให้ทดสอบด้วย unit test ได้โดยตรง
 */

export const DATA_URL_RE =
  /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*;base64,([a-z0-9+/=\s]+)$/i;

export const INLINE_DATA_URL_RE =
  /(["'(])(data:([a-z0-9.+-]+\/[a-z0-9.+-]+)(?:;[a-z0-9=.+-]+)*;base64,[a-z0-9+/=\s]+)(["')])/gi;

export const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/svg+xml': 'svg',
  'application/pdf': 'pdf',
};

export type FoundMedia = {
  field: string;
  path: string;
  mime: string;
  bytes: number;
};

export type Uploader = (dataUrl: string, mime: string, hint: string) => Promise<string>;

/** ตรวจว่าเป็น plain object เท่านั้น (ไม่แตะ Timestamp, GeoPoint, Date, Buffer ฯลฯ) */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (!v || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/** คำนวณขนาดไฟล์จริง (ไบต์) จากสตริง base64 */
export function base64Bytes(b64: string): number {
  const clean = b64.replace(/\s/g, '');
  if (!clean) return 0;
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0;
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding);
}

/** แปลง data: URL เป็น mime + Buffer (คืน null หากรูปแบบไม่ถูกต้องหรือว่าง) */
export function parseDataUrl(dataUrl: string): { mime: string; buffer: Buffer } | null {
  const m = dataUrl.trim().match(DATA_URL_RE);
  if (!m) return null;
  const mime = m[1].toLowerCase();
  const cleanB64 = m[2].replace(/\s/g, '');
  if (!cleanB64) return null;
  const buffer = Buffer.from(cleanB64, 'base64');
  if (buffer.length === 0) return null;
  return { mime, buffer };
}

/** สำรวจค่าใด ๆ แบบลึก แล้วคืนรายการ data URL ที่พบ (ไม่แก้ไขข้อมูลเดิม) */
export function findDataUrls(value: unknown, path = ''): FoundMedia[] {
  const out: FoundMedia[] = [];
  const visit = (v: unknown, p: string) => {
    if (typeof v === 'string') {
      const trimmed = v.trim();
      const m = trimmed.match(DATA_URL_RE);
      if (m) {
        out.push({
          field: p.split(/[.[]/)[0],
          path: p,
          mime: m[1].toLowerCase(),
          bytes: base64Bytes(m[2]),
        });
        return;
      }
      if (v.includes('data:') && v.includes('base64,')) {
        for (const im of v.matchAll(INLINE_DATA_URL_RE)) {
          const b64Part = im[2].split('base64,')[1] || '';
          out.push({
            field: p.split(/[.[]/)[0],
            path: `${p}<inline>`,
            mime: im[3].toLowerCase(),
            bytes: base64Bytes(b64Part),
          });
        }
      }
      return;
    }
    if (Array.isArray(v)) {
      v.forEach((x, i) => visit(x, `${p}[${i}]`));
    } else if (isPlainObject(v)) {
      for (const [k, x] of Object.entries(v)) {
        visit(x, p ? `${p}.${k}` : k);
      }
    }
  };
  visit(value, path);
  return out;
}

/** แทนที่ data URL ทุกจุดด้วย URL จาก uploader (คืนค่าใหม่ ไม่แก้ไขของเดิม) */
export async function replaceDataUrls(
  value: unknown,
  upload: Uploader,
  hint: string
): Promise<unknown> {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    const m = trimmed.match(DATA_URL_RE);
    if (m) return upload(trimmed, m[1].toLowerCase(), hint);
    if (value.includes('data:') && value.includes('base64,')) {
      let result = value;
      for (const im of Array.from(value.matchAll(INLINE_DATA_URL_RE))) {
        const url = await upload(im[2], im[3].toLowerCase(), `${hint}_inline`);
        result = result.replace(im[2], () => url);
      }
      return result;
    }
    return value;
  }
  if (Array.isArray(value)) {
    const arr: unknown[] = [];
    for (let i = 0; i < value.length; i++) {
      arr.push(await replaceDataUrls(value[i], upload, `${hint}_${i}`));
    }
    return arr;
  }
  if (isPlainObject(value)) {
    const obj: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      obj[k] = await replaceDataUrls(v, upload, `${hint}_${k}`);
    }
    return obj;
  }
  return value;
}

/** สร้าง URL ดาวน์โหลดแบบเดียวกับ getDownloadURL() ของ Firebase (มี token) */
export function buildDownloadUrl(bucket: string, path: string, token: string): string {
  return `https://firebasestorage.googleapis.com/v0/b/${bucket}/o/${encodeURIComponent(path)}?alt=media&token=${token}`;
}
