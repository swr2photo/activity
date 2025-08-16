// components/admin/EnhancedQRGenerator.tsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  Typography,
  Button,
  Card,
  CardContent,
  CardMedia,
  Chip,
  IconButton,
  Switch,
  FormControlLabel,
  Tooltip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Paper,
  useTheme,
  useMediaQuery,
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  QrCode as QrCodeIcon,
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  LocationOn as LocationIcon,
} from '@mui/icons-material';
import { AdminProfile, DEPARTMENT_LABELS } from '../../types/admin';

interface Activity {
  id: string;
  activityName: string;
  activityCode: string;
  userCode: string;
  description?: string;
  bannerUrl?: string;
  location?: string;
  startDateTime: Date;
  endDateTime: Date;
  checkInRadius: number;
  maxParticipants: number;
  currentParticipants?: number;
  isActive: boolean;
  qrUrl: string;
}

import {
  getAllActivities as fetchAllActivities,
  getActivitiesByDepartment as fetchActivitiesByDepartment,
  toggleActivityLive, // ✅ ใช้ตัวใหม่
} from '../../lib/adminFirebase';

const ResponsiveContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Box sx={{ maxWidth: 1200, mx: 'auto', p: { xs: 2, md: 3 } }}>{children}</Box>
);

const ResponsiveCard: React.FC<{ children: React.ReactNode; sx?: any }> = ({ children, sx }) => (
  <Card sx={{ p: { xs: 2, md: 3 }, ...sx }}>
    <CardContent>{children}</CardContent>
  </Card>
);

