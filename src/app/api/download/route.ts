import { NextRequest, NextResponse } from 'next/server';
import { verifyUserToken } from '../../../lib/apiAuth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await verifyUserToken(request);
  } catch {
    return NextResponse.json(
      { error: 'กรุณาเข้าสู่ระบบก่อนดาวน์โหลดไฟล์' },
      { status: 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const encodedUrl = searchParams.get('file');

  if (!encodedUrl) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  try {
    const fileUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');
    const parsedUrl = new URL(fileUrl);

    // ตรวจ hostname แบบตรงตัวและต้องเป็น HTTPS เท่านั้น ป้องกัน SSRF
    if (
      parsedUrl.protocol !== 'https:' ||
      parsedUrl.hostname.toLowerCase() !== 'firebasestorage.googleapis.com'
    ) {
      return NextResponse.json({ error: 'Unauthorized download source' }, { status: 403 });
    }

    const response = await fetch(fileUrl);
    if (!response.ok || !response.body) {
      return NextResponse.json({ error: 'Failed to fetch file from storage' }, { status: response.status || 502 });
    }

    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('Content-Disposition') || 'inline';

    // Stream ตรงไม่โหลดทั้งไฟล์เข้า RAM 512MB และใช้ private cache สำหรับ endpoint ที่ต้อง auth
    return new NextResponse(response.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Download failed' }, { status: 500 });
  }
}
