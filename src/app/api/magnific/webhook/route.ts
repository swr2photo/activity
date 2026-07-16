import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function verifySignature(secretKey: string, contentToSign: string, headerSignatures: string): boolean {
  const secretKeyBytes = Buffer.from(secretKey, 'utf-8');
  const hmac = crypto.createHmac('sha256', secretKeyBytes);
  hmac.update(contentToSign);
  const generatedSignature = hmac.digest('base64');

  const signatures = headerSignatures.split(' ');
  for (const sig of signatures) {
    const parts = sig.split(',');
    if (parts.length === 2) {
      const [version, expectedSignature] = parts;
      if (expectedSignature === generatedSignature) {
        return true;
      }
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const webhookId = request.headers.get('webhook-id');
  const webhookTimestamp = request.headers.get('webhook-timestamp');
  const webhookSignature = request.headers.get('webhook-signature');

  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return NextResponse.json({ error: 'Missing webhook headers' }, { status: 400 });
  }

  const secret = process.env.MAGNIFIC_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ error: 'Webhook secret is not configured' }, { status: 500 });
  }

  try {
    const rawBody = await request.text();
    const contentToSign = `${webhookId}.${webhookTimestamp}.${rawBody}`;

    const isValid = verifySignature(secret, contentToSign, webhookSignature);
    if (!isValid) {
      return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 401 });
    }

    const payload = JSON.parse(rawBody);
    
    // Webhook payload: might have fields directly at the root, or wrapped under data
    const data = payload.data || payload;
    const taskId = data.task_id;
    const status = data.status;
    const generated = data.generated || [];

    if (!taskId) {
      return NextResponse.json({ error: 'Missing task_id in payload' }, { status: 400 });
    }

    // Save/Update in Firestore
    const db = getAdminDb();
    await db.collection('magnificTasks').doc(taskId).set({
      taskId,
      status,
      generated,
      updatedAt: new Date(),
    }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
