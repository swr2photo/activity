// src/components/admin/AdminUserManagement.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Search, RefreshCw, Download, User as PersonIcon,
  CheckCircle, Ban, Eye, EyeOff, ShieldAlert, Users, UserCheck,
} from 'lucide-react';

import {
  DEPARTMENT_LABELS,
  ROLE_PERMISSIONS,
  hasPermission,
  type AdminProfile,
  type AdminDepartment,
  type AdminRole,
  type AdminPermission,
} from '../../types/admin';

import {
  getAllUsers,
  getPendingUsers,
  getUsersByDepartment,
  getPendingUsersByDepartment,
  approveUser,
  suspendUser,
  activateUser,
  type UnivUser,
  createAdminUser,
  logAdminEvent,
} from '../../lib/adminFirebase';

import { adminDb as db } from '../../lib/firebase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { PageHeader } from './shared/PageHeader';
import { useConfirm } from '@/components/providers/ConfirmDialogProvider';
import { useSnackbar } from 'notistack';

interface Props {
  currentAdmin: AdminProfile;
}

const PERMISSION_META: Record<
  AdminPermission,
  { th: string; en: string; descTh: string; descEn: string; group: string }
> = {
  manage_users: {
    th: 'จัดการผู้ใช้',
    en: 'Manage Users',
    descTh: 'อนุมัติ/ระงับ/แก้ไขโปรไฟล์ผู้ใช้',
    descEn: 'Approve/Suspend/Edit user profiles',
    group: 'Users',
  },
  manage_activities: {
    th: 'จัดการกิจกรรม',
    en: 'Manage Activities',
    descTh: 'สร้าง/แก้ไข/ปิดกิจกรรมและ QR',
    descEn: 'Create/Edit/Close activities & QR',
    group: 'Activities',
  },
  view_reports: {
    th: 'ดูรายงาน',
    en: 'View Reports',
    descTh: 'เข้าถึงหน้ารายงานและสถิติ',
    descEn: 'Access reports and analytics',
    group: 'Reports',
  },
  export_data: {
    th: 'ส่งออกข้อมูล',
    en: 'Export Data',
    descTh: 'ดาวน์โหลดข้อมูลเป็นไฟล์',
    descEn: 'Download data as files',
    group: 'Data',
  },
  manage_admins: {
    th: 'จัดการแอดมิน',
    en: 'Manage Admins',
    descTh: 'เพิ่ม/แก้ไข/ลบผู้ดูแล',
    descEn: 'Create/Update/Delete admins',
    group: 'Admins',
  },
  system_settings: {
    th: 'ตั้งค่าระบบ',
    en: 'System Settings',
    descTh: 'แก้ไขการตั้งค่าทั่วไปของระบบ',
    descEn: 'Modify global system settings',
    group: 'System',
  },
  moderate_content: {
    th: 'กลั่นกรองเนื้อหา',
    en: 'Moderate Content',
    descTh: 'จัดการเนื้อหาที่รายงาน/ไม่เหมาะสม',
    descEn: 'Handle flagged/inappropriate content',
    group: 'Moderation',
  },
};

/* ---------- ปิดบังข้อมูลอ่อนไหว (PDPA) ---------- */
const maskEmail = (email?: string) => {
  if (!email) return '-';
  const [local, domain] = email.split('@');
  if (!domain) return email;
  const head = local.slice(0, 3);
  return `${head}${'•'.repeat(Math.max(2, local.length - 3))}@${domain}`;
};
const maskStudentId = (sid?: string) => {
  if (!sid) return '-';
  if (sid.length <= 4) return sid;
  return `${sid.slice(0, 2)}${'•'.repeat(sid.length - 4)}${sid.slice(-2)}`;
};

