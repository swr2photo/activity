// src/app/api/invites/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json() as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });

    const ref = adminDb.collection('adminInvites').doc(id);
    const snap = await ref.get();
    if (!snap.exists) return NextResponse.json({ ok: false, error: 'Invite not found' }, { status: 404 });

    await ref.update({
      status: 'cancelled',
      token: null,                 // ทำให้ลิงก์กดยืนยันใช้ไม่ได้
      updatedAt: FieldValue.serverTimestamp(),
      cancelledAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Cancel failed' }, { status: 500 });
  }
}
