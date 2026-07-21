'use client';

import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/components/providers/ConfirmDialogProvider';

export interface LocationPickerProps {
  location: { latitude: number; longitude: number };
  /** radius in meters */
  radius: number;
  onLocationChange: (lat: number, lng: number) => void;
  /** optional: allow changing radius with a slider */
  editableRadius?: boolean;
  onRadiusChange?: (r: number) => void;
  /** optional: show user's current position */
  userLocation?: { lat: number; lng: number; accuracy?: number } | null;
  /** default zoom */
  zoom?: number;
}

const mapContainerStyle = { width: '100%', height: '320px' } as const;

const libraries: ('places' | 'geometry' | 'drawing' | 'visualization')[] = [
  'places',
  'geometry',
];

const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  radius,
  onLocationChange,
  editableRadius = false,
  onRadiusChange,
  userLocation = null,
  zoom = 16,
}) => {
  const alertDialog = useAlertDialog();
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [markerPos, setMarkerPos] = useState({
    lat: location.latitude,
    lng: location.longitude,
  });
  const [r, setR] = useState<number>(Math.max(5, radius));

  useEffect(
    () => setMarkerPos({ lat: location.latitude, lng: location.longitude }),
    [location.latitude, location.longitude]
  );
  useEffect(() => setR(Math.max(5, radius)), [radius]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      void alertDialog(
        'ไม่รองรับตำแหน่ง',
        'เบราว์เซอร์ของคุณไม่รองรับการเข้าถึงตำแหน่ง',
        'warning'
      );
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPos({ lat, lng });
        onLocationChange(lat, lng);
      },
      (error) => {
        let msg = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้: ';
        if (error.code === error.PERMISSION_DENIED)
          msg += 'ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง';
        else if (error.code === error.POSITION_UNAVAILABLE)
          msg += 'ไม่สามารถระบุตำแหน่งได้';
        else if (error.code === error.TIMEOUT) msg += 'หมดเวลาในการขอตำแหน่ง';
        else msg += 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
        void alertDialog('ไม่สามารถดึงตำแหน่งได้', msg, 'warning');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const onMapClick = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
      onLocationChange(lat, lng);
    },
    [onLocationChange]
  );

  const onMarkerDragEnd = useCallback(
    (e: google.maps.MapMouseEvent) => {
      if (!e.latLng) return;
      const lat = e.latLng.lat();
      const lng = e.latLng.lng();
      setMarkerPos({ lat, lng });
      onLocationChange(lat, lng);
    },
    [onLocationChange]
  );

  const handleRadiusInput = (value: number) => {
    const next = Math.max(5, value);
    setR(next);
  };

  const handleRadiusCommit = (value: number) => {
    const next = Math.max(5, value);
    if (onRadiusChange) onRadiusChange(next);
  };

  if (loadError)
    return (
      <div className="p-2.5 text-destructive">
        โหลดแผนที่ล้มเหลว: {loadError.message}
      </div>
    );
  if (!isLoaded)
    return <div className="p-2.5 text-center">กำลังโหลดแผนที่...</div>;

  const center = useMemo(() => markerPos, [markerPos]);

  return (
    <>
      <div className="mb-2 flex items-center justify-between gap-3">
        <Button size="sm" onClick={handleUseCurrentLocation}>
          ใช้ตำแหน่งปัจจุบัน
        </Button>
        {editableRadius && (
          <div className="flex w-80 items-center gap-3">
            <span className="shrink-0 text-xs text-muted-foreground">รัศมี</span>
            <input
              type="range"
              className="h-2 w-full cursor-pointer appearance-none rounded-full bg-muted accent-primary"
              value={r}
              min={5}
              max={5000}
              step={5}
              onChange={(e) => handleRadiusInput(Number(e.target.value))}
              onMouseUp={(e) =>
                handleRadiusCommit(Number((e.target as HTMLInputElement).value))
              }
              onTouchEnd={(e) =>
                handleRadiusCommit(
                  Number((e.target as HTMLInputElement).value)
                )
              }
              aria-label={`รัศมี ${r} เมตร`}
            />
            <span className="shrink-0 text-xs font-medium tabular-nums">
              {r} ม.
            </span>
          </div>
        )}
      </div>

      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={zoom}
        center={center}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
        }}
      >
        <MarkerF position={markerPos} draggable onDragEnd={onMarkerDragEnd} />
        <CircleF
          center={markerPos}
          radius={r}
          options={{
            fillColor: '#1976d2',
            fillOpacity: 0.18,
            strokeColor: '#1976d2',
            strokeOpacity: 0.55,
            strokeWeight: 2,
          }}
        />

        {userLocation && (
          <MarkerF
            position={{ lat: userLocation.lat, lng: userLocation.lng }}
          />
        )}
      </GoogleMap>
    </>
  );
};

export default LocationPicker;
