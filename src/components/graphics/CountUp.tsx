"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";

const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

type CountUpProps = {
  value: number;
  /** มิลลิวินาที */
  duration?: number;
  className?: string;
  locale?: string;
};

const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

/**
 * ตัวเลขนับขึ้นด้วย requestAnimationFrame (อัปเดตเฉพาะ text node เดียว ไม่ re-render ทั้ง tree)
 * เคารพ prefers-reduced-motion — แสดงค่าจริงทันที
 */
export default function CountUp({ value, duration = 1100, className, locale = "th-TH" }: CountUpProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const fromRef = useRef(0);
  const [initial] = useState(() => value);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const fmt = (n: number) => Math.round(n).toLocaleString(locale);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const from = fromRef.current;
    if (reduce || from === value) {
      el.textContent = fmt(value);
      fromRef.current = value;
      return;
    }

    let raf = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      el.textContent = fmt(from + (value - from) * easeOutExpo(t));
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      fromRef.current = value;
    };
  }, [value, duration, locale]);

  // SSR / ก่อน hydrate แสดงค่าจริง เพื่อไม่ให้ layout กระโดดและอ่านได้แม้ JS ช้า
  return (
    <span ref={ref} className={className} suppressHydrationWarning>
      {initial.toLocaleString(locale)}
    </span>
  );
}
