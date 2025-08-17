// src/app/api/invites/send/route.ts
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { adminDb, FieldValue, Timestamp } from '../../../../lib/firebaseAdmin';
import { sendMail } from '../../../../lib/email';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Body = {
  email: string;
  role: string;
  department: string;
  permissions?: string[];
  invitedByUid: string;
  invitedByEmail?: string;
  expiresInHours?: number; // default 7 วัน
};

// เปิดใช้เพื่อข้ามการส่งอีเมลตอนดีบัก: SKIP_EMAIL=1
const SKIP_EMAIL = process.env.SKIP_EMAIL === '1';

function buildAcceptUrl(req: NextRequest, token: string) {
  // ใช้ค่า origin จาก ENV ถ้ามี (รองรับ deploy) ตกมาใช้ของ request ตอน dev
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  // เส้นทางจริงของ API จะเป็น /api/... เสมอ แม้ไฟล์จะอยู่ใน /app/api
  return `${origin}/api/invites/accept?token=${encodeURIComponent(token)}`;
}

export async function POST(req: NextRequest) {
  try {
    // ---- อ่านและตรวจ body ----
    const body = (await req.json()) as Body;

    const email = body?.email?.trim().toLowerCase();
    const role = body?.role?.trim();
    const department = body?.department?.trim();
    const invitedByUid = body?.invitedByUid?.trim();
    const permissions = Array.isArray(body?.permissions) ? body.permissions : [];

    if (!email || !role || !department || !invitedByUid) {
      return NextResponse.json(
        { ok: false, error: 'Missing fields: email, role, department, invitedByUid are required' },
        { status: 400 }
      );
    }

    // ---- เตรียม token & วันหมดอายุ ----
    const token = crypto.randomBytes(32).toString('hex');
    const expiresMs = (body.expiresInHours ?? 24 * 7) * 60 * 60 * 1000; // 7 วันเป็นค่าเริ่มต้น
    const expiresAt = Timestamp.fromDate(new Date(Date.now() + expiresMs));

    // ---- บันทึกเอกสารคำเชิญ ----
    const docRef = await adminDb.collection('adminInvites').add({
      email,
      role,
      department,
      permissions,
      token,
      status: 'pending',
      invitedByUid,
      invitedByEmail: body.invitedByEmail || null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      expiresAt,
    });

    // ---- สร้างลิงก์ยืนยัน ----
    const acceptUrl = buildAcceptUrl(req, token);

    // ---- เนื้อหาอีเมล ----
    const subject = 'คำเชิญเป็นผู้ดูแลระบบ (Admin Invitation)';
    const html = `
      <p>คุณได้รับคำเชิญให้เป็นแอดมิน</p>
      <p><b>บทบาท:</b> ${role}<br/>
         <b>สังกัด:</b> ${department}</p>
      <p>กดยืนยันสิทธิ์ได้ที่ลิงก์นี้ (หมดอายุภายใน ${(body.expiresInHours ?? 24 * 7)} ชั่วโมง):</p>
      <p><a href="${acceptUrl}" target="_blank" rel="noopener">ยืนยันคำเชิญ</a></p>
      <hr/>
      <p>หากคุณไม่ได้ร้องขอ สามารถละเว้นอีเมลฉบับนี้ได้</p>
    `;

    // ---- ส่งอีเมล (หรือข้ามเมื่อดีบัก) ----
    if (!SKIP_EMAIL) {
      await sendMail({ to: email, subject, html });
    } else {
      console.log('[invites/send] SKIP_EMAIL=1 → ไม่ได้ส่งอีเมลจริง', { to: email, acceptUrl });
    }

    return NextResponse.json({ ok: true, id: docRef.id });
  } catch (e: any) {
    // ดึงรายละเอียด error ให้เยอะที่สุด (เช่นจาก Google API)
    const detail = e?.response?.data || e?.errors || e?.stack || null;
    console.error('[invites/send] ERROR:', e?.message || e, detail);
    return NextResponse.json(
      { ok: false, error: e?.message || 'Send invite failed', detail },
      { status: 500 }
    );
  }
}

