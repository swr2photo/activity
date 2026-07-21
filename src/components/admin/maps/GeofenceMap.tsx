'use client';

import React from 'react';
import { MapPin, Map } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  onUseCurrentLocation,
  editable = false,
  title = 'ตำแหน่งกิจกรรม',
}: GeofenceMapProps) {
  const circleSize = Math.min(radius * 2, 250);

  return (
    <div className="mb-4 w-full">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold">
          <Map className="h-4 w-4 text-primary" /> {title}
        </h3>
        {editable && onUseCurrentLocation && (
          <Button size="sm" variant="ghost" onClick={onUseCurrentLocation}>
            <MapPin className="h-4 w-4" />
            ใช้ตำแหน่งปัจจุบัน
          </Button>
        )}
      </div>

      <div className="relative flex h-[300px] w-full items-center justify-center overflow-hidden rounded-2xl border border-border bg-muted">
        <div className="p-6 text-center">
          <p className="text-sm text-muted-foreground">
            พิกัด: {center.lat.toFixed(6)}, {center.lng.toFixed(6)}
          </p>
          <p className="text-xs text-muted-foreground/70">
            รัศมีการเช็คอิน: {radius} เมตร
          </p>
          {editable && (
            <p className="mt-2 block text-xs text-primary">
              * คลิกบนแผนที่หรือลากหมุดเพื่อเปลี่ยนตำแหน่ง
            </p>
          )}
        </div>

        <div
          className="pointer-events-none absolute rounded-full border-2 border-primary bg-primary/10"
          style={{ width: circleSize, height: circleSize }}
        />
        <MapPin className="absolute mb-12 h-10 w-10 text-primary" />
      </div>
    </div>
  );
}
