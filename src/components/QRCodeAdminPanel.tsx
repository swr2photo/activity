// components/QRCodeAdminPanel.tsx
import React, { useState } from 'react';
import {
  Box,
  Typography,
  Paper,
  TextField,
  Button,
  Card,
  CardContent,
  Grid,
  Alert
} from '@mui/material';
import QRCode from 'qrcode';

interface QRCodeAdminPanelProps {
  baseUrl: string;
}

const QRCodeAdminPanel: React.FC<QRCodeAdminPanelProps> = ({ baseUrl }) => {
  const [activityId, setActivityId] = useState('');
  const [qrCodeUrl, setQrCodeUrl] = useState('');
  const [error, setError] = useState('');

  const generateQRCode = async () => {
    if (!activityId.trim()) {
      setError('กรุณาใส่ ID กิจกรรม');
      return;
    }

    try {
      const url = `${baseUrl}/activity/${activityId}`;
      const qrCodeDataUrl = await QRCode.toDataURL(url, {
        width: 256,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      setQrCodeUrl(qrCodeDataUrl);
      setError('');
    } catch (err) {
      setError('เกิดข้อผิดพลาดในการสร้าง QR Code');
      console.error('QR Code generation error:', err);
    }
  };

  const downloadQRCode = () => {
    if (!qrCodeUrl) return;

    const link = document.createElement('a');
    link.download = `qr-activity-${activityId}.png`;
    link.href = qrCodeUrl;
    link.click();
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        สร้าง QR Code สำหรับกิจกรรม
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
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
              sx={{ mt: 2, mr: 2 }}
              fullWidth
            >
              สร้าง QR Code
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              QR Code ที่สร้าง
            </Typography>
            
            {qrCodeUrl ? (
              <Card>
                <CardContent sx={{ textAlign: 'center' }}>
                  <img 
                    src={qrCodeUrl} 
                    alt="QR Code"
                    style={{ maxWidth: '100%', height: 'auto' }}
                  />
                  <Box sx={{ mt: 2 }}>
                    <Typography variant="body2" color="text.secondary">
                      URL: {baseUrl}/activity/{activityId}
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

// Make sure to have a default export
export default QRCodeAdminPanel;