import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const encodedUrl = searchParams.get('file');

  if (!encodedUrl) {
    return NextResponse.json({ error: 'Missing file parameter' }, { status: 400 });
  }

  try {
    // Decode base64
    const fileUrl = Buffer.from(encodedUrl, 'base64').toString('utf-8');

    // Basic security check: Make sure it only fetches from Firebase Storage domain
    const parsedUrl = new URL(fileUrl);
    if (!parsedUrl.hostname.includes('firebasestorage.googleapis.com')) {
      return NextResponse.json({ error: 'Unauthorized download source' }, { status: 403 });
    }

    const response = await fetch(fileUrl);
    if (!response.ok) {
      return NextResponse.json({ error: 'Failed to fetch file from storage' }, { status: response.status });
    }

    const blob = await response.blob();
    
    // Get headers from response or set defaults
    const contentType = response.headers.get('Content-Type') || 'application/octet-stream';
    const contentDisposition = response.headers.get('Content-Disposition') || 'inline';

    return new NextResponse(blob, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'public, max-age=3600, s-maxage=3600', // Cache for 1 hour
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
