// src/app/register/page.tsx
import React from 'react';
import { getPublicActivityByCode } from '@/lib/activitiesServer';
import RegisterClient from './RegisterClient';

export const dynamic = 'force-dynamic';

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ activity?: string; dt?: string }>;
}) {
  const sp = await searchParams;
  const activityCode = String(sp.activity || '').trim().toUpperCase();
  const initialDt = String(sp.dt || '').trim();

  // Prefetch ข้อมูลกิจกรรมฝั่ง Server เพื่อตัด Client Waterfall (1 RTT ทันที)
  const initialActivity = activityCode ? await getPublicActivityByCode(activityCode) : null;

  return (
    <RegisterClient
      activityCode={activityCode}
      initialDt={initialDt}
      initialActivity={initialActivity}
    />
  );
}
