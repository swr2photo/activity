// components/admin/DepartmentDashboard.tsx
import React, { useState, useEffect } from 'react';
import { 
  Box, 
  Typography, 
  Grid,
  Card,
  CardContent,
  Chip,
  Avatar,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Divider,
  Container
} from '@mui/material';
import {
  TrendingUp as TrendingUpIcon,
  People as PeopleIcon,
  Event as EventIcon,
  Assessment as AssessmentIcon
} from '@mui/icons-material';
import { AdminProfile, DEPARTMENT_LABELS } from '../../types/admin';
import { 
  getActivitiesByDepartment, 
  getActivityRecordsByDepartment,
  getUsersByDepartment 
} from '../../lib/adminFirebase';

interface DepartmentDashboardProps {
  currentAdmin: AdminProfile;
}

interface DashboardData {
  totalActivities: number;
  activeActivities: number;
  totalParticipants: number;
  todayParticipants: number;
  recentActivities: any[];
  topActivities: any[];
}

// ResponsiveCard component (inline definition)
const ResponsiveCard: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Card sx={{ 
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 2,
    '&:hover': { boxShadow: 4 }
  }}>
    <CardContent sx={{ flexGrow: 1 }}>
      {children}
    </CardContent>
  </Card>
);

// ResponsiveContainer component (inline definition)
const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Container maxWidth="xl" sx={{ py: 3 }}>
    {children}
  </Container>
);

// Dashboard data fetching function
const getDepartmentDashboardData = async (department: string): Promise<DashboardData> => {
  try {
    // Fetch activities for the department
    const activities = await getActivitiesByDepartment(department);
    const activityRecords = await getActivityRecordsByDepartment(department);
    const users = await getUsersByDepartment(department);

    // Calculate statistics
    const totalActivities = activities.length;
    const activeActivities = activities.filter(activity => activity.isActive).length;
    const totalParticipants = users.length;
    
    // Calculate today's participants
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayParticipants = activityRecords.filter(record => {
      const recordDate = record.timestamp?.toDate?.() || new Date(record.timestamp);
      return recordDate >= today;
    }).length;

    // Get recent activities (last 5)
    const recentActivities = activities
      .slice(0, 5)
      .map(activity => ({
        ...activity,
        participantCount: activityRecords.filter(record => record.activityName === activity.activityName).length
      }));

    // Get top activities by participation
    const activityParticipation = activities.map(activity => ({
      ...activity,
      participantCount: activityRecords.filter(record => record.activityName === activity.activityName).length
    }));
    
    const topActivities = activityParticipation
      .sort((a, b) => b.participantCount - a.participantCount)
      .slice(0, 5);

    return {
      totalActivities,
      activeActivities,
      totalParticipants,
      todayParticipants,
      recentActivities,
      topActivities
    };
  } catch (error) {
    console.error('Error fetching dashboard data:', error);
    throw new Error('ไม่สามารถดึงข้อมูลแดชบอร์ดได้');
  }
};

export const DepartmentDashboard: React.FC<DepartmentDashboardProps> = ({ currentAdmin }) => {
  const [dashboardData, setDashboardData] = useState<DashboardData>({
    totalActivities: 0,
    activeActivities: 0,
    totalParticipants: 0,
    todayParticipants: 0,
    recentActivities: [],
    topActivities: []
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDashboardData();
  }, [currentAdmin.department]);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getDepartmentDashboardData(currentAdmin.department);
      setDashboardData(data);
    } catch (error: any) {
      console.error('Error loading dashboard data:', error);
      setError(error.message || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ResponsiveContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Typography>กำลังโหลดข้อมูล...</Typography>
        </Box>
      </ResponsiveContainer>
    );
  }

  if (error) {
    return (
      <ResponsiveContainer>
        <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
          <Typography color="error">{error}</Typography>
        </Box>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AssessmentIcon />
          แดชบอร์ด {DEPARTMENT_LABELS[currentAdmin.department]}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          ภาพรวมกิจกรรมและผู้เข้าร่วมในสังกัดของคุณ
        </Typography>
      </Box>

      {/* Statistics Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'primary.main' }}>
                <EventIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" color="primary.main">
                  {dashboardData.totalActivities}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  กิจกรรมทั้งหมด
                </Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'success.main' }}>
                <TrendingUpIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" color="success.main">
                  {dashboardData.activeActivities}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  กิจกรรมที่เปิดอยู่
                </Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'info.main' }}>
                <PeopleIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" color="info.main">
                  {dashboardData.totalParticipants}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  ผู้เข้าร่วมทั้งหมด
                </Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <ResponsiveCard>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Avatar sx={{ bgcolor: 'warning.main' }}>
                <TrendingUpIcon />
              </Avatar>
              <Box>
                <Typography variant="h4" color="warning.main">
                  {dashboardData.todayParticipants}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  เข้าร่วมวันนี้
                </Typography>
              </Box>
            </Box>
          </ResponsiveCard>
        </Grid>
      </Grid>

      {/* Recent Activities and Top Activities */}
      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <ResponsiveCard>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <EventIcon />
              กิจกรรมล่าสุด
            </Typography>
            {dashboardData.recentActivities.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                ยังไม่มีกิจกรรม
              </Typography>
            ) : (
              <List>
                {dashboardData.recentActivities.map((activity: any, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'primary.main' }}>
                          {activity.activityName.charAt(0)}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.activityName}
                        secondary={`${activity.participantCount} คน | ${activity.createdAt?.toDate?.()?.toLocaleDateString('th-TH') || 'ไม่ระบุวันที่'}`}
                      />
                      <Chip
                        label={activity.isActive ? 'เปิด' : 'ปิด'}
                        color={activity.isActive ? 'success' : 'default'}
                        size="small"
                      />
                    </ListItem>
                    {index < dashboardData.recentActivities.length - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </List>
            )}
          </ResponsiveCard>
        </Grid>
        
        <Grid item xs={12} md={6}>
          <ResponsiveCard>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon />
              กิจกรรมยอดนิยม
            </Typography>
            {dashboardData.topActivities.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ textAlign: 'center', py: 3 }}>
                ยังไม่มีกิจกรรม
              </Typography>
            ) : (
              <List>
                {dashboardData.topActivities.map((activity: any, index) => (
                  <React.Fragment key={activity.id}>
                    <ListItem>
                      <ListItemAvatar>
                        <Avatar sx={{ bgcolor: 'success.main' }}>
                          {index + 1}
                        </Avatar>
                      </ListItemAvatar>
                      <ListItemText
                        primary={activity.activityName}
                        secondary={`${activity.participantCount} ผู้เข้าร่วม`}
                      />
                      <Typography variant="h6" color="success.main">
                        #{index + 1}
                      </Typography>
                    </ListItem>
                    {index < dashboardData.topActivities.length - 1 && <Divider />}
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