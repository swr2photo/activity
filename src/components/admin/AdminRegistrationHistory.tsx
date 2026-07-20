// src/components/admin/AdminRegistrationHistory.tsx
'use client';

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Search, Download, RefreshCw, Filter, Calendar,
  Users, FileText, ChevronDown, X, List, Layers,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { collection, getDocs, orderBy, query, where } from 'firebase/firestore';
import { adminDb as db } from '@/lib/firebase';
import type { AdminProfile } from '@/types/admin';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Types
type ActivityRecord = {
  id: string;
  activityCode: string;
  activityName?: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  timestamp: Date;
};

interface Props {
  currentAdmin: AdminProfile;
}

const PAGE_SIZE = 25;

const AdminRegistrationHistory: React.FC<Props> = ({ currentAdmin }) => {
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [searchText, setSearchText] = useState('');
  const [activityFilter, setActivityFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'all' | 'grouped'>('all');
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    try {
      const col = collection(db, 'activityRecords');
      let snap;

      if (activityFilter) {
        snap = await getDocs(query(col, where('activityCode', '==', activityFilter)));
      } else {
        snap = await getDocs(query(col, orderBy('timestamp', 'desc')));
      }

      let rows: ActivityRecord[] = snap.docs.map((d) => {
        const data: any = d.data();
        const ts: Date =
          data.timestamp?.toDate?.() ??
          (data.timestamp instanceof Date
            ? data.timestamp
            : new Date(data.timestamp || Date.now()));

        return {
          id: d.id,
          activityCode: data.activityCode || '',
          activityName: data.activityName || '',
          studentId: data.studentId || '',
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          department: data.department || '',
          timestamp: ts,
        };
      });

      if (activityFilter) {
        rows = rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      }

      setRecords(rows);
      setCurrentPage(1);
    } catch (e) {
      console.error('Error fetching records:', e);
    } finally {
      setLoading(false);
    }
  }, [activityFilter]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  // Filtered & paginated
  const filtered = useMemo(() => {
    let result = records;

    // Text search
    if (searchText.trim()) {
      const s = searchText.toLowerCase();
      result = result.filter(
        (r) =>
          r.activityCode.toLowerCase().includes(s) ||
          (r.activityName || '').toLowerCase().includes(s) ||
          r.studentId.includes(searchText) ||
          r.firstName.toLowerCase().includes(s) ||
          r.lastName.toLowerCase().includes(s) ||
          (r.department || '').toLowerCase().includes(s)
      );
    }

    // Date range
    if (dateFrom) {
      const from = new Date(dateFrom);
      from.setHours(0, 0, 0, 0);
      result = result.filter((r) => r.timestamp >= from);
    }
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      result = result.filter((r) => r.timestamp <= to);
    }

    return result;
  }, [records, searchText, dateFrom, dateTo]);

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
  const paginated = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    const uniqueStudents = new Set(filtered.map((r) => r.studentId)).size;
    const uniqueActivities = new Set(filtered.map((r) => r.activityCode)).size;
    return { total: filtered.length, uniqueStudents, uniqueActivities };
  }, [filtered]);

  // Available activities for filter
  const availableActivities = useMemo(() => {
    const set = new Set(records.map((r) => r.activityCode));
    return Array.from(set).sort();
  }, [records]);

  // จัดกลุ่มรายการตามกิจกรรม (เคารพ search/date filters เหมือนตารางรวม)
  const groups = useMemo(() => {
    const map = new Map<string, ActivityRecord[]>();
    filtered.forEach((r) => {
      const key = r.activityCode || '(ไม่ระบุ)';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(r);
    });
    return Array.from(map.entries())
      .map(([code, rows]) => ({
        code,
        name: rows.find((r) => r.activityName)?.activityName || '',
        rows,
        uniqueStudents: new Set(rows.map((r) => r.studentId)).size,
        latest: rows.reduce((mx, r) => (r.timestamp > mx ? r.timestamp : mx), rows[0].timestamp),
      }))
      .sort((a, b) => b.latest.getTime() - a.latest.getTime());
  }, [filtered]);

  // Export CSV (ไม่ส่ง rows = ใช้รายการที่กรองอยู่ทั้งหมด)
  const exportCSV = (rows?: ActivityRecord[], filenameSuffix?: string) => {
    const data = rows ?? filtered;
    const headers = [
      'วันที่/เวลา',
      'รหัสผู้เข้าร่วม',
      'ชื่อ',
      'นามสกุล',
      'สังกัด',
      'รหัสกิจกรรม',
      'ชื่อกิจกรรม',
    ];

    const body = data.map((r) => [
      r.timestamp.toLocaleString('th-TH'),
      r.studentId,
      r.firstName,
      r.lastName,
      r.department,
      r.activityCode,
      r.activityName || '',
    ]);

    const csv = [headers, ...body]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      )
      .join('\n');

    const blob = new Blob(['\uFEFF' + csv], {
      type: 'text/csv;charset=utf-8;',
    });

    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    const codePart = filenameSuffix ?? (activityFilter ? `_${activityFilter}` : '');
    a.download = `registration_history${codePart}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6 w-full min-w-0 max-w-full overflow-x-hidden">
      {/* Header */}
      <div className="min-w-0">
        <h1 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
          <FileText className="h-6 w-6 text-primary shrink-0" />
          <span className="truncate">ประวัติการลงทะเบียน</span>
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          ตรวจสอบรายการลงทะเบียนกิจกรรมทั้งหมดในระบบ
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">รายการทั้งหมด</p>
                <p className="text-3xl font-bold text-slate-900">{stats.total.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
                <FileText className="h-6 w-6 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">ผู้เข้าร่วม (ไม่ซ้ำ)</p>
                <p className="text-3xl font-bold text-slate-900">{stats.uniqueStudents.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
                <Users className="h-6 w-6 text-green-600" />
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground font-medium">กิจกรรม (ไม่ซ้ำ)</p>
                <p className="text-3xl font-bold text-slate-900">{stats.uniqueActivities.toLocaleString()}</p>
              </div>
              <div className="h-12 w-12 rounded-xl bg-purple-100 flex items-center justify-center">
                <Calendar className="h-6 w-6 text-purple-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search & Actions */}
      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="ค้นหา รหัสกิจกรรม, รหัสผู้เข้าร่วม, ชื่อ..."
                value={searchText}
                onChange={(e) => { setSearchText(e.target.value); setCurrentPage(1); }}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
              />
              {searchText && (
                <button
                  title="ล้างคำค้นหา"
                  onClick={() => setSearchText('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-slate-600"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Filter & Actions */}
            <div className="flex flex-wrap gap-2">
              {/* สลับมุมมอง รวม / แยกกิจกรรม */}
              <div className="flex rounded-lg border border-slate-200 overflow-hidden">
                <button
                  title="ดูรายการรวม"
                  onClick={() => setViewMode('all')}
                  className={cn(
                    'px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors',
                    viewMode === 'all' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <List className="h-4 w-4" />
                  รวม
                </button>
                <button
                  title="ดูแยกตามกิจกรรม"
                  onClick={() => setViewMode('grouped')}
                  className={cn(
                    'px-2.5 sm:px-3 py-2 text-xs sm:text-sm font-medium flex items-center gap-1.5 transition-colors border-l border-slate-200',
                    viewMode === 'grouped' ? 'bg-primary text-white' : 'bg-white text-slate-600 hover:bg-slate-50'
                  )}
                >
                  <Layers className="h-4 w-4" />
                  แยกกิจกรรม
                </button>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowFilters(!showFilters)}
                className="gap-1.5"
              >
                <Filter className="h-4 w-4" />
                <span className="hidden xs:inline sm:inline">ตัวกรอง</span>
                {(activityFilter || dateFrom || dateTo) && (
                  <span className="ml-1 h-5 w-5 rounded-full bg-primary text-white text-xs flex items-center justify-center">
                    {[activityFilter, dateFrom, dateTo].filter(Boolean).length}
                  </span>
                )}
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchRecords}
                disabled={loading}
                className="gap-1.5"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">รีเฟรช</span>
              </Button>
              <Button
                size="sm"
                onClick={() => exportCSV()}
                disabled={filtered.length === 0}
                className="gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                <Download className="h-4 w-4" />
                <span className="hidden sm:inline">ส่งออก CSV</span>
                <span className="sm:hidden">CSV</span>
              </Button>
            </div>
          </div>

          {/* Extended Filters */}
          {showFilters && (
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-100 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Activity Filter */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">กิจกรรม</label>
                  <select
                    title="เลือกกิจกรรม"
                    value={activityFilter}
                    onChange={(e) => setActivityFilter(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="">ทุกกิจกรรม</option>
                    {availableActivities.map((code) => (
                      <option key={code} value={code}>
                        {code}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date From */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">ตั้งแต่วันที่</label>
                  <input
                    type="date"
                    title="ตั้งแต่วันที่"
                    value={dateFrom}
                    onChange={(e) => { setDateFrom(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Date To */}
                <div>
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">ถึงวันที่</label>
                  <input
                    type="date"
                    title="ถึงวันที่"
                    value={dateTo}
                    onChange={(e) => { setDateTo(e.target.value); setCurrentPage(1); }}
                    className="w-full px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
              </div>

              {(activityFilter || dateFrom || dateTo) && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setActivityFilter(''); setDateFrom(''); setDateTo(''); setCurrentPage(1); }}
                  className="text-xs text-muted-foreground"
                >
                  <X className="h-3 w-3 mr-1" />
                  ล้างตัวกรอง
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* มุมมองแยกตามกิจกรรม */}
      {viewMode === 'grouped' && (
        <div className="space-y-3">
          {loading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16">
                <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : groups.length === 0 ? (
            <Card>
              <CardContent className="text-center py-16 text-muted-foreground">
                <Layers className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="font-semibold">ไม่มีข้อมูลการลงทะเบียน</p>
                <p className="text-sm mt-1">ลองปรับเงื่อนไขการค้นหาหรือตัวกรอง</p>
              </CardContent>
            </Card>
          ) : (
            groups.map((g) => {
              const expanded = expandedGroup === g.code;
              return (
                <Card key={g.code} className="overflow-hidden">
                  {/* หัวการ์ดกิจกรรม — คลิกเพื่อกาง/หุบ */}
                  <button
                    className="w-full text-left px-5 py-4 flex flex-wrap items-center gap-3 hover:bg-slate-50/80 transition-colors"
                    onClick={() => setExpandedGroup(expanded ? null : g.code)}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">
                        {g.name || <span className="text-slate-400 font-medium">(ไม่มีชื่อกิจกรรม)</span>}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge className="text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 border-0">
                          {g.code}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          ล่าสุด {g.latest.toLocaleDateString('th-TH')} {g.latest.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="text-center">
                        <p className="text-xl font-bold text-slate-900">{g.rows.length.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">รายการ</p>
                      </div>
                      <div className="text-center">
                        <p className="text-xl font-bold text-slate-900">{g.uniqueStudents.toLocaleString()}</p>
                        <p className="text-[11px] text-muted-foreground">ผู้เข้าร่วม</p>
                      </div>
                      <ChevronDown className={cn('h-5 w-5 text-slate-400 transition-transform', expanded && 'rotate-180')} />
                    </div>
                  </button>

                  {/* รายการในกิจกรรม */}
                  {expanded && (
                    <div className="border-t border-slate-100">
                      <div className="flex justify-end px-4 pt-3">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => exportCSV(g.rows, `_${g.code}`)}
                          className="gap-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                        >
                          <Download className="h-4 w-4" />
                          ส่งออกกิจกรรมนี้
                        </Button>
                      </div>
                      <div className="overflow-x-auto max-h-96 overflow-y-auto mt-2 max-w-full">
                        <table className="w-full min-w-[560px]">
                          <thead className="sticky top-0 bg-slate-50">
                            <tr className="border-b border-slate-100">
                              {['#', 'วันที่/เวลา', 'รหัสผู้เข้าร่วม', 'ชื่อ', 'นามสกุล', 'สังกัด'].map((h) => (
                                <th key={h} className="px-4 py-2.5 text-left text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  {h}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {g.rows.map((r, idx) => (
                              <tr key={r.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="px-4 py-2.5 text-sm text-slate-400 font-mono">{idx + 1}</td>
                                <td className="px-4 py-2.5 whitespace-nowrap text-sm text-slate-700">
                                  {r.timestamp.toLocaleDateString('th-TH')}{' '}
                                  <span className="text-xs text-muted-foreground">
                                    {r.timestamp.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                  </span>
                                </td>
                                <td className="px-4 py-2.5 text-sm font-mono font-bold text-slate-800">{r.studentId}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-700">{r.firstName}</td>
                                <td className="px-4 py-2.5 text-sm text-slate-700">{r.lastName}</td>
                                <td className="px-4 py-2.5">
                                  <Badge variant="secondary" className="text-xs font-medium">
                                    {r.department || '-'}
                                  </Badge>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Table */}
      {viewMode === 'all' && (
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <RefreshCw className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : paginated.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold">ไม่มีข้อมูลการลงทะเบียน</p>
              <p className="text-sm mt-1">ลองปรับเงื่อนไขการค้นหาหรือตัวกรอง</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-w-full">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    {['#', 'วันที่/เวลา', 'รหัสผู้เข้าร่วม', 'ชื่อ', 'นามสกุล', 'สังกัด', 'รหัสกิจกรรม'].map(
                      (h) => (
                        <th
                          key={h}
                          className="px-4 py-3 text-left text-xs font-bold text-slate-500 uppercase tracking-wider"
                        >
                          {h}
                        </th>
                      )
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {paginated.map((r, idx) => (
                    <tr
                      key={r.id}
                      className="hover:bg-slate-50/80 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-slate-400 font-mono">
                        {(currentPage - 1) * PAGE_SIZE + idx + 1}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-sm font-semibold text-slate-800">
                          {r.timestamp.toLocaleDateString('th-TH')}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {r.timestamp.toLocaleTimeString('th-TH')}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm font-mono font-bold text-slate-800">
                        {r.studentId}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {r.firstName}
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-700">
                        {r.lastName}
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant="secondary" className="text-xs font-medium">
                          {r.department || '-'}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <Badge className="text-xs font-bold bg-primary/10 text-primary hover:bg-primary/20 border-0">
                          {r.activityCode}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100">
              <p className="text-sm text-muted-foreground">
                แสดง {(currentPage - 1) * PAGE_SIZE + 1} - {Math.min(currentPage * PAGE_SIZE, filtered.length)} จาก {filtered.length} รายการ
              </p>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => p - 1)}
                >
                  ก่อนหน้า
                </Button>
                {/* Page numbers */}
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (currentPage <= 3) {
                    pageNum = i + 1;
                  } else if (currentPage >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = currentPage - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={currentPage === pageNum ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setCurrentPage(pageNum)}
                      className="w-9"
                    >
                      {pageNum}
                    </Button>
                  );
                })}
                <Button
                  variant="outline"
                  size="sm"
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => p + 1)}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
};

export default AdminRegistrationHistory;
