import { NextRequest, NextResponse } from 'next/server';
import { getAdminBucket } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// อนุญาตเฉพาะ path ที่กำหนดเท่านั้น กันการดึงไฟล์อื่นใน bucket
const ALLOWED_PREFIXES = ['desc-images/'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');

  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }

  const normalized = path.replace(/\\/g, '/');
  if (
    normalized.includes('..') ||
    !ALLOWED_PREFIXES.some((prefix) => normalized.startsWith(prefix))
  ) {
    return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
  }

  try {
    const bucket = getAdminBucket();
    const file = bucket.file(normalized);

    const [exists] = await file.exists();
    if (!exists) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    const [metadata] = await file.getMetadata();
    const [buffer] = await file.download();

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': (metadata.contentType as string) || 'image/jpeg',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    });
  } catch (err: any) {
    console.error('[api/images] error:', err);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
