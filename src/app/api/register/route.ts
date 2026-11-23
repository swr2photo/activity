// src/app/api/register/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, FieldValue } from '@/lib/firebaseAdmin';
import { verifyUserToken } from '@/lib/apiAuth';
import {
  getDynamicQrSecret,
  verifyDynamicQrClaim,
  verifyDynamicQrToken,
} from '@/lib/dynamicQrToken';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RegisterBody = {
  activityCode: string;
  activityDocId?: string;
  location?: { latitude: number; longitude: number; accuracy?: number } | null;
  userCode?: string;
  dt?: string;
  claim?: string;
  profileOverride?: {
    nameTitle?: string;
    firstName?: string;
    lastName?: string;
    faculty?: string;
    department?: string;
    degree?: string;
    institutionName?: string;
  };
};

const toRad = (deg: number) => (deg * Math.PI) / 180;
function haversineMeters(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function toDateSafe(v: any): Date | null {
  if (!v) return null;
  if (typeof v?.toDate === 'function') return v.toDate();
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const ERROR_MESSAGES: Record<string, { status: number; message: string }> = {
  ACT_NOT_FOUND: { status: 404, message: 'ไม่พบข้อมูลกิจกรรมในระบบ' },
  NO_PROFILE: { status: 400, message: 'ไม่พบโปรไฟล์ผู้ใช้ กรุณากรอกข้อมูลโปรไฟล์ก่อนลงทะเบียน' },
  ACCOUNT_DISABLED: { status: 403, message: 'บัญชีของคุณถูกระงับการใช้งาน' },
  NO_STUDENT_ID: { status: 400, message: 'โปรไฟล์ยังไม่มีรหัสนักศึกษา/รหัสผู้เข้าร่วม กรุณาแก้ไขโปรไฟล์ก่อน' },
  UNIVERSITY_ONLY: { status: 403, message: 'กิจกรรมนี้จำกัดเฉพาะบัญชีมหาวิทยาลัย (@psu.ac.th)' },
  FORM_CLOSED: { status: 400, message: 'กิจกรรมปิดรับลงทะเบียนแล้ว หรือไม่อยู่ในช่วงเวลาที่กำหนด' },
  FULL: { status: 409, message: 'กิจกรรมนี้มีผู้สมัครครบจำนวนแล้ว' },
  ALREADY_REGISTERED: { status: 409, message: 'คุณได้ลงทะเบียนกิจกรรม/รอบนี้ไปแล้ว' },
  SINGLE_USER_TAKEN: { status: 409, message: 'กิจกรรมนี้อนุญาตให้ลงทะเบียนได้เพียงผู้ใช้เดียว และมีผู้ลงทะเบียนแล้ว' },
  INVALID_USER_CODE: { status: 400, message: 'รหัสยืนยันเข้าร่วมกิจกรรมไม่ถูกต้อง' },
  INVALID_DYNAMIC_QR: { status: 400, message: 'QR Code หมดอายุหรือไม่ถูกต้อง กรุณาสแกนใหม่ที่หน้างาน' },
  OUT_OF_RANGE: { status: 400, message: 'ตำแหน่งของคุณอยู่นอกรัศมีเช็กอินที่กำหนด' },
  LOCATION_REQUIRED: { status: 400, message: 'กรุณาเปิด GPS เพื่อยืนยันตำแหน่งก่อนลงทะเบียน' },
};

const PSU_FACULTY_BY_CODE: Record<string, string> = {
  '01': 'คณะวิศวกรรมศาสตร์',
  '02': 'คณะวิทยาศาสตร์',
  '03': 'คณะแพทยศาสตร์',
  '04': 'คณะทรัพยากรธรรมชาติ',
  '05': 'คณะศึกษาศาสตร์',
  '06': 'คณะมนุษยศาสตร์และสังคมศาสตร์',
  '07': 'คณะเศรษฐศาสตร์',
  '08': 'คณะบริหารธุรกิจ',
  '09': 'คณะศิลปกรรมศาสตร์',
  '10': 'คณะพยาบาลศาสตร์',
  '11': 'คณะเภสัชศาสตร์',
  '12': 'คณะทันตแพทยศาสตร์',
  '13': 'คณะสัตวแพทยศาสตร์',
  '14': 'คณะนิติศาสตร์',
  '15': 'คณะอุตสาหกรรมเกษตร',
  '16': 'คณะการจัดการสิ่งแวดล้อม',
  '18': 'คณะเทคนิคการแพทย์',
};

function inferPsuFaculty(studentId: string): string {
  const sid = (studentId || '').trim();
  if (sid.length >= 10 && /^\d+$/.test(sid) && ['1', '2', '3'].includes(sid.substring(2, 3))) {
    return PSU_FACULTY_BY_CODE[sid.substring(3, 5)] || '';
  }
  if (sid.length >= 8) {
    return PSU_FACULTY_BY_CODE[sid.substring(2, 4)] || '';
  }
  return '';
}

export async function POST(req: NextRequest) {
  try {
    const authUser = await verifyUserToken(req);
    const body = (await req.json()) as RegisterBody;

    const activityCode = String(body?.activityCode || '').trim().toUpperCase();
    if (!activityCode) {
      return NextResponse.json({ ok: false, error: 'กรุณาระบุรหัสกิจกรรม' }, { status: 400 });
    }

    // อ่าน IP จาก Header ทันที 0ms — ไม่ยิง external ipify.org ใน Transaction
    const rawIp =
      req.headers.get('x-forwarded-for') ||
      req.headers.get('x-real-ip') ||
      'unknown';
    const clientIp = rawIp.split(',')[0].trim() || 'unknown';
    const userAgent = (req.headers.get('user-agent') || '').slice(0, 300);

    const db = getAdminDb();

    // หา activityDocId นอก Transaction ถ้าไม่ได้ส่งมา
    let docId = String(body?.activityDocId || '').trim();
    if (!docId) {
      const snap = await db
        .collection('activityQRCodes')
        .where('activityCode', '==', activityCode)
        .limit(1)
        .get();
      if (snap.empty) {
        return NextResponse.json(
          { ok: false, code: 'ACT_NOT_FOUND', error: ERROR_MESSAGES.ACT_NOT_FOUND.message },
          { status: 404 }
        );
      }
      docId = snap.docs[0].id;
    }

    const result = await db.runTransaction(async (tx) => {
      const activityRef = db.collection('activityQRCodes').doc(docId);
      const userRef = db.collection('universityUsers').doc(authUser.uid);
      const recordId = `${activityCode}_${authUser.uid}`;
      const recordRef = db.collection('activityRecords').doc(recordId);

      const [actSnap, userSnap, recordSnap] = await Promise.all([
        tx.get(activityRef),
        tx.get(userRef),
        tx.get(recordRef),
      ]);

      if (!actSnap.exists) throw new Error('ACT_NOT_FOUND');
      if (!userSnap.exists) throw new Error('NO_PROFILE');

      const act = actSnap.data() as Record<string, any>;
      const profile = userSnap.data() as Record<string, any>;

      if (profile.isActive === false) throw new Error('ACCOUNT_DISABLED');

      const profileStudentId = String(profile.studentId || '').trim();
      if (!profileStudentId) throw new Error('NO_STUDENT_ID');

      const userEmail = String(profile.email || authUser.email || '').trim().toLowerCase();
      if (act.requiresUniversityLogin && !userEmail.endsWith('@psu.ac.th')) {
        throw new Error('UNIVERSITY_ONLY');
      }

      // ตรวจ Dynamic QR ฝั่งเซิร์ฟเวอร์ (ไม่เสียเวลา HTTP 2 รอบ)
      if (act.dynamicQREnabled === true) {
        const dt = String(body?.dt || '').trim();
        const claimIn = String(body?.claim || '').trim();
        const secret = getDynamicQrSecret();
        const hmacOk = dt ? verifyDynamicQrToken(secret, activityCode, dt) : false;
        const legacyOk =
          Boolean(dt) && (dt === act.dynamicToken || dt === act.previousDynamicToken);
        const claimOk =
          dt && claimIn ? verifyDynamicQrClaim(secret, activityCode, dt, claimIn) : false;
        if (!hmacOk && !legacyOk && !claimOk) {
          throw new Error('INVALID_DYNAMIC_QR');
        }
      }

      // userCode เป็นรหัสภายในของกิจกรรม (สร้างอัตโนมัติจาก QRCodeAdminPanel) ไม่ใช่รหัสให้นักศึกษากรอกเอง
      const expectedUserCode = String(act.userCode || '').trim();

      // ตรวจวันเวลาเปิดรับ / รอบย่อย
      const now = new Date();
      if (act.isActive === false) throw new Error('FORM_CLOSED');

      let sessionId: string | undefined;
      let sessionName: string | undefined;
      let inWindow = false;

      if (Array.isArray(act.sessions) && act.sessions.length > 0) {
        const activeSession = act.sessions.find((s: any) => {
          const sStart = toDateSafe(s.startDateTime);
          const sEnd = toDateSafe(s.endDateTime);
          return sStart && sEnd && now >= sStart && now <= sEnd;
        });
        if (activeSession) {
          inWindow = true;
          sessionId = String(activeSession.id || '');
          sessionName = String(activeSession.name || '');
        }
      } else {
        const start = toDateSafe(act.startDateTime);
        const end = toDateSafe(act.endDateTime);
        inWindow = (!start || now >= start) && (!end || now <= end);
      }

      if (!inWindow) throw new Error('FORM_CLOSED');

      // ตรวจโควต้า (เฉพาะการลงทะเบียนครั้งแรก)
      const isNewRecord = !recordSnap.exists;
      if (isNewRecord) {
        const max = Number(act.maxParticipants || 0);
        const cur = Number(act.currentParticipants || 0);
        if (max > 0 && cur >= max) throw new Error('FULL');
      } else {
        const existing = recordSnap.data() || {};
        if (sessionId) {
          if (Array.isArray(existing.checkedInSessions) && existing.checkedInSessions.includes(sessionId)) {
            throw new Error('ALREADY_REGISTERED');
          }
        } else {
          throw new Error('ALREADY_REGISTERED');
        }
      }

      // ตรวจพิกัด Geofence ฝั่งเซิร์ฟเวอร์ (ถ้ากิจกรรมตั้งพิกัดและรัศมี > 0)
      const actLat = Number(act.latitude);
      const actLng = Number(act.longitude);
      const radius = Number(act.checkInRadius || 0);
      const loc = body?.location;
      if (Number.isFinite(actLat) && Number.isFinite(actLng) && radius > 0) {
        if (!loc || !Number.isFinite(loc.latitude) || !Number.isFinite(loc.longitude)) {
          throw new Error('LOCATION_REQUIRED');
        }
        const dist = haversineMeters(loc.latitude, loc.longitude, actLat, actLng);
        // เผื่อค่า accuracy เบื้องต้นเล็กน้อย (ไม่เกิน 25m) สำหรับ GPS ในอาคาร
        const tolerance = Math.min(25, Math.max(0, Number(loc.accuracy || 0) * 0.25));
        if (dist > radius + tolerance) {
          throw new Error('OUT_OF_RANGE');
        }
      }

      // Single user mode claim
      if (isNewRecord && act.singleUserMode === true) {
        const claimRef = db.collection('activityClaims').doc(activityCode);
        const claimSnap = await tx.get(claimRef);
        const requester = userEmail || authUser.uid;
        if (claimSnap.exists && claimSnap.data()?.email && claimSnap.data()?.email !== requester) {
          throw new Error('SINGLE_USER_TAKEN');
        }
        tx.set(
          claimRef,
          { email: requester, claimedAt: FieldValue.serverTimestamp(), uid: authUser.uid },
          { merge: false }
        );
      }

      const ov = body?.profileOverride || {};
      const rawFaculty = String(ov.faculty ?? profile.faculty ?? '').trim();
      const resolvedFaculty =
        rawFaculty && rawFaculty !== 'ไม่ระบุ'
          ? rawFaculty
          : profile.userType === 'external'
            ? 'บุคคลภายนอก'
            : inferPsuFaculty(profileStudentId);

      const payload: Record<string, any> = {
        userId: authUser.uid,
        email: userEmail,
        microsoftId: authUser.uid,
        studentId: profileStudentId,
        nameTitle: String(ov.nameTitle ?? profile.nameTitle ?? '').trim(),
        firstName: String(ov.firstName ?? profile.firstName ?? '').trim(),
        lastName: String(ov.lastName ?? profile.lastName ?? '').trim(),
        faculty: resolvedFaculty,
        department: String(
          ov.department ??
            (profile.userType === 'external'
              ? profile.institutionName || profile.department
              : profile.department) ??
            ''
        ).trim(),
        activityDepartment: String(act.department || 'science_faculty'),
        degree: String(ov.degree ?? profile.educationLevel ?? profile.degreeLevel ?? '').trim(),
        userType: profile.userType || 'university',
        institutionName: String(ov.institutionName ?? profile.institutionName ?? '').trim(),
        activityCode,
        activityName: String(act.activityName || activityCode),
        activityDocId: docId,
        location: loc
          ? { latitude: loc.latitude, longitude: loc.longitude }
          : { latitude: 0, longitude: 0 },
        ipAddress: clientIp,
        userAgent,
        userCode: expectedUserCode,
        transcriptSaved: true,
        timestamp: FieldValue.serverTimestamp(),
      };
      if (sessionId) payload.sessionId = sessionId;
      if (sessionName) payload.sessionName = sessionName;

      if (isNewRecord) {
        if (sessionId) {
          payload.checkedInSessions = [sessionId];
          payload.sessionsDetails = [{ sessionId, sessionName, timestamp: new Date() }];
        }
        tx.set(recordRef, payload, { merge: false });
        tx.update(activityRef, { currentParticipants: FieldValue.increment(1) });
        return {
          recordId,
          isNewRecord: true,
          checkedInSessions: sessionId ? [sessionId] : [],
          sessionName,
        };
      } else {
        const existing = recordSnap.data() || {};
        const currentSessions = Array.isArray(existing.checkedInSessions)
          ? existing.checkedInSessions
          : [];
        const currentDetails = Array.isArray(existing.sessionsDetails)
          ? existing.sessionsDetails
          : [];
        const nextSessions = sessionId ? [...currentSessions, sessionId] : currentSessions;
        const nextDetails = sessionId
          ? [...currentDetails, { sessionId, sessionName, timestamp: new Date() }]
          : currentDetails;

        tx.update(recordRef, {
          ...payload,
          checkedInSessions: nextSessions,
          sessionsDetails: nextDetails,
        });
        return {
          recordId,
          isNewRecord: false,
          checkedInSessions: nextSessions,
          sessionName,
        };
      }
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (e: any) {
    const code = String(e?.message || '');
    const mapped = ERROR_MESSAGES[code];
    if (mapped) {
      return NextResponse.json({ ok: false, code, error: mapped.message }, { status: mapped.status });
    }
    const status = e?.status || 500;
    console.error('[api/register] error:', e);
    return NextResponse.json(
      { ok: false, error: e?.message || 'ไม่สามารถบันทึกการลงทะเบียนได้ กรุณาลองใหม่' },
      { status }
    );
  }
}
