'use client';

import React, { useMemo, useState, useCallback, useEffect } from 'react';
import {
  GoogleMap,
  MarkerF,
  CircleF,
  DirectionsRenderer,
  DirectionsService,
  useLoadScript,
} from '@react-google-maps/api';
import {
  Map as MapIcon,
  Satellite,
  ExternalLink,
  Crosshair,
  LocateFixed,
  Footprints,
  Car,
  MapPin,
  CheckCircle2,
  TriangleAlert,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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

const libraries: ('places' | 'geometry' | 'drawing' | 'visualization')[] = [
  'places',
  'geometry',
];

function useIsMobile(breakpoint = 640) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const update = () => setIsMobile(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
  }, [breakpoint]);
  return isMobile;
}

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
  const isMobile = useIsMobile();

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
                {
                  featureType: 'transit',
                  elementType: 'labels.icon',
                  stylers: [{ visibility: 'off' }],
                },
              ]
            : undefined,
      }) as google.maps.MapOptions,
    [mode, isMobile, editable]
  );

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

  const handleDirections = useCallback(
    (res: google.maps.DirectionsResult | null, status: string) => {
      setIsLoadingRoute(false);
      if (status === 'OK' && res) {
        setDirections(res);
        setShowingRoute(true);
      } else {
        setDirections(null);
        setWantRoute(false);
        setShowingRoute(false);
      }
    },
    []
  );

  const statusTone = inRadius ? 'success' : showingRoute ? 'info' : 'warning';
  const statusBg =
    statusTone === 'success'
      ? 'bg-emerald-500/10'
      : statusTone === 'info'
        ? 'bg-[#0a6bcf]/10'
        : 'bg-amber-500/15';
  const statusFg =
    statusTone === 'success'
      ? 'text-emerald-700'
      : statusTone === 'info'
        ? 'text-[#0a6bcf]'
        : 'text-amber-700';

  const shellClass = cn(
    'relative w-full max-w-full overflow-hidden rounded-2xl border border-border/50 bg-card shadow-[0_8px_28px_rgba(0,0,0,0.08)] sm:rounded-[20px]',
    editable ? 'touch-none' : 'touch-pan-y'
  );

  if (loadError) {
    return (
      <div className={cn(shellClass, 'p-8 text-center')}>
        <p className="mb-1 font-bold text-destructive">ไม่สามารถโหลดแผนที่ได้</p>
        <p className="text-sm text-muted-foreground">
          ตรวจสอบการเชื่อมต่ออินเทอร์เน็ตแล้วลองใหม่
        </p>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div
        className={cn(shellClass, 'grid place-items-center')}
        style={{ minHeight: mapHeight }}
      >
        <div className="flex flex-col items-center gap-3">
          <Spinner size="lg" />
          <p className="text-sm text-muted-foreground">กำลังโหลดแผนที่…</p>
        </div>
      </div>
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
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={onClick}
          aria-label={tip}
          className={cn(
            'h-8 w-8 border border-border/40 shadow-sm',
            active
              ? 'bg-[#0a6bcf]/15 text-[#0a6bcf] hover:bg-[#0a6bcf]/20'
              : 'bg-background/90 text-foreground hover:bg-[#0a6bcf]/10'
          )}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{tip}</TooltipContent>
    </Tooltip>
  );

  return (
    <TooltipProvider delayDuration={300}>
      <div className={shellClass}>
        <div
          className={cn(
            'flex min-w-0 items-center gap-2 border-b border-border/25 px-3 py-2',
            statusBg
          )}
        >
          {inRadius ? (
            <CheckCircle2 className={cn('h-5 w-5 shrink-0', statusFg)} />
          ) : (
            <TriangleAlert className={cn('h-5 w-5 shrink-0', statusFg)} />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-[0.85rem] font-extrabold leading-tight text-foreground">
              {title}
            </p>
            <p className={cn('truncate text-[0.72rem] font-semibold leading-tight', statusFg)}>
              {inRadius
                ? 'อยู่ในพื้นที่แล้ว — พร้อมลงทะเบียน'
                : showingRoute
                  ? `กำลังนำทาง (${travelMode === 'DRIVING' ? 'ขับรถ' : 'เดิน'})`
                  : 'อยู่นอกพื้นที่กิจกรรม'}
            </p>
          </div>
          {showingRoute && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              onClick={clearRoute}
              aria-label="ปิดเส้นทาง"
              className={cn('h-8 w-8', statusFg)}
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>

        <div className="relative">
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
            <CircleF
              center={center}
              radius={Math.max(0, radius || 0)}
              options={circleOptions}
            />
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

          <div className="absolute right-2.5 top-2.5 z-[3] flex flex-col gap-1.5">
            <ToolBtn title="โฟกัสจุดกิจกรรม" onClick={panToCenter}>
              <LocateFixed className="h-4 w-4" />
            </ToolBtn>
            {userPos ? (
              <ToolBtn title="ไปตำแหน่งของฉัน" onClick={panToUser}>
                <Crosshair className="h-4 w-4" />
              </ToolBtn>
            ) : (
              onUseCurrentLocation && (
                <ToolBtn title="ค้นหาตำแหน่งฉัน" onClick={onUseCurrentLocation}>
                  <Crosshair className="h-4 w-4" />
                </ToolBtn>
              )
            )}
            <ToolBtn
              title={mode === 'satellite' ? 'แผนที่' : 'ดาวเทียม'}
              onClick={() =>
                setMode((m) => (m === 'satellite' ? 'roadmap' : 'satellite'))
              }
              active={mode === 'satellite'}
            >
              {mode === 'satellite' ? (
                <MapIcon className="h-4 w-4" />
              ) : (
                <Satellite className="h-4 w-4" />
              )}
            </ToolBtn>
            <ToolBtn title="เปิดใน Google Maps" onClick={openInMaps}>
              <ExternalLink className="h-4 w-4" />
            </ToolBtn>
            {editable && onUseCurrentLocation && (
              <ToolBtn title="ตั้งจุดเป็นตำแหน่งฉัน" onClick={onUseCurrentLocation}>
                <MapPin className="h-4 w-4" />
              </ToolBtn>
            )}
          </div>

          {isLoadingRoute && (
            <div className="absolute inset-0 z-[4] grid place-items-center bg-white/55 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-2">
                <Spinner size="lg" />
                <p className="text-xs font-bold">กำลังค้นหาเส้นทาง…</p>
              </div>
            </div>
          )}
        </div>

        {!inRadius && userPos && (
          <div className="border-t border-border/35 bg-muted/40 p-3">
            <p className="mb-2 block text-xs font-semibold text-muted-foreground">
              {showingRoute
                ? 'กำลังแสดงเส้นทางไปยังจุดกิจกรรม'
                : 'กดปุ่มด้านล่างเพื่อนำทางไปยังจุดกิจกรรม'}
            </p>
            <div className="flex gap-2">
              <Button
                type="button"
                className={cn(
                  'w-full rounded-xl py-2 font-extrabold',
                  showingRoute && travelMode === 'DRIVING'
                    ? 'bg-[#0a6bcf] hover:bg-[#0858ad]'
                    : ''
                )}
                variant={
                  showingRoute && travelMode === 'DRIVING' ? 'default' : 'outline'
                }
                onClick={() => toggleRoute('DRIVING')}
              >
                <Car className="h-4 w-4" />
                {showingRoute && travelMode === 'DRIVING' ? 'ปิดเส้นทาง' : 'ขับรถ'}
              </Button>
              <Button
                type="button"
                className={cn(
                  'w-full rounded-xl py-2 font-extrabold',
                  showingRoute && travelMode === 'WALKING'
                    ? 'bg-[#0a6bcf] hover:bg-[#0858ad]'
                    : ''
                )}
                variant={
                  showingRoute && travelMode === 'WALKING' ? 'default' : 'outline'
                }
                onClick={() => toggleRoute('WALKING')}
              >
                <Footprints className="h-4 w-4" />
                {showingRoute && travelMode === 'WALKING' ? 'ปิดเส้นทาง' : 'เดิน'}
              </Button>
            </div>
          </div>
        )}

        {inRadius && (
          <div className="flex items-center gap-2 border-t border-emerald-500/25 bg-emerald-500/10 px-3 py-2">
            <CheckCircle2 className="h-[18px] w-[18px] text-emerald-700" />
            <p className="text-xs font-bold text-emerald-700">
              คุณอยู่ในรัศมีกิจกรรมแล้ว
            </p>
          </div>
        )}

        {!userPos && !editable && (
          <div className="border-t border-border/35 p-3">
            <Button
              type="button"
              className="w-full rounded-xl bg-[#0a6bcf] py-2.5 font-extrabold hover:bg-[#0858ad]"
              onClick={onUseCurrentLocation}
              disabled={!onUseCurrentLocation}
            >
              <Crosshair className="h-4 w-4" />
              เปิดตำแหน่งของฉัน
            </Button>
          </div>
        )}
      </div>
    </TooltipProvider>
  );
};

export default GeofenceMap;
