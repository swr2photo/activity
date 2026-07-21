// components/admin/EnhancedUserManagement.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Search,
  RefreshCw,
  Download,
  User,
  CheckCircle,
  Ban,
  Eye,
} from 'lucide-react';
import { AdminProfile, DEPARTMENT_LABELS } from '../../types/admin';
import {
  getAllUsers,
  getPendingUsers,
  getUsersByDepartment,
  getPendingUsersByDepartment,
  approveUser,
  suspendUser,
  UnivUser,
} from '../../lib/adminFirebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="max-w-full p-4 md:p-6">{children}</div>
);

const ResponsiveCard: React.FC<{ children: React.ReactNode; className?: string }> = ({
  children,
  className,
}) => (
  <div className={cn('rounded-lg border bg-card p-6 shadow-sm', className)}>{children}</div>
);

const ResponsiveTable: React.FC<{
  columns: any[];
  data: any[];
  keyField: string;
  actions?: (row: any) => React.ReactNode;
  emptyMessage?: string;
}> = ({ columns, data, keyField, actions, emptyMessage }) => (
  <div className="overflow-x-auto">
    {data.length === 0 ? (
      <p className="py-8 text-center text-sm text-muted-foreground">
        {emptyMessage || 'ไม่มีข้อมูล'}
      </p>
    ) : (
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.id}
                className={cn(
                  'border-b p-4 text-left text-sm font-bold',
                  col.hideOnMobile && 'hidden md:table-cell'
                )}
              >
                {col.label}
              </th>
            ))}
            {actions && (
              <th className="border-b p-4 text-center text-sm font-bold">การดำเนินการ</th>
            )}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row[keyField]}>
              {columns.map((col) => (
                <td
                  key={col.id}
                  className={cn(
                    'border-b p-4',
                    col.hideOnMobile && 'hidden md:table-cell'
                  )}
                >
                  {col.format ? col.format(row[col.id], row) : row[col.id]}
                </td>
              ))}
              {actions && <td className="border-b p-4">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

interface Props {
  currentAdmin: AdminProfile;
}

export const EnhancedUserManagement: React.FC<Props> = ({ currentAdmin }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [allUsers, setAllUsers] = useState<UnivUser[]>([]);
  const [pendingUsers, setPendingUsers] = useState<UnivUser[]>([]);
  const [filtered, setFiltered] = useState<UnivUser[]>([]);
  const [loading, setLoading] = useState(false);
  const [tabValue, setTabValue] = useState('pending');
  const [search, setSearch] = useState('');
  const [selectedUser, setSelectedUser] = useState<UnivUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin.department]);

  useEffect(() => {
    applyFilter();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allUsers, pendingUsers, search, tabValue]);

  const load = async () => {
    setLoading(true);
    try {
      let usersData: UnivUser[], pendingData: UnivUser[];
      if (currentAdmin.department === 'all') {
        [usersData, pendingData] = await Promise.all([getAllUsers(), getPendingUsers()]);
      } else {
        [usersData, pendingData] = await Promise.all([
          getUsersByDepartment(currentAdmin.department),
          getPendingUsersByDepartment(currentAdmin.department),
        ]);
      }
      setAllUsers(usersData);
      setPendingUsers(pendingData);
    } finally {
      setLoading(false);
    }
  };

  const applyFilter = () => {
    const source = tabValue === 'pending' ? pendingUsers : allUsers;
    if (!search) {
      setFiltered(source);
      return;
    }
    const q = search.toLowerCase();
    setFiltered(
      source.filter(
        (u) =>
          u.displayName?.toLowerCase().includes(q) ||
          u.firstName?.toLowerCase().includes(q) ||
          u.lastName?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          u.studentId?.includes(search) ||
          u.faculty?.toLowerCase().includes(q) ||
          u.department?.toLowerCase().includes(q)
      )
    );
  };

  const exportUsers = () => {
    const rows = [
      ['รหัสผู้เข้าร่วม', 'ชื่อ', 'นามสกุล', 'อีเมล', 'คณะ/สถานศึกษา', 'สาขา/ระดับ', 'ระดับปริญญา', 'สถานะ', 'วันที่สร้าง'],
      ...filtered.map((u) =>
        [
          u.studentId || '',
          u.firstName || '',
          u.lastName || '',
          u.email || '',
          u.faculty || '',
          u.department || '',
          u.degreeLevel || '',
          u.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ',
          u.createdAt?.toLocaleDateString('th-TH') || '',
        ].join(',')
      ),
    ]
      .map((r) => (Array.isArray(r) ? r.join(',') : r))
      .join('\n');

    const blob = new Blob(['\uFEFF' + rows], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `university_users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const columns = [
    {
      id: 'user',
      label: 'ผู้ใช้',
      format: (_: any, row: UnivUser) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={row.photoURL} />
            <AvatarFallback>{row.firstName?.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <p className="text-sm font-medium">
              {row.firstName} {row.lastName}
            </p>
            <p className="text-xs text-muted-foreground">{row.email}</p>
          </div>
        </div>
      ),
    },
    {
      id: 'studentId',
      label: 'รหัสผู้เข้าร่วม',
      format: (v: string) => <p className="font-mono text-sm">{v}</p>,
    },
    {
      id: 'faculty',
      label: 'สังกัด',
      format: (_: any, row: UnivUser) => (
        <div>
          <p className="text-sm">{row.faculty}</p>
          <p className="text-xs text-muted-foreground">{row.department}</p>
        </div>
      ),
      hideOnMobile: true,
    },
    {
      id: 'status',
      label: 'สถานะ',
      format: (_: any, row: UnivUser) => (
        <div className="flex flex-col gap-1">
          <Badge
            variant="outline"
            className={
              row.isVerified
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-amber-200 bg-amber-50 text-amber-800'
            }
          >
            {row.isVerified ? 'อนุมัติแล้ว' : 'รออนุมัติ'}
          </Badge>
          <Badge
            variant="outline"
            className={
              row.isActive
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                : 'border-rose-200 bg-rose-50 text-rose-800'
            }
          >
            {row.isActive ? 'ใช้งานได้' : 'ถูกระงับ'}
          </Badge>
        </div>
      ),
    },
    {
      id: 'createdAt',
      label: 'วันที่สร้าง',
      format: (v: Date | undefined) => (
        <p className="text-sm">{v?.toLocaleDateString('th-TH') || 'ไม่ระบุ'}</p>
      ),
      hideOnMobile: true,
    },
  ];

  const actions = (u: UnivUser) => (
    <div className={cn('flex gap-1', isMobile ? 'justify-start' : 'justify-center')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 text-sky-600"
            onClick={() => {
              setSelectedUser(u);
              setDialogOpen(true);
            }}
          >
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>ดูรายละเอียด</TooltipContent>
      </Tooltip>

      {!u.isVerified && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-emerald-600"
              onClick={async () => {
                await approveUser(u.uid);
                load();
              }}
            >
              <CheckCircle className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>อนุมัติ</TooltipContent>
        </Tooltip>
      )}

      {u.isActive && (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-8 w-8 text-destructive"
              onClick={async () => {
                await suspendUser(u.uid);
                load();
              }}
            >
              <Ban className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>ระงับการใช้งาน</TooltipContent>
        </Tooltip>
      )}
    </div>
  );

  return (
    <TooltipProvider>
      <ResponsiveContainer>
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold">จัดการผู้ใช้มหาวิทยาลัย</h1>
          <p className="text-muted-foreground">
            จัดการบัญชีผู้ใช้ในสังกัด{' '}
            {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          {[
            { label: 'ผู้ใช้ทั้งหมด', value: allUsers.length, color: '#1976d2' },
            { label: 'รออนุมัติ', value: pendingUsers.length, color: '#ed6c02' },
            {
              label: 'อนุมัติแล้ว',
              value: allUsers.filter((u) => u.isVerified).length,
              color: '#2e7d32',
            },
            {
              label: 'ถูกระงับ',
              value: allUsers.filter((u) => !u.isActive).length,
              color: '#d32f2f',
            },
          ].map((s) => (
            <ResponsiveCard key={s.label}>
              <div className="flex items-center gap-4">
                <div
                  className="rounded-lg p-3 text-white"
                  style={{ backgroundColor: s.color }}
                >
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <p className="text-3xl font-bold" style={{ color: s.color }}>
                    {s.value}
                  </p>
                  <p className="text-sm font-semibold">{s.label}</p>
                </div>
              </div>
            </ResponsiveCard>
          ))}
        </div>

        <ResponsiveCard className="mb-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="relative w-full md:min-w-[350px] md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="ชื่อ, อีเมล, รหัสผู้เข้าร่วม, คณะ, สาขา"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="flex gap-2">
              <Button onClick={load} disabled={loading} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                รีเฟรช
              </Button>
              <Button
                onClick={exportUsers}
                disabled={filtered.length === 0}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                ส่งออก
              </Button>
            </div>
          </div>
        </ResponsiveCard>

        <ResponsiveCard className="p-0 overflow-hidden">
          <Tabs value={tabValue} onValueChange={setTabValue}>
            <div className="border-b px-4 pt-2">
              <TabsList className={cn('h-auto', isMobile && 'w-full')}>
                <TabsTrigger value="pending" className="gap-2">
                  <User className="h-4 w-4" />
                  รออนุมัติ
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

            <TabsContent value="pending" className="m-0 p-4">
              <ResponsiveTable
                columns={columns}
                data={filtered}
                keyField="uid"
                actions={actions}
                emptyMessage="ไม่มีผู้ใช้ที่รออนุมัติ"
              />
            </TabsContent>
            <TabsContent value="all" className="m-0 p-4">
              <ResponsiveTable
                columns={columns}
                data={filtered}
                keyField="uid"
                actions={actions}
                emptyMessage="ไม่มีผู้ใช้ในระบบ"
              />
            </TabsContent>
          </Tabs>
        </ResponsiveCard>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogContent className={cn('max-w-2xl', isMobile && 'h-[100dvh] max-h-[100dvh] rounded-none')}>
            {selectedUser && (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={selectedUser.photoURL} />
                      <AvatarFallback>{selectedUser.firstName?.charAt(0)}</AvatarFallback>
                    </Avatar>
                    รายละเอียดผู้ใช้:{' '}
                    {selectedUser.displayName ||
                      `${selectedUser.firstName ?? ''} ${selectedUser.lastName ?? ''}`}
                  </DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">ข้อมูลส่วนตัว</p>
                      <p>
                        {selectedUser.firstName} {selectedUser.lastName}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">อีเมล</p>
                      <p>{selectedUser.email}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">รหัสผู้เข้าร่วม</p>
                      <p className="font-mono">{selectedUser.studentId}</p>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <p className="text-sm text-muted-foreground">คณะ/สถานศึกษา</p>
                      <p>{selectedUser.faculty}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">สาขา/ระดับ</p>
                      <p>{selectedUser.department}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">ระดับปริญญา</p>
                      <p>{selectedUser.degreeLevel}</p>
                    </div>
                  </div>
                </div>

                <DialogFooter>
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    ปิด
                  </Button>

                  {!selectedUser.isVerified && (
                    <Button
                      className="gap-2 bg-emerald-600 hover:bg-emerald-700"
                      onClick={async () => {
                        await approveUser(selectedUser.uid);
                        setDialogOpen(false);
                        load();
                      }}
                    >
                      <CheckCircle className="h-4 w-4" />
                      อนุมัติ
                    </Button>
                  )}

                  {selectedUser.isActive && (
                    <Button
                      variant="destructive"
                      className="gap-2"
                      onClick={async () => {
                        await suspendUser(selectedUser.uid);
                        setDialogOpen(false);
                        load();
                      }}
                    >
                      <Ban className="h-4 w-4" />
                      ระงับ
                    </Button>
                  )}
                </DialogFooter>
              </>
            )}
          </DialogContent>
        </Dialog>
      </ResponsiveContainer>
    </TooltipProvider>
  );
};
