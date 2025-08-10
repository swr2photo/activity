// components/admin/EnhancedAdminPanel.tsx
import React, { useEffect, useState } from 'react';
import {
  Box, Grid, Typography, TextField, Button, IconButton, Tooltip, InputAdornment,
  ButtonGroup, Fab, useTheme, useMediaQuery, Chip
} from '@mui/material';
import {
  Download as DownloadIcon, Refresh as RefreshIcon, Delete as DeleteIcon,
  Visibility as ViewIcon, Search as SearchIcon, Clear as ClearIcon,
  Event as EventIcon, People as PeopleIcon, Today as TodayIcon
} from '@mui/icons-material';
import { AdminProfile, DEPARTMENT_LABELS } from '../../types/admin';
import {
  getAllActivityRecords,
  getActivityRecordsByDepartment,
  ActivityRecord
} from '../../lib/adminFirebase';

const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: '100%' }}>{children}</Box>
);
const ResponsiveCard: React.FC<{ children: React.ReactNode; sx?: any }> = ({ children, sx }) => (
  <Box sx={{ bgcolor: 'background.paper', borderRadius: 2, p: 3, boxShadow: 1, ...sx }}>{children}</Box>
);
const ResponsiveTable: React.FC<{
  columns: any[]; data: any[]; keyField: string; actions?: (row: any) => React.ReactNode; emptyMessage?: string;
}> = ({ columns, data, keyField, actions, emptyMessage }) => (
  <Box sx={{ overflowX: 'auto' }}>
    {data.length === 0 ? (
      <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 4 }}>
        {emptyMessage || 'ไม่มีข้อมูล'}
      </Typography>
    ) : (
      <Box component="table" sx={{ width: '100%', borderCollapse: 'collapse' }}>
        <Box component="thead">
          <Box component="tr">
            {columns.map((col) => (
              <Box
                component="th"
                key={col.id}
                sx={{
                  p: 2, textAlign: 'left', borderBottom: '1px solid', borderColor: 'divider',
                  display: { xs: col.hideOnMobile ? 'none' : 'table-cell', md: 'table-cell' }
                }}
              >
                <Typography variant="subtitle2" fontWeight="bold">{col.label}</Typography>
              </Box>
            ))}
            {actions && (
              <Box component="th" sx={{ p: 2, textAlign: 'center', borderBottom: '1px solid', borderColor: 'divider' }}>
                <Typography variant="subtitle2" fontWeight="bold">การดำเนินการ</Typography>
              </Box>
            )}
          </Box>
        </Box>
        <Box component="tbody">
          {data.map((row) => (
            <Box component="tr" key={row[keyField]}>
              {columns.map((col) => (
                <Box
                  component="td"
                  key={col.id}
                  sx={{
                    p: 2, borderBottom: '1px solid', borderColor: 'divider',
                    display: { xs: col.hideOnMobile ? 'none' : 'table-cell', md: 'table-cell' }
                  }}
                >
                  {col.format ? col.format(row[col.id], row) : row[col.id]}
                </Box>
              ))}
              {actions && <Box component="td" sx={{ p: 2, borderBottom: '1px solid', borderColor: 'divider' }}>{actions(row)}</Box>}
            </Box>
          ))}
        </Box>
      </Box>
    )}
  </Box>
);

