import { NextResponse } from 'next/server';
import { getCachedActivities } from '@/lib/activitiesServer';

export const runtime = 'nodejs';
/** อย่า prerender ตอน build — service account มีเฉพาะตอน runtime */
export const dynamic = 'force-dynamic';

/** เบราว์เซอร์ revalidate เสมอ แต่ CDN เสิร์ฟของเดิมได้ 60 วิ */
const CACHE_CONTROL = 'public, max-age=0, s-maxage=60, stale-while-revalidate=300';

export async function GET() {
  try {
    const items = await getCachedActivities();

    return NextResponse.json(
      { activities: items },
      { headers: { 'Cache-Control': CACHE_CONTROL } }
    );
  } catch (err) {
    console.error('[api/activities] error:', err);
    return NextResponse.json({ error: 'failed to load activities' }, { status: 500 });
  }
}
