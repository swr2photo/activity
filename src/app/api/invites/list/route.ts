// src/app/api/invites/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '../../../../lib/firebaseAdmin';
import { verifyAdminToken } from '../../../../lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toMs(ts: any) {
  return ts?.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : null);
}

export async function GET(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req, { requiredPermission: 'manage_admins' });
    const adminDb = getAdminDb();
    const rawLimit = Number(req.nextUrl.searchParams.get('limit') ?? 100);
    const safeLimit = Number.isFinite(rawLimit) ? Math.max(1, Math.min(200, Math.floor(rawLimit))) : 100;

    let ref: FirebaseFirestore.Query = adminDb.collection('adminInvites');
    if (adminUser.role !== 'super_admin' && adminUser.department !== 'all') {
      ref = ref.where('department', '==', adminUser.department);
    }

    const qs = await ref.orderBy('createdAt', 'desc').limit(safeLimit).get();

    const items = qs.docs.map((d) => {
      const x = d.data() as any;
      return {
        id: d.id,
        email: x.email,
        role: x.role,
        department: x.department,
        permissions: x.permissions ?? [],
        status: x.status,
        token: x.token ?? null,
        invitedByUid: x.invitedByUid,
        invitedByEmail: x.invitedByEmail,
        createdAt: toMs(x.createdAt),
        updatedAt: toMs(x.updatedAt),
        expiresAt: toMs(x.expiresAt),
      };
    });

    return NextResponse.json({ ok: true, items });
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'List invites failed' },
      { status: e?.status || 500 }
    );
  }
}
