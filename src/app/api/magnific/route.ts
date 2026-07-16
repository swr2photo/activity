import { NextRequest, NextResponse } from 'next/server';
import { verifyAdminToken } from '@/lib/apiAuth';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TASK_ENDPOINTS: Record<string, string> = {
  mystic: 'https://api.magnific.com/v1/ai/mystic',
  upscale: 'https://api.magnific.com/v1/ai/image-upscaler-precision-v2',
};

export async function GET(request: NextRequest) {
  // Verify admin authorization
  try {
    await verifyAdminToken(request);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const taskId = searchParams.get('taskId');
  const proxyUrl = searchParams.get('proxyUrl');

  // Case 1: Fetch task status
  if (taskId) {
    // Task type (mystic = text-to-image, upscale = precision upscaler)
    let taskType = 'mystic';

    // Check Firestore cache first
    try {
      const db = getAdminDb();
      const docSnap = await db.collection('magnificTasks').doc(taskId).get();
      if (docSnap.exists) {
        const taskData = docSnap.data();
        if (taskData?.type && TASK_ENDPOINTS[taskData.type]) {
          taskType = taskData.type;
        }
        if (taskData?.status === 'COMPLETED' || taskData?.status === 'FAILED') {
          return NextResponse.json({
            data: {
              task_id: taskData.taskId,
              status: taskData.status,
              generated: taskData.generated || [],
            }
          });
        }
      }
    } catch (dbErr) {
      console.error('Firestore read error:', dbErr);
    }

    const apiKey = process.env.MAGNIFIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: 'กรุณากำหนดค่า MAGNIFIC_API_KEY ในไฟล์ .env.local' }, { status: 500 });
    }

    try {
      const response = await fetch(`${TASK_ENDPOINTS[taskType]}/${taskId}`, {
        headers: {
          'x-magnific-api-key': apiKey,
        },
      });

      const data = await response.json();
      
      // Update Firestore cache
      if (response.ok && data?.data) {
        try {
          const db = getAdminDb();
          await db.collection('magnificTasks').doc(taskId).set({
            taskId: data.data.task_id,
            status: data.data.status,
            generated: data.data.generated || [],
            updatedAt: new Date(),
          }, { merge: true });
        } catch (dbErr) {
          console.error('Firestore write error:', dbErr);
        }
      }

      return NextResponse.json(data, { status: response.status });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  // Case 2: Proxy image to bypass CORS on the client side
  if (proxyUrl) {
    try {
      const response = await fetch(proxyUrl);
      if (!response.ok) {
        return NextResponse.json({ error: 'Failed to fetch image from source' }, { status: response.status });
      }

      const blob = await response.blob();
      const contentType = response.headers.get('Content-Type') || 'image/jpeg';

      return new NextResponse(blob, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=86400', // Cache for 24h
        },
      });
    } catch (err: any) {
      return NextResponse.json({ error: err.message }, { status: 500 });
    }
  }

  return NextResponse.json({ error: 'Missing parameters (taskId or proxyUrl)' }, { status: 400 });
}

export async function POST(request: NextRequest) {
  // Verify admin authorization
  try {
    await verifyAdminToken(request);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const apiKey = process.env.MAGNIFIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'กรุณากำหนดค่า MAGNIFIC_API_KEY ในไฟล์ .env.local' }, { status: 500 });
  }

  try {
    const body = await request.json();
    const { action, prompt, aspect_ratio, model } = body;
    const taskType = action === 'upscale' ? 'upscale' : 'mystic';

    const webhookUrl = process.env.NEXT_PUBLIC_BASE_URL 
      ? `${process.env.NEXT_PUBLIC_BASE_URL}/api/magnific/webhook` 
      : undefined;

    let requestPayload: Record<string, any>;

    if (taskType === 'upscale') {
      // Precision V2 upscaler: image is an HTTPS URL or base64 string
      const { image, scale_factor, flavor, sharpen, smart_grain, ultra_detail } = body;
      if (!image) {
        return NextResponse.json({ error: 'กรุณาระบุรูปภาพ (image)' }, { status: 400 });
      }
      requestPayload = {
        image,
        scale_factor: scale_factor || 2,
        flavor: flavor || 'photo',
        ...(sharpen !== undefined ? { sharpen } : {}),
        ...(smart_grain !== undefined ? { smart_grain } : {}),
        ...(ultra_detail !== undefined ? { ultra_detail } : {}),
        webhook_url: webhookUrl,
      };
      console.log('[Magnific API Request] upscale payload:', {
        ...requestPayload,
        image: `<${String(image).slice(0, 40)}... length=${String(image).length}>`,
      });
    } else {
      if (!prompt) {
        return NextResponse.json({ error: 'กรุณาระบุ prompt' }, { status: 400 });
      }
      requestPayload = {
        prompt,
        aspect_ratio: aspect_ratio || 'widescreen_16_9',
        model: model || 'realism',
        resolution: '1k',
        webhook_url: webhookUrl,
      };
      console.log('[Magnific API Request] payload:', requestPayload);
    }

    const response = await fetch(TASK_ENDPOINTS[taskType], {
      method: 'POST',
      headers: {
        'x-magnific-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestPayload),
    });

    console.log('[Magnific API Response] status:', response.status);
    const responseText = await response.text();
    console.log('[Magnific API Response] body:', responseText);

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseErr) {
      return NextResponse.json(
        { error: responseText || `Magnific API returned non-JSON error (status ${response.status})` },
        { status: response.status || 500 }
      );
    }

    // Store initial state in Firestore
    if (response.ok && data?.data?.task_id) {
      try {
        const db = getAdminDb();
        await db.collection('magnificTasks').doc(data.data.task_id).set({
          taskId: data.data.task_id,
          type: taskType,
          status: data.data.status || 'CREATED',
          generated: [],
          updatedAt: new Date(),
        });
        console.log('[Magnific Tasks] Initialized Firestore task:', data.data.task_id);
      } catch (dbErr) {
        console.error('[Magnific Tasks] Firestore initial write error:', dbErr);
      }
    }

    return NextResponse.json(data, { status: response.status });
  } catch (err: any) {
    console.error('[Magnific API POST Catch Error]:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }

}
