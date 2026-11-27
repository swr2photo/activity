"use client";

import { useMemo, useState } from "react";
import { Bell, BellOff, CheckCheck, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { clearHistory, markAllRead, useNotifications } from "@/lib/notify";
import { StatusIcon } from "./StatusIcon";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type FeedItem = {
  id: string;
  title: string;
  message?: string;
  at: number;
  unread?: boolean;
};

const rtf = new Intl.RelativeTimeFormat("th", { numeric: "auto" });
const ago = (t: number) => {
  const s = Math.round((t - Date.now()) / 1000);
  if (Math.abs(s) < 45) return "เมื่อสักครู่";
  const m = Math.round(s / 60);
  if (Math.abs(m) < 60) return rtf.format(m, "minute");
  const h = Math.round(m / 60);
  if (Math.abs(h) < 24) return rtf.format(h, "hour");
  return rtf.format(Math.round(h / 24), "day");
};

type Props = {
  /** compact = ปุ่มเล็กในแถบสถานะ, icon = ปุ่มกระดิ่งใน header/navbar */
  variant?: "icon" | "compact";
  /** รายการจากระบบ (เช่น adminNotifications ใน Firestore) */
  feed?: FeedItem[];
  feedUnread?: number;
  onOpen?: () => void;
  /** เรียกตอนปิดเมนู (เช่น บันทึกว่าอ่านแล้ว) */
  onClose?: () => void;
  className?: string;
  align?: "start" | "end" | "center";
  side?: "top" | "bottom";
};

/** ศูนย์แจ้งเตือน — ดูย้อนหลังทุกข้อความที่เคยแสดงในแถบสถานะ (+ รายการจากระบบ) */
export default function NotificationCenter({
  variant = "icon",
  feed,
  feedUnread = 0,
  onOpen,
  onClose,
  className,
  align = "end",
  side,
}: Props) {
  const { history } = useNotifications();
  const [tab, setTab] = useState<"session" | "feed">(feed ? "feed" : "session");
  const unread = useMemo(() => history.filter((n) => !n.read).length, [history]);
  const total = unread + feedUnread;

  return (
    <DropdownMenu
      onOpenChange={(open) => {
        if (open) onOpen?.();
        else {
          markAllRead();
          onClose?.();
        }
      }}
    >
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={total > 0 ? `การแจ้งเตือน ${total} รายการใหม่` : "การแจ้งเตือน"}
          className={cn(
            "motion-trigger relative flex shrink-0 items-center justify-center rounded-xl text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
            variant === "compact" ? "h-7 gap-1.5 px-2 text-xs font-semibold" : "h-10 w-10",
            className
          )}
        >
          <Bell className={cn("mi mi-ring", variant === "compact" ? "h-3.5 w-3.5" : "h-5 w-5", total > 0 && "mi-loop text-primary")} />
          {variant === "compact" && <span className="hidden sm:inline">ประวัติ</span>}
          {total > 0 && (
            <span
              key={total}
              className={cn(
                "flex animate-pop-in items-center justify-center rounded-full bg-rose-500 font-bold tabular-nums text-white",
                variant === "compact"
                  ? "h-4 min-w-4 px-1 text-[10px]"
                  : "absolute -right-0.5 -top-0.5 h-[18px] min-w-[18px] border-2 border-[var(--page-card-solid)] px-1 text-[10px]"
              )}
            >
              {total > 99 ? "99+" : total}
            </span>
          )}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align={align}
        side={side}
        sideOffset={8}
        className="w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl p-0"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <p className="text-sm font-bold">การแจ้งเตือน</p>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={markAllRead}
              className="motion-trigger flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
            >
              <CheckCheck className="mi mi-pop h-3.5 w-3.5" />
              อ่านแล้ว
            </button>
            {tab === "session" && history.length > 0 && (
              <button
                type="button"
                onClick={clearHistory}
                aria-label="ล้างประวัติ"
                className="motion-trigger flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-rose-500/10 hover:text-rose-500"
              >
                <Trash2 className="mi mi-wiggle h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {feed && (
          <div className="flex gap-1 border-b border-border p-1.5">
            {(
              [
                { key: "feed", label: "จากระบบ", count: feedUnread },
                { key: "session", label: "ล่าสุดในเครื่องนี้", count: unread },
              ] as const
            ).map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                  tab === t.key ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted"
                )}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="rounded-full bg-rose-500 px-1.5 text-[10px] font-bold text-white">{t.count}</span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="max-h-[min(60vh,380px)] overflow-y-auto overscroll-contain">
          {tab === "feed" && feed ? (
            feed.length === 0 ? (
              <Empty />
            ) : (
              <ul className="stagger divide-y divide-border">
                {feed.map((n, i) => (
                  <li key={n.id} style={{ "--i": i } as React.CSSProperties} className="flex gap-3 px-4 py-3">
                    <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", n.unread ? "bg-primary" : "bg-transparent")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{n.title}</p>
                      {n.message && <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>}
                      <p className="mt-1 text-[11px] text-muted-foreground/80">{ago(n.at)}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )
          ) : history.length === 0 ? (
            <Empty />
          ) : (
            <ul className="stagger divide-y divide-border">
              {history.map((n, i) => (
                <li
                  key={n.id}
                  style={{ "--i": i } as React.CSSProperties}
                  className={cn("flex gap-3 px-4 py-3", !n.read && "bg-primary/[0.04]")}
                >
                  <StatusIcon variant={n.variant} className="mt-0.5 h-4 w-4" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold leading-snug">{n.title}</p>
                    {n.description && <p className="mt-0.5 text-xs text-muted-foreground">{n.description}</p>}
                    <p className="mt-1 text-[11px] text-muted-foreground/80">{ago(n.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function Empty() {
  return (
    <div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-muted-foreground">
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
        <BellOff className="h-5 w-5 animate-float" />
      </span>
      ยังไม่มีการแจ้งเตือน
    </div>
  );
}
