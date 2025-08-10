'use client';
import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import { Box, Button, Stack, Typography, Slider } from '@mui/material';

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

const libraries: ("places" | "geometry" | "drawing" | "visualization")[] = ['places'];

const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  radius,
  onLocationChange,
  editableRadius = false,
  onRadiusChange,
  userLocation = null,
  zoom = 16,
}) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [markerPos, setMarkerPos] = useState({ lat: location.latitude, lng: location.longitude });
  const [r, setR] = useState<number>(Math.max(5, radius));

  // keep in sync with parent
  useEffect(() => setMarkerPos({ lat: location.latitude, lng: location.longitude }), [location.latitude, location.longitude]);
  useEffect(() => setR(Math.max(5, radius)), [radius]);

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) return alert('เบราว์เซอร์ของคุณไม่รองรับการเข้าถึงตำแหน่ง');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        setMarkerPos({ lat, lng });
        onLocationChange(lat, lng);
      },
      (error) => {
        let msg = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้: ';
        if (error.code === error.PERMISSION_DENIED) msg += 'ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง';
        else if (error.code === error.POSITION_UNAVAILABLE) msg += 'ไม่สามารถระบุตำแหน่งได้';
        else if (error.code === error.TIMEOUT) msg += 'หมดเวลาในการขอตำแหน่ง';
        else msg += 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
        alert(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  };

  const onMapClick = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    onLocationChange(lat, lng);
  }, [onLocationChange]);

  const onMarkerDragEnd = useCallback((e: google.maps.MapMouseEvent) => {
    if (!e.latLng) return;
    const lat = e.latLng.lat();
    const lng = e.latLng.lng();
    setMarkerPos({ lat, lng });
    onLocationChange(lat, lng);
  }, [onLocationChange]);

  const handleRadiusChange = (_: Event, value: number | number[]) => {
    const next = Math.max(5, Array.isArray(value) ? value[0] : value);
    setR(next);
  };

  const handleRadiusCommit = (_: Event | React.SyntheticEvent, value: number | number[]) => {
    const next = Math.max(5, Array.isArray(value) ? value[0] : value);
    if (onRadiusChange) onRadiusChange(next);
  };

  if (loadError) return <div style={{ color: 'red', padding: 10 }}>โหลดแผนที่ล้มเหลว: {loadError.message}</div>;
  if (!isLoaded) return <div style={{ padding: 10, textAlign: 'center' }}>กำลังโหลดแผนที่...</div>;

  const center = useMemo(() => markerPos, [markerPos]);

  return (
    <>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Button variant="contained" size="small" onClick={handleUseCurrentLocation}>ใช้ตำแหน่งปัจจุบัน</Button>
        {editableRadius && (
          <Stack direction="row" spacing={2} alignItems="center" sx={{ width: 320 }}>
            <Typography variant="caption">รัศมี</Typography>
            <Slider
              size="small"
              value={r}
              min={5}
              max={5000}
              step={5}
              onChange={handleRadiusChange}
              onChangeCommitted={handleRadiusCommit}
              valueLabelDisplay="auto"
              valueLabelFormat={(v) => `${v} ม.`}
            />
          </Stack>
        )}
      </Stack>

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
        {/* Geofence center (draggable) */}
        <MarkerF position={markerPos} draggable onDragEnd={onMarkerDragEnd} />
        <CircleF
          center={markerPos}
          radius={r}
          options={{ fillColor: '#1976d2', fillOpacity: 0.18, strokeColor: '#1976d2', strokeOpacity: 0.55, strokeWeight: 2 }}
        />

        {/* Optional: show user's current location */}
        {userLocation && <MarkerF position={{ lat: userLocation.lat, lng: userLocation.lng }} />}
      </GoogleMap>
    </>
  );
};

export default LocationPicker;
