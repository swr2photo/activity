'use client';

// components/QRCodeAdminPanel.tsx
import React, { useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Alert from '@mui/material/Alert';

import * as QRCode from 'qrcode';

interface QRCodeAdminPanelProps {
  baseUrl: string;
}

const QRCodeAdminPanel: React.FC<QRCodeAdminPanelProps> = ({ baseUrl }) => {
  const [activityId, setActivityId] = useState<string>('');
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const [error, setError] = useState<string>('');

  const generateQRCode = async (): Promise<void> => {
    if (!activityId.trim()) {
      setError('กรุณาใส่ ID กิจกรรม');
      setQrCodeUrl('');
      return;
    }

    try {
      const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
      const url = `${normalizedBaseUrl}/activity/${activityId.trim()}`;

      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
      });

      setQrCodeUrl(qrCodeDataUrl);
      setError('');
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการสร้าง QR Code');
      setQrCodeUrl('');
      // eslint-disable-next-line no-console
      console.error('QR Code generation error:', err);
    }
  };

  const downloadQRCode = (): void => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `qr-activity-${activityId.trim() || 'unknown'}.png`;
    link.href = qrCodeUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  const displayUrl = activityId.trim()
    ? `${normalizedBaseUrl}/activity/${activityId.trim()}`
    : `${normalizedBaseUrl}/activity/<activityId>`;

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        สร้าง QR Code สำหรับกิจกรรม
      </Typography>

      <Grid container spacing={3} sx={{ width: 1 }}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              ข้อมูลกิจกรรม
            </Typography>

            <TextField
              fullWidth
              label="Activity ID"
              value={activityId}
              onChange={(e) => setActivityId(e.target.value)}
              margin="normal"
              placeholder="ใส่ ID ของกิจกรรม"
            />

            {error && (
              <Alert severity="error" sx={{ mt: 2 }}>
                {error}
              </Alert>
            )}

            <Button
              variant="contained"
              onClick={generateQRCode}
              sx={{ mt: 2 }}
              fullWidth
            >
              สร้าง QR Code
            </Button>
          </Paper>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              QR Code ที่สร้าง
            </Typography>

            {qrCodeUrl ? (
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <Box
                    component="img"
                    src={qrCodeUrl}
                    alt="QR Code"
                    sx={{ maxWidth: '100%', height: 'auto' }}
                  />

                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      URL: {displayUrl}
                    </Typography>

                    <Button
                      variant="outlined"
                      onClick={downloadQRCode}
                      sx={{ mt: 2 }}
                    >
                      ดาวน์โหลด QR Code
                    </Button>
                  </Box>
                </CardContent>
              </Card>
            ) : (
              <Alert severity="info">
                กรุณาใส่ Activity ID และกดสร้าง QR Code
              </Alert>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
};

export default QRCodeAdminPanel;
