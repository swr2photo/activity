import { cn } from "@/lib/utils";
import type { NoticeVariant } from "@/lib/notify";

const TONE: Record<NoticeVariant, string> = {
  success: "text-emerald-500",
  error: "text-rose-500",
  warning: "text-amber-500",
  info: "text-sky-500",
  loading: "text-primary",
  default: "text-primary",
};

/**
 * ไอคอนสถานะแบบเคลื่อนไหว — วาดเส้นด้วย stroke-dashoffset (pathLength=1)
 * key ด้วย id ของการแจ้งเตือนเพื่อเล่นแอนิเมชันใหม่ทุกครั้ง
 */
export function StatusIcon({ variant, className }: { variant: NoticeVariant; className?: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2.2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden className={cn("h-5 w-5 shrink-0", TONE[variant], className)}>
      {variant === "success" && (
        <g className="si-pop">
          <circle cx="12" cy="12" r="9.5" pathLength={1} className="si-stroke" {...common} opacity={0.35} />
          <path d="M7.5 12.4l3 3 6-6.6" pathLength={1} className="si-stroke si-stroke-2" {...common} />
        </g>
      )}
      {variant === "error" && (
        <g className="si-shake">
          <circle cx="12" cy="12" r="9.5" pathLength={1} className="si-stroke" {...common} opacity={0.35} />
          <path d="M9 9l6 6" pathLength={1} className="si-stroke si-stroke-2" {...common} />
          <path d="M15 9l-6 6" pathLength={1} className="si-stroke si-stroke-3" {...common} />
        </g>
      )}
      {variant === "warning" && (
        <g>
          <path d="M12 3.2L2.6 19.5a1 1 0 0 0 .9 1.5h17a1 1 0 0 0 .9-1.5L12 3.2z" pathLength={1} className="si-stroke" {...common} opacity={0.45} />
          <g className="si-pulse">
            <path d="M12 9.5v4.2" pathLength={1} className="si-stroke si-stroke-2" {...common} />
            <circle cx="12" cy="17.2" r="0.6" fill="currentColor" stroke="currentColor" strokeWidth={1.4} />
          </g>
        </g>
      )}
      {variant === "info" && (
        <g className="si-pop">
          <circle cx="12" cy="12" r="9.5" pathLength={1} className="si-stroke" {...common} opacity={0.35} />
          <path d="M12 11v5.5" pathLength={1} className="si-stroke si-stroke-2" {...common} />
          <circle cx="12" cy="7.6" r="0.6" fill="currentColor" stroke="currentColor" strokeWidth={1.4} />
        </g>
      )}
      {variant === "loading" && (
        <g>
          <circle cx="12" cy="12" r="9" {...common} opacity={0.18} />
          <g className="si-orbit">
            <path d="M12 3a9 9 0 0 1 9 9" {...common} />
            <circle cx="21" cy="12" r="1.6" fill="currentColor" stroke="none" />
          </g>
          <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" className="si-pulse" />
        </g>
      )}
      {variant === "default" && (
        <g className="mi mi-ring mi-loop">
          <path d="M6 9a6 6 0 1 1 12 0c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9" pathLength={1} className="si-stroke" {...common} />
          <path d="M10.3 20a1.9 1.9 0 0 0 3.4 0" {...common} />
        </g>
      )}
    </svg>
  );
}

export default StatusIcon;
