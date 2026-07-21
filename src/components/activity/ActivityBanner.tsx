'use client';

import React, { useState } from 'react';
import Image from 'next/image';
import {
  CheckCircle2,
  XCircle,
  Hourglass,
  UserX,
  Clock,
  MapPin,
  Users,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
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

interface ActivityBannerProps {
  activity: ActivityData;
}

const statusBadgeClass: Record<string, string> = {
  success: 'bg-white/90 text-emerald-800 border-transparent',
  warning: 'bg-white/90 text-amber-800 border-transparent',
  error: 'bg-white/90 text-red-800 border-transparent',
  default: 'bg-white/90 text-foreground border-transparent',
};

const ActivityBanner: React.FC<ActivityBannerProps> = ({ activity }) => {
  const [imageError, setImageError] = useState(false);

  const getGradient = () => {
    const now = new Date();
    const startTime = activity.startDateTime?.toDate() || new Date();
    const endTime = activity.endDateTime?.toDate() || new Date();

    if (!activity.isActive) {
      return 'linear-gradient(135deg, #64748b 0%, #475569 100%)';
    }
    if (now < startTime) {
      return 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)';
    }
    if (now > endTime) {
      return 'linear-gradient(135deg, #6b7280 0%, #4b5563 100%)';
    }
    return 'linear-gradient(135deg, #10b981 0%, #059669 100%)';
  };

  const getStatusInfo = () => {
    const now = new Date();
    const startTime = activity.startDateTime?.toDate() || new Date();
    const endTime = activity.endDateTime?.toDate() || new Date();

    if (!activity.isActive) {
      return {
        text: 'ปิดใช้งาน',
        tone: 'error',
        icon: <XCircle className="h-3.5 w-3.5" />,
      };
    }
    if (now < startTime) {
      return {
        text: 'รอเปิด',
        tone: 'warning',
        icon: <Hourglass className="h-3.5 w-3.5" />,
      };
    }
    if (now > endTime) {
      return {
        text: 'สิ้นสุดแล้ว',
        tone: 'default',
        icon: <CheckCircle2 className="h-3.5 w-3.5" />,
      };
    }

    if (
      activity.maxParticipants > 0 &&
      activity.currentParticipants >= activity.maxParticipants
    ) {
      return {
        text: 'เต็มแล้ว',
        tone: 'error',
        icon: <UserX className="h-3.5 w-3.5" />,
      };
    }

    return {
      text: 'เปิดลงทะเบียน',
      tone: 'success',
      icon: <CheckCircle2 className="h-3.5 w-3.5" />,
    };
  };

  const statusInfo = getStatusInfo();

  return (
    <div className="relative mb-6 overflow-hidden rounded-xl border border-border bg-card shadow-sm">
      <div
        className="relative flex h-[200px] items-end sm:h-[250px] md:h-[300px]"
        style={{ background: getGradient() }}
      >
        <div
          className="absolute inset-0 z-[1]"
          style={{
            background:
              'linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.3) 50%, rgba(0,0,0,0.1) 100%)',
          }}
        />

        {activity.bannerUrl && !imageError && (
          <Image
            src={activity.bannerUrl}
            alt={activity.activityName}
            fill
            sizes="100vw"
            style={{ objectFit: 'cover' }}
            onError={() => setImageError(true)}
            onLoad={() => setImageError(false)}
            priority
          />
        )}

        <div className="absolute right-4 top-4 z-[2]">
          <Badge
            className={cn(
              'font-bold shadow-lg backdrop-blur-md',
              statusBadgeClass[statusInfo.tone]
            )}
          >
            <span className="inline-flex items-center gap-1">
              {statusInfo.icon}
              {statusInfo.text}
            </span>
          </Badge>
        </div>

        <div className="relative z-[2] w-full p-6 text-white">
          <h1
            className="mb-2 text-[1.75rem] font-bold sm:text-[2.125rem] md:text-[2.5rem]"
            style={{ textShadow: '2px 2px 4px rgba(0,0,0,0.7)' }}
          >
            {activity.activityName}
          </h1>

          <div className="mb-2 flex items-center gap-2">
            <Badge className="border-transparent bg-white/20 font-mono text-white backdrop-blur-md">
              รหัส: {activity.activityCode}
            </Badge>
            {activity.requiresUniversityLogin && (
              <Badge className="border-transparent bg-blue-500/80 text-white backdrop-blur-md">
                ต้องใช้บัญชีมหาวิทยาลัย
              </Badge>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span
                className="text-xs"
                style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}
              >
                {activity.startDateTime?.toDate()?.toLocaleDateString('th-TH')}
              </span>
            </div>

            {activity.location && (
              <div className="flex items-center gap-1">
                <MapPin className="h-4 w-4" />
                <span
                  className="text-xs"
                  style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}
                >
                  {activity.location}
                </span>
              </div>
            )}

            {activity.maxParticipants > 0 && (
              <div className="flex items-center gap-1">
                <Users className="h-4 w-4" />
                <span
                  className="text-xs"
                  style={{ textShadow: '1px 1px 2px rgba(0,0,0,0.7)' }}
                >
                  {activity.currentParticipants}/{activity.maxParticipants} คน
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ActivityBanner;
