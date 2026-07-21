'use client';

import React from 'react';
import { CheckCircle2, X } from 'lucide-react';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import { Alert } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';

interface ActivityLocationMapProps {
  latitude: number;
  longitude: number;
  radius: number;
  activityName: string;
  userLocation?: { lat: number; lng: number } | null;
}

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const libraries: ('places' | 'geometry' | 'drawing' | 'visualization')[] = [
  'places',
  'geometry',
];

const ActivityLocationMap: React.FC<ActivityLocationMapProps> = ({
  latitude,
  longitude,
  radius,
  activityName,
  userLocation,
}) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const center = { lat: latitude, lng: longitude };

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

  if (loadError) {
    return (
      <Alert variant="destructive">
        ไม่สามารถโหลดแผนที่ได้: {loadError.message}
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <div className="flex h-[300px] flex-col items-center justify-center gap-2 rounded-md bg-muted/50">
        <Spinner size="lg" />
        <p className="text-sm text-muted-foreground">กำลังโหลดแผนที่...</p>
      </div>
    );
  }

  const distance = userLocation
    ? calculateDistance(userLocation.lat, userLocation.lng, latitude, longitude)
    : 0;
  const inRadius = userLocation ? distance <= radius : false;

  return (
    <div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={16}
        center={center}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
          mapTypeId: 'roadmap',
        }}
      >
        <MarkerF
          position={center}
          title={`ตำแหน่งกิจกรรม: ${activityName}`}
          icon={{
            url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDNDMTAuNDc3IDMgNiA3LjQ3NyA2IDEzQzYgMTguMTEzIDkuNjEzIDI0LjIxNiAxNS4wIDI4LjkwMEMxNS4zODQgMjkuMzY2IDE2LjYxNiAyOS4zNjYgMTcgMjguOTAwQzIyLjM4NyAyNC4yMTYgMjYgMTguMTEzIDI2IDEzQzI2IDcuNDc3IDIxLjUyMyAzIDE2IDNaIiBmaWxsPSIjRUY0NDQ0Ii8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTMiIHI9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
            scaledSize: new window.google.maps.Size(32, 32),
            anchor: new window.google.maps.Point(16, 32),
          }}
        />

        {userLocation && (
          <MarkerF
            position={userLocation}
            title="ตำแหน่งของคุณ"
            icon={{
              url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMTAiIGZpbGw9IiMzQjgyRjYiIHN0cm9rZT0id2hpdGUiIHN0cm9rZS13aWR0aD0iMiIvPgo8Y2lyY2xlIGN4PSIxMiIgY3k9IjEyIiByPSI0IiBmaWxsPSJ3aGl0ZSIvPgo8L3N2Zz4K',
              scaledSize: new window.google.maps.Size(24, 24),
              anchor: new window.google.maps.Point(12, 12),
            }}
          />
        )}

        <CircleF
          center={center}
          radius={radius}
          options={{
            fillColor: '#10B981',
            fillOpacity: 0.2,
            strokeColor: '#10B981',
            strokeOpacity: 0.8,
            strokeWeight: 2,
          }}
        />
      </GoogleMap>

      {userLocation && (
        <div className="mt-4 rounded-md border border-border bg-muted/50 p-4">
          <p className="mb-2 text-sm font-bold">ข้อมูลตำแหน่ง</p>

          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              ระยะห่างจากจุดกิจกรรม:{' '}
              <strong>{Math.round(distance)} เมตร</strong>
            </p>

            <div className="flex items-center gap-2">
              {inRadius ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  <p className="text-sm font-bold text-emerald-600">
                    ✅ อยู่ในพื้นที่กิจกรรม - สามารถเช็คอินได้
                  </p>
                </>
              ) : (
                <>
                  <X className="h-5 w-5 text-destructive" />
                  <p className="text-sm font-bold text-destructive">
                    ❌ อยู่นอกพื้นที่กิจกรรม - ไม่สามารถเช็คอินได้
                  </p>
                </>
              )}
            </div>

            <div className="mt-2 rounded-md border border-blue-200 bg-blue-50 p-3 dark:border-blue-800 dark:bg-blue-950/30">
              <p className="text-xs text-blue-800 dark:text-blue-300">
                <strong>หมายเหตุ:</strong> คุณต้องอยู่ในรัศมี {radius} เมตร
                จากจุดกิจกรรมเพื่อทำการเช็คอิน
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-4 rounded-md border border-primary/20 bg-primary/5 p-4">
        <p className="mb-2 text-sm font-bold text-primary">คำอธิบายสัญลักษณ์</p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 border-2 border-white bg-[#EF4444]"
              style={{
                borderRadius: '50% 50% 50% 0%',
                transform: 'rotate(-45deg)',
              }}
            />
            <span className="text-xs text-muted-foreground">จุดกิจกรรม</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="h-4 w-4 rounded-full border-2 border-white bg-[#3B82F6]" />
            <span className="text-xs text-muted-foreground">
              ตำแหน่งของคุณ {!userLocation && '(ยังไม่ได้ค้นหา)'}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <div
              className="h-4 w-4 rounded-full border-2 border-[#10B981]"
              style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)' }}
            />
            <span className="text-xs text-muted-foreground">
              พื้นที่เช็คอิน (รัศมี {radius} เมตร)
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityLocationMap;
