// src/app/admin/App.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';

import AdminLogin from '../../components/AdminLogin';
import AdminShellSkeleton from '../../components/admin/AdminShellSkeleton';

import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { adminAuth as auth, adminDb as db } from '../../lib/firebaseAdminClient';
import { doc, onSnapshot, Timestamp } from 'firebase/firestore';
import type { AdminProfile, AdminRole } from '../../types/admin';
import { ROLE_PERMISSIONS, normalizeDepartment } from '../../types/admin';

import useAdminSession, { endSession, getSession } from '../../lib/useAdminSession';
import { useSnackbar } from '@/lib/toast';

const AdminMain = dynamic(() => import('../../components/admin/AdminMain'), {
  ssr: false,
  loading: () => <AdminShellSkeleton />,
});

// ✅ รายการหน้าที่อนุญาต (รองรับทั้ง 5 หมวดใหม่และ key เดิมใน localStorage)
const VALID_SECTIONS = [
  'dashboard',
  'activities',
  'activity-list',
  'qr-generator',
  'short-links',
  'users',
  'team-settings',
  'admin-management',
  'reports',
  'registration-history',
  'survey-results',
  'settings',
  'profile',
] as const;
type InitialSection = typeof VALID_SECTIONS[number];

const clamp = (n?: number) =>
  typeof n === 'number' ? Math.max(0, Math.min(100, n)) : undefined;

const normalizeAdmin = (a: AdminProfile): AdminProfile => ({
  ...a,
  permissions: Array.isArray(a.permissions) ? a.permissions : [],
  firstName: a.firstName ?? '',
  lastName: a.lastName ?? '',
  displayName: a.displayName ?? `${a.firstName ?? ''} ${a.lastName ?? ''}`.trim(),
  profileImage: a.profileImage,
  profileImagePosX: clamp(a.profileImagePosX) ?? 50,
  profileImagePosY: clamp(a.profileImagePosY) ?? 50,
});

function App() {
  const { enqueueSnackbar } = useSnackbar();

  const [currentAdmin, setCurrentAdmin] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [authChecked, setAuthChecked] = useState(false);

  const initialSection = useMemo<InitialSection | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    try {
      const raw = localStorage.getItem('admin:lastSection') ?? '';
      return (VALID_SECTIONS as readonly string[]).includes(raw) ? (raw as InitialSection) : undefined;
    } catch {
      return undefined;
    }
  }, []);

  const { end } = useAdminSession({
    minutes: 30,
    enabled: !!currentAdmin,
    onExpire: async () => {
      try { await signOut(auth); } catch {}
      endSession();
      setCurrentAdmin(null);
      enqueueSnackbar('เซสชันหมดเวลา • ออกจากระบบอัตโนมัติ', { variant: 'warning' });
    },
  });

  useEffect(() => {
    let unsubLive: (() => void) | null = null;

    const unsubscribe = onAuthStateChanged(auth, (user: User | null) => {
      unsubLive?.();
      unsubLive = null;

      if (!user) {
        setCurrentAdmin(null);
        setAuthChecked(true);
        setLoading(false);
        return;
      }

      // ใช้ onSnapshot ตัวเดียวทั้งโหลดครั้งแรกและอัปเดตสด (ลด getDoc ซ้ำ)
      const ref = doc(db, 'adminUsers', user.uid);
      unsubLive = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            setCurrentAdmin(null);
            setAuthChecked(true);
            setLoading(false);
            return;
          }
          const d = snap.data() as any;
          if (d.isActive === false) {
            setCurrentAdmin(null);
            setAuthChecked(true);
            setLoading(false);
            void signOut(auth).catch(() => {});
            return;
          }

          const rawRole = d.role as string;
          const mappedRole = (rawRole === 'admin' ? 'department_admin' : rawRole) as AdminRole;

          setCurrentAdmin((prev) => {
            const nextEmail = d.email ?? prev?.email ?? user.email ?? '';
            const nextDisplayName = d.displayName ?? prev?.displayName ?? user.displayName ?? '';
            const nextFirstName = d.firstName ?? prev?.firstName ?? '';
            const nextLastName = d.lastName ?? prev?.lastName ?? '';
            const nextDept = normalizeDepartment(d.department ?? prev?.department);
            const nextPerms = Array.isArray(d.permissions)
              ? d.permissions
              : (prev?.permissions?.length ? prev.permissions : (ROLE_PERMISSIONS[mappedRole] ?? []));
            const nextImage = d.profileImage ?? prev?.profileImage;
            const nextX = clamp(d.profileImagePosX) ?? prev?.profileImagePosX ?? 50;
            const nextY = clamp(d.profileImagePosY) ?? prev?.profileImagePosY ?? 50;

            if (
              prev &&
              prev.uid === user.uid &&
              prev.email === nextEmail &&
              prev.displayName === nextDisplayName &&
              prev.firstName === nextFirstName &&
              prev.lastName === nextLastName &&
              prev.department === nextDept &&
              prev.role === mappedRole &&
              prev.profileImage === nextImage &&
              prev.profileImagePosX === nextX &&
              prev.profileImagePosY === nextY &&
              JSON.stringify(prev.permissions) === JSON.stringify(nextPerms)
            ) {
              return prev;
            }

            return normalizeAdmin({
              uid: user.uid,
              email: nextEmail,
              displayName: nextDisplayName,
              firstName: nextFirstName,
              lastName: nextLastName,
              department: nextDept,
              role: mappedRole,
              isActive: true,
              lastLoginAt: d.lastLogin instanceof Timestamp ? d.lastLogin.toDate() : (d.lastLogin as Date) ?? new Date(),
              createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date) ?? new Date(),
              permissions: nextPerms,
              updatedAt: d.updatedAt instanceof Timestamp ? d.updatedAt.toDate() : new Date(),
              profileImage: nextImage,
              profileImagePosX: nextX,
              profileImagePosY: nextY,
            });
          });

          setAuthChecked(true);
          setLoading(false);
        },
        () => {
          setCurrentAdmin(null);
          setAuthChecked(true);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubLive?.();
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!currentAdmin && !auth.currentUser) {
      const s = getSession();
      if (s) endSession();
    }
  }, [currentAdmin]);

  const handleLoginSuccess = useCallback((profile: AdminProfile) => {
    setCurrentAdmin(normalizeAdmin(profile));
  }, []);

  const handleLogout = useCallback(async () => {
    try { await signOut(auth); } catch {}
    end();
    endSession();
    setCurrentAdmin(null);
  }, [end]);

  if (loading || !authChecked) {
    return <AdminShellSkeleton />;
  }

  return (
    <>
      {currentAdmin ? (
        <AdminMain currentAdmin={currentAdmin} onLogout={handleLogout} initialSection={initialSection} />
      ) : (
        <AdminLogin onLoginSuccess={handleLoginSuccess} />
      )}
    </>
  );
}

export default App;
