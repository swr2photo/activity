// src/app/api/invites/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb, FieldValue, Timestamp } from '../../../../lib/firebaseAdmin';
import { sendMail } from '../../../../lib/email';
import { verifyAdminToken } from '../../../../lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  email: string;
  role: string;
  department: string;
  permissions?: string[];
  invitedByUid?: string;
  invitedByEmail?: string;
  expiresInHours?: number;
};

const SKIP_EMAIL = process.env.SKIP_EMAIL === '1';

function buildAcceptUrl(req: NextRequest, token: string) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  return `${origin}/api/invites/accept?token=${encodeURIComponent(token)}`;
}

export async function POST(req: NextRequest) {
  try {
    const adminUser = await verifyAdminToken(req, { requiredPermission: 'manage_admins' });
    const adminDb = getAdminDb();

    const body = (await req.json()) as Body;

    const email = body?.email?.trim().toLowerCase();
    const role = body?.role?.trim();
    const department = body?.department?.trim();
    const permissions = Array.isArray(body?.permissions) ? body.permissions : [];

    if (!email || !role || !department) {
      return NextResponse.json(
        { ok: false, error: 'Missing fields: email, role, department are required' },
        { status: 400 }
      );
    }

    // ป้องกัน non-super_admin เชิญ super_admin หรือเชิญข้ามสังกัด
    if (adminUser.role !== 'super_admin') {
      if (role === 'super_admin') {
        return NextResponse.json(
          { ok: false, error: 'Only super_admin can invite super_admin' },
          { status: 403 }
        );
      }
      if (department !== adminUser.department) {
        return NextResponse.json(
          { ok: false, error: 'Cannot invite admin outside your department' },
          { status: 403 }
        );
      }
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hours = Math.max(1, Math.min(24 * 30, Number(body.expiresInHours ?? 24 * 7) || 24 * 7));
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + hours * 60 * 60 * 1000));

    const docRef = await adminDb.collection('adminInvites').add({
      email,
      role,
      department,
      permissions,
      token,
      status: 'pending',
      invitedByUid: adminUser.uid,
      invitedByEmail: adminUser.email || body.invitedByEmail || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    const acceptUrl = buildAcceptUrl(req, token);
    const subject = 'คำเชิญเป็นผู้ดูแลระบบ (Admin Invitation)';
    const html = `
      <p>คุณได้รับคำเชิญให้เป็นแอดมิน</p>
      <p><b>บทบาท:</b> ${role}<br/>
         <b>สังกัด:</b> ${department}</p>
      <p>กดยืนยันสิทธิ์ได้ที่ลิงก์นี้ (หมดอายุภายใน ${hours} ชั่วโมง):</p>
      <p><a href="${acceptUrl}" target="_blank" rel="noopener">ยืนยันคำเชิญ</a></p>
      <hr/>
      <p>หากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลฉบับนี้ได้</p>
    `;

    if (!SKIP_EMAIL) {
      await sendMail({ to: email, subject, html });
    } else {
      console.log('[invites/send] SKIP_EMAIL=1', { to: email, acceptUrl });
    }

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e: any) {
    console.error('[invites/send] ERROR:', e?.message || e);
    const status = e?.status || 500;
    return NextResponse.json(
      { ok: false, error: e?.message || 'Send invite failed' },
      { status }
    );
  }
}