const StatsCard: React.FC<{ title: string; value: number; icon: React.ReactNode; color: string; subtitle?: string; }> =
({ title, value, icon, color, subtitle }) => (
  <ResponsiveCard>
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
      <Box sx={{ bgcolor: color, color: 'white', p: 1.5, borderRadius: 2, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {icon}
      </Box>
      <Box>
        <Typography variant="h4" fontWeight="bold" color={color}>{value.toLocaleString()}</Typography>
        <Typography variant="subtitle2" fontWeight="600">{title}</Typography>
        {subtitle && <Typography variant="caption" color="text.secondary">{subtitle}</Typography>}
      </Box>
    </Box>
  </ResponsiveCard>
);

interface Props { currentAdmin: AdminProfile; }

export const EnhancedAdminPanel: React.FC<Props> = ({ currentAdmin }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [records, setRecords] = useState<ActivityRecord[]>([]);
  const [filtered, setFiltered] = useState<ActivityRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [stats, setStats] = useState({ totalRecords: 0, uniqueStudents: 0, uniqueActivities: 0, todayRecords: 0 });

  useEffect(() => { loadRecords(); }, [currentAdmin.department]);
  useEffect(() => { filterRecords(); calculateStats(); }, [records, filterText]);

  const loadRecords = async () => {
    setLoading(true);
    try {
      const data = currentAdmin.department === 'all'
        ? await getAllActivityRecords()
        : await getActivityRecordsByDepartment(currentAdmin.department);
      setRecords(data);
    } finally { setLoading(false); }
  };

  const filterRecords = () => {
    if (!filterText) { setFiltered(records); return; }
    const q = filterText.toLowerCase();
    setFiltered(records.filter(r =>
      r.activityCode.toLowerCase().includes(q) ||
      r.studentId.includes(filterText) ||
      r.firstName.toLowerCase().includes(q) ||
      r.lastName.toLowerCase().includes(q)
    ));
  };

  const calculateStats = () => {
    const uniqueStudents = new Set(records.map(r => r.studentId)).size;
    const uniqueActivities = new Set(records.map(r => r.activityCode)).size;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const todayRecords = records.filter(r => {
      const d = new Date(r.timestamp); d.setHours(0, 0, 0, 0);
      return d.getTime() === today.getTime();
    }).length;
    setStats({ totalRecords: records.length, uniqueStudents, uniqueActivities, todayRecords });
  };

  const exportToCSV = () => {
    const headers = ['วันที่/เวลา','รหัสนักศึกษา','ชื่อ','นามสกุล','สาขา','รหัสกิจกรรม'];
    const csv = [
      headers.join(','),
      ...filtered.map(r => [
        r.timestamp.toLocaleString('th-TH'),
        r.studentId,
        r.firstName,
        r.lastName,
        r.department,
        r.activityCode
      ].join(','))
    ].join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `activity_records_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const columns = [
    { id: 'timestamp', label: 'วันที่/เวลา', format: (v: Date) => (
      <Box><Typography variant="body2" fontWeight="medium">{v.toLocaleDateString('th-TH')}</Typography>
      <Typography variant="caption" color="text.secondary">{v.toLocaleTimeString('th-TH')}</Typography></Box>)},
    { id: 'studentId', label: 'รหัสนักศึกษา', format: (v: string) => (
      <Typography variant="body2" fontWeight="600" color="primary.main" sx={{ fontFamily: 'monospace' }}>{v}</Typography>)},
    { id: 'fullName', label: 'ชื่อ-นามสกุล', format: (_: any, row: any) => (
      <Typography variant="body2" fontWeight="medium">{row.firstName} {row.lastName}</Typography>)},
    { id: 'department', label: 'สาขา', format: (v: string) => (<Chip label={v} size="small" variant="outlined" color="secondary" />), hideOnMobile: true },
    { id: 'activityCode', label: 'รหัสกิจกรรม', format: (v: string) => (<Chip label={v} color="primary" size="small" sx={{ fontWeight: 700 }} />)},
  ];

  const renderActions = (_row: any) => (
    <Box sx={{ display: 'flex', gap: 1, justifyContent: isMobile ? 'flex-start' : 'center' }}>
      <Tooltip title="ดูรายละเอียด"><IconButton size="small" color="info"><ViewIcon /></IconButton></Tooltip>
      <Tooltip title="ลบ"><IconButton size="small" color="error"><DeleteIcon /></IconButton></Tooltip>
    </Box>
  );

  return (
    <ResponsiveContainer>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>จัดการข้อมูลการเข้าร่วมกิจกรรม</Typography>
        <Typography variant="body1" color="text.secondary">
          ดูและจัดการข้อมูลในสังกัด {DEPARTMENT_LABELS[currentAdmin.department] || currentAdmin.department}
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}><StatsCard title="รายการทั้งหมด" value={stats.totalRecords} icon={<EventIcon />} color="#1976d2" subtitle="บันทึกการเข้าร่วม" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatsCard title="นักศึกษา" value={stats.uniqueStudents} icon={<PeopleIcon />} color="#9c27b0" subtitle="คนที่เข้าร่วม" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatsCard title="กิจกรรม" value={stats.uniqueActivities} icon={<EventIcon />} color="#2e7d32" subtitle="กิจกรรมทั้งหมด" /></Grid>
        <Grid item xs={12} sm={6} md={3}><StatsCard title="วันนี้" value={stats.todayRecords} icon={<TodayIcon />} color="#ed6c02" subtitle="เข้าร่วมวันนี้" /></Grid>
      </Grid>

      <ResponsiveCard sx={{ mb: 3 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: { xs: 'stretch', md: 'center' },
          flexDirection: { xs: 'column', md: 'row' }, gap: 2 }}>
          <TextField
            size="small" label="ค้นหา" value={filterText} onChange={(e) => setFilterText(e.target.value)}
            placeholder="รหัสกิจกรรม, นักศึกษา, ชื่อ..." sx={{ minWidth: { xs: '100%', md: 300 } }}
            InputProps={{
              startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),
              endAdornment: filterText && (<InputAdornment position="end"><IconButton size="small" onClick={() => setFilterText('')}><ClearIcon /></IconButton></InputAdornment>)
            }}
          />
          <ButtonGroup variant="contained" size={isMobile ? 'medium' : 'small'}>
            <Button onClick={loadRecords} disabled={loading} startIcon={<RefreshIcon />}>รีเฟรช</Button>
            <Button onClick={exportToCSV} startIcon={<DownloadIcon />} color="success">ส่งออก</Button>
          </ButtonGroup>
        </Box>
      </ResponsiveCard>

      <ResponsiveCard>
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <EventIcon /> รายการลงทะเบียน
            <Chip label={`${filtered.length} รายการ`} color="primary" size="small" />
          </Typography>
        </Box>

        <ResponsiveTable
          columns={columns}
          data={filtered.map(r => ({ ...r, fullName: `${r.firstName} ${r.lastName}` }))}
          keyField="id"
          actions={renderActions}
          emptyMessage="ไม่มีข้อมูลการลงทะเบียน"
        />
      </ResponsiveCard>

      {isMobile && (
        <Fab color="primary" onClick={loadRecords} sx={{ position: 'fixed', bottom: 16, right: 16, zIndex: 1000 }}>
          <RefreshIcon />
        </Fab>
      )}
    </ResponsiveContainer>
  );
};
