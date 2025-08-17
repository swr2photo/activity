// src/app/api/invites/accept/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { adminDb, FieldValue, Timestamp } from '../../../../lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  try {
    const token = req.nextUrl.searchParams.get('token') || '';
    if (!token) {
      return NextResponse.json({ ok: false, error: 'Missing token' }, { status: 400 });
    }

    const qs = await adminDb
      .collection('adminInvites')
      .where('token', '==', token)
      .limit(1)
      .get();

    if (qs.empty) {
      return new Response(simpleHtml('ลิงก์ไม่ถูกต้องหรือหมดอายุ', false), {
        status: 400,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    const doc = qs.docs[0];
    const data = doc.data() as any;

    if (data.status !== 'pending') {
      return new Response(simpleHtml('คำเชิญนี้ถูกใช้ไปแล้ว หรือถูกยกเลิก', false), {
        status: 400,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // ตรวจวันหมดอายุ
    const now = Timestamp.now();
    if (data.expiresAt && data.expiresAt.toMillis && data.expiresAt.toMillis() < now.toMillis()) {
      await doc.ref.update({
        status: 'expired',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return new Response(simpleHtml('คำเชิญหมดอายุแล้ว', false), {
        status: 400,
        headers: { 'content-type': 'text/html; charset=utf-8' },
      });
    }

    // ทำเครื่องหมาย accepted + เก็บ acceptedAt
    await doc.ref.update({
      status: 'accepted',
      updatedAt: FieldValue.serverTimestamp(),
      acceptedAt: FieldValue.serverTimestamp(),
    });

    // ส่งหน้า success ง่าย ๆ (หรือจะ redirect ไปหน้า /login ก็ได้)
    return new Response(simpleHtml('ยืนยันคำเชิญสำเร็จ! โปรดเข้าสู่ระบบด้วยอีเมลเดียวกัน', true), {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8' },
    });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'Accept failed' }, { status: 500 });
  }
}

function simpleHtml(message: string, ok: boolean) {
  const origin = process.env.NEXT_PUBLIC_SITE_URL || '/';
  const color = ok ? '#16a34a' : '#dc2626';
  return `
<!doctype html>
<html lang="th">
  <head>
    <meta charset="utf-8"/>
    <meta name="viewport" content="width=device-width,initial-scale=1"/>
    <title>Invite ${ok ? 'Accepted' : 'Error'}</title>
    <style>
      body{font-family: system-ui,-apple-system,Segoe UI,Roboto,Inter,Noto Sans Thai,Arial,sans-serif;padding:24px;background:#f8fafc;color:#0f172a}
      .card{max-width:560px;margin:40px auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px}
      .title{font-size:20px;font-weight:800;margin:0 0 8px}
      .msg{margin:0 0 16px;color:#334155}
      .badge{display:inline-block;padding:4px 10px;border-radius:999px;background:${color}20;color:${color};font-weight:700;font-size:12px}
      .btn{display:inline-block;margin-top:12px;padding:10px 16px;border-radius:8px;border:1px solid #e2e8f0;text-decoration:none}
      .btn-primary{background:#111827;color:#fff;border-color:#111827}
    </style>
  </head>
  <body>
    <div class="card">
      <div class="badge">${ok ? 'SUCCESS' : 'ERROR'}</div>
      <h1 class="title">${ok ? 'ยืนยันคำเชิญสำเร็จ' : 'ไม่สามารถยืนยันได้'}</h1>
      <p class="msg">${message}</p>
      <a class="btn btn-primary" href="${origin}">กลับหน้าแรก</a>
    </div>
  </body>
</html>`;
}
