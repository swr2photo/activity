import { NextRequest } from 'next/server';
import { getAdminAuth, getAdminDb } from './firebaseAdmin';

export async function verifyAdminToken(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new Error('Missing or invalid Authorization header');
    }

    const token = authHeader.split('Bearer ')[1];
    if (!token) {
      throw new Error('Token is missing');
    }

    const auth = getAdminAuth();
    const decodedToken = await auth.verifyIdToken(token);
    const uid = decodedToken.uid;

    const db = getAdminDb();
    const adminDoc = await db.collection('adminUsers').doc(uid).get();

    if (!adminDoc.exists) {
      throw new Error('User is not an admin');
    }

    const adminData = adminDoc.data();
    if (adminData?.isActive !== true) {
      throw new Error('Admin account is not active');
    }

    return {
      uid,
      email: decodedToken.email,
      adminData,
    };
  } catch (error: any) {
    throw new Error(`Authentication failed: ${error.message}`);
  }
}
