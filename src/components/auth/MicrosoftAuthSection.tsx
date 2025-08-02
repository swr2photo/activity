// components/auth/MicrosoftAuthSection.tsx
'use client';
import React, { useState } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Alert,
  CircularProgress,
  Divider
} from '@mui/material';
import {
  Security as SecurityIcon,
  Block as BlockIcon,
  School as SchoolIcon
} from '@mui/icons-material';
import MicrosoftLogin from '../MicrosoftLogin';

interface MicrosoftAuthSectionProps {
  activityData: any;
  onLoginSuccess: (userProfile: any) => void;
  onLoginError: (error: string) => void;
  onPreLoginCheck: (email: string) => Promise<boolean>;
  disabled?: boolean;
  checkingIP?: boolean;
}

const MicrosoftAuthSection: React.FC<MicrosoftAuthSectionProps> = ({
  activityData,
  onLoginSuccess,
  onLoginError,
  onPreLoginCheck,
  disabled = false,
  checkingIP = false
}) => {
  return (
    <Card sx={{ 
      mb: 4,
      background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
      boxShadow: '0 8px 32px rgba(0,0,0,0.1)',
      border: '1px solid rgba(255,255,255,0.2)',
      position: 'relative'
    }}>
      {checkingIP && (
        <Box 
          sx={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            right: 0, 
            bottom: 0, 
            bgcolor: 'rgba(255,255,255,0.95)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            zIndex: 10,
            borderRadius: 2,
            backdropFilter: 'blur(4px)'
          }}
        >
          <Box sx={{ textAlign: 'center' }}>
            <CircularProgress size={32} sx={{ mb: 2 }} />
            <Typography variant="body1" fontWeight="medium">
              ตรวจสอบสิทธิ์การเข้าใช้งาน...
            </Typography>
            <Typography variant="body2" color="text.secondary">
              กรุณารอสักครู่
            </Typography>
          </Box>
        </Box>
      )}

      <CardContent sx={{ p: 4 }}>
        <Box sx={{ textAlign: 'center', mb: 3 }}>
          <SecurityIcon sx={{ 
            fontSize: 48, 
            color: 'primary.main', 
            mb: 2,
            filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
          }} />
          <Typography variant="h5" gutterBottom sx={{ 
            fontWeight: 'bold',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            เข้าสู่ระบบเพื่อลงทะเบียน
          </Typography>
          <Typography variant="body1" color="text.secondary">
            ใช้บัญชี Microsoft ของมหาวิทยาลัยในการเข้าสู่ระบบ
          </Typography>
        </Box>

        {/* University Login Required Alert */}
        {activityData?.requiresUniversityLogin && (
          <>
            <Alert severity="info" sx={{ 
              mb: 3,
              background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
              border: '1px solid #3b82f6'
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                <SchoolIcon fontSize="small" />
                <Typography variant="subtitle2" fontWeight="bold">
                  กิจกรรมนี้สำหรับบุคลากรมหาวิทยาลัยเท่านั้น
                </Typography>
              </Box>
              <Typography variant="body2">
                จำเป็นต้องใช้บัญชี Microsoft ที่ลงท้ายด้วย @university.edu หรือโดเมนของมหาวิทยาลัย
              </Typography>
            </Alert>
            <Divider sx={{ my: 3 }} />
          </>
        )}

        {/* Security Notice */}
        <Alert severity="success" sx={{ 
          mb: 3,
          background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
          border: '1px solid #10b981'
        }}>
          <Typography variant="body2">
            <strong>ความปลอดภัย:</strong> ระบบใช้การยืนยันตัวตนผ่าน Microsoft เพื่อความปลอดภัยสูงสุด 
            ข้อมูลของคุณจะได้รับการปกป้องตามมาตรฐานสากล
          </Typography>
        </Alert>

        {/* Microsoft Login Component */}
        <MicrosoftLogin
          onLoginSuccess={onLoginSuccess}
          onLoginError={onLoginError}
          onLogout={() => {}}
          disabled={disabled || checkingIP}
          onPreLoginCheck={onPreLoginCheck}
        />

        {/* Help Text */}
        <Box sx={{ mt: 3, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1 }}>
            <strong>หมายเหตุ:</strong>
          </Typography>
          <Typography variant="caption" color="text.secondary" component="div">
            • ใช้บัญชี Microsoft ที่ได้รับจากมหาวิทยาลัยเท่านั้น<br/>
            • หากไม่มีบัญชี กรุณาติดต่อแผนกเทคโนโลยีสารสนเทศ<br/>
            • การลงทะเบียนจะเสร็จสิ้นหลังจากเข้าสู่ระบบและกรอกข้อมูลครบถ้วน
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

export default MicrosoftAuthSection;