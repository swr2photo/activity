// src/app/error.tsx
'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  RotateCcw,
  Home,
  Copy,
  TriangleAlert,
  ChevronDown,
  X,
} from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { glassCardClass } from '@/lib/uiTheme';
import { cn } from '@/lib/utils';

import { reportError } from '../lib/errorReporter';
import { auth } from '../lib/firebase';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [showDetails, setShowDetails] = useState(false);
  const [errorId, setErrorId] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const refCode = useMemo(() => {
    const base = error.digest || Math.random().toString(36).slice(2, 8);
    const stamp = Date.now().toString(36).slice(-4);
    return `${base}-${stamp}`.toUpperCase();
  }, [error.digest]);

  useEffect(() => {
    const isChunkError =
      /chunk/i.test(error.message) ||
      /loading.*failed/i.test(error.message) ||
      /load.*chunk/i.test(error.message);

    if (isChunkError) {
      console.warn('Chunk load failure detected. Reloading page...');
      window.location.reload();
      return;
    }

    let mounted = true;
    (async () => {
      try {
        const user = auth.currentUser;
        const id = await reportError({
          message: error.message,
          stack: error.stack,
          digest: error.digest,
          path: pathname || '/',
          userId: user?.uid ?? null,
          userEmail: user?.email ?? null,
          meta: { refCode },
        });
        if (mounted) setErrorId(id);
        console.error('Captured error:', { error, errorId: id, refCode });
      } catch {
        /* noop */
      }
    })();
    return () => {
      mounted = false;
    };
  }, [error, pathname, refCode]);

  const copyInfo = async () => {
    try {
      const info = [
        `Reference: ${refCode}${errorId ? ` (${errorId})` : ''}`,
        `Path: ${pathname}`,
        `Message: ${error.message}`,
        error.stack ? `Stack: ${error.stack}` : '',
      ]
        .filter(Boolean)
        .join('\n');
      await navigator.clipboard.writeText(info);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* noop */
    }
  };

  if (dismissed) return null;

  return (
    <div className="grid min-h-[70vh] place-items-center bg-[radial-gradient(1200px_400px_at_-20%_-20%,rgba(239,68,68,0.08),transparent),linear-gradient(180deg,var(--page-bg),var(--page-bg))] px-2 py-8 md:py-16">
      <Card
        className={cn(
          glassCardClass,
          'w-full max-w-[760px] overflow-hidden shadow-[0_24px_64px_rgba(0,0,0,0.12)]'
        )}
      >
        <div className="flex items-center gap-4 border-b border-border/50 bg-gradient-to-br from-destructive/15 to-[var(--page-card)] p-4 md:p-6">
          <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-destructive/10 shadow-[inset_0_0_0_1px_rgba(239,68,68,0.12)] animate-[float_5s_ease-in-out_infinite]">
            <TriangleAlert className="h-6 w-6 text-destructive" />
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-extrabold text-foreground">
              เกิดข้อผิดพลาดในการทำงาน
            </h2>
            <p className="truncate text-sm text-muted-foreground">
              เราขออภัยในความไม่สะดวก — คุณสามารถลองใหม่หรือกลับไปหน้าหลักได้
            </p>
          </div>

          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={() => setDismissed(true)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>ปิดกล่องนี้</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>

        <CardContent className="p-4 md:p-6">
          <div className="flex flex-col gap-4">
            <Alert variant="destructive" className="border-destructive/30">
              <AlertTitle className="flex flex-wrap items-center gap-2">
                <span className="font-bold">Reference</span>
                <Badge variant="destructive" className="font-bold">
                  {refCode}
                </Badge>
                {errorId && (
                  <Badge variant="outline">ID: {errorId}</Badge>
                )}
              </AlertTitle>
              <AlertDescription className="mt-1 text-muted-foreground">
                หากต้องการติดต่อผู้ดูแล โปรดแจ้งรหัสอ้างอิงนี้เพื่อช่วยตรวจสอบปัญหาได้เร็วขึ้น
              </AlertDescription>
            </Alert>

            <div className="flex flex-col gap-2 sm:flex-row [&_button]:flex-1">
              <Button variant="destructive" onClick={reset}>
                <RotateCcw className="h-4 w-4" />
                ลองใหม่
              </Button>
              <Button variant="outline" onClick={() => router.push('/')}>
                <Home className="h-4 w-4" />
                กลับหน้าหลัก
              </Button>
              <Button variant="ghost" onClick={copyInfo}>
                <Copy className="h-4 w-4" />
                {copied ? 'คัดลอกแล้ว' : 'คัดลอกรายละเอียด'}
              </Button>
            </div>

            <Separator />

            <Button
              variant="ghost"
              className="self-start"
              onClick={() => setShowDetails((v) => !v)}
            >
              รายละเอียดทางเทคนิค
              <ChevronDown
                className={cn(
                  'h-4 w-4 transition-transform duration-200',
                  showDetails && 'rotate-180'
                )}
              />
            </Button>

            {showDetails && (
              <pre className="m-0 overflow-auto rounded-lg border border-border/50 bg-muted/40 p-4 text-xs leading-relaxed dark:bg-muted/20">
                {[
                  `Path: ${pathname}`,
                  `Message: ${error.message}`,
                  error.digest ? `Digest: ${error.digest}` : '',
                  '',
                  error.stack || '',
                ]
                  .filter(Boolean)
                  .join('\n')}
              </pre>
            )}
          </div>
        </CardContent>
      </Card>

      <style jsx global>{`
        @keyframes float {
          0%,
          100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}
