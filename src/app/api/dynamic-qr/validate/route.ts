import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { getDynamicQrSecret, verifyDynamicQrToken } from '@/lib/dynamicQrToken';

export const runtime = 'nodejs';

type ActivityQrDoc = {
  activityCode?: string;
  dynamicQREnabled?: boolean;
  dynamicToken?: string;
  previousDynamicToken?: string;
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
  return snap.docs[0].data() as ActivityQrDoc;
}

export async function GET(req: NextRequest) {
  try {
    const code = (req.nextUrl.searchParams.get('code') || '').trim();
    const dt = (req.nextUrl.searchParams.get('dt') || '').trim();

    if (!code || !dt) {
      return NextResponse.json({ valid: false, reason: 'missing_params' }, { status: 400 });
    }

    const activity = await resolveActivity(code);
    if (!activity) {
      return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 404 });
    }

    if (activity.dynamicQREnabled !== true) {
      return NextResponse.json({ valid: true, reason: 'dynamic_disabled' });
    }

    const activityCode = String(activity.activityCode || code).trim().toUpperCase();
    const secret = getDynamicQrSecret();
    const hmacOk = verifyDynamicQrToken(secret, activityCode, dt);

    // รองรับ QR เก่าที่ยังใช้ dynamicToken จาก Firestore (ช่วงเปลี่ยนผ่าน)
    const legacyOk =
      dt === activity.dynamicToken || dt === activity.previousDynamicToken;

    return NextResponse.json({
      valid: hmacOk || Boolean(legacyOk),
      reason: hmacOk ? 'hmac' : legacyOk ? 'legacy' : 'invalid',
    });
  } catch (e: any) {
    return NextResponse.json(
      { valid: false, reason: 'error', error: e?.message || 'failed' },
      { status: 500 }
    );
  }
}
