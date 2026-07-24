// src/app/r/[code]/page.tsx
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { getAdminDb } from '../../../lib/firebaseAdmin';
import * as admin from 'firebase-admin';
import FullPageError from '../../../components/common/FullPageError';
import AdInterstitial from '../../../components/shortlink/AdInterstitial';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

// GeoIP & Click Logging function (Non-blocking background run)
async function logVisit(
  linkId: string,
  code: string,
  type: 'activity' | 'general',
  ip: string,
  userAgent: string
) {
  try {
    const adminDb = getAdminDb();
    const cleanIp = ip.split(',')[0].trim();

    let geoData = {
      country: 'Unknown',
      province: 'Unknown',
      city: 'Unknown',
    };

    // Simple local IP check
    const isLocal =
      !cleanIp ||
      cleanIp === '127.0.0.1' ||
      cleanIp === '::1' ||
      cleanIp.startsWith('192.168.') ||
      cleanIp.startsWith('10.');

    const ipToQuery = isLocal ? '223.206.125.10' : cleanIp;

    try {
      const geoRes = await fetch(`http://ip-api.com/json/${ipToQuery}?fields=status,country,regionName,city`, {
        next: { revalidate: 3600 }
      });
      if (geoRes.ok) {
        const res = await geoRes.json();
        if (res.status === 'success') {
          geoData = {
            country: res.country || 'Unknown',
            province: res.regionName || 'Unknown',
            city: res.city || 'Unknown',
          };
        }
      }
    } catch (err) {
      console.error('GeoIP lookup error:', err);
    }

    // Simple User-Agent Parsing
    let browser = 'Unknown';
    let os = 'Unknown';
    let device = 'Desktop';
    const ua = userAgent.toLowerCase();

    if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('chrome') && !ua.includes('chromium')) browser = 'Chrome';
    else if (ua.includes('safari') && !ua.includes('chrome')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera') || ua.includes('opr')) browser = 'Opera';

    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os')) os = 'MacOS';
    else if (ua.includes('android')) {
      os = 'Android';
      device = 'Mobile';
    } else if (ua.includes('iphone') || ua.includes('ipad')) {
      os = 'iOS';
      device = 'Mobile';
    } else if (ua.includes('linux')) os = 'Linux';

    // Log visit log document
    await adminDb.collection('shortLinkVisits').add({
      linkId,
      code,
      type,
      ip: cleanIp,
      userAgent,
      browser,
      os,
      device,
      ...geoData,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Increment click counts in main document
    const colName = type === 'general' ? 'customShortLinks' : 'activityQRCodes';
    await adminDb.collection(colName).doc(linkId).update({
      clicksCount: admin.firestore.FieldValue.increment(1),
    });
  } catch (err) {
    console.error('logVisit failed:', err);
  }
}

// Check link accessibility (Status + Timers)
function checkLinkAccess(docData: any): { allowed: boolean; reason?: 'disabled' | 'not-started' | 'expired'; details?: any } {
  const now = new Date();
  
  if (docData.linkEnabled === false) {
    return { allowed: false, reason: 'disabled' };
  }
  
  if (docData.linkStartAt) {
    const start = docData.linkStartAt.toDate ? docData.linkStartAt.toDate() : new Date(docData.linkStartAt);
    if (now < start) {
      return { allowed: false, reason: 'not-started', details: start };
    }
  }
  
  if (docData.linkEndAt) {
    const end = docData.linkEndAt.toDate ? docData.linkEndAt.toDate() : new Date(docData.linkEndAt);
    if (now > end) {
      return { allowed: false, reason: 'expired', details: end };
    }
  }
  
  return { allowed: true };
}

// Render full-page error UI (ใช้ดีไซน์กลางร่วมกับหน้า register)
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

    // 1. ตรวจสอบใน customShortLinks (ลิงก์ทั่วไป/ภายนอก)
    const customQs = await adminDb
      .collection('customShortLinks')
      .where('customCode', '==', normalized)
      .limit(1)
      .get();

    if (!customQs.empty) {
      const linkDoc = customQs.docs[0];
      const linkData = linkDoc.data();
      
      const access = checkLinkAccess(linkData);
      if (!access.allowed) {
        return renderErrorPage(access.reason!, access.details);
      }

      if (linkData.targetUrl) {
        // Log visit asynchronously
        logVisit(linkDoc.id, normalized, 'general', ip, userAgent).catch(console.error);

        const extUrl = buildTargetUrl(linkData.targetUrl, queryString);

        // แสดงหน้าโฆษณา/ประกาศก่อน redirect (ลิงก์ย่อทั่วไปเท่านั้น)
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

    // 2. ตรวจสอบใน activityQRCodes (ลิงก์ย่อกิจกรรม) โดยใช้ customCode
    const qs = await adminDb
      .collection('activityQRCodes')
      .where('customCode', '==', normalized)
      .limit(1)
      .get();

    if (!qs.empty) {
      const actDoc = qs.docs[0];
      const act = actDoc.data();
      
      const access = checkLinkAccess(act);
      if (!access.allowed) {
        return renderErrorPage(access.reason!, access.details);
      }

      if (act.activityCode) {
        // Log visit asynchronously
        logVisit(actDoc.id, normalized, 'activity', ip, userAgent).catch(console.error);
        redirect(`/register?activity=${encodeURIComponent(act.activityCode)}${suffix}`);
      }
    }

    // 3. ค้นหาแบบตรงตัวจาก activityCode (กรณีใช้รหัสกิจกรรมสุ่มเป็นรหัสย่อโดยตรง)
    const qsDirect = await adminDb
      .collection('activityQRCodes')
      .where('activityCode', '==', normalized)
      .limit(1)
      .get();

    if (!qsDirect.empty) {
      const actDoc = qsDirect.docs[0];
      const act = actDoc.data();
      
      const access = checkLinkAccess(act);
      if (!access.allowed) {
        return renderErrorPage(access.reason!, access.details);
      }

      // Log visit asynchronously
      logVisit(actDoc.id, normalized, 'activity', ip, userAgent).catch(console.error);
      redirect(`/register?activity=${encodeURIComponent(act.activityCode)}${suffix}`);
    }

  } catch (e: any) {
    if (e.message === 'NEXT_REDIRECT') {
      throw e;
    }
    console.error('Error resolving custom short link:', e);
  }

  redirect(`/register?activity=${encodeURIComponent(normalized)}${suffix}`);
}

