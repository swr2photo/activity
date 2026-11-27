/**
 * ย้ายไฟล์ที่เก็บเป็น base64 (data: URL) ในเอกสาร Firestore ไปไว้ใน Firebase Storage
 *
 * ทำไม: ตอน Storage ใช้ไม่ได้ (โควตา/billing) ระบบอัปโหลดจะ fallback เป็น data URL ใส่ในเอกสารตรง ๆ
 * → เอกสารกิจกรรมบวมหลายร้อย KB ทุก query ฝั่งแอดมินต้องดาวน์โหลดก้อนนี้ซ้ำ
 *   และหน้ารวมกิจกรรมสาธารณะต้องตัดแบนเนอร์ทิ้ง (ไม่แสดงรูป)
 *
 * ครอบคลุม: ทุกฟิลด์ที่เป็น string ขึ้นต้น "data:" (bannerUrl, dynamicQrBgUrl, adImageUrl,
 * files[].url, sessions[].files[].url ฯลฯ) และ <img src="data:..."> ที่ฝังใน HTML (เช่น description)
 *
 * ใช้ได้เฉพาะฝั่งเซิร์ฟเวอร์ (firebase-admin)
 */
import { randomUUID, createHash } from 'crypto';
import { getAdminBucket, getAdminDb } from '@/lib/firebaseAdmin';
import {
  MIME_EXT,
  buildDownloadUrl,
  findDataUrls,
  parseDataUrl,
  replaceDataUrls,
  type FoundMedia,
  type Uploader,
} from '@/lib/mediaMigrationCore';

export { findDataUrls, parseDataUrl, replaceDataUrls, type FoundMedia };

export const MEDIA_COLLECTIONS = ['activityQRCodes', 'activities', 'customShortLinks'] as const;

const SCAN_CHUNK_SIZE = 50;

export type ScanBucketStat = {
  items: number;
  bytes: number;
};

export type ScanCollectionStat = {
  docs: number;
  docsWithMedia: number;
  items: number;
  bytes: number;
};

export type ScanResult = {
  docs: number;
  docsWithMedia: number;
  items: number;
  bytes: number;
  byField: Record<string, ScanBucketStat>;
  byCollection: Record<string, ScanCollectionStat>;
};

/**
 * สำรวจว่ามี data URL ค้างอยู่เท่าไร (อ่านอย่างเดียว)
 * อ่านทีละชุด (50 เอกสาร) เพื่อไม่ให้โหลด base64 ทั้งหมดเข้า RAM พร้อมกัน
 */
export async function scanMedia(): Promise<ScanResult> {
  const db = getAdminDb();
  const res: ScanResult = {
    docs: 0,
    docsWithMedia: 0,
    items: 0,
    bytes: 0,
    byField: {},
    byCollection: {},
  };

  for (const col of MEDIA_COLLECTIONS) {
    const colStat: ScanCollectionStat = { docs: 0, docsWithMedia: 0, items: 0, bytes: 0 };
    res.byCollection[col] = colStat;
    let afterId = '';

    while (true) {
      let q = db.collection(col).orderBy('__name__').limit(SCAN_CHUNK_SIZE);
      if (afterId) q = q.startAfter(afterId);
      const snap = await q.get();
      if (snap.empty) break;

      for (const d of snap.docs) {
        res.docs++;
        colStat.docs++;
        const found = findDataUrls(d.data());
        if (found.length) {
          res.docsWithMedia++;
          colStat.docsWithMedia++;
        }
        for (const f of found) {
          res.items++;
          res.bytes += f.bytes;
          colStat.items++;
          colStat.bytes += f.bytes;
          const bucket = (res.byField[f.field] ??= { items: 0, bytes: 0 });
          bucket.items++;
          bucket.bytes += f.bytes;
        }
        afterId = d.id;
      }

      if (snap.size < SCAN_CHUNK_SIZE) break;
    }
  }
  return res;
}

export type MigrateResult = {
  processedDocs: number;
  migratedDocs: number;
  migratedItems: number;
  uploadedBytes: number;
  skipped: number;
  errors: { doc: string; error: string }[];
  /** ข้อผิดพลาดของ Storage เอง (เช่น billing/โควตา) — หยุดทั้งชุด */
  storageError?: string;
  nextCursor: string | null;
  done: boolean;
};

class StorageUploadError extends Error {}

/**
 * ย้ายทีละชุด (เรียงตาม collection แล้วตาม document ID) เพื่อไม่ให้เกินเวลาของ serverless function
 * cursor รูปแบบ "<collection>/<docId ล่าสุดที่ทำแล้ว>"
 */
