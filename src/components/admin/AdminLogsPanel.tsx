'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Paper,
  Typography,
  TextField,
  TableContainer,
  Table,
  TableHead,
  TableRow,
  TableCell,
  TableBody,
  Stack,
  Button,
  Alert,
  Box,
} from '@mui/material';
import type { AdminProfile } from '../../types/admin';
import {
  subscribeAdminLogs,
  type AdminLogEntry,
  getAdminLogs,
  logAdminEvent,
  requireSuperAdmin,
} from '../../lib/adminFirebase';

type Props = {
  currentAdmin: AdminProfile;
};

function fmtDate(d?: Date) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString();
  } catch {
    return '-';
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
    JSON.stringify(r.meta ?? {}).replaceAll(',', ';'),
  ]);
  const lines = [header, ...body].map((cols) =>
    cols.map((c) => `"${String(c).replaceAll('"', '""')}"`).join(',')
  );
  // ใส่ BOM เพื่อให้ Excel เปิดภาษาไทยไม่เพี้ยน
  return '\uFEFF' + lines.join('\n');
}

export default function AdminLogsPanel({ currentAdmin }: Props) {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [q, setQ] = useState('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const debounceTimer = useRef<number | null>(null);

  // ---------- Gate: super_admin only ----------
  const accessError = requireSuperAdmin(currentAdmin)
    ? ''
    : 'สิทธิ์ไม่เพียงพอ: เฉพาะผู้ดูแลสูงสุด (Super Admin) เท่านั้นที่เข้าถึงบันทึกการใช้งานได้';

  useEffect(() => {
    // บันทึกการเข้าใช้งานหน้า (ถ้าเข้าได้)
    if (!accessError) {
      logAdminEvent('ADMIN_LOGS_OPEN', {}, { uid: currentAdmin.uid, email: currentAdmin.email }).catch(() => {});
    }
  }, [accessError, currentAdmin?.uid, currentAdmin?.email]);

  useEffect(() => {
    if (accessError) {
      setLoading(false);
      return;
    }
    // preload 1 หน้า เพื่อให้มีข้อมูลทันที
    (async () => {
      try {
        const pre = await getAdminLogs(100);
        setLogs(pre);
      } catch (e: any) {
        setError('โหลดข้อมูลเบื้องต้นไม่สำเร็จ');
      } finally {
        setLoading(false);
      }
    })();

    // subscribe realtime
    const unsub = subscribeAdminLogs((rows) => setLogs(rows), 200);
    return () => unsub();
  }, [accessError]);

  // debounce ค้นหา (ปรับปรุง UX)
  const [term, setTerm] = useState('');
  useEffect(() => {
    if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    debounceTimer.current = window.setTimeout(() => setTerm(q.trim().toLowerCase()), 250);
    return () => {
      if (debounceTimer.current) window.clearTimeout(debounceTimer.current);
    };
  }, [q]);

  const filtered = useMemo(() => {
    if (!term) return logs;
    return logs.filter((r) => {
      const hay =
        `${fmtDate(r.at)} ${r.action} ${r.actorUid ?? ''} ${r.actorEmail ?? ''} ${JSON.stringify(r.meta ?? {})}`.toLowerCase();
      return hay.includes(term);
    });
  }, [term, logs]);

  const exportCsv = () => {
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

    // log export
    logAdminEvent(
      'ADMIN_LOGS_EXPORT',
      { count: filtered.length, query: term },
      { uid: currentAdmin.uid, email: currentAdmin.email }
    ).catch(() => {});
  };

  const refreshNow = async () => {
    try {
      setLoading(true);
      const fresh = await getAdminLogs(200);
      setLogs(fresh);
      setError('');
    } catch (e: any) {
      setError('รีเฟรชข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  };

  if (accessError) {
    return (
      <Paper sx={{ p: 3 }}>
        <Alert severity="error" sx={{ mb: 2 }}>{accessError}</Alert>
        <Typography variant="body2" color="text.secondary">
          หากต้องการสิทธิ์ โปรดติดต่อผู้ดูแลระบบสูงสุดของหน่วยงานคุณ
        </Typography>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>บันทึกการใช้งานของแอดมิน (เรียลไทม์)</Typography>
        <TextField
          size="small"
          placeholder="ค้นหา: คำสั่ง / อีเมล / รายละเอียด"
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // log event ช่วงค้นหาแบบยุบรวม
            logAdminEvent(
              'ADMIN_LOGS_SEARCH',
              { query: e.target.value },
              { uid: currentAdmin.uid, email: currentAdmin.email }
            ).catch(() => {});
          }}
        />
        <Button onClick={refreshNow} variant="outlined">รีเฟรช</Button>
        <Button onClick={exportCsv} variant="contained">ส่งออก CSV</Button>
      </Stack>

      <Box sx={{ mt: 1, color: 'text.secondary', fontSize: 13 }}>
        ทั้งหมด {logs.length.toLocaleString()} รายการ • ตรงเงื่อนไข {filtered.length.toLocaleString()} รายการ
      </Box>

      {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}

      <TableContainer sx={{ mt: 2, maxHeight: 520 }}>
        <Table stickyHeader size="small" aria-label="ตารางบันทึกการใช้งานผู้ดูแล">
          <TableHead>
            <TableRow>
              <TableCell>เวลา</TableCell>
              <TableCell>การกระทำ</TableCell>
              <TableCell>ผู้กระทำ (uid)</TableCell>
              <TableCell>ผู้กระทำ (อีเมล)</TableCell>
              <TableCell>รายละเอียด</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && filtered.map((r) => (
              <TableRow key={r.id} hover>
                <TableCell>{fmtDate(r.at)}</TableCell>
                <TableCell>{r.action}</TableCell>
                <TableCell>{r.actorUid || '-'}</TableCell>
                <TableCell>{r.actorEmail || '-'}</TableCell>
                <TableCell>
                  <code style={{ whiteSpace: 'pre-wrap' }}>
                    {JSON.stringify(r.meta ?? {}, null, 0)}
                  </code>
                </TableCell>
              </TableRow>
            ))}
            {!loading && filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>ไม่พบข้อมูล</TableCell>
              </TableRow>
            )}
            {loading && (
              <TableRow>
                <TableCell colSpan={5}>กำลังโหลดข้อมูล...</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
