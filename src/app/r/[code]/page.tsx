// src/app/r/[code]/page.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { after } from 'next/server';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import FullPageError from '../../../components/common/FullPageError';
import AdInterstitial from '../../../components/shortlink/AdInterstitial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CUSTOM_LINK_FIELDS = [
  'customCode',
  'targetUrl',
  'linkEnabled',
  'linkStartAt',
  'linkEndAt',
  'adEnabled',
  'adTitle',
  'adMessage',
  'adImageUrl',
  'adCountdownSeconds',
  'adButtonText',
] as const;

const ACTIVITY_LINK_FIELDS = [
  'activityCode',
  'customCode',
  'linkEnabled',
  'linkStartAt',
  'linkEndAt',
] as const;

function buildTargetUrl(baseUrl: string, queryString: string) {
  if (!queryString) return baseUrl;
  const separator = baseUrl.includes('?') ? '&' : '?';
  return `${baseUrl}${separator}${queryString}`;
}

function hasActiveAd(linkData: any): boolean {
  if (!linkData?.adEnabled) return false;
  const title = typeof linkData.adTitle === 'string' ? linkData.adTitle.trim() : '';
  const message = typeof linkData.adMessage === 'string' ? linkData.adMessage.trim() : '';
  const imageUrl = typeof linkData.adImageUrl === 'string' ? linkData.adImageUrl.trim() : '';
  return Boolean(title || message || imageUrl);
}

// บันทึกสถิติคลิกผ่าน Next.js after() โดยไม่อาศัย external ip-api.com ที่ติด rate limit 45 req/min
async function logVisit(
  linkId: string,
  code: string,
  type: 'activity' | 'general',
  ip: string,
  userAgent: string,
  geo: { country: string; province: string; city: string }
) {
  try {
    const adminDb = getAdminDb();
    const cleanIp = ip.split(',')[0].trim();

    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Desktop';
    const ua = userAgent.toLowerCase();

    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('edg')) browser = 'Edge';
    else if (ua.includes('opr') || ua.includes('opera')) browser = 'Opera';
    else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';

    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('android')) {
      os = 'Android';
      device = 'Mobile';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
      device = 'Mobile';
    } else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'MacOS';
    else if (ua.includes('linux')) os = 'Linux';

    const colName = type === 'general' ? 'customShortLinks' : 'activityQRCodes';
    await Promise.all([
      adminDb.collection('shortLinkVisits').add({
        linkId,
        code,
        type,
        ip: cleanIp,
        userAgent: userAgent.slice(0, 300),
        browser,
        os,
        device,
        ...geo,
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
      }),
      adminDb.collection(colName).doc(linkId).update({
        clicksCount: admin.firestore.FieldValue.increment(1),
      }),
    ]);
  } catch (err) {
    console.error('logVisit failed:', err);
  }
}

function checkLinkAccess(docData: any): {
  allowed: boolean;
  reason?: 'disabled' | 'not-started' | 'expired';
  details?: any;
} {
  const now = new Date();

  if (docData.linkEnabled === false) {
    return { allowed: false, reason: 'disabled' };
  }

  if (docData.linkStartAt) {
    const start = docData.linkStartAt.toDate
      ? docData.linkStartAt.toDate()
      : new Date(docData.linkStartAt);
    if (now < start) {
      return { allowed: false, reason: 'not-started', details: start };
    }
  }

  if (docData.linkEndAt) {
    const end = docData.linkEndAt.toDate
      ? docData.linkEndAt.toDate()
      : new Date(docData.linkEndAt);
    if (now > end) {
      return { allowed: false, reason: 'expired', details: end };
    }
  }

  return { allowed: true };
}

function renderErrorPage(reason: 'disabled' | 'not-started' | 'expired', details?: any) {
  const timeStr = details
    ? new Date(details).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
    : '';

  if (reason === 'disabled') {
    return (
      <FullPageError
        variant="locked"
        code="LINK_DISABLED"
        title="ลิงก์ย่อนี้ถูกปิดใช้งาน"
        message="ผู้ดูแลระบบได้สั่งปิดการเข้าใช้งานลิงก์ย่อนี้ชั่วคราว กรุณาติดต่อผู้รับผิดชอบโครงการ"
        actions={[{ label: 'กลับหน้าหลัก', href: '/' }]}
      />
    );
  }

  if (reason === 'not-started') {
    return (
      <FullPageError
        variant="warning"
        code="LINK_NOT_STARTED"
        title="ยังไม่ถึงเวลาเปิดใช้งานลิงก์"
        message={`ลิงก์นี้มีกำหนดเปิดให้ใช้งานในวันที่ ${timeStr} กรุณารอจนกว่าจะถึงกำหนดเวลาดังกล่าว`}
        actions={[{ label: 'กลับหน้าหลัก', href: '/' }]}
      />
    );
  }

  return (
    <FullPageError
      variant="expired"
      code="LINK_EXPIRED"
      title="ลิงก์ย่อหมดอายุการใช้งานแล้ว"
      message={`ขออภัย ลิงก์ย่อนี้ได้สิ้นสุดช่วงเวลาเปิดรับสมัครหรือหมดอายุไปแล้วเมื่อวันที่ ${timeStr}`}
      actions={[{ label: 'กลับหน้าหลัก', href: '/' }]}
    />
  );
}

