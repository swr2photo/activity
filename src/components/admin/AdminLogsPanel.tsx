// src/components/admin/AdminLogsPanel.tsx
'use client';

import React, { useEffect, useMemo, useRef, useState, useCallback } from 'react';
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
  CircularProgress,
  IconButton,
  Tooltip
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import DownloadIcon from '@mui/icons-material/Download';

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

// --- Utils ---
function fmtDate(d?: Date) {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleString('th-TH', { 
        year: 'numeric', month: 'short', day: 'numeric', 
        hour: '2-digit', minute: '2-digit', second: '2-digit' 
    });
  } catch {
    return '-';
  }
}

// Function to safely stringify meta data (mask sensitive info if needed)
function safeMetaString(meta: any): string {
    if (!meta) return '{}';
    try {
        // Example: Mask sensitive keys if needed
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
  // State
  const [logs, setLogs] = useState<AdminLogEntry[]>([]);
  const [q, setQ] = useState('');
  const [term, setTerm] = useState('');
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  
  // Refs
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);
  const logSearchTimer = useRef<NodeJS.Timeout | null>(null);

  // Security Gate
  const isSuper = useMemo(() => requireSuperAdmin(currentAdmin), [currentAdmin]);
  const accessError = isSuper ? '' : 'สิทธิ์ไม่เพียงพอ: เฉพาะผู้ดูแลสูงสุด (Super Admin) เท่านั้น';

  // --- Effects ---

  // 1. Log Access (Once per mount)
  useEffect(() => {
    if (isSuper) {
      logAdminEvent('ADMIN_LOGS_OPEN', {}, { uid: currentAdmin.uid, email: currentAdmin.email })
        .catch(console.warn);
    }
  }, [isSuper, currentAdmin]);

  // 2. Fetch Data (Subscribe)
  useEffect(() => {
    if (!isSuper) {
      setLoading(false);
      return;
    }

    setLoading(true);
    // Initial fetch
    getAdminLogs(100)
        .then(setLogs)
        .catch(() => setError('โหลดข้อมูลเบื้องต้นไม่สำเร็จ'))
        .finally(() => setLoading(false));

    // Realtime subscription
    const unsub = subscribeAdminLogs((rows) => {
        setLogs(rows);
        setLoading(false);
    }, 200);

    return () => unsub();
  }, [isSuper]);

  // 3. Debounce Search Input
  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
        setTerm(q.trim().toLowerCase());
        
        // Log search event (Debounced heavily to avoid spam)
        if (q.trim().length > 2) {
            if (logSearchTimer.current) clearTimeout(logSearchTimer.current);
            logSearchTimer.current = setTimeout(() => {
                logAdminEvent(
                    'ADMIN_LOGS_SEARCH',
                    { query: q },
                    { uid: currentAdmin.uid, email: currentAdmin.email }
                ).catch(() => {});
            }, 2000);
        }
    }, 300);

    return () => {
        if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, [q, currentAdmin]);

  // --- Handlers ---

  const filtered = useMemo(() => {
    if (!term) return logs;
    return logs.filter((r) => {
      const hay =
        `${fmtDate(r.at)} ${r.action} ${r.actorUid ?? ''} ${r.actorEmail ?? ''} ${JSON.stringify(r.meta ?? {})}`.toLowerCase();
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

        logAdminEvent(
          'ADMIN_LOGS_EXPORT',
          { count: filtered.length, query: term },
          { uid: currentAdmin.uid, email: currentAdmin.email }
        ).catch(() => {});
    } catch (e) {
        setError('เกิดข้อผิดพลาดในการส่งออกไฟล์');
    }
  }, [filtered, term, currentAdmin]);

  const handleRefresh = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const fresh = await getAdminLogs(200);
      setLogs(fresh);
    } catch (e: any) {
      setError('รีเฟรชข้อมูลไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, []);

  // --- Render ---

  if (accessError) {
    return (
      <Paper sx={{ p: 3, textAlign: 'center' }}>
        <Alert severity="error" sx={{ mb: 2, display: 'inline-flex' }}>{accessError}</Alert>
      </Paper>
    );
  }

  return (
    <Paper sx={{ p: 3, minHeight: 500 }}>
      <Stack spacing={3}>
        {/* Header */}
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center" justifyContent="space-between">
            <Box>
                <Typography variant="h5" fontWeight="bold">บันทึกการใช้งาน (Audit Logs)</Typography>
                <Typography variant="body2" color="text.secondary">
                    ติดตามกิจกรรมของผู้ดูแลระบบแบบเรียลไทม์
                </Typography>
            </Box>
            
            <Stack direction="row" spacing={1} sx={{ width: { xs: '100%', md: 'auto' } }}>
                <TextField
                    size="small"
                    placeholder="ค้นหา..."
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    sx={{ minWidth: 250 }}
                />
                <Tooltip title="รีเฟรช">
                    <IconButton onClick={handleRefresh} disabled={loading}>
                        <RefreshIcon />
                    </IconButton>
                </Tooltip>
                <Button 
                    variant="outlined" 
                    startIcon={<DownloadIcon />} 
                    onClick={handleExportCsv}
                    disabled={filtered.length === 0}
                >
                    CSV
                </Button>
            </Stack>
        </Stack>

        {error && <Alert severity="error" onClose={() => setError('')}>{error}</Alert>}

        {/* Stats */}
        <Box sx={{ bgcolor: 'grey.50', p: 1.5, borderRadius: 2, border: '1px solid', borderColor: 'divider' }}>
            <Typography variant="caption" color="text.secondary">
                แสดงผล {filtered.length} จากทั้งหมด {logs.length} รายการล่าสุด
            </Typography>
        </Box>

        {/* Table */}
        <TableContainer sx={{ maxHeight: 600, border: '1px solid', borderColor: 'divider', borderRadius: 2 }}>
          <Table stickyHeader size="small">
            <TableHead>
              <TableRow>
                <TableCell width="180">เวลา</TableCell>
                <TableCell width="150">Action</TableCell>
                <TableCell width="250">ผู้ดำเนินการ</TableCell>
                <TableCell>รายละเอียด (Meta)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {loading && logs.length === 0 ? (
                 <TableRow>
                    <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                        <CircularProgress size={24} />
                        <Typography variant="caption" display="block" sx={{ mt: 1 }}>กำลังโหลดข้อมูล...</Typography>
                    </TableCell>
                 </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5, color: 'text.secondary' }}>
                    ไม่พบข้อมูลที่ตรงกับคำค้นหา
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id} hover>
                    <TableCell sx={{ whiteSpace: 'nowrap', color: 'text.secondary', fontSize: '0.85rem' }}>
                        {fmtDate(r.at)}
                    </TableCell>
                    <TableCell>
                        <Typography variant="body2" fontWeight="bold" color="primary.main">
                            {r.action}
                        </Typography>
                    </TableCell>
                    <TableCell>
                        <Stack spacing={0.5}>
                            <Typography variant="body2" fontWeight="medium">
                                {r.actorEmail || 'Unknown'}
                            </Typography>
                            <Typography variant="caption" color="text.secondary" sx={{ fontFamily: 'monospace' }}>
                                {r.actorUid}
                            </Typography>
                        </Stack>
                    </TableCell>
                    <TableCell>
                      <Box 
                        component="pre" 
                        sx={{ 
                            m: 0, p: 1, 
                            bgcolor: 'grey.100', 
                            borderRadius: 1, 
                            fontSize: '0.75rem', 
                            overflowX: 'auto',
                            maxWidth: 400
                        }}
                      >
                        {safeMetaString(r.meta)}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Stack>
    </Paper>
  );
}