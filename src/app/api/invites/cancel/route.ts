// src/app/api/invites/cancel/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '../../../../lib/firebaseAdmin';
import { verifyAdminToken } from '../../../../lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req, { requiredPermission: 'manage_admins' });
    const { id } = (await req.json()) as { id?: string };
    if (!id) {
      return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });
    }

    const adminDb = getAdminDb();
    const ref = adminDb.collection('adminInvites').doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ ok: false, error: 'Invite not found' }, { status: 404 });
    }

    const invite = snap.data() as any;
    if (adminUser.role !== 'super_admin' && invite?.department !== adminUser.department) {
      return NextResponse.json({ ok: false, error: 'Forbidden' }, { status: 403 });
    }

    await ref.update({
      status: 'cancelled',
      token: null,
      updatedAt: FieldValue.serverTimestamp(),
      cancelledAt: FieldValue.serverTimestamp(),
    });

    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'Cancel failed' },
      { status: e?.status || 500 }
    );
  }
}