export const EnhancedQRGenerator: React.FC<{ currentAdmin: AdminProfile; baseUrl: string }> = ({
  currentAdmin,
  baseUrl,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadActivities();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentAdmin.department]);

  const loadActivities = async () => {
    setLoading(true);
    try {
      let raw: any[];
      if (currentAdmin.department === 'all') {
        raw = await fetchAllActivities();
      } else {
        raw = await fetchActivitiesByDepartment(currentAdmin.department);
      }
      setActivities(raw.map(mapActivityRecord));
    } catch (e) {
      console.error('Error loading activities:', e);
      setActivities([]);
    } finally {
      setLoading(false);
    }
  };

  const mapActivityRecord = (record: any): Activity => ({
    id: record.id,
    activityName: record.activityName || '',
    activityCode: record.activityCode || '',
    userCode: record.userCode || '',
    description: record.description,
    bannerUrl: record.bannerUrl,
    location: record.location,
    startDateTime:
      record.startDateTime instanceof Date ? record.startDateTime : new Date(record.startDateTime || Date.now()),
    endDateTime:
      record.endDateTime instanceof Date ? record.endDateTime : new Date(record.endDateTime || Date.now()),
    checkInRadius: record.checkInRadius || 50,
    maxParticipants: record.maxParticipants || 0,
    currentParticipants: record.currentParticipants || 0,
    isActive: record.isActive ?? true,
    qrUrl: record.qrUrl || record.qrCode || '',
  });

  const getActivityStatus = (a: Activity) => {
    const now = new Date();
    if (!a.isActive) return { status: 'ปิดใช้งาน', color: 'error' as const };
    if (now < a.startDateTime) return { status: 'รอเปิด', color: 'warning' as const };
    if (now > a.endDateTime) return { status: 'สิ้นสุดแล้ว', color: 'default' as const };
    return { status: 'เปิดใช้งาน', color: 'success' as const };
  };

  return (
    <ResponsiveContainer>
      <Box sx={{ mb: 4, textAlign: { xs: 'center', md: 'left' } }}>
        <Typography
          variant="h4"
          gutterBottom
          sx={{ display: 'flex', alignItems: 'center', gap: 1, justifyContent: { xs: 'center', md: 'flex-start' } }}
        >
          <QrCodeIcon />
          จัดการ QR Code และกิจกรรม
        </Typography>
        <Typography variant="body1" color="text.secondary">
          สร้างและจัดการ QR Code สำหรับกิจกรรมในสังกัด {DEPARTMENT_LABELS[currentAdmin.department]}
        </Typography>
      </Box>

      <ResponsiveCard>
        <Box
          sx={{
            mb: 3,
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexDirection: { xs: 'column', sm: 'row' },
            gap: 2,
          }}
        >
          <Typography variant="h6">รายการกิจกรรมทั้งหมด ({activities.length} กิจกรรม)</Typography>
          <Button variant="contained" startIcon={<AddIcon />}>
            สร้างกิจกรรมใหม่
          </Button>
        </Box>

        {activities.length === 0 ? (
          <Box sx={{ textAlign: 'center,', py: 8 }}>
            <QrCodeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              ยังไม่มีกิจกรรมที่สร้างไว้
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              เริ่มต้นสร้างกิจกรรมแรกของคุณ
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />}>
              สร้างกิจกรรมใหม่
            </Button>
          </Box>
        ) : (
          <Box>
            {activities.map((activity) => {
              const statusInfo = getActivityStatus(activity);
              return (
                <Accordion key={activity.id} sx={{ mb: 2, borderRadius: 2, '&:before': { display: 'none' } }}>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    sx={{
                      bgcolor: 'grey.50',
                      borderRadius: 2,
                      '&.Mui-expanded': { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 },
                    }}
                  >
                    <Box
                      sx={{
                        display: 'flex',
                        alignItems: 'center',
                        width: '100%',
                        gap: 2,
                        flexDirection: { xs: 'column', sm: 'row' },
                        textAlign: { xs: 'center', sm: 'left' },
                      }}
                    >
                      {activity.bannerUrl && (
                        <Box
                          component="img"
                          src={activity.bannerUrl}
                          alt="Activity Banner"
                          sx={{
                            width: { xs: 80, sm: 60 },
                            height: { xs: 60, sm: 40 },
                            borderRadius: 1,
                            objectFit: 'cover',
                          }}
                        />
                      )}

                      <Box sx={{ flex: 1 }}>
                        <Typography variant="h6" sx={{ fontSize: { xs: '1rem', sm: '1.25rem' } }}>
                          {activity.activityName}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          รหัส: {activity.activityCode} | รหัสผู้ใช้: {activity.userCode}
                        </Typography>
                        {activity.location && (
                          <Typography
                            variant="caption"
                            color="text.secondary"
                            sx={{ display: 'flex', alignItems: 'center', gap: 0.5, justifyContent: { xs: 'center', sm: 'flex-start' } }}
                          >
                            <LocationIcon fontSize="small" />
                            {activity.location}
                          </Typography>
                        )}
                      </Box>

                      <Chip label={statusInfo.status} color={statusInfo.color} size={isMobile ? 'small' : 'medium'} />
                    </Box>
                  </AccordionSummary>

                  <AccordionDetails sx={{ bgcolor: 'background.paper' }}>
                    <Grid container spacing={3}>
                      <Grid item xs={12} md={8}>
                        {activity.bannerUrl && (
                          <CardMedia
                            component="img"
                            height={isMobile ? '150' : '200'}
                            image={activity.bannerUrl}
                            alt="Activity Banner"
                            sx={{ borderRadius: 2, mb: 2, objectFit: 'cover' }}
                          />
                        )}

                        <Box sx={{ mb: 3 }}>
                          <Typography variant="h6" gutterBottom>
                            รายละเอียดกิจกรรม
                          </Typography>
                          <Typography variant="body2" paragraph>
                            {activity.description || 'ไม่มีรายละเอียด'}
                          </Typography>

                          <Grid container spacing={2}>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                เริ่มกิจกรรม
                              </Typography>
                              <Typography variant="body2">{activity.startDateTime?.toLocaleString('th-TH')}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                สิ้นสุดกิจกรรม
                              </Typography>
                              <Typography variant="body2">{activity.endDateTime?.toLocaleString('th-TH')}</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                รัศมีเช็คอิน
                              </Typography>
                              <Typography variant="body2">{activity.checkInRadius} เมตร</Typography>
                            </Grid>
                            <Grid item xs={12} sm={6}>
                              <Typography variant="subtitle2" color="text.secondary">
                                ผู้เข้าร่วม
                              </Typography>
                              <Typography variant="body2">
                                {activity.currentParticipants || 0}
                                {activity.maxParticipants > 0 && `/${activity.maxParticipants}`} คน
                              </Typography>
                            </Grid>
                          </Grid>
                        </Box>
                      </Grid>

                      <Grid item xs={12} md={4}>
                        <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'grey.50' }}>
                          <Typography variant="h6" gutterBottom>
                            QR Code
                          </Typography>

                          <Box sx={{ mb: 2 }}>
                            <img
                              src={activity.qrUrl}
                              alt="QR Code"
                              style={{ width: isMobile ? 120 : 150, height: isMobile ? 120 : 150 }}
                            />
                          </Box>

                          <Box sx={{ mb: 2 }}>
                            <FormControlLabel
                              control={
                                <Switch
                                  checked={activity.isActive}
                                  onChange={async (_e, v) => {
                                    try {
                                      await toggleActivityLive(activity.id, v, currentAdmin); // ✅ realtime + version bump
                                      await loadActivities(); // อัปเดตฝั่งแอดมิน
                                    } catch (e) {
                                      console.error(e);
                                    }
                                  }}
                                  color="success"
                                />
                              }
                              label="เปิดใช้งาน"
                            />
                          </Box>

                          <Box sx={{ display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: 1 }}>
                            <Tooltip title="ดูรายละเอียด">
                              <IconButton color="info" size="small">
                                <ViewIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="แก้ไข">
                              <IconButton color="primary" size="small">
                                <EditIcon />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title="ลบ">
                              <IconButton color="error" size="small">
                                <DeleteIcon />
                              </IconButton>
                            </Tooltip>
                          </Box>
                        </Paper>
                      </Grid>
                    </Grid>
                  </AccordionDetails>
                </Accordion>
              );
            })}
          </Box>
        )}
      </ResponsiveCard>
    </ResponsiveContainer>
  );
};
