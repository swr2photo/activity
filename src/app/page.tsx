'use client';
import React from 'react';
import Link from 'next/link';
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Container,
  Divider,
  Grid,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
  Avatar,
} from '@mui/material';
import { useTheme, alpha } from '@mui/material/styles';
import {
  AdminPanelSettings as AdminIcon,
  CheckCircle as CheckIcon,
  LocationOn as LocationIcon,
  QrCode as QrCodeIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';

const HomePage: React.FC = () => {
  const theme = useTheme();

  const adminSteps = [
    'เข้าสู่ Admin Panel',
    'ตั้งค่าตำแหน่ง GPS และรัศมีที่อนุญาต',
    'กำหนดรหัสแอดมินสำหรับป้องกันบอต',
    'สร้าง QR Code สำหรับกิจกรรม',
    'แจก QR Code ให้นักศึกษา',
    'ตรวจสอบรายงานการเข้าร่วม',
  ];

  const studentSteps = [
    'สแกน QR Code ด้วยกล้องโทรศัพท์',
    'กรอกข้อมูลส่วนตัว (รหัสนักศึกษา, ชื่อ-นามสกุล, สาขา)',
    'ใส่รหัสที่ได้รับจากแอดมิน',
    'อนุญาตการเข้าถึงตำแหน่ง GPS',
    'รอการตรวจสอบตำแหน่ง',
    'รับการยืนยันการลงทะเบียนสำเร็จ',
  ];

  return (
    <Box
      sx={{
        position: 'relative',
        minHeight: '100vh',
        pb: 8,
        background: `radial-gradient(1200px 600px at 100% -50%, ${alpha(
          theme.palette.primary.main,
          0.12
        )}, transparent 60%), radial-gradient(900px 500px at -10% -20%, ${alpha(
          theme.palette.secondary.main,
          0.12
        )}, transparent 60%), linear-gradient(180deg, ${alpha(
          theme.palette.background.paper,
          1
        )}, ${alpha(theme.palette.background.default, 1)})`,
      }}
    >
      {/* HERO */}
      <Container maxWidth="lg" sx={{ pt: { xs: 6, md: 10 } }}>
        <Box
          sx={{
            textAlign: 'center',
            mb: 6,
          }}
        >
          <Chip
            label="เวอร์ชันทดลองใช้งาน"
            size="small"
            sx={{
              mb: 2,
              borderRadius: 2,
              bgcolor: alpha(theme.palette.primary.main, 0.08),
              color: theme.palette.primary.main,
            }}
          />
          <Typography
            variant="h3"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 800,
              letterSpacing: -0.5,
            }}
            color="text.primary"
          >
            ระบบบันทึกชั่วโมงกิจกรรม
          </Typography>
          <Typography
            variant="h6"
            component="p"
            color="text.secondary"
            sx={{ maxWidth: 760, mx: 'auto' }}
          >
            ลงทะเบียนเข้าร่วมกิจกรรมด้วย QR Code พร้อมตรวจสอบตำแหน่ง GPS แบบเรียลไทม์
            ป้องกันการโกง และดูรายงานได้ทันที
          </Typography>

          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="center" sx={{ mt: 4 }}>
            <Button
              size="large"
              variant="contained"
              startIcon={<AdminIcon />}
              component={Link}
              href="/admin"
            >
              เข้าสู่ Admin Panel
            </Button>
            <Button size="large" variant="outlined" startIcon={<QrCodeIcon />} disabled>
              สแกน QR Code จากกิจกรรม
            </Button>
          </Stack>
        </Box>

        {/* CTA CARDS */}
        <Grid container spacing={3} justifyContent="center">
          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
                p: 1,
                borderRadius: 4,
                background: `linear-gradient(180deg, ${alpha(
                  theme.palette.primary.main,
                  0.18
                )}, ${alpha(theme.palette.primary.main, 0)} 60%)`,
                boxShadow: `0 10px 30px ${alpha(theme.palette.primary.main, 0.12)}`,
                transition: 'transform .25s ease, box-shadow .25s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 16px 40px ${alpha(theme.palette.primary.main, 0.18)}`,
                },
              }}
              elevation={0}
            >
              <CardContent sx={{ textAlign: 'center', p: { xs: 3, md: 4 } }}>
                <QrCodeIcon sx={{ fontSize: 60, color: 'primary.main', mb: 1 }} />
                <Typography variant="h5" gutterBottom fontWeight={700}>
                  สำหรับนักศึกษา
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  สแกน QR Code เพื่อลงทะเบียนเข้าร่วมกิจกรรม
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  ใช้กล้องโทรศัพท์สแกน QR Code ที่ได้รับจากแอดมิน
                </Typography>
                <Button variant="outlined" size="large" startIcon={<QrCodeIcon />} fullWidth disabled>
                  สแกน QR Code จากกิจกรรม
                </Button>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card
              sx={{
                height: '100%',
                p: 1,
                borderRadius: 4,
                background: `linear-gradient(180deg, ${alpha(
                  theme.palette.secondary.main,
                  0.18
                )}, ${alpha(theme.palette.secondary.main, 0)} 60%)`,
                boxShadow: `0 10px 30px ${alpha(theme.palette.secondary.main, 0.12)}`,
                transition: 'transform .25s ease, box-shadow .25s ease',
                '&:hover': {
                  transform: 'translateY(-4px)',
                  boxShadow: `0 16px 40px ${alpha(theme.palette.secondary.main, 0.18)}`,
                },
              }}
              elevation={0}
            >
              <CardContent sx={{ textAlign: 'center', p: { xs: 3, md: 4 } }}>
                <AdminIcon sx={{ fontSize: 60, color: 'secondary.main', mb: 1 }} />
                <Typography variant="h5" gutterBottom fontWeight={700}>
                  สำหรับแอดมิน
                </Typography>
                <Typography variant="body1" color="text.secondary" paragraph>
                  จัดการระบบและสร้าง QR Code สำหรับกิจกรรม
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                  ตั้งค่าตำแหน่ง สร้าง QR Code และดูรายงาน
                </Typography>
                <Button variant="contained" size="large" startIcon={<AdminIcon />} fullWidth component={Link} href="/admin">
                  เข้าสู่ Admin Panel
                </Button>
              </CardContent>
            </Card>
          </Grid>
        </Grid>

        {/* FEATURES */}
        <Box sx={{ mt: 8 }}>
          <Typography variant="h4" textAlign="center" gutterBottom fontWeight={800}>
            คุณสมบัติของระบบ
          </Typography>
          <Typography variant="body1" color="text.secondary" textAlign="center" sx={{ maxWidth: 780, mx: 'auto', mb: 4 }}>
            ออกแบบมาเพื่อความรวดเร็ว ปลอดภัย และใช้งานง่ายในทุกอุปกรณ์
          </Typography>

          <Grid container spacing={3}>
            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: alpha(theme.palette.primary.main, 0.02),
                }}
              >
                <QrCodeIcon sx={{ fontSize: 50, color: 'primary.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  QR Code Scanning
                </Typography>
                <List dense>
                  {['สแกนง่าย รวดเร็ว', 'สร้าง QR Code อัตโนมัติ', 'รองรับทุกอุปกรณ์'].map((t) => (
                    <ListItem key={t} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={t} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: alpha(theme.palette.info.main, 0.02),
                }}
              >
                <LocationIcon sx={{ fontSize: 50, color: 'info.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  GPS Location Check
                </Typography>
                <List dense>
                  {['ตรวจสอบตำแหน่งจริง', 'กำหนดรัศมีได้', 'ป้องกันการโกง'].map((t) => (
                    <ListItem key={t} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={t} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>

            <Grid item xs={12} md={4}>
              <Paper
                elevation={0}
                sx={{
                  p: 3,
                  textAlign: 'center',
                  height: '100%',
                  borderRadius: 3,
                  border: '1px solid',
                  borderColor: 'divider',
                  background: alpha(theme.palette.warning.main, 0.02),
                }}
              >
                <SecurityIcon sx={{ fontSize: 50, color: 'warning.main', mb: 1 }} />
                <Typography variant="h6" gutterBottom fontWeight={700}>
                  Security Features
                </Typography>
                <List dense>
                  {['รหัสป้องกันบอต', 'ตรวจสอบข้อมูลซ้ำ', 'บันทึกเวลาจริง'].map((t) => (
                    <ListItem key={t} sx={{ px: 0 }}>
                      <ListItemIcon>
                        <CheckIcon color="success" />
                      </ListItemIcon>
                      <ListItemText primary={t} />
                    </ListItem>
                  ))}
                </List>
              </Paper>
            </Grid>
          </Grid>
        </Box>

        {/* HOW TO */}
        <Box sx={{ mt: 8 }}>
          <Typography variant="h4" textAlign="center" gutterBottom fontWeight={800}>
            วิธีการใช้งาน
          </Typography>

          <Grid container spacing={3} sx={{ mt: 2 }}>
            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="primary" fontWeight={800}>
                    สำหรับแอดมิน
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {adminSteps.map((step, i) => (
                      <ListItem key={step} sx={{ px: 0 }}>
                        <Avatar sx={{ width: 28, height: 28, mr: 2, fontSize: 14 }}>{i + 1}</Avatar>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>

            <Grid item xs={12} md={6}>
              <Card elevation={0} sx={{ borderRadius: 3, border: '1px solid', borderColor: 'divider' }}>
                <CardContent>
                  <Typography variant="h6" gutterBottom color="secondary" fontWeight={800}>
                    สำหรับนักศึกษา
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  <List>
                    {studentSteps.map((step, i) => (
                      <ListItem key={step} sx={{ px: 0 }}>
                        <Avatar sx={{ width: 28, height: 28, mr: 2, fontSize: 14 }}>{i + 1}</Avatar>
                        <ListItemText primary={step} />
                      </ListItem>
                    ))}
                  </List>
                </CardContent>
              </Card>
            </Grid>
          </Grid>
        </Box>

        {/* FOOTER */}
        <Box sx={{ mt: 8, py: 4, textAlign: 'center', borderTop: '1px solid', borderColor: 'divider' }}>
          
        </Box>
      </Container>
    </Box>
  );
};

export default HomePage;
