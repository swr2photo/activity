// src/components/admin/AdminAttendancePanel.tsx
'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Download, RefreshCw, Trash2, Eye, Search, Calendar,
  Activity, Bell, FileText, ChevronDown, CheckSquare, Settings2, Trash,
  AlertTriangle, MapPin, Globe, Mail
} from 'lucide-react';
import { useSnackbar } from 'notistack';
import { DatePicker, ConfigProvider } from 'antd';
import thTH from 'antd/locale/th_TH';
import type { AdminProfile, AdminPermission } from '../../types/admin';
import { normalizeDepartment, deptEquals, getDepartmentLabel } from '../../types/admin';

import {
  deleteActivityRecord,
  adjustParticipantsByActivityCode,
  type ActivityRecord
} from '../../lib/adminFirebase';

import { adminDb as db } from '../../lib/firebase';
import {
  collection, doc, getDoc, getDocs, query, where, orderBy, limit,
  onSnapshot, Timestamp, QueryConstraint, startAfter
} from 'firebase/firestore';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuLabel, DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useConfirm } from '@/components/providers/ConfirmDialogProvider';
import { Label } from '@/components/ui/label';
import { PageHeader } from './shared/PageHeader';

// --- Types ---
interface FilterState {
  search: string;
  activities: string[];
  faculties: string[];
  dateRange: { start: string; end: string; };
}

interface Props {
  currentAdmin: AdminProfile;
}

type AdminNotif = {
  id: string;
  title?: string;
  message?: string;
  department?: string;
  departmentKey?: string;
  createdAt?: Date | Timestamp | null;
};

type RecordAnomaly = { level: 'warning' | 'danger'; message: string };

function detectRecordAnomalies(
  record: ActivityRecord,
  all: ActivityRecord[]
): RecordAnomaly[] {
  const out: RecordAnomaly[] = [];
  const sid = (record.studentId || '').trim();
  const ip = (record.ipAddress || '').trim();
  const email = (record.email || '').trim().toLowerCase();
  const fullName = `${record.firstName || ''} ${record.lastName || ''}`.trim().toLowerCase();
  const code = record.activityCode;

  const loc = record.location;
  if (!loc || (typeof loc.latitude === 'number' && loc.latitude === 0 && loc.longitude === 0)) {
    out.push({ level: 'warning', message: 'ไม่มีพิกัด GPS ตอนลงทะเบียน หรือพิกัดเป็น 0,0' });
  }

  if (sid.startsWith('EXT-') && record.faculty && record.faculty !== 'บุคคลภายนอก') {
    out.push({
      level: 'warning',
      message: `บัญชีบุคคลภายนอก แต่คณะเป็น "${record.faculty}" ซึ่งไม่สอดคล้องกัน`,
    });
  }

  if (ip && ip !== 'unknown') {
    const sameIpSameActivity = all.filter(
      (r) =>
        r.id !== record.id &&
        r.activityCode === code &&
        (r.ipAddress || '').trim() === ip &&
        (r.studentId || '').trim() !== sid
    );
    const uniqueUsers = new Set(sameIpSameActivity.map((r) => r.studentId));
    if (uniqueUsers.size >= 1) {
      out.push({
        level: uniqueUsers.size >= 2 ? 'danger' : 'warning',
        message: `IP เดียวกัน (${ip}) ใช้ลงทะเบียนกิจกรรมนี้กับอีก ${uniqueUsers.size} บัญชี: ${[...uniqueUsers].slice(0, 5).join(', ')}${uniqueUsers.size > 5 ? '…' : ''}`,
      });
    }

    const sameIpAny = all.filter(
      (r) => r.id !== record.id && (r.ipAddress || '').trim() === ip && (r.studentId || '').trim() !== sid
    );
    const anyUsers = new Set(sameIpAny.map((r) => r.studentId));
    if (anyUsers.size >= 3 && uniqueUsers.size < 1) {
      out.push({
        level: 'warning',
        message: `IP นี้พบกับอีก ${anyUsers.size} บัญชีในข้อมูลที่โหลด (อาจเป็น Wi‑Fi ร่วม หรือแชร์อุปกรณ์)`,
      });
    }
  }

  if (fullName.length >= 4) {
    const sameName = all.filter(
      (r) =>
        r.id !== record.id &&
        r.activityCode === code &&
        `${r.firstName || ''} ${r.lastName || ''}`.trim().toLowerCase() === fullName &&
        (r.studentId || '').trim() !== sid
    );
    if (sameName.length > 0) {
      out.push({
        level: 'danger',
        message: `ชื่อ-นามสกุลซ้ำกับบัญชีอื่นในกิจกรรมนี้ (${sameName.map((r) => r.studentId).slice(0, 3).join(', ')})`,
      });
    }
  }

  if (email) {
    const sameEmail = all.filter(
      (r) =>
        r.id !== record.id &&
        (r.email || '').trim().toLowerCase() === email &&
        (r.studentId || '').trim() !== sid
    );
    if (sameEmail.length > 0) {
      out.push({
        level: 'danger',
        message: `อีเมลเดียวกันใช้กับรหัสอื่น: ${sameEmail.map((r) => r.studentId).slice(0, 3).join(', ')}`,
      });
    }
  }

  return out;
}

