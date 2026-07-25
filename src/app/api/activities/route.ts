import { NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import {
  ACTIVITY_LIST_FIELDS,
  ActivityListItem,
  toActivityListItem,
} from '@/lib/activitiesList';

export const runtime = 'nodejs';
/** อย่า prerender ตอน build — service account มีเฉพาะตอน runtime */
export const dynamic = 'force-dynamic';

const COLLECTION = 'activityQRCodes';
const MAX_ITEMS = 200;

/** เบราว์เซอร์ revalidate เสมอ แต่ CDN เสิร์ฟของเดิมได้ 60 วิ */
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

/** ผลลัพธ์เหมือนกันทุกคน — แคชในหน่วยความจำกันยิงซ้ำระหว่าง request */
let memoryCache: { at: number; items: ActivityListItem[] } | null = null;
const MEMORY_TTL_MS = 30_000;

async function loadActivities(): Promise<ActivityListItem[]> {
  const db = getAdminDb();
  const snap = await db
    .collection(COLLECTION)
    .select(...ACTIVITY_LIST_FIELDS)
    .limit(MAX_ITEMS)
    .get();

  return snap.docs.flatMap((doc) => {
    const item = toActivityListItem(doc.id, doc.data() as Record<string, unknown>);
    return item ? [item] : [];
  });
}

export async function GET() {
  try {
    if (memoryCache && Date.now() - memoryCache.at < MEMORY_TTL_MS) {
      return NextResponse.json(
        { activities: memoryCache.items },
        { headers: { 'Cache-Control': CACHE_CONTROL } }
      );
    }

    const items = await loadActivities();
    memoryCache = { at: Date.now(), items };

    return NextResponse.json(
      { activities: items },
      { headers: { 'Cache-Control': CACHE_CONTROL } }
    );
  } catch (err) {
    console.error('[api/activities] error:', err);
    // ให้ client fallback ไปอ่าน Firestore ตรงได้
    return NextResponse.json({ error: 'failed to load activities' }, { status: 500 });
  }
}
