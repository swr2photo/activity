'use client';
import React, { useState, useEffect } from 'react';
import { Alert, Button, Box, Typography } from '@mui/material';

interface LocationCheckerProps {
  allowedLocation: {
    latitude: number;
    longitude: number;
    radius: number;
  };
  onLocationVerified: (location: { latitude: number; longitude: number }) => void;
  onLocationError: (error: string) => void;
}

const LocationChecker: React.FC<LocationCheckerProps> = ({
  allowedLocation,
  onLocationVerified,
  onLocationError
}) => {
  const [securityError, setSecurityError] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;

    const a =
      Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
  };

  const isSecureContext = (): boolean => {
    return window.isSecureContext || 
           window.location.protocol === 'https:' || 
           window.location.hostname === 'localhost' ||
           window.location.hostname === '127.0.0.1';
  };

  const checkLocation = () => {
    // Check if running in secure context
    if (!isSecureContext()) {
      setSecurityError(true);
      onLocationError('ระบบต้องการ HTTPS เพื่อเข้าถึงตำแหน่ง กรุณาใช้ https:// หรือ localhost');
      return;
    }

    if (!navigator.geolocation) {
      onLocationError('เบราว์เซอร์ไม่รองรับการตรวจสอบตำแหน่ง');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const distance = calculateDistance(
          latitude,
          longitude,
          allowedLocation.latitude,
          allowedLocation.longitude
        );

        if (distance <= allowedLocation.radius) {
          onLocationVerified({ latitude, longitude });
        } else {
          onLocationError(
            `คุณอยู่นอกพื้นที่ที่กำหนด (ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร)`
          );
        }
      },
      (error) => {
        let errorMessage = 'ไม่สามารถตรวจสอบตำแหน่งได้';
        
        switch (error.code) {
          case error.PERMISSION_DENIED:
            setPermissionDenied(true);
            errorMessage = 'กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบ GPS หรือการเชื่อมต่ออินเทอร์เน็ต';
            break;
          case error.TIMEOUT:
            errorMessage = 'การตรวจสอบตำแหน่งใช้เวลานานเกินไป กรุณาลองใหม่';
            break;
        }

        // Check if it's a security error
        if (error.message?.includes('Only secure origins are allowed')) {
          setSecurityError(true);
          errorMessage = 'ระบบต้องการ HTTPS เพื่อเข้าถึงตำแหน่ง';
        }

        onLocationError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000
      }
    );
  };

  const retryLocationCheck = () => {
    setSecurityError(false);
    setPermissionDenied(false);
    checkLocation();
  };

  useEffect(() => {
    checkLocation();
  }, []);

  // Render helpful UI for common issues
  if (securityError) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            🔒 ต้องการการเชื่อมต่อที่ปลอดภัย (HTTPS)
          </Typography>
          <Typography variant="body2" paragraph>
            เบราว์เซอร์สมัยใหม่ต้องการ HTTPS เพื่อเข้าถึงตำแหน่ง GPS
          </Typography>
          
          <Typography variant="subtitle2" gutterBottom>
            วิธีแก้ไข:
          </Typography>
          <Typography variant="body2" component="div">
            <strong>สำหรับผู้พัฒนา:</strong>
            <br />• ใช้ <code>https://localhost:3000</code> แทน <code>http://</code>
            <br />• หรือใช้ ngrok สำหรับ HTTPS tunnel
            <br />• ติดตั้ง mkcert สำหรับ local HTTPS certificate
          </Typography>
          
          <Typography variant="body2" sx={{ mt: 1 }}>
            <strong>สำหรับผู้ใช้:</strong>
            <br />• กรุณาเข้าถึงผ่าน HTTPS URL ที่ได้รับจากแอดมิน
          </Typography>
        </Alert>
        
        <Button variant="outlined" onClick={retryLocationCheck} fullWidth>
          ลองใหม่
        </Button>
      </Box>
    );
  }

  if (permissionDenied) {
    return (
      <Box sx={{ mt: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="h6" gutterBottom>
            📍 ต้องการอนุญาตการเข้าถึงตำแหน่ง
          </Typography>
          <Typography variant="body2" paragraph>
            กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์
          </Typography>
          
          <Typography variant="subtitle2" gutterBottom>
            วิธีอนุญาต:
          </Typography>
          <Typography variant="body2" component="div">
            • คลิกที่ไอคอน 🔒 หรือ 📍 ใน address bar
            <br />• เลือก "Allow" หรือ "อนุญาต" สำหรับ Location
            <br />• รีเฟรชหน้าเว็บแล้วลองใหม่
          </Typography>
        </Alert>
        
        <Button variant="outlined" onClick={retryLocationCheck} fullWidth>
          ลองใหม่หลังจากอนุญาตแล้ว
        </Button>
      </Box>
    );
  }

  return null;
};

export default LocationChecker;