function DetailField({
  label,
  value,
  className,
}: {
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('space-y-1', className)}>
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="font-medium text-sm break-words">{value || '-'}</div>
    </div>
  );
}



// --- Main Component ---
const AdminAttendancePanel: React.FC<Props> = ({ currentAdmin }) => {
  const { enqueueSnackbar } = useSnackbar();
  const confirm = useConfirm();

  // Data State
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [lastDoc, setLastDoc] = useState<any>(null);
  const [hasMore, setHasMore] = useState(true);
  
  // UI State
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<ActivityRecord | null>(null);

  const selectedAnomalies = useMemo(() => {
    if (!selectedRecord) return [] as RecordAnomaly[];
    return detectRecordAnomalies(selectedRecord, records);
  }, [selectedRecord, records]);

  const anomalyCountById = useMemo(() => {
    const map = new Map<string, number>();
    for (const r of records) {
      const n = detectRecordAnomalies(r, records).length;
      if (n > 0) map.set(r.id, n);
    }
    return map;
  }, [records]);

  // Export State
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFilename, setExportFilename] = useState(`attendance_${new Date().toISOString().slice(0, 10)}.csv`);
  const [isExporting, setIsExporting] = useState(false);

  // Cache
  const [activityNameByCode, setActivityNameByCode] = useState<Record<string, string>>({});

  // Filter State
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    activities: [],
    faculties: [],
    dateRange: { start: '', end: '' }
  });

  // Permission Logic
  const isSuperAdmin = currentAdmin.role === 'super_admin';
  const perms = (currentAdmin.permissions || []) as AdminPermission[];
  const canExport = isSuperAdmin || perms.includes('export_data') || perms.includes('view_reports');
  const allowedDeptKey = normalizeDepartment(currentAdmin.department as any);
  const isDeptScoped = allowedDeptKey !== 'all';

  const loadActivityNames = async (codes: string[]) => {
    const uniq = Array.from(new Set(codes.filter(c => c && !activityNameByCode[c])));
    if (uniq.length === 0) return;

    const results: Record<string, string> = { ...activityNameByCode };
    await Promise.all(uniq.map(async (code) => {
      try {
        let found = false;
        
        // Try activityQRCodes collection first
        const qNew = query(collection(db, 'activityQRCodes'), where('activityCode', '==', code), limit(1));
        const snapNew = await getDocs(qNew);
        if (!snapNew.empty) {
            const d: any = snapNew.docs[0].data();
            results[code] = d?.activityName || d?.nameTh || d?.name || code;
            found = true;
        }

        if (!found) {
            // Fallback to legacy activities collection
            const s = await getDoc(doc(db, 'activities', code));
            if (s.exists()) {
               const d: any = s.data();
               results[code] = d?.nameTh || d?.name || code;
            } else {
                const qs = await getDocs(query(collection(db, 'activities'), where('code', '==', code), limit(1)));
                if (!qs.empty) {
                    const d:any = qs.docs[0].data();
                    results[code] = d?.nameTh || d?.name || code;
                } else {
                    results[code] = code;
                }
            }
        }
      } catch { results[code] = code; }
    }));
    setActivityNameByCode(results);
  };

  const loadData = useCallback(async (isLoadMore = false) => {
    if (loading) return;
    setLoading(true);
    setProgress(30);

    try {
      const constraints: QueryConstraint[] = [];

      if (isDeptScoped) {
        constraints.push(where('department', '==', allowedDeptKey));
      }

      if (filters.dateRange.start) {
        constraints.push(where('timestamp', '>=', new Date(filters.dateRange.start).toISOString()));
      }
      if (filters.dateRange.end) {
        const e = new Date(filters.dateRange.end);
        e.setHours(23, 59, 59, 999);
        constraints.push(where('timestamp', '<=', e.toISOString()));
      }

      constraints.push(orderBy('timestamp', 'desc'));
      
      if (isLoadMore && lastDoc) {
        constraints.push(startAfter(lastDoc));
      }
      
      constraints.push(limit(100));

      const q = query(collection(db, 'activityRecords'), ...constraints);
      const snap = await getDocs(q);
      
      setProgress(70);

      const newRecords = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          ...data,
          timestamp: data.timestamp?.toDate ? data.timestamp.toDate() : new Date(data.timestamp || Date.now())
        } as ActivityRecord;
      });

      if (isLoadMore) {
        setRecords(prev => [...prev, ...newRecords]);
      } else {
        setRecords(newRecords);
      }

      setLastDoc(snap.docs[snap.docs.length - 1]);
      setHasMore(snap.docs.length === 100);

      loadActivityNames(newRecords.map(r => r.activityCode));
      setProgress(100);
    } catch (e: any) {
      console.error(e);
      enqueueSnackbar('เกิดข้อผิดพลาดในการโหลดข้อมูล: ' + e.message, { variant: 'error' });
    } finally {
      setLoading(false);
      setTimeout(() => setProgress(0), 500);
    }
  }, [allowedDeptKey, isDeptScoped, filters.dateRange, lastDoc, loading, enqueueSnackbar]);

  useEffect(() => {
    loadData(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allowedDeptKey, filters.dateRange.start, filters.dateRange.end]); 

  const filteredRecords = useMemo(() => {
    let list = records;
    const s = filters.search.trim().toLowerCase();
    
    if (s) {
      list = list.filter(r => {
        const actName = (activityNameByCode[r.activityCode] || '').toLowerCase();
        return (
          r.activityCode.toLowerCase().includes(s) ||
          actName.includes(s) ||
          r.studentId.toLowerCase().includes(s) ||
          (r.firstName || '').toLowerCase().includes(s) ||
          (r.lastName || '').toLowerCase().includes(s)
        );
      });
    }

    if (filters.activities.length) list = list.filter(r => filters.activities.includes(r.activityCode));
    if (filters.faculties.length) list = list.filter(r => filters.faculties.includes(String(r.faculty || 'ไม่ระบุ')));

    return list;
  }, [records, filters.search, filters.activities, filters.faculties, activityNameByCode]);

  const availableActivities = useMemo(() => {
    const codes = [...new Set(records.map(r => r.activityCode))];
    return codes.sort((a, b) => {
      const nameA = activityNameByCode[a] || a;
      const nameB = activityNameByCode[b] || b;
      return nameA.localeCompare(nameB, 'th');
    });
  }, [records, activityNameByCode]);
  
  const availableFaculties = useMemo(() => [...new Set(records.map(r => String(r.faculty || 'ไม่ระบุ')))].sort((a, b) => a.localeCompare(b, 'th')), [records]);

  const handleDelete = async (ids: string[]) => {
    if (!isSuperAdmin) {
      enqueueSnackbar('ต้องเป็น Super Admin เท่านั้น', { variant: 'warning' });
      return;
    }
    const ok = await confirm({
      title: 'ยืนยันลบรายการลงทะเบียน',
      description: `ต้องการลบ ${ids.length} รายการที่เลือกหรือไม่? การลบนี้ไม่สามารถย้อนกลับได้`,
      confirmText: 'ลบรายการ',
      cancelText: 'ยกเลิก',
      variant: 'destructive',
    });
    if (!ok) return;

    setLoading(true);
    try {
       const recordsToDelete = records.filter(r => ids.includes(r.id));
       const countMap: Record<string, number> = {};
       recordsToDelete.forEach(r => countMap[r.activityCode] = (countMap[r.activityCode] || 0) + 1);

       await Promise.all(ids.map(id => deleteActivityRecord(id)));
       await Promise.all(Object.entries(countMap).map(([code, count]) => adjustParticipantsByActivityCode(code, -count)));

       setRecords(prev => prev.filter(r => !ids.includes(r.id)));
       setSelected([]);
       enqueueSnackbar('ลบข้อมูลสำเร็จ', { variant: 'success' });
    } catch (e: any) {
        enqueueSnackbar('ลบข้อมูลไม่สำเร็จ: ' + e.message, { variant: 'error' });
    } finally {
        setLoading(false);
    }
  };

  const handleExport = async () => {
    if (!canExport) return;
    setIsExporting(true);
    try {
        const constraints: QueryConstraint[] = [];
        if (isDeptScoped) constraints.push(where('department', '==', allowedDeptKey));
        if (filters.dateRange.start) constraints.push(where('timestamp', '>=', new Date(filters.dateRange.start).toISOString()));
        if (filters.dateRange.end) {
             const e = new Date(filters.dateRange.end); e.setHours(23, 59, 59, 999);
             constraints.push(where('timestamp', '<=', e.toISOString()));
        }
        constraints.push(orderBy('timestamp', 'desc'));
        
        const q = query(collection(db, 'activityRecords'), ...constraints);
        const snap = await getDocs(q);
        const allData = snap.docs.map(d => ({...d.data(), timestamp: d.data().timestamp?.toDate() } as ActivityRecord));
        
        const headers = ['วันที่', 'เวลา', 'รหัสผู้เข้าร่วม', 'ชื่อ', 'นามสกุล', 'คณะ/สถานศึกษา', 'สาขา/ระดับ', 'ชื่อกิจกรรม', 'รหัสกิจกรรม'];
        const rows = allData.map(r => [
            r.timestamp.toLocaleDateString('th-TH'),
            r.timestamp.toLocaleTimeString('th-TH'),
            r.studentId, r.firstName, r.lastName,
            r.faculty || '', getDepartmentLabel(r.department as any),
            activityNameByCode[r.activityCode] || r.activityCode, r.activityCode
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));
        
        const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = exportFilename;
        a.click();
        URL.revokeObjectURL(url);
        
        enqueueSnackbar(`ส่งออกข้อมูล ${allData.length} รายการสำเร็จ`, { variant: 'success' });
        setExportOpen(false);
    } catch(e:any) {
        enqueueSnackbar('ส่งออกล้มเหลว: ' + e.message, { variant: 'error' });
    } finally {
        setIsExporting(false);
    }
  };

  const toggleSelectAll = () => {
    if (selected.length === filteredRecords.length && filteredRecords.length > 0) {
      setSelected([]);
    } else {
      setSelected(filteredRecords.map(r => r.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6 relative w-full min-w-0 max-w-full overflow-x-hidden">
      {progress > 0 && (
        <div className="absolute top-0 left-0 right-0 h-1 bg-primary/10 overflow-hidden z-50 rounded-full">
          <div 
            className="h-full bg-primary transition-all duration-300 ease-out" 
            style={{ width: `${progress}%` }}
          />
        </div>
      )}

      <PageHeader 
        title="จัดการข้อมูลการเข้าร่วม"
        icon={<Activity className="h-6 w-6" />}
        actions={
          <Badge variant={isDeptScoped ? 'secondary' : 'default'} className="border-0">
            {isDeptScoped ? `สังกัด: ${getDepartmentLabel(currentAdmin.department)}` : 'Super Admin'}
          </Badge>
        }
      />

        {/* Filters */}
        <Card className="border-0 shadow-sm">
          <CardContent className="p-3 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 sm:gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ค้นหารายการ..."
                  value={filters.search}
                  onChange={(e) => setFilters(v => ({ ...v, search: e.target.value }))}
                  className="pl-9"
                />
              </div>

              <div className="relative flex items-center">
                <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 6 } }}>
                  <DatePicker 
                    showTime
                    placeholder="วันที่และเวลาเริ่มต้น"
                    className="w-full h-10"
                    format="DD/MM/YYYY HH:mm"
                    onChange={(date, dateString) => {
                      setFilters(v => ({ ...v, dateRange: { ...v.dateRange, start: date ? date.toISOString() : '' } }));
                    }}
                  />
                </ConfigProvider>
              </div>

              <div className="relative flex items-center">
                <ConfigProvider locale={thTH} theme={{ token: { fontFamily: 'inherit', colorPrimary: '#0f172a', borderRadius: 6 } }}>
                  <DatePicker 
                    showTime
                    placeholder="วันที่และเวลาสิ้นสุด"
                    className="w-full h-10"
                    format="DD/MM/YYYY HH:mm"
                    onChange={(date, dateString) => {
                      setFilters(v => ({ ...v, dateRange: { ...v.dateRange, end: date ? date.toISOString() : '' } }));
                    }}
                  />
                </ConfigProvider>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" className="flex-1" onClick={() => { setLastDoc(null); loadData(false); }} disabled={loading}>
                  <RefreshCw className={cn("h-4 w-4 mr-2", loading && "animate-spin")} /> โหลด
                </Button>
                {canExport && (
                  <Button variant="default" className="flex-1 bg-emerald-600 hover:bg-emerald-700" onClick={() => setExportOpen(true)}>
                    <Download className="h-4 w-4 mr-2" /> Export
                  </Button>
                )}
              </div>

              {/* Advanced filters (simplified to selects for now, you can enhance with a multi-select component if needed) */}
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.activities.length === 0 ? '' : filters.activities[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters(v => ({ ...v, activities: val ? [val] : [] }));
                }}
              >
                <option value="">ทุกกิจกรรม</option>
                {availableActivities.map(a => (
                  <option key={a} value={a}>{activityNameByCode[a] || a}</option>
                ))}
              </select>

              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={filters.faculties.length === 0 ? '' : filters.faculties[0]}
                onChange={(e) => {
                  const val = e.target.value;
                  setFilters(v => ({ ...v, faculties: val ? [val] : [] }));
                }}
              >
                <option value="">ทุกคณะ</option>
                {availableFaculties.map(f => (
                  <option key={f} value={f}>{f}</option>
                ))}
              </select>

              <div className="md:col-span-2 flex items-center justify-end gap-4">
                <span className="text-sm text-muted-foreground">
                  แสดง {filteredRecords.length} / {records.length}
                </span>
                {selected.length > 0 && isSuperAdmin && (
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(selected)}>
                    <Trash2 className="h-4 w-4 mr-2" /> ลบ {selected.length} รายการ
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data Table / Cards */}
        <Card className="border-0 shadow-sm overflow-hidden">
          {/* Mobile cards */}
          <div className="md:hidden divide-y">
            {filteredRecords.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-sm">ไม่พบข้อมูล</div>
            ) : (
              filteredRecords.map((r) => (
                <div key={r.id} className={cn('p-3 space-y-2', selected.includes(r.id) && 'bg-primary/5')}>
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 rounded border-gray-300 text-primary focus:ring-primary shrink-0"
                      checked={selected.includes(r.id)}
                      onChange={() => toggleSelect(r.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate flex items-center gap-1.5">
                            {anomalyCountById.has(r.id) && (
                              <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                            )}
                            {r.firstName} {r.lastName}
                          </p>
                          <p className="text-xs text-muted-foreground">{r.studentId}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="shrink-0"
                          onClick={() => { setSelectedRecord(r); setDetailOpen(true); }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.timestamp.toLocaleDateString('th-TH')} · {r.timestamp.toLocaleTimeString('th-TH')}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">{String(r.faculty || '-')}</p>
                      <Badge variant="secondary" className="mt-1.5 truncate max-w-full">
                        {activityNameByCode[r.activityCode] || r.activityCode}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <Table>
              <TableHeader className="bg-slate-50/50">
                <TableRow>
                  <TableHead className="w-[50px] text-center">
                    <input 
                      type="checkbox" 
                      className="rounded border-gray-300 text-primary focus:ring-primary"
                      checked={selected.length === filteredRecords.length && filteredRecords.length > 0}
                      onChange={toggleSelectAll}
                    />
                  </TableHead>
                  <TableHead>เวลา</TableHead>
                  <TableHead>ผู้เข้าร่วม</TableHead>
                  <TableHead>สังกัด</TableHead>
                  <TableHead>กิจกรรม</TableHead>
                  <TableHead className="text-right">จัดการ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRecords.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                      ไม่พบข้อมูล
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredRecords.map((r) => (
                    <TableRow key={r.id} className={cn(selected.includes(r.id) && "bg-primary/5")}>
                      <TableCell className="text-center">
                        <input 
                          type="checkbox" 
                          className="rounded border-gray-300 text-primary focus:ring-primary"
                          checked={selected.includes(r.id)}
                          onChange={() => toggleSelect(r.id)}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{r.timestamp.toLocaleDateString('th-TH')}</div>
                        <div className="text-xs text-muted-foreground">{r.timestamp.toLocaleTimeString('th-TH')}</div>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium flex items-center gap-1.5">
                          {anomalyCountById.has(r.id) && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>พบความผิดปกติ — เปิดรายละเอียดเพื่อดู</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          {r.firstName} {r.lastName}
                        </div>
                        <div className="text-xs text-muted-foreground">{r.studentId}</div>
                        {r.ipAddress && (
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">{r.ipAddress}</div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-sm">{String(r.faculty || '-')}</div>
                      </TableCell>
                      <TableCell>
                        <TooltipProvider>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Badge variant="secondary" className="truncate max-w-[200px] cursor-help">
                                {activityNameByCode[r.activityCode] || r.activityCode}
                              </Badge>
                            </TooltipTrigger>
                            <TooltipContent>
                              {r.activityCode}
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" onClick={() => { setSelectedRecord(r); setDetailOpen(true); }}>
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
          
          {!loading && hasMore && filteredRecords.length > 0 && (
            <div className="p-4 border-t flex justify-center bg-slate-50/50">
              <Button variant="outline" onClick={() => loadData(true)}>
                โหลดเพิ่มเติม
              </Button>
            </div>
          )}
        </Card>

      {/* Detail Dialog */}
      <Dialog open={detailOpen} onOpenChange={setDetailOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>รายละเอียดการเข้าร่วม</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-2">
              {selectedAnomalies.length > 0 && (
                <div className="space-y-2">
                  {selectedAnomalies.map((a, i) => (
                    <div
                      key={i}
                      className={cn(
                        'flex gap-2 rounded-lg border p-3 text-sm',
                        a.level === 'danger'
                          ? 'border-red-200 bg-red-50 text-red-900'
                          : 'border-amber-200 bg-amber-50 text-amber-950'
                      )}
                    >
                      <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                      <div>
                        <p className="font-semibold">
                          {a.level === 'danger' ? 'พบความผิดปกติ' : 'ควรตรวจสอบ'}
                        </p>
                        <p className="mt-0.5 leading-snug">{a.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <DetailField
                  label={selectedRecord.studentId?.startsWith('EXT-') ? 'รหัสอ้างอิง' : 'รหัสผู้เข้าร่วม'}
                  value={selectedRecord.studentId}
                />
                <DetailField
                  label="ชื่อ-นามสกุล"
                  value={`${selectedRecord.nameTitle || ''}${selectedRecord.firstName || ''} ${selectedRecord.lastName || ''}`.trim()}
                />
                <DetailField
                  label="อีเมล"
                  value={
                    selectedRecord.email ? (
                      <span className="inline-flex items-center gap-1.5">
                        <Mail className="h-3.5 w-3.5 text-muted-foreground" />
                        {selectedRecord.email}
                      </span>
                    ) : (
                      '-'
                    )
                  }
                  className="sm:col-span-2"
                />
                <DetailField
                  label="กิจกรรม"
                  value={activityNameByCode[selectedRecord.activityCode] || selectedRecord.activityCode}
                  className="sm:col-span-2"
                />
                <DetailField label="รหัสกิจกรรม" value={selectedRecord.activityCode} />
                <DetailField
                  label="รอบ / เซสชัน"
                  value={selectedRecord.sessionName || selectedRecord.sessionId || '-'}
                />
                <DetailField
                  label="เวลา"
                  value={selectedRecord.timestamp.toLocaleString('th-TH')}
                />
                <DetailField
                  label="ประเภทผู้ใช้"
                  value={
                    selectedRecord.userType === 'external' || selectedRecord.studentId?.startsWith('EXT-')
                      ? 'บุคคลภายนอก'
                      : 'มหาวิทยาลัย'
                  }
                />
                <DetailField
                  label={
                    selectedRecord.userType === 'external' || selectedRecord.studentId?.startsWith('EXT-')
                      ? 'สถานศึกษา / หน่วยงาน'
                      : 'คณะ'
                  }
                  value={
                    selectedRecord.institutionName ||
                    selectedRecord.faculty ||
                    '-'
                  }
                />
                <DetailField
                  label={
                    selectedRecord.userType === 'external' || selectedRecord.studentId?.startsWith('EXT-')
                      ? 'ระดับการศึกษา'
                      : 'สาขา'
                  }
                  value={
                    selectedRecord.userType === 'external' || selectedRecord.studentId?.startsWith('EXT-')
                      ? selectedRecord.degree || selectedRecord.department || '-'
                      : String(selectedRecord.department || '-')
                  }
                />
                {!(selectedRecord.userType === 'external' || selectedRecord.studentId?.startsWith('EXT-')) && (
                  <DetailField label="ระดับการศึกษา" value={selectedRecord.degree || '-'} />
                )}
                <DetailField
                  label="IP Address"
                  value={
                    <span className="inline-flex items-center gap-1.5 font-mono text-xs sm:text-sm">
                      <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                      {selectedRecord.ipAddress || 'ไม่มีข้อมูล (รายการเก่า)'}
                    </span>
                  }
                  className="sm:col-span-2"
                />
                <DetailField
                  label="พิกัด GPS"
                  value={
                    selectedRecord.location?.latitude != null &&
                    selectedRecord.location?.longitude != null ? (
                      <span className="inline-flex items-center gap-1.5 font-mono text-xs">
                        <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
                        {Number(selectedRecord.location.latitude).toFixed(6)},{' '}
                        {Number(selectedRecord.location.longitude).toFixed(6)}
                        <a
                          className="ml-1 text-primary underline font-sans text-xs"
                          href={`https://www.google.com/maps?q=${selectedRecord.location.latitude},${selectedRecord.location.longitude}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          เปิดแผนที่
                        </a>
                      </span>
                    ) : (
                      'ไม่มีข้อมูล'
                    )
                  }
                  className="sm:col-span-2"
                />
                {selectedRecord.userAgent && (
                  <DetailField
                    label="อุปกรณ์ / เบราว์เซอร์"
                    value={<span className="text-xs text-muted-foreground font-normal">{selectedRecord.userAgent}</span>}
                    className="sm:col-span-2"
                  />
                )}
                <DetailField label="User ID" value={selectedRecord.userId || '-'} className="sm:col-span-2" />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            {isSuperAdmin && selectedRecord && (
              <Button variant="destructive" className="mr-auto" onClick={() => { handleDelete([selectedRecord.id]); setDetailOpen(false); }}>
                <Trash className="h-4 w-4 mr-2" /> ลบรายการ
              </Button>
            )}
            <Button variant="outline" onClick={() => setDetailOpen(false)}>ปิด</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Export Dialog */}
      <Dialog open={exportOpen} onOpenChange={setExportOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ส่งออกข้อมูล (Export CSV)</DialogTitle>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <p className="text-sm text-muted-foreground">
              ระบบจะทำการดึงข้อมูล "ทั้งหมด" จากฐานข้อมูลตามเงื่อนไขวันที่และสังกัดที่คุณเลือก (ไม่จำกัดแค่รายการที่แสดงผลอยู่)
            </p>
            <div className="space-y-2">
              <Label>ชื่อไฟล์</Label>
              <Input 
                value={exportFilename} 
                onChange={(e) => setExportFilename(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setExportOpen(false)}>ยกเลิก</Button>
            <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={handleExport} disabled={isExporting}>
              {isExporting ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
              {isExporting ? 'กำลังประมวลผล...' : 'ดาวน์โหลด CSV'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminAttendancePanel;