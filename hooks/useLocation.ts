import { useState, useEffect } from 'react';

interface LocationState {
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  error: string | null;
  loading: boolean;
}

export const useLocation = () => {
  const [location, setLocation] = useState<LocationState>({
    latitude: null,
    longitude: null,
    accuracy: null,
    error: null,
    loading: true,
  });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation(prev => ({
        ...prev,
        error: 'เบราว์เซอร์ไม่รองรับการตรวจสอบตำแหน่ง',
        loading: false,
      }));
      return;
    }

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          error: null,
          loading: false,
        });
      },
      (error) => {
        let errorMessage = 'ไม่สามารถตรวจสอบตำแหน่งได้';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            errorMessage = 'กรุณาอนุญาตการเข้าถึงตำแหน่ง';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage = 'ไม่สามารถระบุตำแหน่งได้';
            break;
          case error.TIMEOUT:
            errorMessage = 'การตรวจสอบตำแหน่งใช้เวลานานเกินไป';
            break;
        }
        setLocation(prev => ({
          ...prev,
          error: errorMessage,
          loading: false,
        }));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  return location;
};
export interface Student {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  createdAt: Date;
}

export interface ActivityRecord {
  id: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  activityCode: string;
  location: {
    latitude: number;
    longitude: number;
  };
  timestamp: Date;
  adminCode: string;
}

export interface AdminSettings {
  id: string;
  allowedLocation: {
    latitude: number;
    longitude: number;
    radius: number; // in meters
  };
  adminCode: string;
  isActive: boolean;
}