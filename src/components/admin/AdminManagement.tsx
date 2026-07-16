// src/components/admin/AdminManagement.tsx
'use client';

import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { useSnackbar } from 'notistack';
import {
  Shield, UserPlus, Mail, RefreshCw, Edit, Trash2, ShieldAlert, Check,
  Copy, X, Search, ChevronDown, CheckCircle2, ShieldCheck, MailWarning, UserX
} from 'lucide-react';

import {
  AdminProfile,
  AdminDepartment,
  AdminRole,
  AdminPermission,
  DEPARTMENT_LABELS,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
} from '../../types/admin';

import {
  getAdminsByDepartment,
  updateAdminUser,
  deleteAdminUser,
  getAllUsers,
  getUsersByDepartment,
  type UnivUser,
  getAdminInvitesByDepartment,
  type AdminInvite,
  logAdminEvent,
} from '../../lib/adminFirebase';
import { adminAuth as auth } from '../../lib/firebase';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PageHeader } from './shared/PageHeader';

type Props = { currentAdmin: AdminProfile };

const PERMISSION_META: Record<
  AdminPermission,
  { th: string; en: string; descTh: string; descEn: string; group: string }
> = {
  manage_users: {
    th: 'จัดการผู้ใช้', en: 'Manage Users', descTh: 'อนุมัติ/ระงับ/แก้ไขโปรไฟล์ผู้ใช้', descEn: 'Approve/Suspend/Edit user profiles', group: 'Users'
  },
  manage_activities: {
    th: 'จัดการกิจกรรม', en: 'Manage Activities', descTh: 'สร้าง/แก้ไข/ปิดกิจกรรมและ QR', descEn: 'Create/Edit/Close activities & QR', group: 'Activities'
  },
  view_reports: {
    th: 'ดูรายงาน', en: 'View Reports', descTh: 'เข้าถึงหน้ารายงานและสถิติ', descEn: 'Access reports and analytics', group: 'Reports'
  },
  export_data: {
    th: 'ส่งออกข้อมูล', en: 'Export Data', descTh: 'ดาวน์โหลดข้อมูลเป็นไฟล์', descEn: 'Download data as files', group: 'Data'
  },
  manage_admins: {
    th: 'จัดการแอดมิน', en: 'Manage Admins', descTh: 'เพิ่ม/แก้ไข/ลบผู้ดูแล', descEn: 'Create/Update/Delete admins', group: 'Admins'
  },
  system_settings: {
    th: 'ตั้งค่าระบบ', en: 'System Settings', descTh: 'แก้ไขการตั้งค่าทั่วไปของระบบ', descEn: 'Modify global system settings', group: 'System'
  },
  moderate_content: {
    th: 'กลั่นกรองเนื้อหา', en: 'Moderate Content', descTh: 'จัดการเนื้อหาที่รายงาน/ไม่เหมาะสม', descEn: 'Handle flagged/inappropriate content', group: 'Moderation'
  },
};
const ALL_PERMS = Object.keys(PERMISSION_META) as AdminPermission[];

type ConfirmState = {
  open: boolean;
  title?: string;
  message?: string;
  confirmText?: string;
  onConfirm?: () => Promise<void> | void;
  busy?: boolean;
};
const useConfirm = () => {
  const [state, setState] = useState<ConfirmState>({ open: false });
  const open = (s: Omit<ConfirmState, 'busy' | 'open'>) => setState({ open: true, busy: false, ...s });
  const close = () => setState({ open: false });
  const setBusy = (busy: boolean) => setState((p) => ({ ...p, busy }));
  return { state, open, close, setBusy };
};

const roleRank = (role: AdminRole) => {
  switch (role) {
    case 'super_admin': return 3;
    case 'department_admin': return 2;
    case 'moderator': return 1;
    default: return 0;
  }
};

const safeSplitName = (displayName?: string) => {
  const raw = (displayName || '').trim();
  if (!raw) return { firstName: '', lastName: '' };
  const parts = raw.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
};

const getSiteOrigin = () => {
  const env = (process.env.NEXT_PUBLIC_SITE_URL || '').toString().replace(/\/$/, '');
  if (env) return env;
  if (typeof window !== 'undefined' && window.location?.origin) return window.location.origin;
  return '';
};

