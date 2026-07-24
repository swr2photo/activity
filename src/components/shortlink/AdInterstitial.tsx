'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Megaphone } from 'lucide-react';
import { Button } from '@/components/ui/button';

export type AdInterstitialProps = {
  targetUrl: string;
  title?: string;
  message?: string;
  imageUrl?: string;
  countdownSeconds?: number;
  buttonText?: string;
};

export default function AdInterstitial({
  targetUrl,
  title = 'ประกาศ',
  message = '',
  imageUrl,
  countdownSeconds = 5,
  buttonText = 'ไปยังลิงก์ปลายทาง',
}: AdInterstitialProps) {
  const safeCountdown = Math.max(0, Math.min(60, Math.floor(Number(countdownSeconds) || 0)));
  const [remaining, setRemaining] = useState(safeCountdown);
  const canContinue = remaining <= 0;

  useEffect(() => {
    if (safeCountdown <= 0) return;
    setRemaining(safeCountdown);
    const timer = window.setInterval(() => {
      setRemaining((prev) => {
        if (prev <= 1) {
          window.clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [safeCountdown]);

  useEffect(() => {
    if (!canContinue || safeCountdown <= 0) return;
    // Auto-redirect once countdown finishes (only when a countdown was configured)
    const t = window.setTimeout(() => {
      window.location.assign(targetUrl);
    }, 400);
    return () => window.clearTimeout(t);
  }, [canContinue, safeCountdown, targetUrl]);

  const progress = useMemo(() => {
    if (safeCountdown <= 0) return 100;
    return Math.round(((safeCountdown - remaining) / safeCountdown) * 100);
  }, [remaining, safeCountdown]);

  const handleContinue = () => {
    window.location.assign(targetUrl);
  };

  return (
    <div className="relative min-h-[100svh] w-full overflow-hidden bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(36,138,61,0.12),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(0,122,255,0.10),transparent),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] dark:bg-[radial-gradient(1200px_600px_at_10%_-10%,rgba(52,199,89,0.12),transparent),radial-gradient(900px_500px_at_90%_0%,rgba(10,132,255,0.12),transparent),linear-gradient(180deg,#0b1220_0%,#111827_100%)]">
      <div className="mx-auto flex min-h-[100svh] w-full max-w-lg flex-col justify-center px-4 py-10 sm:px-6">
        <div className="overflow-hidden rounded-3xl border border-border/60 bg-background/90 shadow-[0_20px_60px_rgba(15,23,42,0.12)] backdrop-blur-xl">
          {imageUrl ? (
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-slate-100 dark:bg-slate-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={title || 'ประกาศ'}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/40 to-transparent" />
            </div>
          ) : (
            <div className="flex items-center gap-3 border-b border-border/50 bg-emerald-50/70 px-5 py-4 dark:bg-emerald-950/30">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-600 text-white shadow-sm">
                <Megaphone className="h-5 w-5" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                  ประกาศ / โฆษณา
                </p>
                <p className="text-sm text-muted-foreground">ก่อนไปยังลิงก์ปลายทาง</p>
              </div>
            </div>
          )}

          <div className="space-y-4 px-5 py-6 sm:px-6">
            <div className="space-y-2">
              <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
                {title || 'ประกาศ'}
              </h1>
              {message ? (
                <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground sm:text-[15px]">
                  {message}
                </p>
              ) : null}
            </div>

            {safeCountdown > 0 && (
              <div className="space-y-2 rounded-2xl border border-border/60 bg-muted/40 p-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{canContinue ? 'พร้อมไปต่อแล้ว' : 'กำลังเปิดลิงก์ปลายทาง...'}</span>
                  <span className="font-semibold tabular-nums text-foreground">
                    {canContinue ? '0' : remaining} วินาที
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-background">
                  <div
                    className="h-full rounded-full bg-emerald-600 transition-[width] duration-1000 ease-linear"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={handleContinue}
              disabled={!canContinue && safeCountdown > 0}
              className="h-11 w-full gap-2 bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              <ExternalLink className="h-4 w-4" />
              {canContinue || safeCountdown <= 0
                ? buttonText || 'ไปยังลิงก์ปลายทาง'
                : `รออีก ${remaining} วินาที`}
            </Button>

            <p className="text-center text-[11px] text-muted-foreground">
              คุณจะถูกส่งต่อไปยังปลายทางโดยอัตโนมัติเมื่อครบเวลา
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