export async function migrateMediaBatch(
  cursor: string | null,
  batchSize = 15
): Promise<MigrateResult> {
  const db = getAdminDb();
  const result: MigrateResult = {
    processedDocs: 0,
    migratedDocs: 0,
    migratedItems: 0,
    uploadedBytes: 0,
    skipped: 0,
    errors: [],
    nextCursor: cursor,
    done: false,
  };

  let bucket: ReturnType<typeof getAdminBucket>;
  try {
    bucket = getAdminBucket();
  } catch (err: any) {
    result.storageError = String(err?.message || err).slice(0, 300);
    return result;
  }

  const [startCol, startAfterId = ''] = cursor ? cursor.split('/') : [MEDIA_COLLECTIONS[0], ''];
  let colIndex = Math.max(
    0,
    MEDIA_COLLECTIONS.indexOf(startCol as (typeof MEDIA_COLLECTIONS)[number])
  );
  let afterId = startAfterId;

  while (colIndex < MEDIA_COLLECTIONS.length && result.processedDocs < batchSize) {
    const colName = MEDIA_COLLECTIONS[colIndex];
    const want = batchSize - result.processedDocs;
    let q = db.collection(colName).orderBy('__name__').limit(want);
    if (afterId) q = q.startAfter(afterId);
    const snap = await q.get();

    for (const d of snap.docs) {
      const data = d.data();
      const fields = Array.from(new Set(findDataUrls(data).map((f) => f.field)));
      if (fields.length > 0) {
        // แคชต่อเอกสารเผื่อ data URL เดียวกันซ้ำหลายตำแหน่งในเอกสารเดียว
        const dedupeCache = new Map<string, { url: string; path: string; bytes: number }>();
        const allUploadedPaths = new Set<string>();
        const fieldMeta = new Map<string, { paths: Set<string>; items: number; bytes: number }>();

        try {
          const patch: Record<string, unknown> = {};
          for (const field of fields) {
            const meta = { paths: new Set<string>(), items: 0, bytes: 0 };
            fieldMeta.set(field, meta);

            const uploadForField: Uploader = async (dataUrl, mime, hint) => {
              const cached = dedupeCache.get(dataUrl);
              if (cached) {
                meta.paths.add(cached.path);
                meta.items++;
                return cached.url;
              }
              const parsed = parseDataUrl(dataUrl);
              if (!parsed) throw new Error(`Invalid base64 data URL in field "${field}"`);

              const hash = createHash('sha1').update(parsed.buffer).digest('hex').slice(0, 10);
              const safeHint = hint.replace(/[^a-z0-9_-]/gi, '').slice(0, 40) || 'file';
              const ext = MIME_EXT[parsed.mime] || MIME_EXT[mime] || 'bin';
              const path = `migrated/${colName}/${d.id}/${safeHint}_${hash}.${ext}`;
              const token = randomUUID();
              try {
                await bucket.file(path).save(parsed.buffer, {
                  resumable: false,
                  contentType: parsed.mime,
                  metadata: {
                    cacheControl: 'public,max-age=31536000,immutable',
                    metadata: {
                      firebaseStorageDownloadTokens: token,
                      migratedFrom: `${colName}/${d.id}`,
                    },
                  },
                });
              } catch (err: any) {
                throw new StorageUploadError(String(err?.message || err));
              }

              const url = buildDownloadUrl(bucket.name, path, token);
              allUploadedPaths.add(path);
              dedupeCache.set(dataUrl, { url, path, bytes: parsed.buffer.length });
              meta.paths.add(path);
              meta.items++;
              meta.bytes += parsed.buffer.length;
              return url;
            };

            patch[field] = await replaceDataUrls(data[field], uploadForField, field);
          }

          // เขียนกลับเฉพาะฟิลด์ที่ยังเป็นค่าเดิม (กันทับการแก้ไขที่เกิดระหว่างย้าย)
          const appliedFields = await db.runTransaction(async (tx) => {
            const cur = await tx.get(d.ref);
            if (!cur.exists) return [] as string[];
            const curData = cur.data() || {};
            const safe: Record<string, unknown> = {};
            const applied: string[] = [];
            for (const field of fields) {
              if (JSON.stringify(curData[field]) === JSON.stringify(data[field])) {
                safe[field] = patch[field];
                applied.push(field);
              }
            }
            if (applied.length) {
              tx.update(d.ref, { ...safe, mediaMigratedAt: new Date() });
            }
            return applied;
          });

          const appliedPathSet = new Set<string>();
          for (const field of appliedFields) {
            const meta = fieldMeta.get(field);
            if (!meta) continue;
            result.migratedItems += meta.items;
            result.uploadedBytes += meta.bytes;
            meta.paths.forEach((p) => appliedPathSet.add(p));
          }
          if (appliedFields.length > 0) result.migratedDocs++;
          if (appliedFields.length < fields.length) {
            result.skipped += fields.length - appliedFields.length;
            // ลบไฟล์ของฟิลด์ที่ถูกข้าม (หากไม่มีฟิลด์อื่นที่เขียนสำเร็จใช้งานร่วม)
            const orphanPaths = Array.from(allUploadedPaths).filter((p) => !appliedPathSet.has(p));
            if (orphanPaths.length) {
              await Promise.all(orphanPaths.map((p) => bucket.file(p).delete().catch(() => {})));
            }
          }
        } catch (err: any) {
          // ไม่สำเร็จ → ลบไฟล์ที่อัปโหลดไปแล้วของเอกสารนี้ ไม่ให้มีไฟล์กำพร้า
          if (allUploadedPaths.size) {
            await Promise.all(
              Array.from(allUploadedPaths).map((p) => bucket.file(p).delete().catch(() => {}))
            );
          }
          if (err instanceof StorageUploadError) {
            // Storage ใช้ไม่ได้ (billing/โควตา/สิทธิ์) → หยุดทั้งชุด รอบหน้าเริ่มที่เอกสารนี้ใหม่
            result.storageError = err.message.slice(0, 300);
            result.nextCursor = `${colName}/${afterId}`;
            return result;
          }
          result.errors.push({
            doc: `${colName}/${d.id}`,
            error: String(err?.message || err).slice(0, 300),
          });
        }
      }
      result.processedDocs++;
      afterId = d.id;
    }

    if (snap.size < want) {
      // collection นี้หมดแล้ว → ไปต่อ collection ถัดไป
      colIndex++;
      afterId = '';
    }
  }

  result.done = colIndex >= MEDIA_COLLECTIONS.length;
  result.nextCursor = result.done ? null : `${MEDIA_COLLECTIONS[colIndex]}/${afterId}`;
  return result;
}
