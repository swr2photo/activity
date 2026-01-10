'use client';

import React, { useState, useEffect } from 'react';
import { Box, Typography, Button, Stack, alpha, useTheme } from '@mui/material';
import { MyLocation as LocationIcon, Map as MapIcon } from '@mui/icons-material';
// สมมติว่าใช้ Google Maps หรือ Leaflet (ในที่นี้เขียนโครงสร้างแบบ Universal ให้)
// หมายเหตุ: คุณต้องมี API Key หรือ Library เช่น @react-google-maps/api หรือ react-leaflet

interface GeofenceMapProps {
  center: { lat: number; lng: number };
  radius: number;
  onCenterChange?: (pos: { lat: number; lng: number }) => void;
  onUseCurrentLocation?: () => void;
  editable?: boolean;
  title?: string;
}

export default function GeofenceMap({ 
  center, 
  radius, 
  onCenterChange, 
  onUseCurrentLocation, 
  editable = false,
  title = "ตำแหน่งกิจกรรม"
}: GeofenceMapProps) {
  const theme = useTheme();

  return (
    <Box sx={{ width: '100%', mb: 2 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <MapIcon fontSize="small" color="primary" /> {title}
        </Typography>
        {editable && onUseCurrentLocation && (
          <Button 
            size="small" 
            startIcon={<LocationIcon />} 
            onClick={onUseCurrentLocation}
            sx={{ borderRadius: 2 }}
          >
            ใช้ตำแหน่งปัจจุบัน
          </Button>
        )}
      </Stack>

      {/* Map Container - ในที่นี้จำลองเป็น Placeholder */}
      {/* ในการใช้งานจริง ให้เปลี่ยน Box นี้เป็น <GoogleMap> หรือ <MapContainer> */}
      
      <Box sx={{ 
        height: 300, 
        width: '100%', 
        bgcolor: 'grey.100', 
        borderRadius: 4, 
        border: '1px solid',
        borderColor: 'divider',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
        overflow: 'hidden'
      }}>
        <Box sx={{ textAlign: 'center', p: 3 }}>
          <Typography variant="body2" color="text.secondary">
            พิกัด: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
          </Typography>
          <Typography variant="caption" color="text.disabled">
            รัศมีการเช็คอิน: {radius} เมตร
          </Typography>
          {editable && (
            <Typography variant="caption" display="block" color="primary" sx={{ mt: 1 }}>
              * คลิกบนแผนที่หรือลากหมุดเพื่อเปลี่ยนตำแหน่ง
            </Typography>
          )}
        </Box>
        
        {/* จำลองวงกลม Geofence */}
        <Box sx={{ 
          position: 'absolute',
          width: Math.min(radius * 2, 250), // จำลองขนาดวงกลมตามรัศมี
          height: Math.min(radius * 2, 250),
          borderRadius: '50%',
          border: `2px solid ${theme.palette.primary.main}`,
          bgcolor: alpha(theme.palette.primary.main, 0.1),
          pointerEvents: 'none'
        }} />
        <LocationIcon color="primary" sx={{ position: 'absolute', fontSize: 40, mb: 5 }} />
      </Box>
    </Box>
  );
}