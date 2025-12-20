'use client';

import React from 'react';
import {
  Box,
  Container,
  Stack,
  Typography,
  Link as MuiLink,
  IconButton,
  useTheme,
  useMediaQuery,
  Divider,
} from '@mui/material';
import Grid from '@mui/material/Grid';
import { alpha } from '@mui/material/styles';
import { Facebook, Instagram, Mail, Phone } from '@mui/icons-material';

const Footer: React.FC = () => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const socialLinks = [
    { icon: Facebook, label: 'Facebook', url: 'https://www.facebook.com/psuscc', color: '#1877F2' },
    { icon: Instagram, label: 'Instagram', url: 'https://www.instagram.com/psuscc', color: '#E4405F' },
    { icon: Mail, label: 'Email', url: 'mailto:psuscc@psu.ac.th', color: theme.palette.primary.main },
    { icon: Phone, label: 'Phone', url: 'tel:+66-81-2345678', color: theme.palette.primary.main },
  ];

  return (
    <Box
      component="footer"
      sx={{
        background:
          theme.palette.mode === 'dark'
            ? `linear-gradient(135deg, ${alpha('#ffffff', 0.02)}, ${alpha('#ffffff', 0.01)})`
            : `linear-gradient(135deg, ${alpha('#000000', 0.02)}, ${alpha('#000000', 0.01)})`,
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderTop: `1px solid ${alpha(theme.palette.divider, 0.1)}`,
        mt: { xs: 4, md: 6 },
        py: { xs: 3, md: 4 },
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={{ xs: 2, md: 4 }}>
          {/* Brand & Description */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={1}>
              <Typography
                variant="h6"
                fontWeight={950}
                sx={{
                  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.secondary.main})`,
                  backgroundClip: 'text',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  fontSize: isMobile ? '1rem' : '1.25rem',
                }}
              >
                PSU SCC
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
                ศูนย์วิทยาศาสตร์ราชภัฏสงขลา
              </Typography>
            </Stack>
          </Grid>

          {/* Quick Links */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" fontWeight={950} sx={{ fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
                ลิงก์อื่น
              </Typography>
              <Stack spacing={0.75}>
                {[
                  { label: 'หน้าแรก', href: '/' },
                  { label: 'ลงทะเบียน', href: '/register' },
                  { label: 'เกี่ยวกับเรา', href: '/about' },
                ].map((link) => (
                  <MuiLink
                    key={link.href}
                    href={link.href}
                    sx={{
                      color: 'text.secondary',
                      textDecoration: 'none',
                      fontSize: isMobile ? '0.8rem' : '0.875rem',
                      transition: 'color .2s',
                      '&:hover': { color: 'primary.main' },
                    }}
                  >
                    {link.label}
                  </MuiLink>
                ))}
              </Stack>
            </Stack>
          </Grid>

          {/* Contact Info */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" fontWeight={950} sx={{ fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
                ติดต่อเรา
              </Typography>
              <Stack spacing={1}>
                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Phone sx={{ fontSize: isMobile ? '1rem' : '1.25rem', color: 'primary.main', mt: 0.25 }} />
                  <Typography variant="body2" color="text.secondary" sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem' }}>
                    +66-81-2345678
                  </Typography>
                </Box>

                <Box sx={{ display: 'flex', gap: 1, alignItems: 'flex-start' }}>
                  <Mail sx={{ fontSize: isMobile ? '1rem' : '1.25rem', color: 'primary.main', mt: 0.25 }} />
                  <Typography
                    variant="body2"
                    color="text.secondary"
                    sx={{ fontSize: isMobile ? '0.8rem' : '0.875rem', wordBreak: 'break-all' }}
                  >
                    psuscc@psu.ac.th
                  </Typography>
                </Box>
              </Stack>
            </Stack>
          </Grid>

          {/* Social Links */}
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <Stack spacing={1}>
              <Typography variant="subtitle2" fontWeight={950} sx={{ fontSize: isMobile ? '0.85rem' : '0.95rem' }}>
                ติดตามเรา
              </Typography>
              <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
                {socialLinks.map(({ icon: Icon, label, url, color }) => (
                  <IconButton
                    key={label}
                    component={MuiLink}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    size={isMobile ? 'small' : 'medium'}
                    sx={{
                      color: 'text.secondary',
                      transition: 'all .3s cubic-bezier(0.4, 0.0, 0.2, 1)',
                      '&:hover': {
                        color,
                        transform: 'translateY(-4px)',
                        background: alpha(color, 0.08),
                      },
                    }}
                    title={label}
                  >
                    <Icon />
                  </IconButton>
                ))}
              </Box>
            </Stack>
          </Grid>
        </Grid>

        <Divider sx={{ my: { xs: 2, md: 3 }, opacity: 0.1 }} />

        <Box sx={{ textAlign: 'center' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontSize: isMobile ? '0.7rem' : '0.8rem' }}>
            © {new Date().getFullYear()} Prince of Songkla University Science Center. All rights reserved.
          </Typography>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;
