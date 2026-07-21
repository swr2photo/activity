'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle,
  Ban,
  Eye,
  Search,
  RefreshCw,
  Download,
  User,
  GraduationCap,
  IdCard,
} from 'lucide-react';
import { getAllUsers, getPendingUsers, approveUser, suspendUser, UniversityUserProfile } from '../lib/firebaseAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface UserDetailDialogProps {
  user: UniversityUserProfile | null;
  open: boolean;
  onClose: () => void;
  onApprove?: (uid: string) => void;
  onSuspend?: (uid: string) => void;
}

const UserDetailDialog: React.FC<UserDetailDialogProps> = ({ user, open, onClose, onApprove, onSuspend }) => {
  const [actionLoading, setActionLoading] = useState(false);

  const handleApprove = async () => {
    if (!user || !onApprove) return;
    setActionLoading(true);
    try {
      await onApprove(user.uid);
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  const handleSuspend = async () => {
    if (!user || !onSuspend) return;
    setActionLoading(true);
    try {
      await onSuspend(user.uid);
      onClose();
    } finally {
      setActionLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Avatar className="h-10 w-10">
              <AvatarImage src={user.photoURL} />
              <AvatarFallback>{user.firstName.charAt(0)}</AvatarFallback>
            </Avatar>
            รายละเอียดผู้ใช้: {user.displayName}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <User className="h-4 w-4" />
              ข้อมูลส่วนตัว
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">ชื่อ-นามสกุล (ไทย)</p>
                <p className="text-sm text-muted-foreground">
                  {user.firstName} {user.lastName}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">ชื่อที่แสดง</p>
                <p className="text-sm text-muted-foreground">{user.displayName}</p>
              </div>
              <div>
                <p className="text-sm font-medium">อีเมล</p>
                <p className="text-sm text-muted-foreground">{user.email}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <GraduationCap className="h-4 w-4" />
              ข้อมูลการศึกษา
            </h3>
            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">รหัสนักศึกษา</p>
                <p className="font-mono text-sm text-muted-foreground">{user.studentId}</p>
              </div>
              <div>
                <p className="text-sm font-medium">ระดับปริญญา</p>
                <p className="text-sm text-muted-foreground">{user.degreeLevel}</p>
              </div>
              <div>
                <p className="text-sm font-medium">คณะ</p>
                <p className="text-sm text-muted-foreground">{user.faculty}</p>
              </div>
              <div>
                <p className="text-sm font-medium">สาขาวิชา</p>
                <p className="text-sm text-muted-foreground">{user.department}</p>
              </div>
            </div>
          </div>

          <div className="rounded-lg border bg-muted/30 p-4 md:col-span-2">
            <h3 className="mb-3 flex items-center gap-2 text-base font-semibold">
              <IdCard className="h-4 w-4" />
              สถานะบัญชี
            </h3>
            <div className="mb-3 flex gap-2">
              <Badge
                variant="outline"
                className={
                  user.isActive
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-rose-200 bg-rose-50 text-rose-800'
                }
              >
                {user.isActive ? 'ใช้งานได้' : 'ถูกระงับ'}
              </Badge>
              <Badge
                variant="outline"
                className={
                  user.isVerified
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                    : 'border-amber-200 bg-amber-50 text-amber-800'
                }
              >
                {user.isVerified ? 'ได้รับการอนุมัติ' : 'รอการอนุมัติ'}
              </Badge>
            </div>

            <div className="space-y-2">
              <div>
                <p className="text-sm font-medium">วันที่สร้างบัญชี</p>
                <p className="text-sm text-muted-foreground">
                  {user.createdAt?.toDate?.()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">เข้าสู่ระบบครั้งล่าสุด</p>
                <p className="text-sm text-muted-foreground">
                  {user.lastLoginAt?.toDate?.()?.toLocaleString('th-TH') || 'ไม่ระบุ'}
                </p>
              </div>
              <div>
                <p className="text-sm font-medium">จำนวนครั้งที่เข้าสู่ระบบ</p>
                <p className="text-sm text-muted-foreground">{user.loginCount || 0} ครั้ง</p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            ปิด
          </Button>

          {!user.isVerified && onApprove && (
            <Button
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={handleApprove}
              disabled={actionLoading}
            >
              {actionLoading ? <Spinner size="sm" className="text-white" /> : <CheckCircle className="h-4 w-4" />}
              อนุมัติ
            </Button>
          )}

          {user.isActive && onSuspend && (
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handleSuspend}
              disabled={actionLoading}
            >
              {actionLoading ? <Spinner size="sm" className="text-white" /> : <Ban className="h-4 w-4" />}
              ระงับการใช้งาน
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

interface AdminUserManagementProps {
  onUserUpdate?: () => void;
}

const AdminUserManagement: React.FC<AdminUserManagementProps> = ({ onUserUpdate }) => {
  const [allUsers, setAllUsers] = useState<UniversityUserProfile[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UniversityUserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedUser, setSelectedUser] = useState<UniversityUserProfile | null>(null);
  const [showUserDialog, setShowUserDialog] = useState(false);
  const [tabValue, setTabValue] = useState('pending');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      setError('');

      const [allUsersData, pendingUsersData] = await Promise.all([getAllUsers(), getPendingUsers()]);

      setAllUsers(
        allUsersData.sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0))
      );
      setPendingUsers(
        pendingUsersData.sort((a, b) => (b.createdAt?.toDate?.()?.getTime() || 0) - (a.createdAt?.toDate?.()?.getTime() || 0))
      );
    } catch (err) {
      console.error('Error loading users:', err);
      setError('เกิดข้อผิดพลาดในการโหลดข้อมูลผู้ใช้');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveUser = async (uid: string) => {
    try {
      await approveUser(uid);
      await loadUsers();
      onUserUpdate?.();
    } catch (error) {
      console.error('Error approving user:', error);
      setError('เกิดข้อผิดพลาดในการอนุมัติผู้ใช้');
    }
  };

  const handleSuspendUser = async (uid: string) => {
    try {
      await suspendUser(uid);
      await loadUsers();
      onUserUpdate?.();
    } catch (error) {
      console.error('Error suspending user:', error);
      setError('เกิดข้อผิดพลาดในการระงับผู้ใช้');
    }
  };

  const exportUsers = () => {
    const csvContent = [
      ['รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'อีเมล', 'คณะ', 'สาขา', 'ระดับปริญญา', 'สถานะ', 'วันที่สร้าง'],
      ...allUsers.map((user) => [
        user.studentId,
        user.firstName,
        user.lastName,
        user.email,
        user.faculty,
        user.department,
        user.degreeLevel,
        user.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ',
        user.createdAt?.toDate?.()?.toLocaleDateString('th-TH') || '',
      ]),
    ]
      .map((row) => row.join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `university_users_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  const filteredUsers = (users: UniversityUserProfile[]) => {
    if (!searchTerm) return users;
    const s = searchTerm.toLowerCase();

    return users.filter((u) => {
      return (
        u.displayName.toLowerCase().includes(s) ||
        u.firstName.toLowerCase().includes(s) ||
        u.lastName.toLowerCase().includes(s) ||
        u.email.toLowerCase().includes(s) ||
        u.studentId.includes(searchTerm) ||
        u.faculty.toLowerCase().includes(s) ||
        u.department.toLowerCase().includes(s)
      );
    });
  };

  const handleViewUser = (user: UniversityUserProfile) => {
    setSelectedUser(user);
    setShowUserDialog(true);
  };

  const renderUserTable = (users: UniversityUserProfile[], showActions = true) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>ผู้ใช้</TableHead>
          <TableHead>รหัสนักศึกษา</TableHead>
          <TableHead>คณะ/สาขา</TableHead>
          <TableHead>สถานะ</TableHead>
          <TableHead>วันที่สร้าง</TableHead>
          {showActions && <TableHead className="text-center">การดำเนินการ</TableHead>}
        </TableRow>
      </TableHeader>
      <TableBody>
        {filteredUsers(users).map((user) => (
          <TableRow key={user.uid}>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.photoURL} />
                  <AvatarFallback>{user.firstName.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-medium">
                    {user.firstName} {user.lastName}
                  </p>
                  <p className="text-xs text-muted-foreground">{user.email}</p>
                </div>
              </div>
            </TableCell>

            <TableCell>
              <p className="font-mono text-sm">{user.studentId}</p>
              <p className="text-xs text-muted-foreground">{user.degreeLevel}</p>
            </TableCell>

            <TableCell>
              <p className="text-sm">{user.faculty}</p>
              <p className="text-xs text-muted-foreground">{user.department}</p>
            </TableCell>

            <TableCell>
              <div className="flex flex-col gap-1">
                <Badge
                  variant="outline"
                  className={
                    user.isVerified
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-amber-200 bg-amber-50 text-amber-800'
                  }
                >
                  {user.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
                </Badge>
                <Badge
                  variant="outline"
                  className={
                    user.isActive
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                      : 'border-rose-200 bg-rose-50 text-rose-800'
                  }
                >
                  {user.isActive ? 'ใช้งานได้' : 'ถูกระงับ'}
                </Badge>
              </div>
            </TableCell>

            <TableCell>
              <p className="text-sm">
                {user.createdAt?.toDate?.()?.toLocaleDateString('th-TH') || 'ไม่ระบุ'}
              </p>
              <p className="text-xs text-muted-foreground">เข้าสู่ระบบ: {user.loginCount || 0} ครั้ง</p>
            </TableCell>

            {showActions && (
              <TableCell>
                <div className="flex justify-center gap-1">
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        onClick={() => handleViewUser(user)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>ดูรายละเอียด</TooltipContent>
                  </Tooltip>

                  {!user.isVerified && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-emerald-600"
                          onClick={() => handleApproveUser(user.uid)}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>อนุมัติ</TooltipContent>
                    </Tooltip>
                  )}

                  {user.isActive && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8 text-destructive"
                          onClick={() => handleSuspendUser(user.uid)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>ระงับการใช้งาน</TooltipContent>
                    </Tooltip>
                  )}
                </div>
              </TableCell>
            )}
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-3 p-8">
        <Spinner size="lg" />
        <p>กำลังโหลดข้อมูลผู้ใช้...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div>
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">จัดการผู้ใช้มหาวิทยาลัย</h2>
              <div className="flex gap-2">
                <Button variant="outline" className="gap-2" onClick={loadUsers} disabled={loading}>
                  <RefreshCw className="h-4 w-4" />
                  รีเฟรช
                </Button>
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={exportUsers}
                  disabled={allUsers.length === 0}
                >
                  <Download className="h-4 w-4" />
                  ส่งออก CSV
                </Button>
              </div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="ค้นหาผู้ใช้ (ชื่อ, อีเมล, รหัสนักศึกษา, คณะ, สาขา)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Statistics */}
        <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { label: 'ผู้ใช้ทั้งหมด', value: allUsers.length, className: 'text-primary' },
            { label: 'รออนุมัติ', value: pendingUsers.length, className: 'text-amber-600' },
            {
              label: 'อนุมัติแล้ว',
              value: allUsers.filter((u) => u.isVerified).length,
              className: 'text-emerald-600',
            },
            {
              label: 'ถูกระงับ',
              value: allUsers.filter((u) => !u.isActive).length,
              className: 'text-destructive',
            },
          ].map((s) => (
            <div key={s.label} className="rounded-lg border bg-card p-4 text-center shadow-sm">
              <p className={`text-3xl font-bold ${s.className}`}>{s.value}</p>
              <p className="text-sm text-muted-foreground">{s.label}</p>
            </div>
          ))}
        </div>

        <Card>
          <Tabs value={tabValue} onValueChange={setTabValue}>
            <div className="border-b px-4 pt-2">
              <TabsList>
                <TabsTrigger value="pending" className="gap-2">
                  <User className="h-4 w-4" />
                  รออนุมัติ ({pendingUsers.length})
                  {pendingUsers.length > 0 && (
                    <Badge className="ml-1 bg-amber-500 text-white hover:bg-amber-500">
                      {pendingUsers.length}
                    </Badge>
                  )}
                </TabsTrigger>
                <TabsTrigger value="all" className="gap-2">
                  <User className="h-4 w-4" />
                  ผู้ใช้ทั้งหมด ({allUsers.length})
                </TabsTrigger>
              </TabsList>
            </div>

            <CardContent>
              <TabsContent value="pending" className="mt-0">
                {pendingUsers.length === 0 ? (
                  <div className="py-8 text-center">
                    <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                    <p className="text-lg text-muted-foreground">ไม่มีผู้ใช้ที่รออนุมัติ</p>
                  </div>
                ) : (
                  renderUserTable(pendingUsers)
                )}
              </TabsContent>
              <TabsContent value="all" className="mt-0">
                {allUsers.length === 0 ? (
                  <div className="py-8 text-center">
                    <User className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                    <p className="text-lg text-muted-foreground">ไม่มีผู้ใช้ในระบบ</p>
                  </div>
                ) : (
                  renderUserTable(allUsers)
                )}
              </TabsContent>
            </CardContent>
          </Tabs>
        </Card>

        <UserDetailDialog
          user={selectedUser}
          open={showUserDialog}
          onClose={() => {
            setShowUserDialog(false);
            setSelectedUser(null);
          }}
          onApprove={handleApproveUser}
          onSuspend={handleSuspendUser}
        />
      </div>
    </TooltipProvider>
  );
};

export default AdminUserManagement;