const AdminManagement: React.FC<Props> = ({ currentAdmin }) => {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();

  const [admins, setAdmins] = useState<AdminProfile[]>([]);
  const [invites, setInvites] = useState<AdminInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [dialogOpen, setDialogOpen] = useState(false);
  const closeDialog = () => setDialogOpen(false);
  const [mode, setMode] = useState<'create' | 'edit' | 'invite'>('create');
  const [editingUid, setEditingUid] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<AdminProfile>>({
    uid: '', email: '', firstName: '', lastName: '', displayName: '',
    role: 'department_admin', department: currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department,
    permissions: [], isActive: true,
  });

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<AdminRole>(currentAdmin.role === 'super_admin' ? 'department_admin' : 'moderator');
  const [inviteDept, setInviteDept] = useState<AdminDepartment>(currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department);
  const [invitePerms, setInvitePerms] = useState<AdminPermission[]>([]);

  const [userOptions, setUserOptions] = useState<UnivUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<UnivUser | null>(null);
  const [userSearch, setUserSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const isSuper = currentAdmin.role === 'super_admin';
  const canManageAdmins = (currentAdmin.permissions ?? []).includes('manage_admins') || isSuper;

  const SITE_ORIGIN = useMemo(() => getSiteOrigin(), []);

  const safeLog = useCallback(async (event: string, payload: any) => {
    try { await logAdminEvent(event, payload, { uid: currentAdmin.uid, email: currentAdmin.email }); } catch {}
  }, [currentAdmin.email, currentAdmin.uid]);

  const load = useCallback(async () => {
    setLoading(true); setErr('');
    try {
      const dept: AdminDepartment = isSuper ? ('all' as any) : (currentAdmin.department as AdminDepartment);
      const [adminList, inviteList] = await Promise.all([ getAdminsByDepartment(dept), getAdminInvitesByDepartment(dept) ]);
      setAdmins(adminList);
      setInvites(inviteList);
    } catch (e: any) {
      setErr(e?.message || 'โหลดข้อมูลไม่สำเร็จ');
      enqueueSnackbar(e?.message || 'โหลดข้อมูลไม่สำเร็จ', { variant: 'error' });
    } finally {
      setLoading(false);
    }
  }, [currentAdmin.department, enqueueSnackbar, isSuper]);

  useEffect(() => { void load(); }, [load]);

  const useRoleDefaults = useCallback((target: 'form' | 'invite' = 'form') => {
    if (target === 'form') {
      if (!form.role) return;
      setForm((p) => ({ ...p, permissions: ROLE_PERMISSIONS[form.role as AdminRole] || [] }));
    } else {
      setInvitePerms(ROLE_PERMISSIONS[inviteRole] || []);
    }
  }, [form.role, inviteRole]);

  const onChange = useCallback(<K extends keyof AdminProfile>(k: K, v: AdminProfile[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  const onTogglePermission = useCallback((perm: AdminPermission, target: 'form' | 'invite' = 'form') => {
    if (target === 'form') {
      setForm((p) => {
        const list = new Set(p.permissions || []);
        if (list.has(perm)) list.delete(perm); else list.add(perm);
        return { ...p, permissions: Array.from(list) };
      });
    } else {
      setInvitePerms((prev) => {
        const set = new Set(prev);
        if (set.has(perm)) set.delete(perm); else set.add(perm);
        return Array.from(set);
      });
    }
  }, []);

  const canDelete = useCallback((target: AdminProfile) => {
    if (currentAdmin.uid === target.uid) return false;
    if (isSuper) return true;
    return target.department === currentAdmin.department && target.role !== 'super_admin';
  }, [currentAdmin.department, currentAdmin.uid, isSuper]);

  const openCreate = useCallback(async () => {
    setMode('create'); setEditingUid(null); setSelectedUser(null); setUserSearch(''); setErr('');
    setForm({
      uid: '', email: '', firstName: '', lastName: '', displayName: '',
      role: isSuper ? 'department_admin' : 'moderator',
      department: (isSuper ? inviteDept : currentAdmin.department) as any,
      permissions: [], isActive: true,
    });
    try {
      const options = isSuper ? await getAllUsers() : await getUsersByDepartment(currentAdmin.department as AdminDepartment);
      setUserOptions(options);
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'โหลดผู้ใช้ไม่สำเร็จ', { variant: 'error' });
    }
    setDialogOpen(true);
  }, [currentAdmin.department, enqueueSnackbar, inviteDept, isSuper]);

  const openInvite = useCallback(() => {
    setMode('invite'); setErr(''); setInviteEmail('');
    setInviteRole(isSuper ? 'department_admin' : 'moderator');
    setInviteDept(isSuper ? 'student_union' : (currentAdmin.department as AdminDepartment));
    setInvitePerms([]);
    setDialogOpen(true);
  }, [currentAdmin.department, isSuper]);

  const openEdit = useCallback((a: AdminProfile) => {
    if (!isSuper && a.department !== currentAdmin.department) return;
    setMode('edit'); setEditingUid(a.uid); setSelectedUser(null); setUserSearch(''); setErr('');
    setForm({
      uid: a.uid, email: a.email, firstName: a.firstName, lastName: a.lastName, displayName: a.displayName,
      role: a.role, department: a.department, permissions: a.permissions || [],
      isActive: a.isActive, profileImage: a.profileImage || '',
    });
    setDialogOpen(true);
  }, [currentAdmin.department, isSuper]);

  const submit = useCallback(async () => {
    setErr('');
    try {
      if (mode === 'create') {
        if (!selectedUser) {
          const m = 'โปรดเลือกผู้ใช้ที่จะตั้งเป็นแอดมิน';
          setErr(m); enqueueSnackbar(m, { variant: 'warning' }); return;
        }
        if (!isSuper && form.role === 'super_admin') {
          const m = 'คุณไม่มีสิทธิ์ตั้งบทบาทเป็นผู้ดูแลสูงสุด';
          setErr(m); enqueueSnackbar(m, { variant: 'error' }); return;
        }

        const dept: AdminDepartment = (isSuper ? (form.department as AdminDepartment) : (currentAdmin.department as AdminDepartment)) as AdminDepartment;
        const fallbackName = safeSplitName(selectedUser.displayName);
        const firstName = selectedUser.firstName || fallbackName.firstName || '';
        const lastName = selectedUser.lastName || fallbackName.lastName || '';

        const payload: AdminProfile = {
          uid: selectedUser.uid, email: selectedUser.email || '', firstName, lastName,
          displayName: selectedUser.displayName || `${firstName || ''} ${lastName || ''}`.trim(),
          role: (form.role || 'department_admin') as AdminRole,
          department: dept,
          permissions: form.permissions && form.permissions.length > 0 ? (form.permissions as AdminPermission[]) : ROLE_PERMISSIONS[(form.role || 'department_admin') as AdminRole] || [],
          isActive: form.isActive ?? true,
          createdAt: new Date(), updatedAt: new Date(),
          createdBy: currentAdmin.uid, lastLoginAt: null,
          profileImage: selectedUser.photoURL || '',
        };

        await updateAdminUser(payload.uid, payload);
        await safeLog('ADMIN_CREATE', { targetUid: payload.uid, role: payload.role, department: payload.department });
        enqueueSnackbar('เพิ่มแอดมินเรียบร้อย', { variant: 'success' });
      }

      if (mode === 'edit') {
        if (!editingUid) return;
        if (!isSuper) {
          if (form.role === 'super_admin') {
            const m = 'คุณไม่มีสิทธิ์ตั้งบทบาทเป็นผู้ดูแลสูงสุด';
            setErr(m); enqueueSnackbar(m, { variant: 'error' }); return;
          }
          if (form.department !== currentAdmin.department) {
            const m = 'ไม่สามารถเปลี่ยนสังกัดข้ามหน่วยได้';
            setErr(m); enqueueSnackbar(m, { variant: 'error' }); return;
          }
        }
        await updateAdminUser(editingUid, {
          role: form.role as AdminRole, department: form.department as AdminDepartment,
          permissions: (form.permissions || []) as AdminPermission[],
          isActive: !!form.isActive, profileImage: (form as any).profileImage || '',
          updatedAt: new Date(),
        } as any);
        await safeLog('ADMIN_UPDATE', { targetUid: editingUid, role: form.role, department: form.department });
        enqueueSnackbar('อัปเดตข้อมูลแอดมินเรียบร้อย', { variant: 'success' });
      }

      if (mode === 'invite') {
        if (!inviteEmail.trim()) {
          const m = 'โปรดกรอกอีเมลผู้รับเชิญ';
          setErr(m); enqueueSnackbar(m, { variant: 'warning' }); return;
        }
        if (!isSuper && inviteRole === 'super_admin') {
          const m = 'คุณไม่มีสิทธิ์เชิญบทบาทผู้ดูแลสูงสุด';
          setErr(m); enqueueSnackbar(m, { variant: 'error' }); return;
        }
        const dept: AdminDepartment = isSuper ? inviteDept : (currentAdmin.department as AdminDepartment);

        const token = await auth.currentUser?.getIdToken();
        const res = await fetch('/api/invites/send', {
          method: 'POST', 
          headers: { 
            'content-type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {})
          },
          body: JSON.stringify({
            email: inviteEmail.trim(), role: inviteRole, department: dept,
            permissions: invitePerms.length ? invitePerms : ROLE_PERMISSIONS[inviteRole] || [],
            invitedByUid: currentAdmin.uid, invitedByEmail: currentAdmin.email,
          }),
        });

        const data = await res.json();
        if (!res.ok || !data?.ok) {
          const m = data?.error || 'ส่งคำเชิญไม่สำเร็จ';
          setErr(m); enqueueSnackbar(m, { variant: 'error' }); return;
        }

        await safeLog('ADMIN_INVITE_CREATE', { email: inviteEmail.trim(), role: inviteRole, department: dept });
        enqueueSnackbar('ส่งคำเชิญทางอีเมลเรียบร้อย', { variant: 'success' });
      }

      setDialogOpen(false);
      await load();
    } catch (e: any) {
      const m = e?.message || 'บันทึกไม่สำเร็จ';
      setErr(m);
      enqueueSnackbar(m, { variant: 'error' });
    }
  }, [currentAdmin.department, currentAdmin.email, currentAdmin.uid, enqueueSnackbar, form, inviteDept, inviteEmail, invitePerms, inviteRole, isSuper, load, mode, editingUid, safeLog, selectedUser]);

  const removeAdmin = useCallback((a: AdminProfile) => {
    if (!canDelete(a)) return;
    confirm.open({
      title: 'ยืนยันการลบแอดมิน',
      message: `ต้องการลบสิทธิ์แอดมินของ ${a.firstName} ${a.lastName} ใช่หรือไม่?`,
      confirmText: 'ลบ',
      onConfirm: async () => {
        confirm.setBusy(true);
        try {
          await deleteAdminUser(a.uid);
          await safeLog('ADMIN_DELETE', { targetUid: a.uid });
          enqueueSnackbar('ลบแอดมินเรียบร้อย', { variant: 'success' });
          await load();
        } catch (e: any) {
          enqueueSnackbar(e?.message || 'ลบไม่สำเร็จ', { variant: 'error' });
        } finally {
          confirm.setBusy(false); confirm.close();
        }
      },
    });
  }, [canDelete, confirm, enqueueSnackbar, load, safeLog]);

  const cancelInvite = useCallback((inv: AdminInvite) => {
    if (!isSuper && inv.department !== currentAdmin.department) return;
    confirm.open({
      title: 'ยืนยันยกเลิกคำเชิญ',
      message: `ยกเลิกคำเชิญสำหรับ ${inv.email}?`,
      confirmText: 'ยกเลิกคำเชิญ',
      onConfirm: async () => {
        confirm.setBusy(true);
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/invites/cancel', {
            method: 'POST', 
            headers: { 
              'content-type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ id: inv.id }),
          });
          const data = await res.json();
          if (!res.ok || !data?.ok) throw new Error(data?.error || 'ยกเลิกคำเชิญไม่สำเร็จ');
          await safeLog('ADMIN_INVITE_CANCEL', { inviteId: inv.id, email: inv.email });
          enqueueSnackbar('ยกเลิกคำเชิญแล้ว', { variant: 'info' });
          await load();
        } catch (e: any) {
          enqueueSnackbar(e?.message || 'ยกเลิกคำเชิญไม่สำเร็จ', { variant: 'error' });
        } finally {
          confirm.setBusy(false); confirm.close();
        }
      },
    });
  }, [confirm, currentAdmin.department, enqueueSnackbar, isSuper, load, safeLog]);

  const deleteInvite = useCallback((inv: AdminInvite) => {
    if (!isSuper && inv.department !== currentAdmin.department) return;
    confirm.open({
      title: 'ลบประวัติคำเชิญ',
      message: `ลบประวัติคำเชิญของ ${inv.email}? (การลบนี้ถาวร)`,
      confirmText: 'ลบประวัติ',
      onConfirm: async () => {
        confirm.setBusy(true);
        try {
          const token = await auth.currentUser?.getIdToken();
          const res = await fetch('/api/invites/delete', {
            method: 'POST', 
            headers: { 
              'content-type': 'application/json',
              ...(token ? { Authorization: `Bearer ${token}` } : {})
            },
            body: JSON.stringify({ id: inv.id }),
          });
          const data = await res.json();
          if (!res.ok || !data?.ok) throw new Error(data?.error || 'ลบประวัติคำเชิญไม่สำเร็จ');
          await safeLog('ADMIN_INVITE_DELETE', { inviteId: inv.id, email: inv.email });
          enqueueSnackbar('ลบประวัติคำเชิญแล้ว', { variant: 'success' });
          await load();
        } catch (e: any) {
          enqueueSnackbar(e?.message || 'ลบประวัติคำเชิญไม่สำเร็จ', { variant: 'error' });
        } finally {
          confirm.setBusy(false); confirm.close();
        }
      },
    });
  }, [confirm, currentAdmin.department, enqueueSnackbar, isSuper, load, safeLog]);

  const copyInviteLink = useCallback(async (inv: AdminInvite) => {
    if (!inv?.token) return;
    if (!SITE_ORIGIN) { enqueueSnackbar('ไม่สามารถสร้างลิงก์ได้ (ไม่พบ site origin)', { variant: 'warning' }); return; }
    if (!isSuper && inv.department !== currentAdmin.department) return;
    try {
      const link = `${SITE_ORIGIN}/admin/invite?token=${inv.token}`;
      await navigator.clipboard.writeText(link);
      enqueueSnackbar('คัดลอกลิงก์แล้ว', { variant: 'success' });
    } catch {
      enqueueSnackbar('คัดลอกลิงก์ไม่สำเร็จ', { variant: 'error' });
    }
  }, [SITE_ORIGIN, currentAdmin.department, enqueueSnackbar, isSuper]);

  const visibleAdmins = useMemo(() => {
    return admins.slice().sort((a, b) => roleRank(b.role as AdminRole) - roleRank(a.role as AdminRole));
  }, [admins]);

  const filteredUsers = useMemo(() => {
    const s = userSearch.trim().toLowerCase();
    if (!s) return userOptions.slice(0, 50);
    return userOptions.filter((u) =>
      (u.firstName || '').toLowerCase().includes(s) ||
      (u.lastName || '').toLowerCase().includes(s) ||
      (u.displayName || '').toLowerCase().includes(s) ||
      (u.email || '').toLowerCase().includes(s) ||
      (u.studentId || '').toLowerCase().includes(s)
    ).slice(0, 50);
  }, [userOptions, userSearch]);

  return (
    <div className="space-y-6 relative">
      <PageHeader 
        title="จัดการแอดมิน"
        subtitle={`สังกัด: ${DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}`}
        icon={<Shield className="h-6 w-6" />}
        actions={
          <>
            <Button variant="outline" onClick={load} disabled={loading} className="flex-1 md:flex-none">
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> รีเฟรช
            </Button>
            <Button onClick={openCreate} disabled={!canManageAdmins} className="flex-1 md:flex-none">
              <UserPlus className="h-4 w-4 mr-2" /> เพิ่มแอดมิน
            </Button>
            <Button variant="secondary" onClick={openInvite} disabled={!canManageAdmins} className="flex-1 md:flex-none">
              <Mail className="h-4 w-4 mr-2" /> เชิญอีเมล
            </Button>
          </>
        }
      />

      {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}

      {/* Invites */}
      <Card className="border shadow-sm">
        <CardContent className="p-6">
          <h2 className="text-lg font-bold mb-4">คำเชิญแอดมิน</h2>
          {invites.length === 0 ? (
            <p className="text-muted-foreground text-sm">ไม่มีคำเชิญ</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {invites.map((inv) => {
                const canSeeInvite = isSuper || inv.department === currentAdmin.department;
                if (!canSeeInvite) return null;
                return (
                  <div key={inv.id} className="flex items-center gap-4 p-4 rounded-xl border bg-card hover:bg-slate-50 transition-colors">
                    <div className="p-2 bg-slate-100 rounded-full">
                      <Mail className="h-5 w-5 text-slate-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{inv.email}</p>
                      <p className="text-xs text-muted-foreground truncate">
                        {ROLE_LABELS[inv.role]} • {DEPARTMENT_LABELS[inv.department] || inv.department}
                      </p>
                    </div>
                    <Badge variant={inv.status === 'pending' ? 'warning' : inv.status === 'accepted' ? 'success' : 'secondary'}>
                      {inv.status === 'pending' ? 'รอรับสิทธิ์' : inv.status === 'accepted' ? 'รับแล้ว' : 'ยกเลิก'}
                    </Badge>
                    <div className="flex items-center gap-1">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => copyInviteLink(inv)} disabled={!inv.token || !SITE_ORIGIN}>
                              <Copy className="h-4 w-4 text-blue-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>คัดลอกลิงก์ยืนยัน</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>

                      {inv.status === 'pending' && (
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" onClick={() => cancelInvite(inv)}>
                                <X className="h-4 w-4 text-amber-500" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>ยกเลิกคำเชิญ</TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}

                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => deleteInvite(inv)}>
                              <Trash2 className="h-4 w-4 text-red-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>ลบประวัติคำเชิญ</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Admins Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {visibleAdmins.length === 0 ? (
          <div className="col-span-full py-10 text-center text-muted-foreground border rounded-xl bg-white">
            ไม่พบข้อมูลแอดมิน
          </div>
        ) : (
          visibleAdmins.map((a) => (
            <Card key={a.uid} className="flex flex-col hover:shadow-md transition-shadow">
              <CardContent className="p-5 flex-1 flex flex-col">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12 border">
                    <AvatarImage src={a.profileImage || ''} />
                    <AvatarFallback>{(a.firstName || 'A').charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold truncate">{a.firstName} {a.lastName}</p>
                    <p className="text-sm text-muted-foreground truncate mb-2">{a.email}</p>
                    <div className="flex flex-wrap gap-1.5">
                      <Badge variant={a.role === 'super_admin' ? 'destructive' : a.role === 'department_admin' ? 'default' : 'secondary'} className="text-[10px]">
                        {ROLE_LABELS[a.role]}
                      </Badge>
                      <Badge variant="outline" className="text-[10px]">
                        {DEPARTMENT_LABELS[a.department] || a.department}
                      </Badge>
                      <Badge variant={a.isActive ? 'success' : 'secondary'} className="text-[10px]">
                        {a.isActive ? 'ใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 -mt-1 -mr-2">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(a)} disabled={!canManageAdmins || (!isSuper && a.department !== currentAdmin.department)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>แก้ไข</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => removeAdmin(a)} disabled={!canDelete(a)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{canDelete(a) ? 'ลบแอดมิน' : 'ไม่สามารถลบได้'}</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                </div>

                {a.permissions && a.permissions.length > 0 && (
                  <div className="mt-4 pt-4 border-t flex flex-wrap gap-1.5">
                    {a.permissions.map((p) => (
                      <TooltipProvider key={p}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className="text-[10px] cursor-help bg-slate-100 hover:bg-slate-200">
                              <ShieldCheck className="h-3 w-3 mr-1" />
                              {PERMISSION_META[p]?.th || p}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="font-semibold">{PERMISSION_META[p]?.th}</p>
                            <p className="text-xs">{PERMISSION_META[p]?.descTh}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Create/Edit/Invite Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {mode === 'create' && <><UserPlus className="h-5 w-5" /> เพิ่มแอดมินจากผู้ใช้</>}
              {mode === 'edit' && <><Edit className="h-5 w-5" /> แก้ไขแอดมิน</>}
              {mode === 'invite' && <><Mail className="h-5 w-5" /> เชิญผู้ใช้เป็นแอดมิน</>}
            </DialogTitle>
          </DialogHeader>

          <div className="py-4 space-y-6">
            {mode === 'create' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>เลือกผู้ใช้ <span className="text-destructive">*</span></Label>
                  <div className="relative">
                    <div 
                      className="border rounded-md px-3 py-2 flex items-center justify-between cursor-pointer"
                      onClick={() => setShowDropdown(!showDropdown)}
                    >
                      {selectedUser ? (
                        <div className="flex items-center gap-2">
                          <Avatar className="h-6 w-6"><AvatarImage src={selectedUser.photoURL} /><AvatarFallback>{selectedUser.firstName?.[0]}</AvatarFallback></Avatar>
                          <span className="font-medium text-sm">{selectedUser.firstName} {selectedUser.lastName} ({selectedUser.email})</span>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">ค้นหาชื่อหรืออีเมล...</span>
                      )}
                      <ChevronDown className="h-4 w-4 opacity-50" />
                    </div>
                    
                    {showDropdown && (
                      <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-md shadow-lg z-50 max-h-64 flex flex-col">
                        <div className="p-2 border-b">
                          <Input 
                            autoFocus
                            placeholder="พิมพ์ค้นหา..." 
                            value={userSearch} 
                            onChange={(e) => setUserSearch(e.target.value)}
                            className="h-8"
                          />
                        </div>
                        <div className="overflow-y-auto p-1">
                          {filteredUsers.length === 0 ? (
                            <div className="p-2 text-center text-sm text-muted-foreground">ไม่พบผู้ใช้</div>
                          ) : (
                            filteredUsers.map(u => (
                              <div 
                                key={u.uid} 
                                className="flex items-center gap-3 p-2 hover:bg-slate-100 rounded cursor-pointer"
                                onClick={() => { setSelectedUser(u); setShowDropdown(false); }}
                              >
                                <Avatar className="h-8 w-8"><AvatarImage src={u.photoURL} /><AvatarFallback>{u.firstName?.[0] || 'U'}</AvatarFallback></Avatar>
                                <div>
                                  <p className="text-sm font-semibold">{u.firstName} {u.lastName} <span className="text-muted-foreground font-normal ml-1">({u.studentId || '-'})</span></p>
                                  <p className="text-xs text-muted-foreground">{u.email}</p>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>บทบาท <span className="text-destructive">*</span></Label>
                    <div className="flex gap-2 bg-slate-100 p-1 rounded-md">
                      <Button type="button" variant={form.role === 'moderator' ? 'default' : 'ghost'} className="flex-1 h-8 text-xs" onClick={() => onChange('role', 'moderator' as any)}>
                        ผู้ช่วย
                      </Button>
                      <Button type="button" variant={form.role === 'department_admin' ? 'default' : 'ghost'} className="flex-1 h-8 text-xs" onClick={() => onChange('role', 'department_admin' as any)}>
                        แอดมินสังกัด
                      </Button>
                      {isSuper && (
                        <Button type="button" variant={form.role === 'super_admin' ? 'default' : 'ghost'} className="flex-1 h-8 text-xs bg-red-100 text-red-700 hover:bg-red-200" onClick={() => onChange('role', 'super_admin' as any)}>
                          Super Admin
                        </Button>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>สังกัด <span className="text-destructive">*</span></Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                      value={form.department || (isSuper ? inviteDept : currentAdmin.department)}
                      onChange={(e) => onChange('department', e.target.value as AdminDepartment)}
                      disabled={!isSuper}
                    >
                      {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => k !== 'all' ? <option key={k} value={k}>{v}</option> : null)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {mode === 'edit' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-xl border">
                  <Avatar className="h-12 w-12 border"><AvatarImage src={(form as any).profileImage || ''} /><AvatarFallback>{form.firstName?.[0]}</AvatarFallback></Avatar>
                  <div>
                    <p className="font-bold text-lg">{form.firstName} {form.lastName}</p>
                    <p className="text-sm text-muted-foreground">{form.email}</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>บทบาท <span className="text-destructive">*</span></Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={form.role || 'moderator'}
                      onChange={(e) => onChange('role', e.target.value as AdminRole)}
                    >
                      {Object.keys(ROLE_LABELS).map((r) => {
                        if (!isSuper && r === 'super_admin') return null;
                        return <option key={r} value={r}>{ROLE_LABELS[r as AdminRole]}</option>;
                      })}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>สังกัด <span className="text-destructive">*</span></Label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50"
                      value={form.department || (isSuper ? 'student_union' : currentAdmin.department)}
                      onChange={(e) => onChange('department', e.target.value as AdminDepartment)}
                      disabled={!isSuper}
                    >
                      {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => k !== 'all' ? <option key={k} value={k}>{v}</option> : null)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            {mode === 'invite' && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>อีเมลผู้รับเชิญ <span className="text-destructive">*</span></Label>
                  <Input placeholder="name@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>บทบาท <span className="text-destructive">*</span></Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm" value={inviteRole} onChange={(e) => setInviteRole(e.target.value as AdminRole)}>
                      <option value="moderator">ผู้ช่วย (Moderator)</option>
                      <option value="department_admin">แอดมินสังกัด (Department Admin)</option>
                      {isSuper && <option value="super_admin">ผู้ดูแลสูงสุด (Super Admin)</option>}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>สังกัด <span className="text-destructive">*</span></Label>
                    <select className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm disabled:opacity-50" value={inviteDept} onChange={(e) => setInviteDept(e.target.value as AdminDepartment)} disabled={!isSuper}>
                      {Object.entries(DEPARTMENT_LABELS).map(([k, v]) => k !== 'all' ? <option key={k} value={k}>{v}</option> : null)}
                    </select>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>ชุดสิทธิ์การเข้าถึง (Permissions)</Label>
                <Button variant="outline" size="sm" onClick={() => useRoleDefaults(mode === 'invite' ? 'invite' : 'form')} className="h-7 text-xs">
                  รีเซ็ตตามบทบาท
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 p-4 bg-slate-50 border rounded-xl">
                {ALL_PERMS.map((p) => {
                  const checked = mode === 'invite' ? invitePerms.includes(p) : (form.permissions || []).includes(p);
                  return (
                    <TooltipProvider key={p}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge 
                            variant={checked ? 'default' : 'outline'}
                            className={cn("cursor-pointer select-none", checked ? "bg-primary text-primary-foreground hover:bg-primary/90" : "bg-white text-muted-foreground hover:bg-slate-100")}
                            onClick={() => onTogglePermission(p, mode === 'invite' ? 'invite' : 'form')}
                          >
                            {checked && <Check className="h-3 w-3 mr-1" />}
                            {!checked && <X className="h-3 w-3 mr-1 opacity-50" />}
                            {PERMISSION_META[p]?.th}
                          </Badge>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p className="font-semibold">{PERMISSION_META[p]?.en}</p>
                          <p className="text-xs">{PERMISSION_META[p]?.descTh}</p>
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  );
                })}
              </div>
            </div>

            {(mode === 'create' || mode === 'edit') && (
              <div className="flex items-center justify-between p-4 border rounded-xl">
                <div className="space-y-0.5">
                  <Label>สถานะการใช้งาน</Label>
                  <p className="text-xs text-muted-foreground">อนุญาตให้แอดมินเข้าสู่ระบบได้</p>
                </div>
                <Switch checked={!!form.isActive} onCheckedChange={(checked) => onChange('isActive', checked as any)} />
              </div>
            )}

            {err && <Alert variant="destructive"><AlertDescription>{err}</AlertDescription></Alert>}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeDialog}>ยกเลิก</Button>
            <Button className="gap-2" onClick={submit} disabled={loading}>
              <ShieldAlert className="h-4 w-4" /> {mode === 'invite' ? 'ส่งคำเชิญ' : 'บันทึก'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirm.state.open} onOpenChange={(v) => !v && !confirm.state.busy && confirm.close()}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{confirm.state.title || 'ยืนยันการทำรายการ'}</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p>{confirm.state.message}</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={confirm.close} disabled={confirm.state.busy}>ยกเลิก</Button>
            <Button variant="destructive" onClick={() => confirm.state.onConfirm?.()} disabled={confirm.state.busy}>
              {confirm.state.busy ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : null}
              {confirm.state.confirmText || 'ยืนยัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export { AdminManagement };
export default AdminManagement;
