'use client';

import React, { useMemo, useState, useCallback } from 'react';
import {
  GoogleMap,
  MarkerF,
  CircleF,
  DirectionsRenderer,
  DirectionsService,
  useLoadScript,
} from '@react-google-maps/api';
import {
  Box,
  Typography,
  Button,
  IconButton,
  CircularProgress,
  Stack,
  Tooltip,
  useMediaQuery,
} from '@mui/material';
import { alpha, useTheme } from '@mui/material/styles';
import {
  Map as MapIcon,
  SatelliteAlt as SatelliteIcon,
  OpenInNew as OpenInNewIcon,
  GpsFixed as GpsIcon,
  CenterFocusStrong as FocusIcon,
  DirectionsWalk as WalkIcon,
  DirectionsCar as CarIcon,
  MyLocation as MyLocationIcon,
  CheckCircle as CheckIcon,
  WarningAmber as WarningIcon,
  Close as CloseIcon,
} from '@mui/icons-material';

export interface GeofenceMapProps {
  center: { lat: number; lng: number };
  radius: number;
  userPos?: { lat: number; lng: number } | null;
  inRadius?: boolean;
  title?: string;
  height?: number | string;
  editable?: boolean;
  minRadius?: number;
  maxRadius?: number;
  onCenterChange?: (pos: { lat: number; lng: number }) => void;
  onUseCurrentLocation?: () => void;
}

const libraries: ('places' | 'geometry' | 'drawing' | 'visualization')[] = ['places', 'geometry'];

