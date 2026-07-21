// components/activity/ActivityInfoCard.tsx
'use client';
import React, { useState, useEffect } from 'react';
import {
  CalendarDays,
  Info,
  MapPin,
  Clock,
  Map,
  LocateFixed,
  Users,
  CheckCircle2,
  AlertTriangle,
  UserX,
} from 'lucide-react';
import { onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import ActivityLocationMap from './ActivityLocationMap';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { glassCardClass } from '@/lib/uiTheme';
import { cn } from '@/lib/utils';

interface ActivityData {
  id: string;
  activityCode: string;
  activityName: string;
  description: string;
  location: string;
  latitude: number;
  longitude: number;
  checkInRadius: number;
  userCode: string;
  startDateTime: any;
  endDateTime: any;
  isActive: boolean;
  maxParticipants: number;
  currentParticipants: number;
  qrUrl: string;
  targetUrl: string;
  requiresUniversityLogin: boolean;
  bannerUrl?: string;
  createdAt?: any;
  updatedAt?: any;
}

interface ActivityInfoCardProps {
  activity: ActivityData;
  showRegistrationButton?: boolean;
}

// Enhanced Participant Counter Component
const ParticipantCounter: React.FC<{
  currentParticipants: number;
  maxParticipants: number;
  activityId: string;
}> = ({ currentParticipants, maxParticipants, activityId }) => {
  const [realTimeCount, setRealTimeCount] = useState(currentParticipants);

  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityId), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRealTimeCount(data.currentParticipants || 0);
      }
    });

    return () => unsubscribe();
  }, [activityId]);

  if (maxParticipants <= 0) return null;

  const percentage = Math.min((realTimeCount / maxParticipants) * 100, 100);
  const isFull = realTimeCount >= maxParticipants;
  const isNearFull = percentage > 80;

  const barGradient = isFull
    ? 'bg-gradient-to-r from-[#f87171] to-[#ef4444]'
    : isNearFull
      ? 'bg-gradient-to-r from-[#fbbf24] to-[#f59e0b]'
      : 'bg-gradient-to-r from-[#34d399] to-[#10b981]';

  const countColor = isFull
    ? 'text-destructive'
    : isNearFull
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="flex items-center gap-2 text-sm font-semibold">
          <Users className="h-4 w-4" />
          จำนวนผู้เข้าร่วม
        </p>
        <div className="relative flex items-center gap-2">
          {(isFull || isNearFull) && (
            <Badge
              variant={isFull ? 'destructive' : 'warning'}
              className="gap-1 text-[0.6rem]"
            >
              {isFull ? (
                <>
                  <UserX className="h-3 w-3" />
                  เต็มแล้ว
                </>
              ) : (
                <>
                  <AlertTriangle className="h-3 w-3" />
                  ใกล้เต็ม
                </>
              )}
            </Badge>
          )}
          <span className={cn('text-lg font-bold', countColor)}>
            {realTimeCount}/{maxParticipants}
          </span>
        </div>
      </div>

      <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={cn('h-full rounded-full transition-all', barGradient)}
          style={{ width: `${percentage}%` }}
        />
      </div>

      <div className="mt-2 flex justify-between">
        <span className="text-xs text-muted-foreground">
          {percentage.toFixed(1)}% ของจำนวนที่รับ
        </span>
        <span className="text-xs text-muted-foreground">
          เหลือ {Math.max(0, maxParticipants - realTimeCount)} ที่นั่ง
        </span>
      </div>
    </div>
  );
};

