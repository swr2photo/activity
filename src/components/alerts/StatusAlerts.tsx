// components/alerts/StatusAlerts.tsx
'use client';
import React, { useState, useEffect } from 'react';
import {
  Alert,
  Typography,
  Box,
  Card,
  CardContent,
  Button,
  LinearProgress
} from '@mui/material';
import {
  Block as BlockIcon,
  Info as InfoIcon,
  Person as PersonIcon,
  Edit as EditIcon,
  Warning as WarningIcon,
  PersonOff as PersonOffIcon,
  AccessTime as AccessTimeIcon
} from '@mui/icons-material';

// IP Restriction Alert Component
interface IPRestrictionAlertProps {
  remainingTime: number; 
  onClose: () => void;
}

export const IPRestrictionAlert: React.FC<IPRestrictionAlertProps> = ({ 
  remainingTime, 
  onClose 
}) => {
  const [timeLeft, setTimeLeft] = useState(remainingTime);

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onClose();
          return 0;
        }
        return prev - 1;
      });
    }, 60000);

    return () => clearInterval(timer);
  }, [onClose]);

  const progressValue = ((remainingTime - timeLeft) / remainingTime) * 100;

  return (
    <Alert 
      severity="error" 
      sx={{ 
        mb: 3,
        background: 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)',
        border: '1px solid #fca5a5'
      }}
      icon={<BlockIcon />}
    >
      <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold' }}>
        ไม่สามารถเข้าสู่ระบบได้
      </Typography>
      
      <Typography variant="body2" gutterBottom>
        IP นี้เพิ่งมีการเข้าสู่ระบบด้วยบัญชีอื่นแล้ว เพื่อความปลอดภัย 
        คุณต้องรออีก <strong>{timeLeft} นาที</strong> ก่อนที่จะสามารถเข้าสู่ระบบได้
      </Typography>
      
      <Box sx={{ mt: 2, mb: 1 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">
            เวลาที่เหลือ
          </Typography>
          <Typography variant="caption" color="error.main" fontWeight="medium">
            {timeLeft} นาที
          </Typography>
        </Box>
        <LinearProgress 
          variant="determinate" 
          value={progressValue}
          sx={{
            height: 6,
            borderRadius: 3,
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            '& .MuiLinearProgress-bar': {
              borderRadius: 3,
              backgroundColor: '#ef4444'
            }
          }}
        />
      </Box>
      
      <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
        มาตรการนี้ป้องกันการใช้งานบัญชีหลายบัญชีจาก IP เดียวกันในช่วงเวลาสั้นๆ
      </Typography>
    </Alert>
  );
};

// Duplicate Registration Alert Component
export const DuplicateRegistrationAlert: React.FC = () => {
  return (
    <Alert 
      severity="warning" 
      sx={{ 
        mb: 3,
        background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
        border: '1px solid #f59e0b'
      }}
      icon={<PersonOffIcon />}
    >
      <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold' }}>
        เคยลงทะเบียนแล้ว
      </Typography>
      <Typography variant="body2">
        บัญชีนี้เคยลงทะเบียนกิจกรรมนี้ไว้แล้ว ไม่สามารถลงทะเบียนซ้ำได้
      </Typography>
      
      <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', borderRadius: 1 }}>
        <Typography variant="caption" color="text.secondary">
          <strong>หมายเหตุ:</strong> หากคิดว่าเป็นข้อผิดพลาด กรุณาติดต่อผู้ดูแลกิจกรรม
        </Typography>
      </Box>
    </Alert>
  );
};

// Profile Setup Alert Component
interface ProfileSetupAlertProps {
  onEditProfile: () => void;
}

