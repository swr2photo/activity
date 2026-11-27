"use client";

import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { dismiss, registerDockedBar, useNotifications, type Notice } from "@/lib/notify";
import { StatusIcon } from "./StatusIcon";
import NotificationCenter from "./NotificationCenter";

const ACCENT: Record<Notice["variant"], string> = {
  success: "bg-emerald-500",
  error: "bg-rose-500",
  warning: "bg-amber-500",
  info: "bg-sky-500",
  loading: "bg-primary",
  default: "bg-primary",
};

/** ตั้งเวลาปิดอัตโนมัติ + หยุดเวลาเมื่อเมาส์ชี้ (ให้อ่านทัน) */
function useAutoDismiss(current: Notice | undefined, paused: boolean) {
  const remaining = useRef<number>(0);
  const startedAt = useRef<number>(0);
  const lastId = useRef<string | null>(null);

  useEffect(() => {
    if (!current || current.duration <= 0) return;
    // รายการใหม่ (หรือถูกอัปเดตจาก loading → สำเร็จ) → เริ่มนับใหม่
    const key = `${current.id}:${current.createdAt}`;
    if (lastId.current !== key) {
      lastId.current = key;
      remaining.current = current.duration;
    }
    if (paused) return;
    startedAt.current = performance.now();
    const t = window.setTimeout(() => dismiss(current.id), remaining.current);
    return () => {
      window.clearTimeout(t);
      remaining.current = Math.max(400, remaining.current - (performance.now() - startedAt.current));
    };
  }, [current, paused]);
}

function NoticeContent({ notice, queued, paused }: { notice: Notice; queued: number; paused: boolean }) {
  return (
    <div key={`${notice.id}:${notice.createdAt}`} className="flex min-w-0 flex-1 animate-fade-in items-center gap-2.5">
      <StatusIcon variant={notice.variant} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">{notice.title}</p>
        {notice.description && (
          <p className="truncate text-xs leading-tight text-muted-foreground">{notice.description}</p>
        )}
      </div>
      {queued > 0 && (
        <span className="shrink-0 animate-pop-in rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold tabular-nums text-muted-foreground">
          +{queued}
        </span>
      )}
      {notice.duration > 0 && (
        <span
          aria-hidden
          className={cn("absolute inset-x-0 bottom-0 h-[2px] origin-left opacity-70", ACCENT[notice.variant])}
          style={{
            animation: `countdown ${notice.duration}ms linear forwards`,
            animationPlayState: paused ? "paused" : "running",
          }}
        />
      )}
    </div>
  );
}

/**
 * แถบสถานะแจ้งเตือน
 * - floating: แถบเดียวโผล่ใต้ navbar (มือถือ: เหนือแถบเมนูล่าง) แทน toast ที่เด้งซ้อนกัน
 * - docked: แถบล่างถาวรของหน้าแอดมิน มีสถานะการเชื่อมต่อ + ศูนย์แจ้งเตือน
 */
export default function NotificationStatusBar({
  mode = "floating",
  className,
  style,
}: {
  mode?: "floating" | "docked";
  className?: string;
  style?: React.CSSProperties;
}) {
  const { queue, docked } = useNotifications();
  const [paused, setPaused] = useState(false);
  const [online, setOnline] = useState(true);
  const current = queue[0];
  useAutoDismiss(current, paused);

  useEffect(() => {
    if (mode !== "docked") return;
    return registerDockedBar();
  }, [mode]);

  useEffect(() => {
    if (mode !== "docked") return;
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [mode]);

  if (mode === "floating") {
    if (docked > 0 || !current) return null;
    const assertive = current.variant === "error" || current.variant === "warning";
    return (
      <div
        role={assertive ? "alert" : "status"}
        aria-live={assertive ? "assertive" : "polite"}
        className={cn(
          "pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3",
          "bottom-[calc(84px+env(safe-area-inset-bottom))] lg:bottom-auto lg:top-[calc(4.25rem+10px)]",
          className
        )}
        style={style}
      >
        <div
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
          className={cn(
            "pointer-events-auto relative flex w-full max-w-[560px] items-center gap-2 overflow-hidden rounded-2xl border border-[var(--page-border)]",
            "bg-[color-mix(in_srgb,var(--page-card-solid)_92%,transparent)] py-2.5 pl-3.5 pr-2 shadow-[var(--page-shadow-lg)] backdrop-blur-xl",
            "animate-[status-in_0.45s_var(--ease-out-expo)_backwards]"
          )}
        >
          <span aria-hidden className={cn("absolute inset-y-2 left-0 w-[3px] rounded-r-full", ACCENT[current.variant])} />
          <NoticeContent notice={current} queued={queue.length - 1} paused={paused} />
          <button
            type="button"
            onClick={() => dismiss(current.id)}
            aria-label="ปิดการแจ้งเตือน"
            className="motion-trigger flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <X className="mi mi-spin h-4 w-4" />
          </button>
        </div>
      </div>
    );
  }

  // ── docked ──
  return (
    <div
      className={cn(
        "fixed bottom-0 right-0 z-30 flex h-10 items-center gap-3 border-t border-slate-200/70 bg-white/85 px-3 text-xs backdrop-blur-xl sm:px-4",
        "dark:border-white/[0.06] dark:bg-[hsl(var(--background)/0.85)]",
        className
      )}
      style={style}
    >
      <span className="flex shrink-0 items-center gap-1.5 font-semibold text-muted-foreground" title={online ? "เชื่อมต่อแล้ว" : "ออฟไลน์"}>
        <span className="relative flex h-2 w-2">
          {online && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-500 opacity-50" />}
          <span className={cn("relative h-2 w-2 rounded-full", online ? "bg-emerald-500" : "bg-rose-500")} />
        </span>
        <span className="hidden sm:inline">{online ? "ออนไลน์" : "ออฟไลน์"}</span>
      </span>

      <span aria-hidden className="h-4 w-px shrink-0 bg-border" />

      <div
        role="status"
        aria-live="polite"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        className="relative flex h-full min-w-0 flex-1 items-center"
      >
        {current ? (
          <>
            <NoticeContent notice={current} queued={queue.length - 1} paused={paused} />
            <button
              type="button"
              onClick={() => dismiss(current.id)}
              aria-label="ปิดการแจ้งเตือน"
              className="ml-1 flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </>
        ) : (
          <span className="truncate text-muted-foreground">พร้อมใช้งาน · การแจ้งเตือนจะแสดงที่แถบนี้</span>
        )}
      </div>

      <NotificationCenter variant="compact" />
    </div>
  );
}
