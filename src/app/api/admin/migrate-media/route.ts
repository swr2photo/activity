import { NextRequest, NextResponse } from 'next/server';
import { ApiAuthError, verifyAdminToken } from '@/lib/apiAuth';
import { migrateMediaBatch, scanMedia } from '@/lib/mediaMigration';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** GET: สำรวจว่ามีไฟล์ base64 ค้างในเอกสารกิจกรรมเท่าไร (อ่านอย่างเดียว) */
export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req, { allowedRoles: ['super_admin'] });
    return NextResponse.json(await scanMedia());
  } catch (err: any) {
    const status = err instanceof ApiAuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || 'scan failed' }, { status });
  }
}

/**
 * POST { cursor?: string, batchSize?: number }: ย้ายทีละชุดไป Storage
 * เรียกซ้ำด้วย nextCursor จนกว่า done = true
 */
export async function POST(req: NextRequest) {
  try {
    await verifyAdminToken(req, { allowedRoles: ['super_admin'] });
    const body = (await req.json().catch(() => ({}))) as { cursor?: unknown; batchSize?: unknown };
    const cursor = typeof body.cursor === 'string' && body.cursor.trim() ? body.cursor.trim() : null;
    const batchSize = Math.max(1, Math.min(30, Math.floor(Number(body.batchSize) || 15)));
    const result = await migrateMediaBatch(cursor, batchSize);
    // คืน 200 พร้อม storageError ใน JSON เพื่อให้หน้าจอแสดงคำแนะนำอย่างชัดเจนโดยไม่เกิด error แดง 503 ใน Console
    return NextResponse.json(result, { status: 200 });
  } catch (err: any) {
    const status = err instanceof ApiAuthError ? err.status : 500;
    return NextResponse.json({ error: err?.message || 'migration failed' }, { status });
  }
}
