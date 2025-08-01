'use client';
import React from 'react';
import { 
  Container, 
  Typography, 
  Button, 
  Box, 
  Card, 
  CardContent, 
  Grid,
  Paper,
  List,
  ListItem,
  ListItemIcon,
  ListItemText
} from '@mui/material';
import { 
  QrCode as QrCodeIcon,
  AdminPanelSettings as AdminIcon,
  School as SchoolIcon,
  CheckCircle as CheckIcon,
  LocationOn as LocationIcon,
  Security as SecurityIcon 
} from '@mui/icons-material';
import Link from 'next/link';

const HomePage: React.FC = () => {
  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      <Box sx={{ textAlign: 'center', mb: 6 }}>
        <Typography variant="h3" component="h1" gutterBottom color="primary">
          ระบบบันทึกชั่วโมงกิจกรรม
        </Typography>
        <Typography variant="h6" component="p" color="text.secondary" sx={{ mb: 4 }}>
          ระบบลงทะเบียนเข้าร่วมกิจกรรมด้วย QR Code พร้อมการตรวจสอบตำแหน่ง GPS
        </Typography>
      </Box>

      <Grid container spacing={4} justifyContent="center">
        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', transition: '0.3s', '&:hover': { transform: 'translateY(-5px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 4 }}>
              <SchoolIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                สำหรับนักศึกษา
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                สแกน QR Code เพื่อลงทะเบียนเข้าร่วมกิจกรรม
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                ใช้กล้องโทรศัพท์สแกน QR Code ที่ได้รับจากแอดมิน
              </Typography>
              <Button
                variant="outlined"
                size="large"
                startIcon={<QrCodeIcon />}
                fullWidth
                disabled
              >
                สแกน QR Code จากกิจกรรม
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid item xs={12} md={6}>
          <Card sx={{ height: '100%', transition: '0.3s', '&:hover': { transform: 'translateY(-5px)' } }}>
            <CardContent sx={{ textAlign: 'center', p: 4 }}>
              <AdminIcon sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h5" gutterBottom>
                สำหรับแอดมิน
              </Typography>
              <Typography variant="body1" color="text.secondary" paragraph>
                จัดการระบบและสร้าง QR Code สำหรับกิจกรรม
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                ตั้งค่าตำแหน่ง สร้าง QR Code และดูรายงาน
              </Typography>
              <Link href="/admin" style={{ textDecoration: 'none' }}>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<AdminIcon />}
                  fullWidth
                >
                  เข้าสู่ Admin Panel
                </Button>
              </Link>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Features Section */}
      <Box sx={{ mt: 8 }}>
        <Typography variant="h4" textAlign="center" gutterBottom>
          คุณสมบัติของระบบ
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }}>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
              <QrCodeIcon sx={{ fontSize: 50, color: 'primary.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                QR Code Scanning
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="สแกนง่าย รวดเร็ว" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="สร้าง QR Code อัตโนมัติ" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="รองรับทุกอุปกรณ์" />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
              <LocationIcon sx={{ fontSize: 50, color: 'info.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                GPS Location Check
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="ตรวจสอบตำแหน่งจริง" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="กำหนดรัศมีได้" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="ป้องกันการโกง" />
                </ListItem>
              </List>
            </Paper>
          </Grid>

          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 3, textAlign: 'center', height: '100%' }}>
              <SecurityIcon sx={{ fontSize: 50, color: 'warning.main', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Security Features
              </Typography>
              <List dense>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="รหัสป้องกันบอต" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="ตรวจสอบข้อมูลซ้ำ" />
                </ListItem>
                <ListItem>
                  <ListItemIcon>
                    <CheckIcon color="success" />
                  </ListItemIcon>
                  <ListItemText primary="บันทึกเวลาจริง" />
                </ListItem>
              </List>
            </Paper>
          </Grid>
        </Grid>
      </Box>

      {/* Instructions */}
      <Box sx={{ mt: 8 }}>
        <Typography variant="h4" textAlign="center" gutterBottom>
          วิธีการใช้งาน
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="primary">
                  สำหรับแอดมิน
                </Typography>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>เข้าสู่ Admin Panel</li>
                  <li>ตั้งค่าตำแหน่ง GPS และรัศมีที่อนุญาต</li>
                  <li>กำหนดรหัสแอดมินสำหรับป้องกันบอต</li>
                  <li>สร้าง QR Code สำหรับกิจกรรม</li>
                  <li>แจก QR Code ให้นักศึกษา</li>
                  <li>ตรวจสอบรายงานการเข้าร่วม</li>
                </ol>
              </CardContent>
            </Card>
          </Grid>

          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom color="secondary">
                  สำหรับนักศึกษา
                </Typography>
                <ol style={{ margin: 0, paddingLeft: 20 }}>
                  <li>สแกน QR Code ด้วยกล้องโทรศัพท์</li>
                  <li>กรอกข้อมูลส่วนตัว (รหัสนักศึกษา, ชื่อ-นามสกุล, สาขา)</li>
                  <li>ใส่รหัสที่ได้รับจากแอดมิน</li>
                  <li>อนุญาตการเข้าถึงตำแหน่ง GPS</li>
                  <li>รอการตรวจสอบตำแหน่ง</li>
                  <li>รับการยืนยันการลงทะเบียนสำเร็จ</li>
                </ol>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </Box>

      {/* Footer */}
      <Box sx={{ mt: 8, py: 4, textAlign: 'center', borderTop: 1, borderColor: 'divider' }}>
        <Typography variant="body2" color="text.secondary">
          ระบบบันทึกชั่วโมงกิจกรรม | พัฒนาด้วย Next.js 15 + Material-UI + Firebase
        </Typography>
      </Box>
    </Container>
  );
};

export default HomePage;

