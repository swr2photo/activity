'use client';
import React, { useMemo, useState, useCallback } from 'react';
import {
  GoogleMap,
  MarkerF,
  CircleF,
  DirectionsRenderer,
  DirectionsService,
  OverlayView,
  useLoadScript,
} from '@react-google-maps/api';
import {
  Box,
  Chip,
  Typography,
  SpeedDial,
  SpeedDialAction,
  SpeedDialIcon,
  useMediaQuery,
  Fade,
  Backdrop,
  CircularProgress,
} from '@mui/material';
import { alpha, keyframes, useTheme, styled } from '@mui/material/styles';
import type { Theme } from '@mui/material/styles';
import type { PaletteColor } from '@mui/material';
import {
  Map as MapIcon,
  SatelliteAlt as SatelliteIcon,
  Language as LanguageIcon,
  NearMe as RouteIcon,
  GpsFixed as GpsIcon,
  CenterFocusStrong as FocusIcon,
  LocationOn as LocationIcon,
  DirectionsWalk as WalkIcon,
  DirectionsCar as CarIcon,
  MyLocation as MyLocationIcon,
} from '@mui/icons-material';

export interface GeofenceMapProps {
  center: { lat: number; lng: number };
  radius: number; // meters
  userPos?: { lat: number; lng: number } | null;
  inRadius?: boolean;
  title?: string;
  height?: number | string;

  // โหมดแก้ไข (ใช้ในแอดมิน)
  editable?: boolean;
  minRadius?: number;
  maxRadius?: number;
  onCenterChange?: (pos: { lat: number; lng: number }) => void;

  // ปุ่มขอใช้ตำแหน่งปัจจุบัน (ทั้งฝั่งแอดมิน/ผู้ใช้)
  onUseCurrentLocation?: () => void;
}

const defaultContainerStyle = { width: '100%', height: 480 } as const;

/* ============== Utils ============== */
type ActionColor = 'primary' | 'secondary' | 'success' | 'warning' | 'error' | 'info';
type Action = {
  icon: React.ReactNode;
  name: string;
  onClick: () => void;
  color: ActionColor;
};
const tone = (t: Theme, key: ActionColor) =>
  ((t.palette as any)[key] as PaletteColor).main as string;

/* ============== Animations ============== */
const pulse = keyframes`
  0% { transform: scale(1); opacity: .8; box-shadow: 0 0 0 0 rgba(34,197,94,.7); }
  50% { transform: scale(1.2); opacity: .6; box-shadow: 0 0 0 8px rgba(34,197,94,.3); }
  100% { transform: scale(1.6); opacity: 0; box-shadow: 0 0 0 16px rgba(34,197,94,0); }
`;
const shimmer = keyframes`
  0% { background-position: -200px 0; }
  100% { background-position: calc(200px + 100%) 0; }
`;
const bounceIn = keyframes`
  0% { transform: translate(-50%, -110%) scale(.3); opacity: 0; }
  50% { transform: translate(-50%, -110%) scale(1.1); opacity: .8; }
  100% { transform: translate(-50%, -110%) scale(1); opacity: 1; }
`;
const floatUpDown = keyframes`
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-3px); }
`;

/* ============== Styled ============== */
const StyledMapContainer = styled(Box)(({ theme }) => ({
  position: 'relative',
  borderRadius: theme.spacing(2),
  overflow: 'hidden',
  boxShadow: `
    0 8px 32px rgba(0,0,0,.12),
    0 2px 16px rgba(0,0,0,.08),
    inset 0 0 0 1px ${alpha(theme.palette.divider, .1)}
  `,
}));

const GlassmorphicChip = styled(Chip)(({ theme }) => ({
  backgroundColor: alpha(theme.palette.background.paper, 0.95),
  backdropFilter: 'blur(20px) saturate(180%)',
  border: `1px solid ${alpha(theme.palette.divider, 0.25)}`,
  boxShadow: `0 8px 32px rgba(0,0,0,.12)`,
  fontWeight: 700,
  letterSpacing: '0.25px',
}));

const EnhancedTitleCard = styled(Box)(({ theme }) => ({
  position: 'absolute',
  zIndex: 5,
  top: 16,
  left: 16,
  right: 16,
  padding: theme.spacing(1.25, 1.75),
  background: `linear-gradient(135deg,
    ${alpha(theme.palette.background.paper, .98)} 0%,
    ${alpha(theme.palette.background.paper, .92)} 100%)`,
  backdropFilter: 'blur(24px) saturate(200%)',
  border: `1px solid ${alpha(theme.palette.divider, .2)}`,
  borderRadius: theme.spacing(2),
  boxShadow: `
    0 12px 40px rgba(0,0,0,.15),
    0 4px 16px rgba(0,0,0,.1),
    inset 0 1px 0 ${alpha('#fff', .15)}
  `,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: theme.spacing(1.25),
  pointerEvents: 'none',
  animation: `${bounceIn} .8s cubic-bezier(.68,-.55,.265,1.55)`,
  textAlign: 'center',
}));

const LoadingOverlay = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(4),
  background: `linear-gradient(135deg,
    ${alpha(theme.palette.background.paper, .95)} 0%,
    ${alpha(theme.palette.background.default, .98)} 100%)`,
  backdropFilter: 'blur(10px)',
  borderRadius: theme.spacing(2),
  '&::before': {
    content: '""',
    position: 'absolute',
    top: 0,
    left: '-100%',
    width: '100%',
    height: '100%',
    background: `linear-gradient(90deg, transparent, ${alpha(theme.palette.primary.main, .1)}, transparent)`,
    animation: `${shimmer} 2s infinite`,
  },
}));

interface StatusBarProps { inRadius?: boolean }
const StatusBar = styled(
  Box,
  { shouldForwardProp: (prop) => prop !== 'inRadius' }
)<StatusBarProps>(({ theme, inRadius }) => ({
  padding: theme.spacing(1.25, 2),
  background: inRadius
    ? alpha(theme.palette.success.main, .06)
    : alpha(theme.palette.warning.main, .06),
  borderTop: `1px solid ${alpha(theme.palette.divider, .1)}`,
  backdropFilter: 'blur(8px)',
  transition: 'all .3s ease-in-out',
}));