/* ---------- กัน CSV formula injection ---------- */
const csvCell = (v: any) => {
  let s = String(v ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
};

const AdminUserManagement: React.FC<Props> = ({ currentAdmin }) => {
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();
  const [allUsers, setAllUsers] = useState<UnivUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UnivUser[]>([]);
  const [search, setSearch] = useState('');
  /** 0=ทั้งหมด 1=ใช้งานได้ 2=ถูกระงับ 3=รออนุมัติ (แสดงเมื่อมีเท่านั้น) */
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(false);
  const [busyUid, setBusyUid] = useState<string | null>(null);
  const [showSensitive, setShowSensitive] = useState(false);
  const [loadError, setLoadError] = useState('');

  const canExport = hasPermission(currentAdmin, 'export_data') || currentAdmin.role === 'super_admin';
  const canPromote = hasPermission(currentAdmin, 'manage_admins') || currentAdmin.role === 'super_admin';
  const canManage = hasPermission(currentAdmin, 'manage_users') || currentAdmin.role === 'super_admin';

  // view dialog
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<UnivUser | null>(null);

  // promote-to-admin dialog
  const [promoteOpen, setPromoteOpen] = useState(false);
  const [promoteUser, setPromoteUser] = useState<UnivUser | null>(null);
  const [chosenRole, setChosenRole] = useState<AdminRole>('department_admin');
  const [chosenDept, setChosenDept] = useState<AdminDepartment>(
    (currentAdmin.department === 'all' ? 'student_union' : currentAdmin.department) as AdminDepartment
  );
  const [alreadyAdmin, setAlreadyAdmin] = useState(false);
  const [promoteBusy, setPromoteBusy] = useState(false);
  const [promoteErr, setPromoteErr] = useState('');

  const load = async () => {
    setLoading(true);
    setLoadError('');
    try {
      if (currentAdmin.department === 'all') {
        const [a, p] = await Promise.all([getAllUsers(), getPendingUsers()]);
        setAllUsers(a);
        setPendingUsers(p);
      } else {
        const [a, p] = await Promise.all([
          getUsersByDepartment(currentAdmin.department as AdminDepartment),
          getPendingUsersByDepartment(currentAdmin.department as AdminDepartment),
        ]);
        setAllUsers(a);
        setPendingUsers(p);
      }
    } catch (e: any) {
      console.error(e);
      setLoadError(e?.message || 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin.department]);

  const activeUsers = useMemo(() => allUsers.filter((u) => u.isActive !== false), [allUsers]);
  const suspendedUsers = useMemo(() => allUsers.filter((u) => !u.isActive), [allUsers]);

  const source =
    tab === 0 ? allUsers :
    tab === 1 ? activeUsers :
    tab === 2 ? suspendedUsers :
    pendingUsers;
  const filtered = useMemo(() => {
    if (!search.trim()) return source;
    const s = search.trim().toLowerCase();
    return source.filter(
      (u) =>
        (u.displayName || '').toLowerCase().includes(s) ||
        (u.firstName || '').toLowerCase().includes(s) ||
        (u.lastName || '').toLowerCase().includes(s) ||
        (u.email || '').toLowerCase().includes(s) ||
        (u.studentId || '').toLowerCase().includes(s) ||
        (u.faculty || '').toLowerCase().includes(s) ||
        String(u.department || '').toLowerCase().includes(s)
    );
  }, [source, search]);

  const exportCSV = async () => {
    if (!canExport) return;
    const rows = filtered.map((u) => [
      u.studentId || '',
      u.firstName || '',
      u.lastName || '',
      u.email || '',
      u.faculty || '',
      String(u.department || ''),
      u.degreeLevel || '',
      u.isActive ? 'ใช้งานได้' : 'ถูกระงับ',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : '',
    ]);

    const csv = [
      ['รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'อีเมล', 'คณะ', 'สาขา', 'ระดับปริญญา', 'สถานะ', 'วันที่สร้าง'],
      ...rows,
    ]
      .map((r) => r.map(csvCell).join(','))
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `university_users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    await logAdminEvent(
      'EXPORT_USERS',
      {
        tab: tab === 0 ? 'all' : tab === 1 ? 'active' : tab === 2 ? 'suspended' : 'pending',
        filteredCount: filtered.length,
        query: search,
        department: currentAdmin.department,
        revealedSensitive: showSensitive,
      },
      { uid: currentAdmin.uid, email: currentAdmin.email }
    );
  };

  /* ---------- ระงับ / คืนสถานะ (มี confirm + audit log) ---------- */
  const doSuspend = async (u: UnivUser) => {
    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.displayName || 'ผู้ใช้';
    const ok = await confirm({
      title: 'ยืนยันระงับการใช้งานบัญชี',
      description: (
        <>
          ต้องการระงับบัญชี <b>&quot;{name}&quot;</b> ({u.studentId || u.email || u.uid}) หรือไม่?
          <br /><br />
          ผู้ใช้จะเข้าสู่ระบบและลงทะเบียนกิจกรรมไม่ได้จนกว่าจะคืนสถานะ
        </>
      ),
      confirmText: 'ระงับบัญชี',
      cancelText: 'ยกเลิก',
      variant: 'warning',
    });
    if (!ok) return;
    setBusyUid(u.uid);
    try {
      await suspendUser(u.uid);
      await logAdminEvent('SUSPEND_USER', { targetUid: u.uid, studentId: u.studentId }, { uid: currentAdmin.uid, email: currentAdmin.email });
      await load();
      enqueueSnackbar('ระงับการใช้งานสำเร็จ', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'ระงับการใช้งานไม่สำเร็จ', { variant: 'error' });
    } finally {
      setBusyUid(null);
    }
  };

  const doActivate = async (u: UnivUser) => {
    const name = `${u.firstName || ''} ${u.lastName || ''}`.trim() || u.displayName || 'ผู้ใช้';
    const ok = await confirm({
      title: 'ยืนยันคืนสถานะการใช้งาน',
      description: (
        <>
          คืนสถานะให้บัญชี <b>&quot;{name}&quot;</b> ({u.studentId || u.email || u.uid}) เพื่อให้ใช้งานระบบได้อีกครั้ง?
        </>
      ),
      confirmText: 'คืนสถานะ',
      cancelText: 'ยกเลิก',
      variant: 'default',
    });
    if (!ok) return;
    setBusyUid(u.uid);
    try {
      await activateUser(u.uid);
      await logAdminEvent('ACTIVATE_USER', { targetUid: u.uid, studentId: u.studentId }, { uid: currentAdmin.uid, email: currentAdmin.email });
      await load();
      enqueueSnackbar('คืนสถานะสำเร็จ', { variant: 'success' });
    } catch (e: any) {
      enqueueSnackbar(e?.message || 'คืนสถานะไม่สำเร็จ', { variant: 'error' });
    } finally {
      setBusyUid(null);
    }
  };

  const toggleSensitive = async () => {
    const next = !showSensitive;
    setShowSensitive(next);
    if (next) {
      // เก็บ audit log เมื่อมีการเปิดดูข้อมูลอ่อนไหวแบบเต็ม
      await logAdminEvent(
        'VIEW_SENSITIVE_USER_DATA',
        { department: currentAdmin.department },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );
    }
  };

  const openPromote = async (u: UnivUser) => {
    setPromoteErr('');
    setPromoteUser(u);
    setChosenRole(currentAdmin.role === 'super_admin' ? 'department_admin' : 'moderator');
    
    let userDept = String(u.department || 'student_union');
    if (!Object.keys(DEPARTMENT_LABELS).includes(userDept)) {
        userDept = 'student_union';
    }

    setChosenDept(
      (currentAdmin.department === 'all'
        ? (userDept as AdminDepartment)
        : currentAdmin.department) as AdminDepartment
    );
    setPromoteOpen(true);

    const ref = doc(db, 'adminUsers', u.uid);
    const snap = await getDoc(ref);
    setAlreadyAdmin(snap.exists());
  };

  const doPromote = async () => {
    if (!promoteUser) return;
    setPromoteBusy(true);
    setPromoteErr('');

    try {
      if (alreadyAdmin) {
        setPromoteErr('ผู้ใช้นี้เป็นผู้ดูแลอยู่แล้ว');
        return;
      }
      if (currentAdmin.role !== 'super_admin' && chosenRole === 'super_admin') {
        setPromoteErr('คุณไม่มีสิทธิ์ตั้งบทบาทเป็นผู้ดูแลสูงสุด');
        return;
      }
      const dept: AdminDepartment =
        (currentAdmin.department === 'all' ? chosenDept : currentAdmin.department) as AdminDepartment;
      const userImage = promoteUser.photoURL || (promoteUser as any).profileImage || '';

      await createAdminUser({
        uid: promoteUser.uid,
        email: promoteUser.email || '',
        displayName: promoteUser.displayName || `${promoteUser.firstName || ''} ${promoteUser.lastName || ''}`.trim(),
        firstName: promoteUser.firstName || promoteUser.displayName?.split(' ')[0] || '',
        lastName: promoteUser.lastName || promoteUser.displayName?.split(' ')[1] || '',
        role: chosenRole,
        department: dept,
        permissions: ROLE_PERMISSIONS[chosenRole] ?? [],
        isActive: true,
        createdBy: currentAdmin.uid,
        lastLoginAt: null,
        profileImage: userImage,
      });

      await logAdminEvent(
        'ADMIN_PROMOTE',
        { targetUid: promoteUser.uid, role: chosenRole, department: dept },
        { uid: currentAdmin.uid, email: currentAdmin.email }
      );

      setPromoteOpen(false);
      enqueueSnackbar('ตั้งค่าผู้ดูแลสำเร็จ! ผู้ใช้จะได้รับสิทธิ์เมื่อล็อกอินครั้งถัดไป', { variant: 'success' });
    } catch (e: any) {
      setPromoteErr(e?.message || 'ไม่สามารถตั้งผู้ใช้เป็นแอดมินได้');
    } finally {
      setPromoteBusy(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      <PageHeader 
        title="จัดการผู้ใช้มหาวิทยาลัย"
        subtitle={`สังกัด: ${(DEPARTMENT_LABELS as any)[currentAdmin.department] || currentAdmin.department}`}
        icon={<Users className="h-6 w-6" />}
      />

      {loadError && (
        <Alert variant="destructive">
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      )}

      {!canManage && (
        <Alert variant="warning">
          <AlertDescription>บัญชีนี้ไม่มีสิทธิ์จัดการผู้ใช้ — สามารถดูรายชื่อได้เท่านั้น</AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'ผู้ใช้ทั้งหมด', value: allUsers.length, tab: 0, iconBg: 'bg-primary/10 text-primary', icon: <PersonIcon className="h-6 w-6" /> },
          { label: 'ใช้งานได้', value: activeUsers.length, tab: 1, iconBg: 'bg-emerald-500/10 text-emerald-600', icon: <UserCheck className="h-6 w-6" /> },
          { label: 'ถูกระงับ', value: suspendedUsers.length, tab: 2, iconBg: 'bg-rose-500/10 text-rose-600', icon: <Ban className="h-6 w-6" /> },
          { label: 'รออนุมัติ', value: pendingUsers.length, tab: 3, iconBg: 'bg-amber-500/10 text-amber-600', icon: <CheckCircle className="h-6 w-6" /> },
        ].map((s) => (
          <Card
            key={s.label}
            className={cn('cursor-pointer transition-shadow hover:shadow-md', tab === s.tab && 'ring-2 ring-primary/40')}
            onClick={() => setTab(s.tab)}
          >
            <CardContent className="flex items-center gap-4 p-6">
              <div className={cn('p-3 rounded-full', s.iconBg)}>{s.icon}</div>
              <div>
                <p className="text-2xl font-bold">{s.value.toLocaleString()}</p>
                <p className="text-sm text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardContent className="flex flex-col md:flex-row gap-4 items-center p-4">
          <div className="relative w-full md:w-96">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ค้นหาผู้ใช้..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex-1" />
          <div className="flex gap-2 w-full md:w-auto">
            <Button variant="outline" onClick={toggleSensitive} className="flex-1 md:flex-none">
              {showSensitive ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />}
              {showSensitive ? 'ปิดบังข้อมูล' : 'แสดงข้อมูลเต็ม'}
            </Button>
            <Button variant="outline" onClick={load} disabled={loading} className="flex-1 md:flex-none">
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              รีเฟรช
            </Button>
            {canExport && (
              <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0} className="flex-1 md:flex-none text-emerald-600">
                <Download className="h-4 w-4 mr-2" />
                ส่งออก
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-0 border-b">
          <div className="flex flex-wrap gap-4 px-4 pt-4">
            {[
              { id: 0, label: `ผู้ใช้ทั้งหมด (${allUsers.length})` },
              { id: 1, label: `ใช้งานได้ (${activeUsers.length})` },
              { id: 2, label: `ถูกระงับ (${suspendedUsers.length})`, badge: suspendedUsers.length > 0 ? suspendedUsers.length : 0, badgeClass: 'bg-rose-500' },
              ...(pendingUsers.length > 0
                ? [{ id: 3, label: `รออนุมัติ (${pendingUsers.length})`, badge: pendingUsers.length, badgeClass: 'bg-amber-500' }]
                : []),
            ].map((t) => (
              <button
                key={t.id}
                className={cn(
                  'pb-3 text-sm font-medium border-b-2 transition-colors inline-flex items-center',
                  tab === t.id ? 'border-primary text-primary' : 'border-transparent text-muted-foreground'
                )}
                onClick={() => setTab(t.id)}
              >
                {t.label}
                {!!t.badge && (
                  <span className={cn('ml-1.5 text-white text-[10px] px-1.5 py-0.5 rounded-full', t.badgeClass)}>
                    {t.badge}
                  </span>
                )}
              </button>
            ))}
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {!showSensitive && filtered.length > 0 && (
            <p className="text-xs text-muted-foreground mb-3 flex items-center gap-1.5">
              <EyeOff className="h-3.5 w-3.5" />
              กำลังปิดบังอีเมลและรหัสนักศึกษา — กด &quot;แสดงข้อมูลเต็ม&quot; เพื่อดู (มีการบันทึก audit log)
            </p>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-16 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin mr-2" /> กำลังโหลด...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {tab === 0 ? 'ไม่มีผู้ใช้ในระบบ' :
               tab === 1 ? 'ไม่มีผู้ใช้ที่ใช้งานได้' :
               tab === 2 ? 'ไม่มีผู้ใช้ที่ถูกระงับ' :
               'ไม่มีผู้ใช้ที่รออนุมัติ'}
            </div>
          ) : (
            <div className="space-y-3">
              {filtered.map((u) => (
                <div key={u.uid} className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-4 rounded-xl border bg-card hover:shadow-sm transition-shadow">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={u.photoURL} />
                    <AvatarFallback>{(u.firstName || u.displayName || 'U').charAt(0)}</AvatarFallback>
                  </Avatar>
                  
                  <div className="min-w-[200px]">
                    <p className="font-semibold">{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-muted-foreground">{showSensitive ? (u.email || '-') : maskEmail(u.email)}</p>
                  </div>

                  <div className="min-w-[180px]">
                    <p className="text-sm">รหัส: <b>{showSensitive ? (u.studentId || '-') : maskStudentId(u.studentId)}</b></p>
                    <p className="text-xs text-muted-foreground">{u.faculty} • {String(u.department || '')}</p>
                  </div>

                  <div className="flex gap-2">
                    <Badge variant={u.isActive ? 'success' : 'destructive'}>
                      {u.isActive ? 'ใช้งานได้' : 'ถูกระงับ'}
                    </Badge>
                  </div>

                  <div className="flex-1" />

                  <div className="flex gap-1 mt-3 sm:mt-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={async () => {
                            setSel(u);
                            setOpen(true);
                            await logAdminEvent('VIEW_USER_DETAIL', { targetUid: u.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                          }}>
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>ดูรายละเอียด</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {canManage && !u.isVerified && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busyUid === u.uid} onClick={async () => {
                              await approveUser(u.uid);
                              await logAdminEvent('APPROVE_USER', { targetUid: u.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                              await load();
                            }}>
                              <CheckCircle className="h-4 w-4 text-emerald-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>อนุมัติ</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

                    {canManage && (u.isActive ? (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busyUid === u.uid} onClick={() => doSuspend(u)}>
                              <Ban className="h-4 w-4 text-rose-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>ระงับการใช้งาน</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ) : (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" disabled={busyUid === u.uid} onClick={() => doActivate(u)}>
                              <UserCheck className="h-4 w-4 text-emerald-600" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>คืนสถานะการใช้งาน</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    ))}

                    {canPromote && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={() => openPromote(u)}>
                              <ShieldAlert className="h-4 w-4 text-indigo-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>ตั้งเป็นแอดมิน</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          {sel && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  <Avatar>
                    <AvatarImage src={sel.photoURL} />
                    <AvatarFallback>{(sel.firstName || 'U').charAt(0)}</AvatarFallback>
                  </Avatar>
                  รายละเอียดผู้ใช้: {sel.firstName} {sel.lastName}
                </DialogTitle>
              </DialogHeader>
              
              <div className="flex gap-2 mb-2">
                <Badge variant={sel.isActive ? 'success' : 'destructive'}>
                  {sel.isActive ? 'ใช้งานได้' : 'ถูกระงับ'}
                </Badge>
                {!sel.isVerified && <Badge variant="secondary">รออนุมัติ</Badge>}
              </div>

              {!showSensitive && (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-3">
                  ข้อมูลอ่อนไหวถูกปิดบังอยู่ — ปิดหน้าต่างนี้แล้วกด &quot;แสดงข้อมูลเต็ม&quot; ก่อนเปิดดูอีกครั้ง
                </p>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
                <div>
                  <p className="text-xs text-muted-foreground">อีเมล</p>
                  <p className="text-sm font-medium break-all">{showSensitive ? (sel.email || '-') : maskEmail(sel.email)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">รหัสนักศึกษา</p>
                  <p className="text-sm font-medium font-mono">{showSensitive ? (sel.studentId || '-') : maskStudentId(sel.studentId)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">คณะ</p>
                  <p className="text-sm font-medium">{sel.faculty || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">สาขา</p>
                  <p className="text-sm font-medium">{String(sel.department || '-')}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">ระดับปริญญา</p>
                  <p className="text-sm font-medium">{sel.degreeLevel || '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">เข้าสู่ระบบล่าสุด</p>
                  <p className="text-sm font-medium">
                    {sel.lastLoginAt
                      ? new Date(sel.lastLoginAt).toLocaleString('th-TH')
                      : '-'}
                    {typeof sel.loginCount === 'number' && (
                      <span className="text-xs text-muted-foreground ml-1">({sel.loginCount} ครั้ง)</span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">สร้างเมื่อ</p>
                  <p className="text-sm font-medium">{sel.createdAt ? new Date(sel.createdAt).toLocaleDateString('th-TH') : '-'}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">UID</p>
                  <p className="text-xs font-mono text-slate-500 break-all">{showSensitive ? sel.uid : `${sel.uid.slice(0, 8)}…`}</p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>ปิด</Button>
                {canManage && !sel.isVerified && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
                    await approveUser(sel.uid);
                    await logAdminEvent('APPROVE_USER', { targetUid: sel.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                    setOpen(false);
                    await load();
                  }}>
                    <CheckCircle className="h-4 w-4 mr-2" /> อนุมัติ
                  </Button>
                )}
                {canManage && (sel.isActive ? (
                  <Button variant="destructive" disabled={busyUid === sel.uid} onClick={async () => {
                    await doSuspend(sel);
                    setOpen(false);
                  }}>
                    <Ban className="h-4 w-4 mr-2" /> ระงับ
                  </Button>
                ) : (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" disabled={busyUid === sel.uid} onClick={async () => {
                    await doActivate(sel);
                    setOpen(false);
                  }}>
                    <UserCheck className="h-4 w-4 mr-2" /> คืนสถานะ
                  </Button>
                ))}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={promoteOpen} onOpenChange={setPromoteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-indigo-500" /> ตั้งผู้ใช้งานให้เป็น "แอดมิน"
            </DialogTitle>
          </DialogHeader>
          
          {promoteUser && (
            <div className="space-y-6 py-4">
              {alreadyAdmin && (
                <Alert variant="warning">
                  <AlertDescription>ผู้ใช้นี้เป็นผู้ดูแลอยู่แล้ว</AlertDescription>
                </Alert>
              )}

              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={promoteUser.photoURL} />
                  <AvatarFallback>{(promoteUser.firstName || 'U').charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-bold">{promoteUser.firstName} {promoteUser.lastName}</p>
                  <p className="text-sm text-muted-foreground">{promoteUser.email}</p>
                </div>
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">บทบาท</Label>
                <div className="flex flex-wrap gap-2">
                  <Button variant={chosenRole === 'moderator' ? 'default' : 'outline'} onClick={() => setChosenRole('moderator')}>
                    ผู้ช่วย (Moderator)
                  </Button>
                  <Button variant={chosenRole === 'department_admin' ? 'default' : 'outline'} onClick={() => setChosenRole('department_admin')}>
                    แอดมินสังกัด (Dept Admin)
                  </Button>
                  {currentAdmin.role === 'super_admin' && (
                    <Button variant={chosenRole === 'super_admin' ? 'destructive' : 'outline'} onClick={() => setChosenRole('super_admin')}>
                      ผู้ดูแลสูงสุด (Super Admin)
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label className="text-base font-semibold">สังกัด</Label>
                <select
                  title="เลือกสังกัด"
                  disabled={currentAdmin.department !== 'all'}
                  value={chosenDept}
                  onChange={(e) => setChosenDept(e.target.value as AdminDepartment)}
                  className="flex h-10 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm ring-offset-background disabled:opacity-50"
                >
                  {Object.entries(DEPARTMENT_LABELS).map(([k, v]) =>
                    k !== 'all' ? <option key={k} value={k}>{v as any}</option> : null
                  )}
                </select>
                {currentAdmin.department !== 'all' && (
                  <p className="text-xs text-muted-foreground">* คุณไม่ได้เป็นผู้ดูแลสูงสุด จึงไม่สามารถเปลี่ยนสังกัดได้ (ระบบจะใช้สังกัดของคุณ)</p>
                )}
              </div>

              <div className="space-y-3">
                <Label className="text-base font-semibold">ชุดสิทธิ์ที่จะได้ (Permissions)</Label>
                <div className="flex flex-wrap gap-2">
                  {(ROLE_PERMISSIONS[chosenRole] ?? []).map((p) => (
                    <TooltipProvider key={p}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Badge variant="secondary" className="cursor-help">
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
              </div>

              {promoteErr && <Alert variant="destructive"><AlertDescription>{promoteErr}</AlertDescription></Alert>}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteOpen(false)}>ยกเลิก</Button>
            <Button disabled={promoteBusy || alreadyAdmin} onClick={doPromote} className="gap-2">
              <ShieldAlert className="h-4 w-4" /> ตั้งเป็นแอดมิน
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminUserManagement;