"use client";

import { useEffect, useState } from "react";

type DeferredHeroVideoProps = {
  src: string;
  poster: string;
};

type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean };
};

export default function DeferredHeroVideo({
  src,
  poster,
}: DeferredHeroVideoProps) {
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const navigatorWithConnection = navigator as NavigatorWithConnection;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    const isMobile = window.matchMedia("(max-width: 767px)").matches;

    if (
      navigatorWithConnection.connection?.saveData ||
      prefersReducedMotion ||
      isMobile
    ) {
      return;
    }

    const start = () => setShouldLoad(true);
    const windowWithIdleCallback = window as typeof window & {
      requestIdleCallback?: (
        callback: IdleRequestCallback,
        options?: IdleRequestOptions
      ) => number;
      cancelIdleCallback?: (handle: number) => void;
    };

    if (windowWithIdleCallback.requestIdleCallback) {
      const idleId = windowWithIdleCallback.requestIdleCallback(start, {
        timeout: 2000,
      });
      return () => windowWithIdleCallback.cancelIdleCallback?.(idleId);
    }

    const timeoutId = window.setTimeout(start, 1200);
    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <video
      autoPlay={shouldLoad}
      loop
      muted
      playsInline
      preload={shouldLoad ? "metadata" : "none"}
      poster={poster}
      aria-hidden="true"
      tabIndex={-1}
      className="absolute inset-0 -z-[2] h-full w-full object-cover motion-safe:animate-[heroZoom_28s_ease-in-out_infinite_alternate]"
    >
      {shouldLoad ? <source src={src} type="video/mp4" /> : null}
    </video>
  );
}
