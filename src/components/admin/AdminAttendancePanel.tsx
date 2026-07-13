// src/components/admin/AdminAttendancePanel.tsx
'use client';
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Download, RefreshCw, Trash2, Eye, Search, Calendar,
  Activity, Bell, FileText, ChevronDown, CheckSquare, Settings2, Trash
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

import { db } from '../../lib/firebase';
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



// --- Main Component ---
const AdminAttendancePanel: React.FC<Props> = ({ currentAdmin }) => {
  const { enqueueSnackbar } = useSnackbar();

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
    if (!confirm(`ยืนยันลบ ${ids.length} รายการ?`)) return;

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
        
        const headers = ['วันที่', 'เวลา', 'รหัสนักศึกษา', 'ชื่อ', 'นามสกุล', 'คณะ', 'สาขา', 'ชื่อกิจกรรม', 'รหัสกิจกรรม'];
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
    <div className="space-y-6 relative">
      {progress > 0 && (
        <div className="absolute -top-6 -left-4 sm:-left-6 lg:-left-8 w-[calc(100%+2rem)] sm:w-[calc(100%+3rem)] lg:w-[calc(100%+4rem)] h-1 bg-primary/10 overflow-hidden z-50">
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
          <CardContent className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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

        {/* Data Table */}
        <Card className="border-0 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
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
                  <TableHead>นักศึกษา</TableHead>
                  <TableHead>คณะ/สาขา</TableHead>
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
                        <div className="font-medium">{r.firstName} {r.lastName}</div>
                        <div className="text-xs text-muted-foreground">{r.studentId}</div>
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>รายละเอียดการเข้าร่วม</DialogTitle>
          </DialogHeader>
          {selectedRecord && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">รหัสนักศึกษา</Label>
                  <p className="font-medium">{selectedRecord.studentId}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">ชื่อ-นามสกุล</Label>
                  <p className="font-medium">{selectedRecord.firstName} {selectedRecord.lastName}</p>
                </div>
                <div className="space-y-1 col-span-2">
                  <Label className="text-xs text-muted-foreground">กิจกรรม</Label>
                  <p className="font-medium">{activityNameByCode[selectedRecord.activityCode] || selectedRecord.activityCode}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">เวลา</Label>
                  <p className="font-medium">{selectedRecord.timestamp.toLocaleString('th-TH')}</p>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">คณะ</Label>
                  <p className="font-medium">{selectedRecord.faculty || '-'}</p>
                </div>
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