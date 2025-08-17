// src/app/api/invites/delete/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const { id } = await req.json() as { id?: string };
    if (!id) return NextResponse.json({ ok: false, error: 'Missing id' }, { status: 400 });

    await adminDb.collection('adminInvites').doc(id).delete();
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Delete invite failed' }, { status: 500 });
  }
}
