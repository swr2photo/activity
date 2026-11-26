"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

type DeferredHeroVideoProps = {
  src: string;
  poster: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean; effectiveType?: string };
};

/**
 * วิดีโอพื้นหลัง hero
 * - โหลดหลัง idle และข้ามบนมือถือ / Save-Data / 2G / reduced-motion
 * - หยุดเล่นเมื่อเลื่อนพ้นจอหรือสลับแท็บ (ประหยัด CPU/GPU decode ระหว่างดูรายการกิจกรรม)
 * - ค่อย ๆ fade-in เมื่อเฟรมแรกพร้อม ไม่กระพริบทับ poster
 */
export default function DeferredHeroVideo({ src, poster }: DeferredHeroVideoProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    const nav = navigator as NavigatorWithConnection;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;
    const slowNetwork = /(^|-)2g$/.test(nav.connection?.effectiveType ?? "");

    if (nav.connection?.saveData || prefersReducedMotion || isMobile || slowNetwork) {
      return;
    }

    const start = () => setShouldLoad(true);
    const w = window as typeof window & {
      requestIdleCallback?: (callback: IdleRequestCallback, options?: IdleRequestOptions) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (w.requestIdleCallback) {
      const idleId = w.requestIdleCallback(start, { timeout: 2000 });
      return () => w.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(start, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  // เล่นเฉพาะตอนมองเห็นและแท็บ active
  useEffect(() => {
    const video = videoRef.current;
    if (!shouldLoad || !video) return;

    let visible = true;
    const sync = () => {
      if (visible && document.visibilityState === "visible") {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    };

    const io = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        sync();
      },
      { threshold: 0.05 }
    );
    io.observe(video);
    document.addEventListener("visibilitychange", sync);
    return () => {
      io.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [shouldLoad]);

  return (
    <video
      ref={videoRef}
      loop
      muted
      playsInline
      preload={shouldLoad ? "metadata" : "none"}
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
      onPlaying={() => setPlaying(true)}
      className={cn(
        "absolute inset-0 -z-[2] h-full w-full object-cover transition-opacity duration-1000 motion-safe:animate-hero-zoom",
        playing ? "opacity-100" : "opacity-0"
      )}
    >
      {shouldLoad ? <source src={src} type="video/mp4" /> : null}
    </video>
  );
}