export const ProfileSetupAlert: React.FC<ProfileSetupAlertProps> = ({ 
  onEditProfile 
}) => {
  return (
    <Card sx={{ 
      mb: 4,
      background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      border: '2px solid #f59e0b',
      boxShadow: '0 8px 32px rgba(245, 158, 11, 0.2)'
    }}>
      <CardContent sx={{ textAlign: 'center', p: 4 }}>
        <PersonIcon sx={{ 
          fontSize: 64, 
          color: 'warning.main', 
          mb: 2,
          filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.1))'
        }} />
        
        <Typography variant="h5" gutterBottom sx={{ 
          color: 'warning.dark',
          fontWeight: 'bold'
        }}>
          กรุณากรอกข้อมูลส่วนตัวเพิ่มเติม
        </Typography>
        
        <Typography variant="body1" color="text.secondary" sx={{ mb: 3, maxWidth: 400, mx: 'auto' }}>
          เพื่อดำเนินการลงทะเบียนกิจกรรม กรุณากรอกชื่อ-นามสกุล และข้อมูลเพิ่มเติม
          เพื่อให้ระบบสามารถประมวลผลการลงทะเบียนได้อย่างถูกต้อง
        </Typography>
        
        <Button
          variant="contained"
          size="large"
          startIcon={<EditIcon />}
          onClick={onEditProfile}
          sx={{
            background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
            px: 4,
            py: 1.5,
            fontSize: '1rem',
            fontWeight: 'bold',
            boxShadow: '0 4px 16px rgba(245, 158, 11, 0.4)',
            '&:hover': {
              background: 'linear-gradient(135deg, #d97706 0%, #b45309 100%)',
              boxShadow: '0 6px 20px rgba(245, 158, 11, 0.5)',
              transform: 'translateY(-1px)'
            }
          }}
        >
          กรอกข้อมูลส่วนตัว
        </Button>
        
        <Box sx={{ mt: 3, p: 2, bgcolor: 'rgba(245, 158, 11, 0.1)', borderRadius: 1 }}>
          <Typography variant="caption" color="text.secondary">
            <strong>ข้อมูลที่จำเป็น:</strong> ชื่อ-นามสกุล, คณะ, สาขา (หากมี)
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
};

// Success Message Alert
interface SuccessAlertProps {
  message: string;
  onClose?: () => void;
  autoHide?: boolean;
  duration?: number;
}

export const SuccessAlert: React.FC<SuccessAlertProps> = ({ 
  message, 
  onClose, 
  autoHide = true, 
  duration = 3000 
}) => {
  useEffect(() => {
    if (autoHide && onClose) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [autoHide, onClose, duration]);

  return (
    <Alert 
      severity="success" 
      sx={{ 
        mb: 2,
        background: 'linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%)',
        border: '1px solid #10b981'
      }}
      onClose={onClose}
    >
      <Typography variant="body2" fontWeight="medium">
        {message}
      </Typography>
    </Alert>
  );
};

// Activity Status Alert
interface ActivityStatusAlertProps {
  status: 'inactive' | 'upcoming' | 'ended' | 'full';
  message: string;
  startTime?: Date;
  endTime?: Date;
}

export const ActivityStatusAlert: React.FC<ActivityStatusAlertProps> = ({
  status,
  message,
  startTime,
  endTime
}) => {
  const getSeverityAndIcon = () => {
    switch (status) {
      case 'inactive':
        return { severity: 'error' as const, icon: <BlockIcon /> };
      case 'upcoming':
        return { severity: 'warning' as const, icon: <AccessTimeIcon /> };
      case 'ended':
        return { severity: 'info' as const, icon: <InfoIcon /> };
      case 'full':
        return { severity: 'error' as const, icon: <PersonOffIcon /> };
      default:
        return { severity: 'info' as const, icon: <InfoIcon /> };
    }
  };

  const { severity, icon } = getSeverityAndIcon();

  return (
    <Alert 
      severity={severity}
      icon={icon}
      sx={{ 
        mb: 3,
        background: severity === 'error' 
          ? 'linear-gradient(135deg, #fee2e2 0%, #fecaca 100%)'
          : severity === 'warning'
            ? 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)'
            : 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
        border: `1px solid ${
          severity === 'error' ? '#ef4444' : 
          severity === 'warning' ? '#f59e0b' : '#3b82f6'
        }`
      }}
    >
      <Typography variant="body1" gutterBottom fontWeight="bold">
        {status === 'inactive' && 'กิจกรรมถูกปิดใช้งาน'}
        {status === 'upcoming' && 'กิจกรรมยังไม่เปิดให้ลงทะเบียน'}
        {status === 'ended' && 'กิจกรรมสิ้นสุดแล้ว'}
        {status === 'full' && 'กิจกรรมเต็มแล้ว'}
      </Typography>
      <Typography variant="body2">
        {message}
      </Typography>
      
      {(startTime || endTime) && (
        <Box sx={{ mt: 2, p: 2, bgcolor: 'rgba(0,0,0,0.05)', borderRadius: 1 }}>
          {startTime && status === 'upcoming' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              <strong>เปิดลงทะเบียน:</strong> {startTime.toLocaleString('th-TH')}
            </Typography>
          )}
          {endTime && status === 'ended' && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
              <strong>สิ้นสุดเมื่อ:</strong> {endTime.toLocaleString('th-TH')}
            </Typography>
          )}
        </Box>
      )}
    </Alert>
  );
};