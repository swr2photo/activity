// src/app/admin/App.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';

import AdminLogin from '../../components/AdminLogin';
import AdminMain from '../../components/admin/AdminMain';

import { onAuthStateChanged, User, signOut } from 'firebase/auth';
import { auth, db } from '../../lib/firebase';
import { doc, getDoc, onSnapshot, Timestamp } from 'firebase/firestore';
import type { AdminProfile, AdminRole, AdminDepartment } from '../../types/admin';
import { ROLE_PERMISSIONS, normalizeDepartment } from '../../types/admin';

import useAdminSession, { endSession, getSession } from '../../lib/useAdminSession';
import { useSnackbar } from 'notistack';

// ✅ รายการหน้าที่อนุญาต
const VALID_SECTIONS = [
  'dashboard',
  'activity-list',
  'qr-generator',
  'users',
  'admin-management',
  'reports',
  'registration-history',
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
    const unsubscribe = onAuthStateChanged(auth, async (user: User | null) => {
      if (user) {
        await bootstrapAdminOnce(user);
        startLiveAdminSubscribe(user.uid);
      } else {
        setCurrentAdmin(null);
      }
      setAuthChecked(true);
      setLoading(false);
    });
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentAdmin && !auth.currentUser) {
      const s = getSession();
      if (s) endSession();
    }
  }, [currentAdmin]);

  const bootstrapAdminOnce = async (user: User) => {
    const ref = doc(db, 'adminUsers', user.uid);
    const snap = await getDoc(ref);
    if (!snap.exists()) return;
    const d = snap.data() as any;
    if (d.isActive === false) return;

    const rawRole = d.role as string;
    const mappedRole = (rawRole === 'admin' ? 'department_admin' : rawRole) as AdminRole;

    const profile: AdminProfile = {
      uid: user.uid,
      email: d.email ?? user.email ?? '',
      displayName: d.displayName ?? user.displayName ?? '',
      firstName: d.firstName ?? '',
      lastName: d.lastName ?? '',
      department: normalizeDepartment(d.department),
      role: mappedRole,
      isActive: d.isActive ?? true,
      lastLoginAt: d.lastLogin instanceof Timestamp ? d.lastLogin.toDate() : (d.lastLogin as Date) ?? new Date(),
      createdAt: d.createdAt instanceof Timestamp ? d.createdAt.toDate() : (d.createdAt as Date) ?? new Date(),
      permissions: Array.isArray(d.permissions) ? d.permissions : (ROLE_PERMISSIONS[mappedRole] ?? []),
      updatedAt: new Date(),
      profileImage: d.profileImage,
      profileImagePosX: clamp(d.profileImagePosX) ?? 50,
      profileImagePosY: clamp(d.profileImagePosY) ?? 50,
    };
    setCurrentAdmin(normalizeAdmin(profile));
  };

  const startLiveAdminSubscribe = (uid: string) => {
    const ref = doc(db, 'adminUsers', uid);
    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as any;
      if (d.isActive === false) return;

      setCurrentAdmin((prev) => {
        if (!prev) return prev;
        const rawRole = d.role as string;
        const mappedRole = (rawRole === 'admin' ? 'department_admin' : rawRole) as AdminRole;
        const merged: AdminProfile = normalizeAdmin({
          ...prev,
          email: d.email ?? prev.email,
          displayName: d.displayName ?? prev.displayName,
          firstName: d.firstName ?? prev.firstName,
          lastName: d.lastName ?? prev.lastName,
          department: normalizeDepartment(d.department ?? prev.department),
          role: mappedRole,
          permissions: Array.isArray(d.permissions) ? d.permissions : prev.permissions,
          profileImage: d.profileImage ?? prev.profileImage,
          profileImagePosX: clamp(d.profileImagePosX) ?? prev.profileImagePosX,
          profileImagePosY: clamp(d.profileImagePosY) ?? prev.profileImagePosY,
          updatedAt: new Date(),
        } as AdminProfile);
        return merged;
      });
    });
  };

  const handleLoginSuccess = (profile: AdminProfile) => {
    setCurrentAdmin(normalizeAdmin(profile));
  };

  const handleLogout = async () => {
    try { await signOut(auth); } catch {}
    end();
    endSession();
    setCurrentAdmin(null);
  };

  if (loading || !authChecked) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col">
        <div className="h-16 bg-white border-b border-slate-200 flex items-center px-6">
          <div className="h-8 w-48 bg-slate-200 rounded animate-pulse" />
        </div>
        <div className="flex flex-1">
          <div className="w-64 bg-white border-r border-slate-200 p-6 hidden md:block">
            <div className="space-y-4">
              <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
              <div className="h-10 w-full bg-slate-100 rounded animate-pulse" />
            </div>
          </div>
          <div className="flex-1 p-8">
            <div className="h-8 w-64 bg-slate-200 rounded animate-pulse mb-8" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
              <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
              <div className="h-32 bg-slate-200 rounded-xl animate-pulse" />
            </div>
            <div className="h-64 bg-slate-200 rounded-xl animate-pulse mt-6" />
          </div>
        </div>
      </div>
    );
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