export default async function R({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const { code } = await params;
  const sParams = await searchParams;
  const normalized = decodeURIComponent(code || '').trim().toUpperCase();
  if (!normalized) redirect('/');

  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for') || headerList.get('x-real-ip') || '127.0.0.1';
  const userAgent = headerList.get('user-agent') || '';
  const geo = {
    country:
      headerList.get('x-vercel-ip-country') ||
      headerList.get('x-appengine-country') ||
      'Thailand',
    province:
      headerList.get('x-vercel-ip-country-region') ||
      headerList.get('x-appengine-region') ||
      'Unknown',
    city:
      headerList.get('x-vercel-ip-city') ||
      headerList.get('x-appengine-city') ||
      'Unknown',
  };

  const queryObj: Record<string, string> = {};
  for (const [key, val] of Object.entries(sParams)) {
    if (typeof val === 'string') {
      queryObj[key] = val;
    }
  }
  const queryString = new URLSearchParams(queryObj).toString();
  const suffix = queryString ? `&${queryString}` : '';

  try {
    const adminDb = getAdminDb();

    // ยิงทั้ง 3 lookup พร้อมกัน (1 RTT แทน 3 sequential RTT) และดึงเฉพาะฟิลด์ที่จำเป็น
    const [customQs, qsCustom, qsDirect] = await Promise.all([
      adminDb
        .collection('customShortLinks')
        .where('customCode', '==', normalized)
        .select(...CUSTOM_LINK_FIELDS)
        .limit(1)
        .get(),
      adminDb
        .collection('activityQRCodes')
        .where('customCode', '==', normalized)
        .select(...ACTIVITY_LINK_FIELDS)
        .limit(1)
        .get(),
      adminDb
        .collection('activityQRCodes')
        .where('activityCode', '==', normalized)
        .select(...ACTIVITY_LINK_FIELDS)
        .limit(1)
        .get(),
    ]);

    if (!customQs.empty) {
      const linkDoc = customQs.docs[0];
      const linkData = linkDoc.data();

      const access = checkLinkAccess(linkData);
      if (!access.allowed) {
        return renderErrorPage(access.reason!, access.details);
      }

      if (linkData.targetUrl) {
        after(() => logVisit(linkDoc.id, normalized, 'general', ip, userAgent, geo));

        const extUrl = buildTargetUrl(linkData.targetUrl, queryString);
        if (hasActiveAd(linkData)) {
          const countdown = Number(linkData.adCountdownSeconds);
          return (
            <AdInterstitial
              targetUrl={extUrl}
              title={linkData.adTitle || 'ประกาศ'}
              message={linkData.adMessage || ''}
              imageUrl={linkData.adImageUrl || ''}
              countdownSeconds={Number.isFinite(countdown) ? countdown : 5}
              buttonText={linkData.adButtonText || 'ไปยังลิงก์ปลายทาง'}
            />
          );
        }

        redirect(extUrl);
      }
    }

    const actDoc = !qsCustom.empty ? qsCustom.docs[0] : !qsDirect.empty ? qsDirect.docs[0] : null;
    if (actDoc) {
      const act = actDoc.data();
      const access = checkLinkAccess(act);
      if (!access.allowed) {
        return renderErrorPage(access.reason!, access.details);
      }

      const targetCode = String(act.activityCode || normalized);
      after(() => logVisit(actDoc.id, normalized, 'activity', ip, userAgent, geo));
      redirect(`/register?activity=${encodeURIComponent(targetCode)}${suffix}`);
    }
  } catch (e: any) {
    if (e?.digest?.startsWith?.('NEXT_REDIRECT') || e?.message === 'NEXT_REDIRECT') {
      throw e;
    }
    console.error('Error resolving custom short link:', e);
  }

  redirect(`/register?activity=${encodeURIComponent(normalized)}${suffix}`);
}
