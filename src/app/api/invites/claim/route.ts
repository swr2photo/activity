// src/app/api/invites/claim/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb, FieldValue, Timestamp } from '@/lib/firebaseAdmin';
import { verifyUserToken } from '@/lib/apiAuth';
import { ROLE_PERMISSIONS, type AdminRole } from '@/types/admin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * ตรวจสอบคำเชิญแอดมินฝั่งเซิร์ฟเวอร์ (Admin SDK) และสร้างเอกสาร adminUsers/{uid} อย่างปลอดภัย
 * ปิดช่องโหว่ client self-promote บน Firestore Rules
 */
export async function POST(req: NextRequest) {
  try {
    const user = await verifyUserToken(req);
    const email = (user.email || '').trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ ok: false, error: 'Missing user email' }, { status: 400 });
    }

    const db = getAdminDb();
    const adminRef = db.collection('adminUsers').doc(user.uid);
    const existing = await adminRef.get();
    if (existing.exists) {
      const data = existing.data() || {};
      if (data.isActive === false) {
        await getAdminAuth()
          .setCustomUserClaims(user.uid, { role: null, department: null, isActive: false })
          .catch(() => {});
        return NextResponse.json({ ok: false, error: 'ADMIN_DISABLED' }, { status: 403 });
      }
      const existingRole = data.role || 'viewer';
      const existingDept = data.department || 'science_faculty';
      let claimsSynced = false;
      if (
        user.decodedToken.role !== existingRole ||
        user.decodedToken.department !== existingDept ||
        user.decodedToken.isActive !== true
      ) {
        await getAdminAuth()
          .setCustomUserClaims(user.uid, {
            role: existingRole,
            department: existingDept,
            isActive: true,
          })
          .then(() => {
            claimsSynced = true;
          })
          .catch(() => {});
      }
      return NextResponse.json({ ok: true, alreadyAdmin: true, claimsSynced });
    }

    const inviteSnap = await db
      .collection('adminInvites')
      .where('email', '==', email)
      .where('status', 'in', ['accepted', 'pending'])
      .limit(5)
      .get();

    if (inviteSnap.empty) {
      return NextResponse.json({ ok: false, error: 'NOT_INVITED' }, { status: 403 });
    }

    const nowMs = Timestamp.now().toMillis();
    const validDoc = inviteSnap.docs.find((d) => {
      const data = d.data() as any;
      const exp = data.expiresAt?.toMillis ? data.expiresAt.toMillis() : null;
      return !exp || exp > nowMs;
    });

    if (!validDoc) {
      return NextResponse.json({ ok: false, error: 'INVITE_EXPIRED' }, { status: 403 });
    }

    const inviteData = validDoc.data() as any;
    const role = (inviteData.role || 'viewer') as AdminRole;
    const department = inviteData.department || 'science_faculty';
    const permissions =
      Array.isArray(inviteData.permissions) && inviteData.permissions.length > 0
        ? inviteData.permissions
        : (ROLE_PERMISSIONS[role] ?? []);

    const authUser = await getAdminAuth().getUser(user.uid);
    const displayName = authUser.displayName || email.split('@')[0];
    const parts = displayName.trim().split(/\s+/);

    const batch = db.batch();
    batch.set(adminRef, {
      uid: user.uid,
      email,
      displayName,
      firstName: parts[0] || '',
      lastName: parts.slice(1).join(' ') || '',
      role,
      department,
      permissions,
      isActive: true,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      lastLoginAt: FieldValue.serverTimestamp(),
      createdBy: inviteData.invitedByUid || 'system',
      profileImage: authUser.photoURL || '',
    });
    batch.update(validDoc.ref, {
      status: 'registered',
      acceptedByUid: user.uid,
      token: null,
      updatedAt: FieldValue.serverTimestamp(),
    });
    await batch.commit();

    // ตั้ง Custom Claims ทันทีเพื่อลด Firestore rules get() reads
    try {
      await getAdminAuth().setCustomUserClaims(user.uid, {
        role,
        department,
        isActive: true,
      });
    } catch (claimErr) {
      console.warn('[invites/claim] setCustomUserClaims failed:', claimErr);
    }

    return NextResponse.json({ ok: true, claimed: true });
  } catch (e: any) {
    const status = e?.status || (String(e?.message || '').includes('เข้าสู่ระบบ') ? 401 : 500);
    return NextResponse.json({ ok: false, error: e?.message || 'Claim failed' }, { status });
  }
}
