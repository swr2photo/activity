import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/apiAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { currentDynamicQrToken, getDynamicQrSecret } from '@/lib/dynamicQrToken';

export const runtime = 'nodejs';

type ActivityQrDoc = {
  id: string;
  activityCode?: string;
  customCode?: string;
  dynamicQREnabled?: boolean;
};

async function resolveActivity(code: string): Promise<ActivityQrDoc | null> {
  const db = getAdminDb();
  const normalized = code.trim().toUpperCase();

  let snap = await db
    .collection('activityQRCodes')
    .where('activityCode', '==', normalized)
    .limit(1)
    .get();

  if (snap.empty) {
    snap = await db
      .collection('activityQRCodes')
      .where('activityCode', '==', code.trim())
      .limit(1)
      .get();
  }

  if (snap.empty) return null;
  const doc = snap.docs[0];
  const data = doc.data() as Omit<ActivityQrDoc, 'id'>;
  return { id: doc.id, ...data };
}

export async function GET(req: NextRequest) {
  try {
    await verifyAdminToken(req);

    const code = (req.nextUrl.searchParams.get('code') || '').trim();
    if (!code) {
      return NextResponse.json({ error: 'missing code' }, { status: 400 });
    }

    const activity = await resolveActivity(code);
    if (!activity) {
      return NextResponse.json({ error: 'activity not found' }, { status: 404 });
    }

    if (activity.dynamicQREnabled !== true) {
      return NextResponse.json({ error: 'dynamic QR is not enabled' }, { status: 400 });
    }

    const activityCode = String(activity.activityCode || code).trim().toUpperCase();
    const secret = getDynamicQrSecret();
    const payload = currentDynamicQrToken(secret, activityCode);

    return NextResponse.json({
      activityCode,
      customCode: activity.customCode || null,
      token: payload.token,
      windowSeconds: payload.windowSeconds,
      expiresIn: payload.expiresIn,
    });
  } catch (e: any) {
    const msg = e?.message || 'failed';
    const status = String(msg).includes('Authentication') ? 401 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