/* ============== Component ============== */
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
  });

  const [map, setMap] = useState<any | null>(null);
  const [mode, setMode] = useState<'roadmap' | 'satellite'>('satellite');
  const [wantRoute, setWantRoute] = useState(false);
  const [directions, setDirections] = useState<any | null>(null);
  const [isLoadingRoute, setIsLoadingRoute] = useState(false);
  const [showingRoute, setShowingRoute] = useState(false);
  const [travelMode, setTravelMode] = useState<'DRIVING' | 'WALKING'>('DRIVING');

  /* Container */
  const containerStyle = useMemo(
    () => ({
      ...defaultContainerStyle,
      height: height ?? (isMobile ? 440 : 560),
      borderRadius: theme.spacing(2),
    }),
    [height, isMobile, theme]
  );

  /* Map options */
  const mapOptions = useMemo(
    () =>
      ({
        mapTypeId: mode,
        disableDefaultUI: true,
        zoomControl: !isMobile,
        streetViewControl: false,
        mapTypeControl: false,
        fullscreenControl: false,
        gestureHandling: 'greedy',
        clickableIcons: false,
        styles:
          mode === 'roadmap'
            ? [
                { featureType: 'poi.business', stylers: [{ visibility: 'off' }] },
                { featureType: 'transit', elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
              ]
            : undefined,
      } as google.maps.MapOptions),
    [mode, isMobile]
  );

  /* Helpers */
  const openInMaps = useCallback(() => {
    window.open(
      `https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`,
      '_blank'
    );
  }, [center]);

  const panTo = useCallback(
    (pos: { lat: number; lng: number }, zoom?: number) => {
      if (!map) return;
      map.panTo(pos);
      if (zoom) map.setZoom(zoom);
    },
    [map]
  );

  const panToCenter = useCallback(() => {
    panTo(center, 17);
    if (showingRoute) {
      setShowingRoute(false);
      setDirections(null);
      setWantRoute(false);
    }
  }, [panTo, center, showingRoute]);

  const panToUser = useCallback(() => {
    if (userPos) {
      panTo(userPos, 17);
      if (showingRoute) {
        setShowingRoute(false);
        setDirections(null);
        setWantRoute(false);
      }
    }
  }, [panTo, userPos, showingRoute]);

  /* Icons */
  const eventIcon = useMemo<google.maps.Symbol | undefined>(() => {
    if (!isLoaded || !(window as any).google) return undefined;
    return {
      path: 'M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z',
      fillColor: '#111111',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
      scale: 1.2,
      anchor: new google.maps.Point(12, 24),
    };
  }, [isLoaded]);

  const userIcon = useMemo<google.maps.Symbol | undefined>(() => {
    if (!isLoaded || !(window as any).google) return undefined;
    return {
      path: google.maps.SymbolPath.CIRCLE,
      fillColor: '#1976D2',
      fillOpacity: 1,
      strokeColor: '#FFFFFF',
      strokeWeight: 3,
      scale: 8,
    };
  }, [isLoaded]);

  /* Geofence circle */
  const circleOptions = useMemo<google.maps.CircleOptions>(
    () => ({
      fillColor: '#22C55E',
      fillOpacity: inRadius ? 0.25 : 0.15,
      strokeColor: inRadius ? '#16A34A' : '#22C55E',
      strokeOpacity: inRadius ? 1 : 0.8,
      strokeWeight: inRadius ? 3 : 2,
      clickable: false,
    }),
    [inRadius]
  );

  /* Actions */
  const rawActions: Array<Action | false | undefined | null> = [
    { icon: <FocusIcon />, name: 'โฟกัสจุดกิจกรรม', onClick: panToCenter, color: 'primary' },
    userPos
      ? { icon: <GpsIcon />, name: 'ไปตำแหน่งของฉัน', onClick: panToUser, color: 'info' }
      : onUseCurrentLocation && {
          icon: <GpsIcon />, name: 'ค้นหาตำแหน่งฉัน', onClick: onUseCurrentLocation, color: 'secondary',
        },
    { icon: <MapIcon />, name: 'แผนที่', onClick: () => setMode('roadmap'), color: 'success' },
    { icon: <SatelliteIcon />, name: 'ดาวเทียม', onClick: () => setMode('satellite'), color: 'success' },
    { icon: <LanguageIcon />, name: 'เปิดใน Google Maps', onClick: openInMaps, color: 'warning' },
    editable && onUseCurrentLocation && {
      icon: <MyLocationIcon />, name: 'ตั้งจุดกิจกรรมเป็นตำแหน่งฉัน', onClick: onUseCurrentLocation, color: 'info',
    },
    userPos && {
      icon: showingRoute ? <RouteIcon sx={{ transform: 'rotate(180deg)' }} /> : <RouteIcon />,
      name: showingRoute ? 'ยกเลิกเส้นทาง' : 'แสดงเส้นทาง (ขับรถ)',
      onClick: () => {
        if (!isLoaded) return;
        if (showingRoute) {
          setShowingRoute(false);
          setDirections(null);
          setWantRoute(false);
          setIsLoadingRoute(false);
        } else {
          setTravelMode('DRIVING');
          setIsLoadingRoute(true);
          setWantRoute(true);
          setDirections(null);
          if (map && (window as any).google) {
            const bounds = new google.maps.LatLngBounds();
            bounds.extend(center);
            bounds.extend(userPos!);
            map.fitBounds(bounds, 80);
          }
        }
      },
      color: 'error',
    },
    userPos && !showingRoute && {
      icon: <WalkIcon />,
      name: 'เส้นทาง (เดินเท้า)',
      onClick: () => {
        if (!isLoaded) return;
        setTravelMode('WALKING');
        setIsLoadingRoute(true);
        setWantRoute(true);
        setDirections(null);
        if (map && (window as any).google) {
          const bounds = new google.maps.LatLngBounds();
          bounds.extend(center);
          bounds.extend(userPos!);
          map.fitBounds(bounds, 80);
        }
      },
      color: 'error',
    },
  ];
  const actions: Action[] = rawActions.filter((a): a is Action => Boolean(a));

  /* Directions callback */
  const handleDirections = useCallback((res: any, status: any) => {
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

  /* Guards */
  if (loadError) {
    return (
      <StyledMapContainer>
        <LoadingOverlay>
          <Typography variant="h6" color="error" gutterBottom>ไม่สามารถโหลดแผนที่ได้</Typography>
          <Typography variant="body2" color="text.secondary">กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต</Typography>
        </LoadingOverlay>
      </StyledMapContainer>
    );
  }
  if (!isLoaded) {
    return (
      <StyledMapContainer>
        <LoadingOverlay>
          <CircularProgress size={48} thickness={3.6} sx={{ mb: 2 }} />
          <Typography variant="h6" gutterBottom>กำลังโหลดแผนที่...</Typography>
          <Typography variant="body2" color="text.secondary">โปรดรอสักครู่</Typography>
        </LoadingOverlay>
      </StyledMapContainer>
    );
  }

  /* Render */
  return (
    <StyledMapContainer>
      {/* Title */}
      <EnhancedTitleCard>
        <LocationIcon
          fontSize={isMobile ? 'medium' : 'small'}
          sx={{ color: 'primary.main', animation: `${floatUpDown} 2s ease-in-out infinite` }}
        />
        <Box>
          <Typography
            variant={isMobile ? 'h6' : 'subtitle2'}
            sx={{ fontWeight: 800, letterSpacing: '0.5px', color: 'text.primary', lineHeight: 1.2 }}
          >
            {title}
          </Typography>
          <Typography
            variant="caption"
            sx={{
              display: 'block',
              fontWeight: 600,
              color: inRadius ? 'success.main' : showingRoute ? 'info.main' : 'warning.main',
              mt: 0.25,
              fontSize: isMobile ? '0.75rem' : '0.7rem',
            }}
          >
            {inRadius ? '✓ อยู่ในพื้นที่'
              : showingRoute ? '→ กำลังแสดงเส้นทาง'
              : '⚠ นอกพื้นที่'}
          </Typography>
        </Box>
      </EnhancedTitleCard>

      {/* SpeedDial */}
      <SpeedDial
        ariaLabel="เครื่องมือแผนที่"
        icon={<SpeedDialIcon />}
        direction={isMobile ? 'up' : 'right'}
        sx={{
          position: 'absolute',
          zIndex: 6,
          bottom: 64,
          left: 16,
          '& .MuiFab-root': {
            background: alpha(theme.palette.background.paper, 0.95),
            backdropFilter: 'blur(20px)',
            border: `1px solid ${alpha(theme.palette.divider, 0.15)}`,
            boxShadow: `0 8px 32px rgba(0,0,0,.12), 0 2px 8px rgba(0,0,0,.08)`,
          },
        }}
      >
        {actions.map((action) => (
          <SpeedDialAction
            key={action.name}
            icon={action.icon}
            tooltipTitle={action.name}
            tooltipOpen={false}
            tooltipPlacement={isMobile ? 'right' : 'top'}
            onClick={action.onClick}
            FabProps={{
              size: isMobile ? 'small' : 'medium',
              color: action.color as any,
              sx: (t) => ({
                bgcolor: 'background.paper',
                border: `1px solid ${alpha(t.palette.divider, 0.1)}`,
                boxShadow: `0 4px 20px ${alpha(tone(t, action.color), 0.2)}`,
                ...(isMobile && { width: 40, height: 40, minHeight: 40 }),
                '&:hover': {
                  bgcolor: alpha(tone(t, action.color), 0.1),
                  transform: 'scale(1.08)',
                  boxShadow: `0 8px 32px ${alpha(tone(t, action.color), 0.3)}`,
                },
              }),
            }}
          />
        ))}
      </SpeedDial>

      {/* Backdrop loading route */}
      <Backdrop
        sx={{
          position: 'absolute',
          zIndex: 4,
          borderRadius: 2,
          bgcolor: alpha(theme.palette.background.paper, 0.8),
          backdropFilter: 'blur(8px)',
        }}
        open={isLoadingRoute}
      >
        <Box textAlign="center">
          <CircularProgress size={40} thickness={4} sx={{ mb: 2 }} />
          <Typography variant="body2">กำลังค้นหาเส้นทาง...</Typography>
        </Box>
      </Backdrop>

      {/* Google Map */}
      <GoogleMap
        center={center}
        zoom={16}
        mapContainerStyle={containerStyle}
        options={mapOptions}
        onLoad={(m) => setMap(m)}
        onUnmount={() => setMap(null)}
        onClick={(e) => {
          if (!editable || !e.latLng) return;
          const pos = { lat: e.latLng.lat(), lng: e.latLng.lng() };
          onCenterChange?.(pos);
        }}
      >
        <MarkerF position={center} icon={eventIcon} />
        <CircleF center={center} radius={Math.max(0, radius || 0)} options={circleOptions} />

        {/* Label */}
        <OverlayView position={center} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
          <Box
            sx={{
              transform: 'translate(-50%, -56%)',
              display: 'flex',
              alignItems: 'center',
              pointerEvents: 'none',
            }}
          >
            <Box
              sx={{
                position: 'relative',
                width: 18,
                height: 18,
                borderRadius: '50%',
                bgcolor: inRadius ? '#16A34A' : '#EAB308',
                boxShadow: (t) => `0 0 0 4px ${t.palette.background.paper}`,
                animation: `${pulse} 2s ease-out infinite`,
                zIndex: 1,
              }}
            />
            <GlassmorphicChip
              label={title}
              size={isMobile ? 'medium' : 'small'}
              sx={{
                ml: 1.5,
                px: 1.25,
                fontWeight: 700,
                fontSize: isMobile ? '0.9rem' : '0.75rem',
                color: 'text.primary',
                bgcolor: '#fff',
                border: (t) => `1px solid ${alpha(t.palette.divider, 0.25)}`,
                boxShadow: '0 6px 18px rgba(0,0,0,.12)',
                animation: `${bounceIn} .7s cubic-bezier(.68,-.55,.265,1.55) .2s both`,
                maxWidth: isMobile ? '86vw' : 520,
                '& .MuiChip-label': { wordBreak: 'break-word', lineHeight: 1.25 },
              }}
            />
          </Box>
        </OverlayView>

        {userPos && <MarkerF position={userPos} icon={userIcon} />}

        {wantRoute && userPos && (
          <DirectionsService
            options={{
              origin: userPos,
              destination: center,
              travelMode: (google.maps.TravelMode as any)[travelMode],
            }}
            callback={handleDirections}
          />
        )}
        {directions && showingRoute && (
          <DirectionsRenderer
            options={{
              directions,
              suppressMarkers: true,
              polylineOptions: {
                strokeColor: theme.palette.primary.main,
                strokeOpacity: 0.95,
                strokeWeight: 5,
              },
            }}
          />
        )}
      </GoogleMap>

      {/* (ถอดตัวเลื่อนรัศมีในแผนที่ออกตามที่ขอ) */}

      {/* Status */}
      <StatusBar inRadius={inRadius}>
        <Fade in timeout={800}>
          <Typography
            variant="caption"
            sx={{
              fontWeight: 600,
              color: inRadius ? 'success.main' : showingRoute ? 'info.main' : 'warning.main',
              display: 'flex',
              alignItems: 'center',
              gap: 1,
            }}
          >
            <Box
              component="span"
              sx={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                bgcolor: inRadius ? 'success.main' : showingRoute ? 'info.main' : 'warning.main',
                animation: `${pulse} 2s ease-in-out infinite`,
              }}
            />
            {inRadius
              ? 'คุณอยู่ในพื้นที่กิจกรรม — พร้อมเข้าร่วมแล้ว!'
              : showingRoute
              ? `กำลังแสดงเส้นทาง (${travelMode === 'DRIVING' ? 'ขับรถ' : 'เดินเท้า'}) — กดปุ่มเส้นทางอีกครั้งเพื่อยกเลิก`
              : 'คุณอยู่นอกพื้นที่ — กดปุ่ม "แสดงเส้นทาง" เพื่อนำทางไปยังจุดกิจกรรม'}
          </Typography>
        </Fade>
      </StatusBar>
    </StyledMapContainer>
  );
};

export default GeofenceMap;
