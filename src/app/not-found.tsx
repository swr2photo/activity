// src/app/not-found.tsx
'use client';

import React from 'react';
import { Home, Map } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { glassCardClass } from '@/lib/uiTheme';
import { cn } from '@/lib/utils';

export default function NotFoundPage() {
  const router = useRouter();

  return (
    <div className="grid min-h-[70vh] place-items-center bg-gradient-to-br from-primary/10 to-transparent px-2 py-8 md:py-16">
      <Card className={cn(glassCardClass, 'w-full max-w-[680px] overflow-hidden shadow-none')}>
        <CardContent className="p-6 text-center md:p-8">
          <h1 className="mb-1 text-5xl font-extrabold tracking-tight text-foreground md:text-6xl">
            404
          </h1>
          <h2 className="text-lg font-bold text-foreground">
            ไม่พบหน้าที่คุณต้องการ
          </h2>
          <p className="mb-6 mt-1 text-sm text-muted-foreground">
            ลิงก์อาจหมดอายุหรือถูกย้ายไปยังที่อื่น
          </p>

          <div className="flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => router.push('/')}>
              <Home className="h-4 w-4" />
              กลับหน้าหลัก
            </Button>
            <Button variant="outline" onClick={() => router.back()}>
              <Map className="h-4 w-4" />
              กลับหน้าก่อนหน้า
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
