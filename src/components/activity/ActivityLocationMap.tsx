// components/activity/ActivityLocationMap.tsx
'use client';
import React from 'react';
import {
  Alert,
  Box,
  CircularProgress,
  Typography
} from '@mui/material';
import {
  CheckCircle as CheckIcon,
  Close as CloseIcon
} from '@mui/icons-material';
import { GoogleMap, MarkerF, CircleF, useLoadScript } from '@react-google-maps/api';

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

// กำหนด libraries array นอก component
const libraries: ("places" | "geometry")[] = ['places', 'geometry'];

const ActivityLocationMap: React.FC<ActivityLocationMapProps> = ({ 
  latitude, 
  longitude, 
  radius, 
  activityName, 
  userLocation 
}) => {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const center = { lat: latitude, lng: longitude };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI/180; // φ, λ in radians
    const φ2 = lat2 * Math.PI/180;
    const Δφ = (lat2-lat1) * Math.PI/180;
    const Δλ = (lon2-lon1) * Math.PI/180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  if (loadError) {
    return (
      <Alert severity="error">
        ไม่สามารถโหลดแผนที่ได้: {loadError.message}
      </Alert>
    );
  }

  if (!isLoaded) {
    return (
      <Box sx={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        height: '300px',
        flexDirection: 'column',
        gap: 2,
        bgcolor: 'grey.50',
        borderRadius: 1
      }}>
        <CircularProgress size={32} />
        <Typography variant="body2" color="text.secondary">
          กำลังโหลดแผนที่...
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
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
          mapTypeId: 'roadmap'
        }}
      >
        {/* Activity Location Marker */}
        <MarkerF
          position={center}
          title={`ตำแหน่งกิจกรรม: ${activityName}`}
          icon={{
            url: 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHBhdGggZD0iTTE2IDNDMTAuNDc3IDMgNiA3LjQ3NyA2IDEzQzYgMTguMTEzIDkuNjEzIDI0LjIxNiAxNS4wIDI4LjkwMEMxNS4zODQgMjkuMzY2IDE2LjYxNiAyOS4zNjYgMTcgMjguOTAwQzIyLjM4NyAyNC4yMTYgMjYgMTguMTEzIDI2IDEzQzI2IDcuNDc3IDIxLjUyMyAzIDE2IDNaIiBmaWxsPSIjRUY0NDQ0Ii8+CjxjaXJjbGUgY3g9IjE2IiBjeT0iMTMiIHI9IjQiIGZpbGw9IndoaXRlIi8+Cjwvc3ZnPgo=',
            scaledSize: new window.google.maps.Size(32, 32),
            anchor: new window.google.maps.Point(16, 32),
          }}
        />
        
        {/* User Location Marker */}
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
        
        {/* Check-in Radius Circle */}
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
      
      {/* Location Status Info */}
      {userLocation && (
        <Box sx={{ 
          mt: 2, 
          p: 2, 
          bgcolor: 'grey.50', 
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'grey.200'
        }}>
          <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
            ข้อมูลตำแหน่ง
          </Typography>
          
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <Typography variant="body2" color="text.secondary">
              ระยะห่างจากจุดกิจกรรม: <strong>{Math.round(calculateDistance(
                userLocation.lat, userLocation.lng, 
                latitude, longitude
              ))} เมตร</strong>
            </Typography>
            
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              {calculateDistance(userLocation.lat, userLocation.lng, latitude, longitude) <= radius ? (
                <>
                  <CheckIcon sx={{ color: 'success.main', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: 'success.main', fontWeight: 'bold' }}>
                    ✅ อยู่ในพื้นที่กิจกรรม - สามารถเช็คอินได้
                  </Typography>
                </>
              ) : (
                <>
                  <CloseIcon sx={{ color: 'error.main', fontSize: 20 }} />
                  <Typography variant="body2" sx={{ color: 'error.main', fontWeight: 'bold' }}>
                    ❌ อยู่นอกพื้นที่กิจกรรม - ไม่สามารถเช็คอินได้
                  </Typography>
                </>
              )}
            </Box>
            
            <Box sx={{ 
              mt: 1, 
              p: 1.5, 
              bgcolor: 'info.50', 
              borderRadius: 1,
              border: '1px solid',
              borderColor: 'info.200'
            }}>
              <Typography variant="caption" color="info.dark">
                <strong>หมายเหตุ:</strong> คุณต้องอยู่ในรัศมี {radius} เมตร จากจุดกิจกรรมเพื่อทำการเช็คอิน
              </Typography>
            </Box>
          </Box>
        </Box>
      )}
      
      {/* Map Legend */}
      <Box sx={{ 
        mt: 2, 
        p: 2, 
        bgcolor: 'primary.50', 
        borderRadius: 1,
        border: '1px solid',
        borderColor: 'primary.200'
      }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.dark' }}>
          คำอธิบายสัญลักษณ์
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              bgcolor: '#EF4444', 
              borderRadius: '50% 50% 50% 0%',
              transform: 'rotate(-45deg)',
              border: '2px solid white'
            }} />
            <Typography variant="caption" color="text.secondary">
              จุดกิจกรรม
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              bgcolor: '#3B82F6', 
              borderRadius: '50%',
              border: '2px solid white'
            }} />
            <Typography variant="caption" color="text.secondary">
              ตำแหน่งของคุณ {!userLocation && '(ยังไม่ได้ค้นหา)'}
            </Typography>
          </Box>
          
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <Box sx={{ 
              width: 16, 
              height: 16, 
              bgcolor: 'rgba(16, 185, 129, 0.2)', 
              border: '2px solid #10B981',
              borderRadius: '50%'
            }} />
            <Typography variant="caption" color="text.secondary">
              พื้นที่เช็คอิน (รัศมี {radius} เมตร)
            </Typography>
          </Box>
        </Box>
      </Box>
    </Box>
  );
};

export default ActivityLocationMap;