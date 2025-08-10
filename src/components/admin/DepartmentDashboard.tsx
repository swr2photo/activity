// components/admin/DepartmentDashboard.tsx
'use client';

import React, { useEffect, useState } from 'react';
import {
  Box, Typography, Grid, Card, CardContent, Avatar, List, ListItem,
  ListItemAvatar, ListItemText, Divider, Container, Chip
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Event as EventIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { AdminProfile, DEPARTMENT_LABELS, type AdminDepartment } from '../../types/admin';
import {
  getActivitiesByDepartment,
  getActivityRecordsByDepartment,
  getUsersByDepartment,
  type Activity
} from '../../lib/adminFirebase';

interface DepartmentDashboardProps {
  currentAdmin: AdminProfile;
}

interface DashboardData {
  totalActivities: number;
  activeActivities: number;
  totalParticipants: number;
  todayParticipants: number;
  recentActivities: Activity[];
  topActivities: (Activity & { participantCount: number })[];
}

const ResponsiveCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column', boxShadow: 2, '&:hover': { boxShadow: 4 } }}>
    <CardContent sx={{ flexGrow: 1 }}>{children}</CardContent>
  </Card>
);

const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Container maxWidth="xl" sx={{ py: 3 }}>{children}</Container>
);

// compare day (ไม่แก้ object เดิม)
const isSameDay = (a?: Date, b?: Date) => {
  if (!a || !b) return false;
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
};

const getDepartmentDashboardData = async (department: AdminDepartment): Promise<DashboardData> => {
  const [activities, activityRecords, users] = await Promise.all([
    getActivitiesByDepartment(department),
    getActivityRecordsByDepartment(department),
    getUsersByDepartment(department),
  ]);

  const totalActivities = activities.length;
  const activeActivities = activities.filter((a) => a.isActive).length;
  const totalParticipants = users.length;

  const today = new Date();
  const todayParticipants = activityRecords.filter((r) => isSameDay(r.timestamp, today)).length;

  // สร้างแผนที่ activityCode -> จำนวน record เพื่อคำนวณ top
  const countsByCode = activityRecords.reduce((acc, r) => {
    const code = r.activityCode || '';
    acc[code] = (acc[code] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  // กิจกรรมล่าสุด: sort ตาม createdAt (fallback เป็น startDateTime/endDateTime)
  const createdTime = (a: Activity) =>
    a.createdAt?.getTime() ??
    a.startDateTime?.getTime() ??
    a.endDateTime?.getTime() ??
    0;

  const recentActivities = [...activities]
    .sort((a, b) => createdTime(b) - createdTime(a))
    .slice(0, 5);

  // Top โดยนับจาก activityCode
  const topActivities = activities
    .map((a) => ({
      ...a,
      participantCount: countsByCode[a.activityCode] || 0,
    }))
    .sort((a, b) => b.participantCount - a.participantCount)
    .slice(0, 5);

  return { totalActivities, activeActivities, totalParticipants, todayParticipants, recentActivities, topActivities };
};

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ currentAdmin }) => {
  const [data, setData] = useState<DashboardData>({
    totalActivities: 0,
    activeActivities: 0,
    totalParticipants: 0,
    todayParticipants: 0,
    recentActivities: [],
    topActivities: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setError(null);
        const result = await getDepartmentDashboardData(currentAdmin.department);
        setData(result);
      } catch (e: any) {
        setError(e?.message || 'ไม่สามารถดึงข้อมูลแดชบอร์ดได้');
      } finally {
        setLoading(false);
      }
    })();
  }, [currentAdmin.department]);

  if (loading) {
    return (
      <ResponsiveContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10 }}>กำลังโหลดข้อมูล...</Box>
      </ResponsiveContainer>
    );
  }

  if (error) {
    return (
      <ResponsiveContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 10, color: 'error.main' }}>{error}</Box>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon /> แดชบอร์ด {DEPARTMENT_LABELS[currentAdmin.department] ?? currentAdmin.department}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          ภาพรวมกิจกรรมและผู้เข้าร่วมในสังกัดของคุณ
        </Typography>
      </Box>

      {/* KPIs */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}><EventIcon /></Avatar>
              <Box>
                <Typography variant="h4" color="primary.main">{data.totalActivities}</Typography>
                <Typography variant="body2">กิจกรรมทั้งหมด</Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'success.main' }}><TrendingUpIcon /></Avatar>
              <Box>
                <Typography variant="h4" color="success.main">{data.activeActivities}</Typography>
                <Typography variant="body2">กิจกรรมที่เปิดอยู่</Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'info.main' }}><PeopleIcon /></Avatar>
              <Box>
                <Typography variant="h4" color="info.main">{data.totalParticipants}</Typography>
                <Typography variant="body2">ผู้เข้าร่วมทั้งหมด</Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>

        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main' }}><TrendingUpIcon /></Avatar>
              <Box>
                <Typography variant="h4" color="warning.main">{data.todayParticipants}</Typography>
                <Typography variant="body2">เข้าร่วมวันนี้</Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>
      </Grid>

      <Grid container spacing={3}>
        {/* Recent activities */}
        <Grid item xs={12} md={6}>
          <ResponsiveCard>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventIcon /> กิจกรรมล่าสุด
            </Typography>

            {data.recentActivities.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                ยังไม่มีกิจกรรม
              </Typography>
            ) : (
              <List>
                {data.recentActivities.map((a, i) => (
                  <React.Fragment key={a.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {(a.activityName || '?').charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={a.activityName}
                        secondary={`${a.currentParticipants ?? 0} คน | ${a.createdAt?.toLocaleDateString('th-TH') ?? 'ไม่ระบุวันที่'}`}
                      />
                      <Chip label={a.isActive ? 'เปิด' : 'ปิด'} color={a.isActive ? 'success' : 'default'} size="small" />
                    </ListItem>
                    {i < data.recentActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </ResponsiveCard>
        </Grid>

        {/* Top activities */}
        <Grid item xs={12} md={6}>
          <ResponsiveCard>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon /> กิจกรรมยอดนิยม
            </Typography>

            {data.topActivities.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                ยังไม่มีกิจกรรม
              </Typography>
            ) : (
              <List>
                {data.topActivities.map((a, i) => (
                  <React.Fragment key={a.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'success.main' }}>{i + 1}</Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={a.activityName}
                        secondary={`${a.participantCount} ผู้เข้าร่วม`}
                      />
                      <Typography variant="h6" color="success.main">#{i + 1}</Typography>
                    </ListItem>
                    {i < data.topActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </ResponsiveCard>
        </Grid>
      </Grid>
    </ResponsiveContainer>
  );
};

// ให้มี default export ด้วย ป้องกันปัญหาการ import ต่างรูปแบบ
export default DepartmentDashboard;
