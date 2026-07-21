// components/admin/EnhancedAdminPanel.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Download,
  RefreshCw,
  Trash2,
  Eye,
  Search,
  X,
  Calendar,
  Users,
} from 'lucide-react';
import { AdminProfile, DEPARTMENT_LABELS } from '../../types/admin';
import { getAllActivityRecords, getActivityRecordsByDepartment, ActivityRecord } from '../../lib/adminFirebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
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
  <div className={cn('rounded-lg bg-card p-6 shadow-sm border', className)}>{children}</div>
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

const StatsCard: React.FC<{
  title: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  subtitle?: string;
}> = ({ title, value, icon, color, subtitle }) => (
  <ResponsiveCard>
    <div className="flex items-center gap-4">
      <div
        className="flex items-center justify-center rounded-lg p-3 text-white"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>
      <div>
        <p className="text-3xl font-bold" style={{ color }}>
          {value.toLocaleString()}
        </p>
        <p className="text-sm font-semibold">{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
  </ResponsiveCard>
);

interface Props {
  currentAdmin: AdminProfile;
}

export const EnhancedAdminPanel: React.FC<Props> = ({ currentAdmin }) => {
  const [isMobile, setIsMobile] = useState(false);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [filtered, setFiltered] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [stats, setStats] = useState({
    totalRecords: 0,
    uniqueStudents: 0,
    uniqueActivities: 0,
    todayRecords: 0,
  });

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 767px)');
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    loadRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin.department]);

  useEffect(() => {
    filterRecords();
    calculateStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, filterText]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data =
        currentAdmin.department === 'all'
          ? await getAllActivityRecords()
          : await getActivityRecordsByDepartment(currentAdmin.department);
      setRecords(data);
    } finally {
      setLoading(false);
    }
  };

  const filterRecords = () => {
    if (!filterText) {
      setFiltered(records);
      return;
    }
    const q = filterText.toLowerCase();
    setFiltered(
      records.filter(
        (r) =>
          r.activityCode.toLowerCase().includes(q) ||
          r.studentId.includes(filterText) ||
          r.firstName.toLowerCase().includes(q) ||
          r.lastName.toLowerCase().includes(q)
      )
    );
  };

  const calculateStats = () => {
    const uniqueStudents = new Set(records.map((r) => r.studentId)).size;
    const uniqueActivities = new Set(records.map((r) => r.activityCode)).size;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayRecords = records.filter((r) => {
      const d = new Date(r.timestamp);
      d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
    setStats({ totalRecords: records.length, uniqueStudents, uniqueActivities, todayRecords });
  };

  const exportToCSV = () => {
    const headers = ['วันที่/เวลา', 'รหัสผู้เข้าร่วม', 'ชื่อ', 'นามสกุล', 'สังกัด', 'รหัสกิจกรรม'];
    const csv = [
      headers.join(','),
      ...filtered.map((r) =>
        [r.timestamp.toLocaleString('th-TH'), r.studentId, r.firstName, r.lastName, r.department, r.activityCode].join(',')
      ),
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `activity_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const columns = [
    {
      id: 'timestamp',
      label: 'วันที่/เวลา',
      format: (v: Date) => (
        <div>
          <p className="text-sm font-medium">{v.toLocaleDateString('th-TH')}</p>
          <p className="text-xs text-muted-foreground">{v.toLocaleTimeString('th-TH')}</p>
        </div>
      ),
    },
    {
      id: 'studentId',
      label: 'รหัสผู้เข้าร่วม',
      format: (v: string) => (
        <p className="font-mono text-sm font-semibold text-primary">{v}</p>
      ),
    },
    {
      id: 'fullName',
      label: 'ชื่อ-นามสกุล',
      format: (_: any, row: any) => (
        <p className="text-sm font-medium">
          {row.firstName} {row.lastName}
        </p>
      ),
    },
    {
      id: 'department',
      label: 'สังกัด',
      format: (v: string) => (
        <Badge variant="outline">{v}</Badge>
      ),
      hideOnMobile: true,
    },
    {
      id: 'activityCode',
      label: 'รหัสกิจกรรม',
      format: (v: string) => (
        <Badge className="font-bold">{v}</Badge>
      ),
    },
  ];

  const renderActions = (_row: any) => (
    <div className={cn('flex gap-1', isMobile ? 'justify-start' : 'justify-center')}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-sky-600">
            <Eye className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>ดูรายละเอียด</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
            <Trash2 className="h-4 w-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>ลบ</TooltipContent>
      </Tooltip>
    </div>
  );

  return (
    <TooltipProvider>
      <ResponsiveContainer>
        <div className="mb-8">
          <h1 className="mb-1 text-3xl font-bold">จัดการข้อมูลการเข้าร่วมกิจกรรม</h1>
          <p className="text-muted-foreground">
            ดูและจัดการข้อมูลในสังกัด{' '}
            {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
          </p>
        </div>

        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatsCard
            title="รายการทั้งหมด"
            value={stats.totalRecords}
            icon={<Calendar className="h-5 w-5" />}
            color="#1976d2"
            subtitle="บันทึกการเข้าร่วม"
          />
          <StatsCard
            title="ผู้เข้าร่วม"
            value={stats.uniqueStudents}
            icon={<Users className="h-5 w-5" />}
            color="#9c27b0"
            subtitle="คนที่เข้าร่วม"
          />
          <StatsCard
            title="กิจกรรม"
            value={stats.uniqueActivities}
            icon={<Calendar className="h-5 w-5" />}
            color="#2e7d32"
            subtitle="กิจกรรมทั้งหมด"
          />
          <StatsCard
            title="วันนี้"
            value={stats.todayRecords}
            icon={<Calendar className="h-5 w-5" />}
            color="#ed6c02"
            subtitle="เข้าร่วมวันนี้"
          />
        </div>

        <ResponsiveCard className="mb-6">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="relative w-full md:min-w-[300px] md:max-w-md">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-9 pr-9"
                placeholder="รหัสกิจกรรม, ผู้เข้าร่วม, ชื่อ..."
                value={filterText}
                onChange={(e) => setFilterText(e.target.value)}
              />
              {filterText && (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                  onClick={() => setFilterText('')}
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <div className="flex gap-2">
              <Button onClick={loadRecords} disabled={loading} variant="outline" className="gap-2">
                <RefreshCw className="h-4 w-4" />
                รีเฟรช
              </Button>
              <Button
                onClick={exportToCSV}
                className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                ส่งออก
              </Button>
            </div>
          </div>
        </ResponsiveCard>

        <ResponsiveCard>
          <div className="mb-4 flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            <h2 className="text-lg font-semibold">รายการลงทะเบียน</h2>
            <Badge>{filtered.length} รายการ</Badge>
          </div>

          <ResponsiveTable
            columns={columns}
            data={filtered.map((r) => ({ ...r, fullName: `${r.firstName} ${r.lastName}` }))}
            keyField="id"
            actions={renderActions}
            emptyMessage="ไม่มีข้อมูลการลงทะเบียน"
          />
        </ResponsiveCard>

        {isMobile && (
          <Button
            size="icon"
            className="fixed bottom-4 right-4 z-50 h-14 w-14 rounded-full shadow-lg"
            onClick={loadRecords}
          >
            <RefreshCw className="h-5 w-5" />
          </Button>
        )}
      </ResponsiveContainer>
    </TooltipProvider>
  );
};
