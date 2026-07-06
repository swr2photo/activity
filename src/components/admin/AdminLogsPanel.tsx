// src/components/admin/AdminLogsPanel.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { RefreshCw, Download, Search } from 'lucide-react';

import type { AdminProfile } from '../../types/admin';
import {
  subscribeAdminLogs,
  type AdminLogEntry,
  getAdminLogs,
  logAdminEvent,
  requireSuperAdmin,
} from '../../lib/adminFirebase';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { PageHeader } from './shared/PageHeader';
import { FileText } from 'lucide-react';
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from '@/components/ui/tooltip';

type Props = {
  currentAdmin: AdminProfile;
};

function fmtDate(d?: Date) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('th-TH', {
      year: 'numeric', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
  } catch {
    return '-';
  }
}

function safeMetaString(meta: any): string {
  if (!meta) return '{}';
  try {
    const clone = { ...meta };
    if (clone.password) clone.password = '***';
    if (clone.token) clone.token = '***';
    return JSON.stringify(clone);
  } catch {
    return String(meta);
  }
}

function toCsv(rows: AdminLogEntry[]) {
  const header = ['เวลา', 'การกระทำ', 'ผู้กระทำ (uid)', 'ผู้กระทำ (อีเมล)', 'User-Agent', 'Meta(JSON)'];
  const body = rows.map((r) => [
    fmtDate(r.at),
    r.action,
    r.actorUid || '',
    r.actorEmail || '',
    (r.ua || '').replaceAll(',', ' '),
    safeMetaString(r.meta).replaceAll(',', ';'),
  ]);
  const lines = [header, ...body].map((cols) =>
    cols.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')
  );
  return '\uFEFF' + lines.join('\n');
}

export default function AdminLogsPanel({ currentAdmin }: Props) {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const logSearchTimer = useRef<NodeJS.Timeout | null>(null);

  const isSuper = useMemo(() => requireSuperAdmin(currentAdmin), [currentAdmin]);
  const accessError = isSuper ? '' : 'สิทธิ์ไม่เพียงพอ: เฉพาะผู้ดูแลสูงสุด (Super Admin) เท่านั้น';

  useEffect(() => {
    if (isSuper) {
      logAdminEvent('ADMIN_LOGS_OPEN', {}, { uid: currentAdmin.uid, email: currentAdmin.email }).catch(console.warn);
    }
  }, [isSuper, currentAdmin]);

  useEffect(() => {
    if (!isSuper) { setLoading(false); return; }
    setLoading(true);
    getAdminLogs(100)
      .then(setLogs)
      .catch(() => setError('โหลดข้อมูลเบื้องต้นไม่สำเร็จ'))
      .finally(() => setLoading(false));
    const unsub = subscribeAdminLogs((rows) => { setLogs(rows); setLoading(false); }, 200);
    return () => unsub();
  }, [isSuper]);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setTerm(q.trim().toLowerCase());
      if (q.trim().length > 2) {
        if (logSearchTimer.current) clearTimeout(logSearchTimer.current);
        logSearchTimer.current = setTimeout(() => {
          logAdminEvent('ADMIN_LOGS_SEARCH', { query: q }, { uid: currentAdmin.uid, email: currentAdmin.email }).catch(() => {});
        }, 2000);
      }
    }, 300);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
  }, [q, currentAdmin]);

  const filtered = useMemo(() => {
    if (!term) return logs;
    return logs.filter((r) => {
      const hay = `${fmtDate(r.at)} ${r.action} ${r.actorUid ?? ''} ${r.actorEmail ?? ''} ${JSON.stringify(r.meta ?? {})}`.toLowerCase();
      return hay.includes(term);
    });
  }, [term, logs]);

  const handleExportCsv = useCallback(() => {
    if (filtered.length === 0) return;
    try {
      const csv = toCsv(filtered);
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const ts = new Date().toISOString().slice(0, 19).replaceAll(':', '-');
      a.href = url;
      a.download = `admin-logs-${ts}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      logAdminEvent('ADMIN_LOGS_EXPORT', { count: filtered.length, query: term }, { uid: currentAdmin.uid, email: currentAdmin.email }).catch(() => {});
    } catch {
      setError('เกิดข้อผิดพลาดในการส่งออกไฟล์');
    }
  }, [filtered, term, currentAdmin]);

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const fresh = await getAdminLogs(200);
      setLogs(fresh);
    } catch {
      setError('รีเฟรชข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  if (accessError) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <Alert variant="destructive">
            <AlertDescription>{accessError}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 relative">
      <PageHeader 
        title="บันทึกการใช้งาน (Audit Logs)"
        subtitle="ติดตามกิจกรรมของผู้ดูแลระบบแบบเรียลไทม์"
        icon={<FileText className="h-6 w-6" />}
        actions={
          <>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ค้นหา..."
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9 w-64"
              />
            </div>
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="outline" size="icon" onClick={handleRefresh} disabled={loading}>
                    <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>รีเฟรช</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            <Button variant="outline" onClick={handleExportCsv} disabled={filtered.length === 0}>
              <Download className="h-4 w-4 mr-2" />
              CSV
            </Button>
          </>
        }
      />
      <Card className="min-h-[500px] border-0 shadow-sm">
        <CardContent className="p-6 space-y-4">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="bg-muted/50 px-3 py-2 rounded-lg border text-xs text-muted-foreground">
          แสดงผล {filtered.length} จากทั้งหมด {logs.length} รายการล่าสุด
        </div>

        <div className="rounded-xl border overflow-hidden max-h-[600px] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-[180px]">เวลา</TableHead>
                <TableHead className="w-[150px]">Action</TableHead>
                <TableHead className="w-[250px]">ผู้ดำเนินการ</TableHead>
                <TableHead>รายละเอียด (Meta)</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && logs.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                      <span className="text-sm text-muted-foreground">กำลังโหลดข้อมูล...</span>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                    ไม่พบข้อมูลที่ตรงกับคำค้นหา
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(r.at)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="info" className="font-mono text-xs">
                        {r.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5">
                        <p className="text-sm font-medium">{r.actorEmail || 'Unknown'}</p>
                        <p className="text-xs text-muted-foreground font-mono">{r.actorUid}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <pre className="text-xs bg-muted/50 rounded-md p-2 overflow-x-auto max-w-[400px] m-0">
                        {safeMetaString(r.meta)}
                      </pre>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
    </div>
  );
}