'use client';

import React, { useState, useEffect } from 'react';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

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
  onLocationError,
}) => {
  const [securityError, setSecurityError] = useState<boolean>(false);
  const [permissionDenied, setPermissionDenied] = useState<boolean>(false);

  const calculateDistance = (
    lat1: number,
    lon1: number,
    lat2: number,
    lon2: number
  ): number => {
    const R = 6371e3;
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
    return (
      window.isSecureContext ||
      window.location.protocol === 'https:' ||
      window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1'
    );
  };

  const checkLocation = () => {
    if (!isSecureContext()) {
      setSecurityError(true);
      onLocationError(
        'ระบบต้องการ HTTPS เพื่อเข้าถึงตำแหน่ง กรุณาใช้ https:// หรือ localhost'
      );
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
            errorMessage =
              'ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบ GPS หรือการเชื่อมต่ออินเทอร์เน็ต';
            break;
          case error.TIMEOUT:
            errorMessage = 'การตรวจสอบตำแหน่งใช้เวลานานเกินไป กรุณาลองใหม่';
            break;
        }

        if (error.message?.includes('Only secure origins are allowed')) {
          setSecurityError(true);
          errorMessage = 'ระบบต้องการ HTTPS เพื่อเข้าถึงตำแหน่ง';
        }

        onLocationError(errorMessage);
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 60000,
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (securityError) {
    return (
      <div className="mt-4">
        <Alert variant="destructive" className="mb-4">
          <AlertTitle>🔒 ต้องการการเชื่อมต่อที่ปลอดภัย (HTTPS)</AlertTitle>
          <AlertDescription>
            <p className="mb-2">
              เบราว์เซอร์สมัยใหม่ต้องการ HTTPS เพื่อเข้าถึงตำแหน่ง GPS
            </p>
            <p className="mb-1 font-semibold">วิธีแก้ไข:</p>
            <div className="text-sm">
              <strong>สำหรับผู้พัฒนา:</strong>
              <br />• ใช้ <code>https://localhost:3000</code> แทน{' '}
              <code>http://</code>
              <br />• หรือใช้ ngrok สำหรับ HTTPS tunnel
              <br />• ติดตั้ง mkcert สำหรับ local HTTPS certificate
            </div>
            <p className="mt-2 text-sm">
              <strong>สำหรับผู้ใช้:</strong>
              <br />• กรุณาเข้าถึงผ่าน HTTPS URL ที่ได้รับจากแอดมิน
            </p>
          </AlertDescription>
        </Alert>

        <Button variant="outline" onClick={retryLocationCheck} className="w-full">
          ลองใหม่
        </Button>
      </div>
    );
  }

  if (permissionDenied) {
    return (
      <div className="mt-4">
        <Alert variant="warning" className="mb-4">
          <AlertTitle>📍 ต้องการอนุญาตการเข้าถึงตำแหน่ง</AlertTitle>
          <AlertDescription>
            <p className="mb-2">กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์</p>
            <p className="mb-1 font-semibold">วิธีอนุญาต:</p>
            <div className="text-sm">
              • คลิกที่ไอคอน 🔒 หรือ 📍 ใน address bar
              <br />• เลือก &quot;Allow&quot; หรือ &quot;อนุญาต&quot; สำหรับ Location
              <br />• รีเฟรชหน้าเว็บแล้วลองใหม่
            </div>
          </AlertDescription>
        </Alert>

        <Button variant="outline" onClick={retryLocationCheck} className="w-full">
          ลองใหม่หลังจากอนุญาตแล้ว
        </Button>
      </div>
    );
  }

  return null;
};

export default LocationChecker;
