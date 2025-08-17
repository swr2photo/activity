// src/app/api/invites/list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function toMs(ts: any) {
  return ts?.toMillis ? ts.toMillis() : (typeof ts === 'number' ? ts : null);
}

export async function GET(req: NextRequest) {
  try {
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? 100);
    const qs = await adminDb
      .collection('adminInvites')
      .orderBy('createdAt', 'desc')
      .limit(limit)
      .get();

    const items = qs.docs.map(d => {
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
    return NextResponse.json({ ok: false, error: e?.message || 'List invites failed' }, { status: 500 });
  }
}
