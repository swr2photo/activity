'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Container,
  Stack,
  Typography,
  IconButton,
  useTheme,
  Divider,
} from '@mui/material';
import Grid from '@mui/material/Grid'; // MUI v6 จะใช้ Grid v2 อัตโนมัติ
import { alpha } from '@mui/material/styles';
import { Facebook, Instagram, Mail, Phone } from '@mui/icons-material';

const Footer: React.FC = () => {
  const theme = useTheme();

  const socialLinks = [
    { icon: Facebook, url: 'https://www.facebook.com/psuscc', color: '#1877F2' },
    { icon: Instagram, url: 'https://www.instagram.com/psuscc', color: '#E4405F' },
    { icon: Mail, url: 'mailto:psuscc@psu.ac.th', color: theme.palette.primary.main },
    { icon: Phone, url: 'tel:+66-81-2345678', color: theme.palette.primary.main },
  ];

  return (
    <Box
      component="footer"
      sx={{
        // ✨ Apple Glassmorphism Style
        backdropFilter: 'blur(20px) saturate(180%)',
        WebkitBackdropFilter: 'blur(20px) saturate(180%)',
        backgroundColor: alpha(theme.palette.background.default, 0.8),
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.08)}`,
        // pb: 12 สำหรับมือถือ เพื่อไม่ให้โดน Bottom Navbar บังเนื้อหา
        pb: { xs: 12, sm: 4 }, 
        pt: 6,
        mt: 'auto',
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="space-between">
          {/* Brand Section */}
          <Grid size={{ xs: 12, md: 5 }}>
            <Stack spacing={1.5} alignItems={{ xs: 'center', md: 'flex-start' }}>
              <Typography
                variant="h6"
                sx={{
                  fontWeight: 900,
                  letterSpacing: -0.5,
                  color: 'text.primary',
                }}
              >
                PSU REGISTER
              </Typography>
              <Typography
                variant="body2"
                color="text.secondary"
                sx={{ 
                  maxWidth: 320, 
                  textAlign: { xs: 'center', md: 'left' },
                  lineHeight: 1.6 
                }}
              >
                ระบบลงทะเบียนกิจกรรมชุมนุม คณะวิทยาศาสตร์ <br />
                มหาวิทยาลัยสงขลานครินทร์
              </Typography>
            </Stack>
          </Grid>

          {/* Social & Contact Section */}
          <Grid size={{ xs: 12, md: 4 }}>
            <Stack spacing={2} alignItems={{ xs: 'center', md: 'flex-end' }}>
              <Stack direction="row" spacing={1}>
                {socialLinks.map(({ icon: Icon, url, color }, index) => (
                  <IconButton
                    key={index}
                    component="a"
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    sx={{
                      color: 'text.secondary',
                      bgcolor: alpha(theme.palette.divider, 0.05),
                      transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
                      '&:hover': {
                        color: color,
                        transform: 'translateY(-3px)',
                        bgcolor: alpha(color, 0.1),
                      },
                    }}
                  >
                    <Icon fontSize="small" />
                  </IconButton>
                ))}
              </Stack>
              <Typography 
                variant="caption" 
                color="text.disabled"
                sx={{ textAlign: { xs: 'center', md: 'right' } }}
              >
                ติดต่อเจ้าหน้าที่: 081-234-5678 (ในเวลาราชการ)
              </Typography>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: 4, opacity: 0.5 }} />

        {/* Bottom Bar */}
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          justifyContent="space-between"
          alignItems="center"
          spacing={2}
        >
          <Typography variant="caption" color="text.disabled" sx={{ order: { xs: 2, sm: 1 } }}>
            © {new Date().getFullYear()} Prince of Songkla University.
          </Typography>
          
          <Stack direction="row" spacing={3} sx={{ order: { xs: 1, sm: 2 } }}>
            {/* ✅ ใช้ Typography + component={Link} เพื่อรองรับ Next.js 16 และ MUI v6 */}
            <Typography
              component={Link}
              href="/privacy"
              variant="caption"
              sx={{ 
                color: 'text.disabled', 
                textDecoration: 'none', 
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' } 
              }}
            >
              ความเป็นส่วนตัว
            </Typography>

            <Typography
              component={Link}
              href="/admin"
              variant="caption"
              sx={{ 
                color: 'text.disabled', 
                textDecoration: 'none', 
                cursor: 'pointer',
                '&:hover': { color: 'primary.main' } 
              }}
            >
              สำหรับแอดมิน
            </Typography>
          </Stack>
        </Stack>
      </Container>
    </Box>
  );
};

export default Footer;