'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';
import { Button } from '@/components/ui/button';
import { useAlertDialog } from '@/components/providers/ConfirmDialogProvider';

interface LocationPickerProps {
  location: { latitude: number; longitude: number };
  radius: number;
  onLocationChange: (lat: number, lng: number) => void;
}

const mapContainerStyle = {
  width: '100%',
  height: '300px',
};

const libraries: ('places' | 'geometry' | 'drawing' | 'visualization')[] = [
  'places',
  'geometry',
];

const LocationPicker: React.FC<LocationPickerProps> = ({
  location,
  radius,
  onLocationChange,
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

  useEffect(() => {
    setMarkerPos({
      lat: location.latitude,
      lng: location.longitude,
    });
  }, [location.latitude, location.longitude]);

  const handleUseCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          setMarkerPos({ lat, lng });
          onLocationChange(lat, lng);
        },
        (error) => {
          let errorMessage = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage += 'ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'ไม่สามารถระบุตำแหน่งได้';
              break;
            case error.TIMEOUT:
              errorMessage += 'หมดเวลาในการขอตำแหน่ง';
              break;
            default:
              errorMessage += 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
              break;
          }
          void alertDialog('ไม่สามารถดึงตำแหน่งได้', errorMessage, 'warning');
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    } else {
      void alertDialog(
        'ไม่รองรับตำแหน่ง',
        'เบราว์เซอร์ของคุณไม่รองรับการเข้าถึงตำแหน่ง',
        'warning'
      );
    }
  };

  const onMapClick = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        setMarkerPos({ lat, lng });
        onLocationChange(lat, lng);
      }
    },
    [onLocationChange]
  );

  const onMarkerDragEnd = useCallback(
    (event: google.maps.MapMouseEvent) => {
      if (event.latLng) {
        const lat = event.latLng.lat();
        const lng = event.latLng.lng();
        setMarkerPos({ lat, lng });
        onLocationChange(lat, lng);
      }
    },
    [onLocationChange]
  );

  if (loadError) {
    return (
      <div className="p-2.5 text-destructive">
        โหลดแผนที่ล้มเหลว: {loadError.message}
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="p-2.5 text-center">กำลังโหลดแผนที่...</div>;
  }

  return (
    <>
      <div className="mb-2 text-right">
        <Button size="sm" onClick={handleUseCurrentLocation}>
          ใช้ตำแหน่งปัจจุบัน
        </Button>
      </div>
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={15}
        center={markerPos}
        onClick={onMapClick}
        options={{
          disableDefaultUI: false,
          zoomControl: true,
          mapTypeControl: false,
          scaleControl: true,
          streetViewControl: false,
          rotateControl: false,
          fullscreenControl: true,
        }}
      >
        <MarkerF
          position={markerPos}
          draggable={true}
          onDragEnd={onMarkerDragEnd}
        />
        <CircleF
          center={markerPos}
          radius={radius}
          options={{
            fillColor: '#1976d2',
            fillOpacity: 0.2,
            strokeColor: '#1976d2',
            strokeOpacity: 0.5,
            strokeWeight: 2,
          }}
        />
      </GoogleMap>
    </>
  );
};

export default LocationPicker;