const ActivityInfoCard: React.FC<ActivityInfoCardProps> = ({
  activity,
  showRegistrationButton = false,
}) => {
  const [showLocationDialog, setShowLocationDialog] = useState(false);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locationError, setLocationError] = useState('');
  const [locationLoading, setLocationLoading] = useState(false);

  // preserve prop for API compatibility
  void showRegistrationButton;

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
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

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      setLocationLoading(true);
      setLocationError('');

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userPos = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          setUserLocation(userPos);
          setLocationLoading(false);

          const distance = calculateDistance(
            userPos.lat,
            userPos.lng,
            activity.latitude,
            activity.longitude
          );

          if (distance <= activity.checkInRadius) {
            setLocationError(
              `คุณอยู่ในพื้นที่กิจกรรม (ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร)`
            );
          } else {
            setLocationError(
              `คุณอยู่นอกพื้นที่กิจกรรม (ห่างจากจุดกิจกรรม ${Math.round(distance)} เมตร - ต้องอยู่ในรัศมี ${activity.checkInRadius} เมตร)`
            );
          }
        },
        (error) => {
          setLocationLoading(false);
          let errorMessage = 'ไม่สามารถดึงตำแหน่งปัจจุบันได้: ';
          switch (error.code) {
            case error.PERMISSION_DENIED:
              errorMessage +=
                'ผู้ใช้ปฏิเสธการเข้าถึงตำแหน่ง กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage += 'ไม่สามารถระบุตำแหน่งได้ กรุณาตรวจสอบการเชื่อมต่อ GPS';
              break;
            case error.TIMEOUT:
              errorMessage += 'หมดเวลาในการขอตำแหน่ง กรุณาลองใหม่อีกครั้ง';
              break;
            default:
              errorMessage += 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
              break;
          }
          setLocationError(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 30000,
        }
      );
    } else {
      setLocationError('เบราว์เซอร์ของคุณไม่รองรับการเข้าถึงตำแหน่ง');
    }
  };

  const locationAlertVariant = locationError.includes('อยู่ในพื้นที่กิจกรรม')
    ? 'success'
    : locationError.includes('อยู่นอกพื้นที่กิจกรรม')
      ? 'destructive'
      : 'warning';

  return (
    <>
      <Card className={cn(glassCardClass, 'mb-8 shadow-[var(--page-shadow)]')}>
        <CardContent className="p-6">
          <h2 className="flex items-center gap-2 text-xl font-bold text-primary">
            <CalendarDays className="h-5 w-5" />
            รายละเอียดกิจกรรม
          </h2>

          <Separator className="my-4" />

          <div className="flex flex-col gap-6">
            {activity.description && (
              <div className="rounded-lg border-l-4 border-primary bg-muted/50 p-4 dark:bg-muted/20">
                <div className="flex items-start gap-2">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div>
                    <p className="mb-1 text-sm font-semibold text-primary">
                      รายละเอียดกิจกรรม
                    </p>
                    <p className="text-sm text-muted-foreground">{activity.description}</p>
                  </div>
                </div>
              </div>
            )}

            {activity.location && (
              <div className="flex items-start gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <div>
                  <p className="mb-1 text-sm font-semibold">สถานที่</p>
                  <p className="text-sm text-muted-foreground">{activity.location}</p>
                </div>
              </div>
            )}

            {/* ตำแหน่งที่ตั้งและการเช็คอิน */}
            <div className="flex items-start gap-2">
              <Map className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="w-full">
                <p className="mb-1 text-sm font-semibold">ตำแหน่งกิจกรรม</p>
                <p className="mb-1 text-sm text-muted-foreground">
                  พิกัด: {activity.latitude.toFixed(6)}, {activity.longitude.toFixed(6)}
                </p>
                <p className="mb-1 text-sm text-muted-foreground">
                  รัศมีเช็คอิน: {activity.checkInRadius} เมตร
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowLocationDialog(true)}
                    className="border-primary hover:bg-blue-50 dark:hover:bg-blue-950/30"
                  >
                    <Map className="h-4 w-4" />
                    ดูแผนที่
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={getCurrentLocation}
                    disabled={locationLoading}
                    className="border-emerald-500 text-emerald-600 hover:bg-emerald-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                  >
                    {locationLoading ? (
                      <Spinner size="sm" />
                    ) : (
                      <LocateFixed className="h-4 w-4" />
                    )}
                    {locationLoading ? 'กำลังค้นหา...' : 'ตรวจสอบตำแหน่งของฉัน'}
                  </Button>
                </div>

                {locationError && (
                  <Alert
                    variant={locationAlertVariant}
                    className={cn(
                      'mt-4',
                      locationAlertVariant === 'success' &&
                        'bg-gradient-to-br from-[#dcfce7] to-[#bbf7d0] dark:from-emerald-950/40 dark:to-emerald-900/30',
                      locationAlertVariant === 'destructive' &&
                        'bg-gradient-to-br from-[#fee2e2] to-[#fecaca] dark:from-red-950/40 dark:to-red-900/30',
                      locationAlertVariant === 'warning' &&
                        'bg-gradient-to-br from-[#fef3c7] to-[#fde68a] dark:from-amber-950/40 dark:to-amber-900/30'
                    )}
                  >
                    <AlertDescription>{locationError}</AlertDescription>
                  </Alert>
                )}
              </div>
            </div>

            <div className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div>
                <p className="mb-2 text-sm font-semibold">วันเวลา</p>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 rounded-md border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950/30">
                    <Clock className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <p className="text-sm font-medium text-emerald-800 dark:text-emerald-300">
                      เริ่ม:{' '}
                      {activity.startDateTime?.toDate()?.toLocaleString('th-TH') ||
                        'ไม่ระบุ'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 rounded-md border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-950/30">
                    <Clock className="h-4 w-4 text-red-600 dark:text-red-400" />
                    <p className="text-sm font-medium text-red-800 dark:text-red-300">
                      สิ้นสุด:{' '}
                      {activity.endDateTime?.toDate()?.toLocaleString('th-TH') ||
                        'ไม่ระบุ'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Enhanced Participant Counter */}
            {activity.maxParticipants > 0 && (
              <div className="rounded-lg border border-[#0ea5e9] bg-gradient-to-br from-[#f0f9ff] to-[#e0f2fe] p-4 dark:from-sky-950/40 dark:to-sky-900/30">
                <ParticipantCounter
                  currentParticipants={activity.currentParticipants}
                  maxParticipants={activity.maxParticipants}
                  activityId={activity.id}
                />
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Dialog */}
      <Dialog open={showLocationDialog} onOpenChange={setShowLocationDialog}>
        <DialogContent className={cn(glassCardClass, 'max-w-3xl gap-0 overflow-hidden p-0')}>
          <DialogHeader className="bg-gradient-to-br from-[#667eea] to-[#764ba2] p-4 text-white sm:rounded-t-xl">
            <DialogTitle className="flex items-center gap-2 text-white">
              <Map className="h-5 w-5" />
              ตำแหน่งกิจกรรม: {activity.activityName}
            </DialogTitle>
          </DialogHeader>
          <div className="p-4 pt-6 sm:p-6">
            <div className="mb-4 flex flex-col gap-1">
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                วงกลมสีเขียวแสดงพื้นที่ที่สามารถเช็คอินได้ (รัศมี {activity.checkInRadius}{' '}
                เมตร)
              </p>
              <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 text-destructive" />
                หมุดสีแดงแสดงจุดกิจกรรม
              </p>
              {userLocation && (
                <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                  <LocateFixed className="h-4 w-4 text-primary" />
                  จุดสีน้ำเงินแสดงตำแหน่งของคุณ
                </p>
              )}
            </div>

            <ActivityLocationMap
              latitude={activity.latitude}
              longitude={activity.longitude}
              radius={activity.checkInRadius}
              activityName={activity.activityName}
              userLocation={userLocation}
            />
          </div>
          <DialogFooter className="gap-2 border-t border-border p-4">
            <Button variant="outline" onClick={() => setShowLocationDialog(false)}>
              ปิด
            </Button>
            <Button
              onClick={getCurrentLocation}
              disabled={locationLoading}
              className="bg-gradient-to-br from-[#10b981] to-[#059669] text-white hover:from-[#059669] hover:to-[#047857]"
            >
              {locationLoading ? (
                <Spinner size="sm" className="text-white" />
              ) : (
                <LocateFixed className="h-4 w-4" />
              )}
              {locationLoading ? 'กำลังค้นหา...' : 'ค้นหาตำแหน่งของฉัน'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default ActivityInfoCard;
