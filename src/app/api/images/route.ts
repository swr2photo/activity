import { NextRequest, NextResponse } from 'next/server';
import { Readable } from 'stream';
import { getAdminBucket } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

    // ลด 1 RPC (ไม่ต้องเรียก file.exists() แยก) และ stream ตรงแทนโหลดเข้า RAM
    const [metadata] = await file.getMetadata();
    const nodeStream = file.createReadStream();
    const webStream = Readable.toWeb(nodeStream) as ReadableStream;

    return new NextResponse(webStream, {
      status: 200,
      headers: {
        'Content-Type': (metadata.contentType as string) || 'image/jpeg',
        ...(metadata.size ? { 'Content-Length': String(metadata.size) } : {}),
        'Cache-Control': 'public, max-age=86400, s-maxage=86400, immutable',
      },
    });
  } catch (err: any) {
    if (err?.code === 404) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }
    console.error('[api/images] error:', err);
    return NextResponse.json({ error: 'Failed to load image' }, { status: 500 });
  }
}
