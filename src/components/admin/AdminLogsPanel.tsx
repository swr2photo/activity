'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
} from '@mui/material';
import type { AdminProfile } from '../../types/admin';
import { subscribeAdminLogs, type AdminLogEntry } from '../../lib/adminFirebase';

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
  const header = ['เวลา', 'การกระทำ', 'ผู้กระทำ (uid)', 'ผู้กระทำ (email)', 'User-Agent', 'Meta(JSON)'];
  const body = rows.map((r) => [
    fmtDate(r.at),
    r.action,
    r.actorUid || '',
    r.actorEmail || '',
    (r.ua || '').replaceAll(',', ' '),
    JSON.stringify(r.meta ?? {}).replaceAll(',', ';'),
  ]);
  const lines = [header, ...body].map((cols) =>
    cols
      .map((c) => `"${String(c).replaceAll('"', '""')}"`)
      .join(',')
  );
  return lines.join('\n');
}

export default function AdminLogsPanel({ currentAdmin }: Props) {
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    const unsub = subscribeAdminLogs((rows) => setLogs(rows));
    return () => unsub();
  }, []);

  const filtered = useMemo(() => {
    const term = q.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((r) => {
      const hay =
        `${r.action} ${r.actorUid ?? ''} ${r.actorEmail ?? ''} ${JSON.stringify(r.meta ?? {})}`.toLowerCase();
      return hay.includes(term);
    });
  }, [q, logs]);

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
  };

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} alignItems={{ sm: 'center' }}>
        <Typography variant="h4" sx={{ flexGrow: 1 }}>บันทึกการใช้งานของแอดมิน (Realtime)</Typography>
        <TextField
          size="small"
          placeholder="ค้นหา action / email / meta"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <Button onClick={exportCsv} variant="outlined">Export CSV</Button>
      </Stack>

      <TableContainer sx={{ mt: 2, maxHeight: 520 }}>
        <Table stickyHeader size="small">
          <TableHead>
            <TableRow>
              <TableCell>เวลา</TableCell>
              <TableCell>การกระทำ</TableCell>
              <TableCell>ผู้กระทำ (uid)</TableCell>
              <TableCell>ผู้กระทำ (email)</TableCell>
              <TableCell>Meta</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((r) => (
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
            {filtered.length === 0 && (
              <TableRow>
                <TableCell colSpan={5}>ไม่พบข้อมูล</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
    </Paper>
  );
}
