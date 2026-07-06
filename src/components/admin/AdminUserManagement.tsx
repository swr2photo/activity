// src/components/admin/AdminUserManagement.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { doc, getDoc } from 'firebase/firestore';
import {
  Search, RefreshCw, Download, User as PersonIcon,
  CheckCircle, Ban, Eye, ShieldAlert, Users,
} from 'lucide-react';

import {
  DEPARTMENT_LABELS,
  ROLE_PERMISSIONS,
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
  type UnivUser,
  createAdminUser,
  logAdminEvent,
} from '../../lib/adminFirebase';

import { db } from '../../lib/firebase';
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

const AdminUserManagement: React.FC<Props> = ({ currentAdmin }) => {
  const [allUsers, setAllUsers] = useState<UnivUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UnivUser[]>([]);
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(0); // 0: pending, 1: all
  const [loading, setLoading] = useState(false);

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
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin.department]);

  const source = tab === 0 ? pendingUsers : allUsers;
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
    const rows = filtered.map((u) => [
      u.studentId || '',
      u.firstName || '',
      u.lastName || '',
      u.email || '',
      u.faculty || '',
      String(u.department || ''),
      u.degreeLevel || '',
      u.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ',
      u.createdAt ? new Date(u.createdAt).toLocaleDateString('th-TH') : '',
    ]);

    const csv = [
      ['รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'อีเมล', 'คณะ', 'สาขา', 'ระดับปริญญา', 'สถานะ', 'วันที่สร้าง'].join(','),
      ...rows.map((r) => r.join(',')),
    ].join('\n');

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
        tab: tab === 0 ? 'pending' : 'all',
        filteredCount: filtered.length,
        query: search,
        department: currentAdmin.department,
      },
      { uid: currentAdmin.uid, email: currentAdmin.email }
    );
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
      alert('ตั้งค่าผู้ดูแลสำเร็จ! ผู้ใช้จะได้รับสิทธิ์เมื่อล็อกอินครั้งถัดไป');
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

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-primary/10 text-primary rounded-full">
              <PersonIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allUsers.length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">ผู้ใช้ทั้งหมด</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-amber-500/10 text-amber-600 rounded-full">
              <PersonIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{pendingUsers.length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">รออนุมัติ</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-emerald-500/10 text-emerald-600 rounded-full">
              <PersonIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allUsers.filter(u => u.isVerified).length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">อนุมัติแล้ว</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-6">
            <div className="p-3 bg-rose-500/10 text-rose-600 rounded-full">
              <PersonIcon className="h-6 w-6" />
            </div>
            <div>
              <p className="text-2xl font-bold">{allUsers.filter(u => !u.isActive).length.toLocaleString()}</p>
              <p className="text-sm text-muted-foreground">ถูกระงับ</p>
            </div>
          </CardContent>
        </Card>
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
            <Button variant="outline" onClick={load} disabled={loading} className="flex-1 md:flex-none">
              <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} />
              รีเฟรช
            </Button>
            <Button variant="outline" onClick={exportCSV} disabled={filtered.length === 0} className="flex-1 md:flex-none text-emerald-600">
              <Download className="h-4 w-4 mr-2" />
              ส่งออก
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="p-0 border-b">
          <div className="flex gap-4 px-4 pt-4">
            <button
              className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", tab === 0 ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
              onClick={() => setTab(0)}
            >
              รออนุมัติ {pendingUsers.length > 0 && <span className="ml-1 bg-amber-500 text-white text-[10px] px-1.5 py-0.5 rounded-full">{pendingUsers.length}</span>}
            </button>
            <button
              className={cn("pb-3 text-sm font-medium border-b-2 transition-colors", tab === 1 ? "border-primary text-primary" : "border-transparent text-muted-foreground")}
              onClick={() => setTab(1)}
            >
              ผู้ใช้ทั้งหมด ({allUsers.length})
            </button>
          </div>
        </CardHeader>
        <CardContent className="p-4">
          {filtered.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {tab === 0 ? 'ไม่มีผู้ใช้ที่รออนุมัติ' : 'ไม่มีผู้ใช้ในระบบ'}
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
                    <p className="text-xs text-muted-foreground">{u.email}</p>
                  </div>

                  <div className="min-w-[180px]">
                    <p className="text-sm">รหัส: <b>{u.studentId || '-'}</b></p>
                    <p className="text-xs text-muted-foreground">{u.faculty} • {String(u.department || '')}</p>
                  </div>

                  <div className="flex gap-2">
                    <Badge variant={u.isVerified ? 'success' : 'warning'}>
                      {u.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                    </Badge>
                    <Badge variant={u.isActive ? 'success' : 'destructive'}>
                      {u.isActive ? 'ใช้งานได้' : 'ถูกระงับ'}
                    </Badge>
                  </div>

                  <div className="flex-1" />

                  <div className="flex gap-1 mt-3 sm:mt-0">
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button variant="ghost" size="icon" onClick={() => { setSel(u); setOpen(true); }}>
                            <Eye className="h-4 w-4 text-blue-500" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>ดูรายละเอียด</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>

                    {!u.isVerified && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={async () => {
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

                    {u.isActive && (
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button variant="ghost" size="icon" onClick={async () => {
                              await suspendUser(u.uid);
                              await logAdminEvent('SUSPEND_USER', { targetUid: u.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                              await load();
                            }}>
                              <Ban className="h-4 w-4 text-rose-500" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>ระงับการใช้งาน</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    )}

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
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
                <div>
                  <p className="text-xs text-muted-foreground">อีเมล</p>
                  <p className="text-sm font-medium">{sel.email}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">รหัสนักศึกษา</p>
                  <p className="text-sm font-medium">{sel.studentId || '-'}</p>
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
                  <p className="text-xs text-muted-foreground">สร้างเมื่อ</p>
                  <p className="text-sm font-medium">{sel.createdAt ? new Date(sel.createdAt).toLocaleDateString('th-TH') : '-'}</p>
                </div>
              </div>

              <DialogFooter className="gap-2">
                <Button variant="outline" onClick={() => setOpen(false)}>ปิด</Button>
                {!sel.isVerified && (
                  <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={async () => {
                    await approveUser(sel.uid);
                    await logAdminEvent('APPROVE_USER', { targetUid: sel.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                    setOpen(false);
                    await load();
                  }}>
                    <CheckCircle className="h-4 w-4 mr-2" /> อนุมัติ
                  </Button>
                )}
                {sel.isActive && (
                  <Button variant="destructive" onClick={async () => {
                    await suspendUser(sel.uid);
                    await logAdminEvent('SUSPEND_USER', { targetUid: sel.uid }, { uid: currentAdmin.uid, email: currentAdmin.email });
                    setOpen(false);
                    await load();
                  }}>
                    <Ban className="h-4 w-4 mr-2" /> ระงับ
                  </Button>
                )}
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