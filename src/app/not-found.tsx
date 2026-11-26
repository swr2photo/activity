// src/app/not-found.tsx
'use client';

import React from 'react';
import { Home, Undo2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import AuroraBackground from '@/components/graphics/AuroraBackground';
import ScienceOrbit from '@/components/graphics/ScienceOrbit';

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="relative isolate grid min-h-[100svh] place-items-center overflow-hidden bg-[var(--page-bg)] px-4 py-12">
      <AuroraBackground />

      <div className="relative w-full max-w-[560px] animate-scale-in text-center">
        <div className="relative mx-auto mb-2 flex h-44 w-full items-center justify-center">
          <span className="text-gradient-brand animate-gradient-x select-none text-[7.5rem] font-black leading-none tracking-tighter md:text-[9rem]">
            4
          </span>
          <ScienceOrbit className="mx-1 h-32 w-32 animate-float md:h-40 md:w-40" />
          <span className="text-gradient-brand animate-gradient-x select-none text-[7.5rem] font-black leading-none tracking-tighter md:text-[9rem]">
            4
          </span>
        </div>

        <h1 className="animate-fade-up text-xl font-extrabold text-foreground [animation-delay:120ms] md:text-2xl">
          ไม่พบหน้าที่คุณต้องการ
        </h1>
        <p className="mb-8 mt-2 animate-fade-up text-sm text-muted-foreground [animation-delay:200ms] md:text-base">
          ลิงก์อาจหมดอายุ หรือถูกย้ายไปยังที่อื่นแล้ว
        </p>

        <div className="flex animate-fade-up flex-col justify-center gap-2 [animation-delay:280ms] sm:flex-row">
          <Button onClick={() => router.push('/')} className="shine h-11 rounded-full px-6">
            <Home className="h-4 w-4" />
            กลับหน้าหลัก
          </Button>
          <Button variant="outline" onClick={() => router.back()} className="h-11 rounded-full px-6">
            <Undo2 className="h-4 w-4" />
            กลับหน้าก่อนหน้า
          </Button>
        </div>
      </div>
    </div>
  );
}