const GeofenceMap: React.FC<GeofenceMapProps> = ({
  center,
  radius,
  userPos,
  inRadius,
  title = 'จุดกิจกรรม',
  height,
  editable = false,
  onCenterChange,
  onUseCurrentLocation,
}) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [mode, setMode] = useState<'roadmap' | 'satellite'>('satellite');
  const [wantRoute, setWantRoute] = useState(false);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [showingRoute, setShowingRoute] = useState(false);
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');

  const mapHeight = height ?? (isMobile ? 340 : 420);

  const containerStyle = useMemo(
    () => ({
      width: '100%',
      height: typeof mapHeight === 'number' ? mapHeight : mapHeight,
    }),
    [mapHeight]
  );

  const mapOptions = useMemo(
    () =>
      ({
        mapTypeId: mode,
        disableDefaultUI: true,
        zoomControl: !isMobile,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: editable ? 'greedy' : 'cooperative',
        clickableIcons: false,
        styles:
          mode === 'roadmap'
            ? [
                { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
              ]
            : undefined,
      }) as google.maps.MapOptions,
    [mode, isMobile, editable]
  );

  const openInMaps = useCallback(() => {
    window.open(`https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`, '_blank');
  }, [center]);

  const panTo = useCallback(
    (pos: { lat: number; lng: number }, zoom?: number) => {
      if (!map) return;
      map.panTo(pos);
      if (zoom) map.setZoom(zoom);
    },
    [map]
  );

  const clearRoute = useCallback(() => {
    setShowingRoute(false);
    setDirections(null);
    setWantRoute(false);
    setIsLoadingRoute(false);
  }, []);

  const panToCenter = useCallback(() => {
    panTo(center, 17);
    clearRoute();
  }, [panTo, center, clearRoute]);

  const panToUser = useCallback(() => {
    if (userPos) {
      panTo(userPos, 17);
      clearRoute();
    }
  }, [panTo, userPos, clearRoute]);

  const fitBoth = useCallback(() => {
    if (!map || !userPos || !(window as any).google) return;
    const bounds = new google.maps.LatLngBounds();
    bounds.extend(center);
    bounds.extend(userPos);
    map.fitBounds(bounds, 72);
  }, [map, center, userPos]);

  const startRoute = useCallback(
    (modeNext: 'DRIVING' | 'WALKING') => {
      if (!isLoaded || !userPos) return;
      setTravelMode(modeNext);
      setIsLoadingRoute(true);
      setWantRoute(true);
      setDirections(null);
      fitBoth();
    },
    [isLoaded, userPos, fitBoth]
  );

  const toggleRoute = useCallback(
    (modeNext: 'DRIVING' | 'WALKING') => {
      if (showingRoute && travelMode === modeNext) {
        clearRoute();
        return;
      }
      startRoute(modeNext);
    },
    [showingRoute, travelMode, clearRoute, startRoute]
  );

  const eventIcon = useMemo<google.maps.Symbol | undefined>(() => {
    if (!isLoaded || !(window as any).google) return undefined;
    return {
      path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
      fillColor: '#0a6bcf',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 2.5,
      scale: 1.15,
      anchor: new google.maps.Point(12, 24),
    };
  }, [isLoaded]);

  const userIcon = useMemo<google.maps.Symbol | undefined>(() => {
    if (!isLoaded || !(window as any).google) return undefined;
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#2563eb',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
      scale: 7,
    };
  }, [isLoaded]);

  const circleOptions = useMemo<google.maps.CircleOptions>(
    () => ({
      fillColor: inRadius ? '#16a34a' : '#0a6bcf',
      fillOpacity: inRadius ? 0.22 : 0.14,
      strokeColor: inRadius ? '#15803d' : '#0a6bcf',
      strokeOpacity: 0.9,
      strokeWeight: 2,
      clickable: false,
    }),
    [inRadius]
  );

  const handleDirections = useCallback((res: google.maps.DirectionsResult | null, status: string) => {
    setIsLoadingRoute(false);
    if (status === 'OK' && res) {
      setDirections(res);
      setShowingRoute(true);
    } else {
      setDirections(null);
      setWantRoute(false);
      setShowingRoute(false);
    }
  }, []);

  const statusTone = inRadius ? 'success' : showingRoute ? 'info' : 'warning';
  const statusBg =
    statusTone === 'success'
      ? alpha('#16a34a', 0.12)
      : statusTone === 'info'
        ? alpha('#0a6bcf', 0.12)
        : alpha('#d97706', 0.14);
  const statusFg =
    statusTone === 'success' ? '#15803d' : statusTone === 'info' ? '#0a6bcf' : '#b45309';

  const shellSx = {
    position: 'relative' as const,
    borderRadius: { xs: '16px', sm: '20px' },
    overflow: 'hidden',
    touchAction: editable ? 'none' : 'pan-y pinch-zoom',
    border: `1px solid ${alpha(theme.palette.divider, 0.5)}`,
    bgcolor: 'background.paper',
    boxShadow: '0 8px 28px rgba(0,0,0,0.08)',
    width: '100%',
    maxWidth: '100%',
  };

  if (loadError) {
    return (
      <Box sx={{ ...shellSx, p: 4, textAlign: 'center' }}>
        <Typography fontWeight={700} color="error" gutterBottom>
          ไม่สามารถโหลดแผนที่ได้
        </Typography>
        <Typography variant="body2" color="text.secondary">
          ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่
        </Typography>
      </Box>
    );
  }

  if (!isLoaded) {
    return (
      <Box sx={{ ...shellSx, minHeight: mapHeight, display: 'grid', placeItems: 'center' }}>
        <Stack alignItems="center" spacing={1.5}>
          <CircularProgress size={36} />
          <Typography variant="body2" color="text.secondary">
            กำลังโหลดแผนที่…
          </Typography>
        </Stack>
      </Box>
    );
  }

  const ToolBtn = ({
    title: tip,
    onClick,
    active,
    children,
  }: {
    title: string;
    onClick: () => void;
    active?: boolean;
    children: React.ReactNode;
  }) => (
    <Tooltip title={tip} arrow>
      <IconButton
        size="small"
        onClick={onClick}
        aria-label={tip}
        sx={{
          bgcolor: active ? alpha('#0a6bcf', 0.14) : alpha(theme.palette.background.paper, 0.92),
          color: active ? '#0a6bcf' : 'text.primary',
          border: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
          boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
          '&:hover': { bgcolor: alpha('#0a6bcf', 0.1) },
        }}
      >
        {children}
      </IconButton>
    </Tooltip>
  );

  return (
    <Box sx={shellSx}>
      {/* Compact status strip */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 1.5,
          py: 1,
          bgcolor: statusBg,
          borderBottom: `1px solid ${alpha(theme.palette.divider, 0.25)}`,
          minWidth: 0,
        }}
      >
        {inRadius ? (
          <CheckIcon sx={{ color: statusFg, fontSize: 20, flexShrink: 0 }} />
        ) : (
          <WarningIcon sx={{ color: statusFg, fontSize: 20, flexShrink: 0 }} />
        )}
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography
            noWrap
            sx={{ fontWeight: 800, fontSize: '0.85rem', color: 'text.primary', lineHeight: 1.25 }}
          >
            {title}
          </Typography>
          <Typography
            noWrap
            sx={{ fontWeight: 600, fontSize: '0.72rem', color: statusFg, lineHeight: 1.2 }}
          >
            {inRadius
              ? 'อยู่ในพื้นที่แล้ว — พร้อมลงทะเบียน'
              : showingRoute
                ? `กำลังนำทาง (${travelMode === 'DRIVING' ? 'ขับรถ' : 'เดิน'})`
                : 'อยู่นอกพื้นที่กิจกรรม'}
          </Typography>
        </Box>
        {showingRoute && (
          <IconButton size="small" onClick={clearRoute} aria-label="ปิดเส้นทาง" sx={{ color: statusFg }}>
            <CloseIcon fontSize="small" />
          </IconButton>
        )}
      </Box>

      {/* Map */}
      <Box sx={{ position: 'relative' }}>
        <GoogleMap
          center={center}
          zoom={16}
          mapContainerStyle={containerStyle}
          options={mapOptions}
          onLoad={(m) => setMap(m)}
          onUnmount={() => setMap(null)}
          onClick={(e) => {
            if (!editable || !e.latLng) return;
            onCenterChange?.({ lat: e.latLng.lat(), lng: e.latLng.lng() });
          }}
        >
          <MarkerF position={center} icon={eventIcon} />
          <CircleF center={center} radius={Math.max(0, radius || 0)} options={circleOptions} />
          {userPos && <MarkerF position={userPos} icon={userIcon} />}

          {wantRoute && userPos && (
            <DirectionsService
              options={{
                origin: userPos,
                destination: center,
                travelMode: (google.maps.TravelMode as any)[travelMode],
              }}
              callback={handleDirections as any}
            />
          )}
          {directions && showingRoute && (
            <DirectionsRenderer
              options={{
                directions,
                suppressMarkers: true,
                polylineOptions: {
                  strokeColor: '#0a6bcf',
                  strokeOpacity: 0.95,
                  strokeWeight: 5,
                },
              }}
            />
          )}
        </GoogleMap>

        {/* Floating tools — top right */}
        <Stack
          spacing={0.75}
          sx={{ position: 'absolute', top: 10, right: 10, zIndex: 3 }}
        >
          <ToolBtn title="โฟกัสจุดกิจกรรม" onClick={panToCenter}>
            <FocusIcon fontSize="small" />
          </ToolBtn>
          {userPos ? (
            <ToolBtn title="ไปตำแหน่งของฉัน" onClick={panToUser}>
              <GpsIcon fontSize="small" />
            </ToolBtn>
          ) : (
            onUseCurrentLocation && (
              <ToolBtn title="ค้นหาตำแหน่งฉัน" onClick={onUseCurrentLocation}>
                <GpsIcon fontSize="small" />
              </ToolBtn>
            )
          )}
          <ToolBtn
            title={mode === 'satellite' ? 'แผนที่' : 'ดาวเทียม'}
            onClick={() => setMode((m) => (m === 'satellite' ? 'roadmap' : 'satellite'))}
            active={mode === 'satellite'}
          >
            {mode === 'satellite' ? <MapIcon fontSize="small" /> : <SatelliteIcon fontSize="small" />}
          </ToolBtn>
          <ToolBtn title="เปิดใน Google Maps" onClick={openInMaps}>
            <OpenInNewIcon fontSize="small" />
          </ToolBtn>
          {editable && onUseCurrentLocation && (
            <ToolBtn title="ตั้งจุดเป็นตำแหน่งฉัน" onClick={onUseCurrentLocation}>
              <MyLocationIcon fontSize="small" />
            </ToolBtn>
          )}
        </Stack>

        {isLoadingRoute && (
          <Box
            sx={{
              position: 'absolute',
              inset: 0,
              zIndex: 4,
              display: 'grid',
              placeItems: 'center',
              bgcolor: alpha('#fff', 0.55),
              backdropFilter: 'blur(4px)',
            }}
          >
            <Stack alignItems="center" spacing={1}>
              <CircularProgress size={32} />
              <Typography variant="caption" fontWeight={700}>
                กำลังค้นหาเส้นทาง…
              </Typography>
            </Stack>
          </Box>
        )}
      </Box>

      {/* Primary actions — always visible when outside */}
      {!inRadius && userPos && (
        <Box
          sx={{
            p: 1.25,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
            bgcolor: alpha(theme.palette.background.default, 0.65),
          }}
        >
          <Typography
            variant="caption"
            sx={{ display: 'block', mb: 1, color: 'text.secondary', fontWeight: 600 }}
          >
            {showingRoute
              ? 'กำลังแสดงเส้นทางไปยังจุดกิจกรรม'
              : 'กดปุ่มด้านล่างเพื่อนำทางไปยังจุดกิจกรรม'}
          </Typography>
          <Stack direction="row" spacing={1}>
            <Button
              fullWidth
              variant={showingRoute && travelMode === 'DRIVING' ? 'contained' : 'outlined'}
              startIcon={<CarIcon />}
              onClick={() => toggleRoute('DRIVING')}
              sx={{
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '12px',
                py: 1,
                ...(showingRoute && travelMode === 'DRIVING'
                  ? { bgcolor: '#0a6bcf', '&:hover': { bgcolor: '#0858ad' } }
                  : {}),
              }}
            >
              {showingRoute && travelMode === 'DRIVING' ? 'ปิดเส้นทาง' : 'ขับรถ'}
            </Button>
            <Button
              fullWidth
              variant={showingRoute && travelMode === 'WALKING' ? 'contained' : 'outlined'}
              startIcon={<WalkIcon />}
              onClick={() => toggleRoute('WALKING')}
              sx={{
                fontWeight: 800,
                textTransform: 'none',
                borderRadius: '12px',
                py: 1,
                ...(showingRoute && travelMode === 'WALKING'
                  ? { bgcolor: '#0a6bcf', '&:hover': { bgcolor: '#0858ad' } }
                  : {}),
              }}
            >
              {showingRoute && travelMode === 'WALKING' ? 'ปิดเส้นทาง' : 'เดิน'}
            </Button>
          </Stack>
        </Box>
      )}

      {/* In-radius confirmation */}
      {inRadius && (
        <Box
          sx={{
            px: 1.5,
            py: 1,
            borderTop: `1px solid ${alpha('#16a34a', 0.25)}`,
            bgcolor: alpha('#16a34a', 0.08),
            display: 'flex',
            alignItems: 'center',
            gap: 1,
          }}
        >
          <CheckIcon sx={{ color: '#15803d', fontSize: 18 }} />
          <Typography variant="caption" sx={{ fontWeight: 700, color: '#15803d' }}>
            คุณอยู่ในรัศมีกิจกรรมแล้ว
          </Typography>
        </Box>
      )}

      {/* No GPS yet */}
      {!userPos && !editable && (
        <Box
          sx={{
            p: 1.25,
            borderTop: `1px solid ${alpha(theme.palette.divider, 0.35)}`,
          }}
        >
          <Button
            fullWidth
            variant="contained"
            startIcon={<GpsIcon />}
            onClick={onUseCurrentLocation}
            disabled={!onUseCurrentLocation}
            sx={{
              fontWeight: 800,
              textTransform: 'none',
              borderRadius: '12px',
              py: 1.1,
              bgcolor: '#0a6bcf',
              '&:hover': { bgcolor: '#0858ad' },
            }}
          >
            เปิดตำแหน่งของฉัน
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default GeofenceMap;
