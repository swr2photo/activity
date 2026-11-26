import { cn } from "@/lib/utils";

type EmptyIllustrationProps = {
  className?: string;
  /** search = แว่นขยาย, calendar = ปฏิทิน, inbox = กล่องว่าง */
  kind?: "search" | "calendar" | "inbox";
};

/** ภาพประกอบสถานะว่าง — SVG เบา ๆ ลอยขึ้นลงช้า ๆ */
export default function EmptyIllustration({ className, kind = "search" }: EmptyIllustrationProps) {
  return (
    <svg viewBox="0 0 240 180" aria-hidden="true" className={cn("pointer-events-none", className)}>
      <defs>
        <linearGradient id="empty-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--brand-1)" />
          <stop offset="60%" stopColor="var(--brand-2)" />
          <stop offset="100%" stopColor="var(--brand-3)" />
        </linearGradient>
      </defs>

      {/* พื้นเงา */}
      <ellipse cx="120" cy="160" rx="70" ry="9" fill="currentColor" opacity="0.07" />

      {/* ดาว/จุดประกาย */}
      <g fill="var(--brand-2)">
        <circle cx="38" cy="40" r="3" className="animate-blink" />
        <circle cx="204" cy="56" r="2.5" className="animate-blink [animation-delay:-0.8s]" />
        <circle cx="190" cy="128" r="2" className="animate-blink [animation-delay:-1.4s]" />
        <circle cx="52" cy="118" r="2" className="animate-blink [animation-delay:-0.4s]" />
      </g>

      <g className="animate-float" style={{ transformBox: "fill-box" }}>
        {kind === "search" && (
          <>
            <circle cx="108" cy="78" r="44" fill="url(#empty-grad)" opacity="0.14" />
            <circle cx="108" cy="78" r="34" fill="none" stroke="url(#empty-grad)" strokeWidth="9" />
            <path d="M133 104 L162 133" stroke="url(#empty-grad)" strokeWidth="12" strokeLinecap="round" />
            <path d="M92 66 q8 -10 22 -6" stroke="#fff" strokeOpacity="0.8" strokeWidth="5" fill="none" strokeLinecap="round" />
          </>
        )}
        {kind === "calendar" && (
          <>
            <rect x="62" y="36" width="116" height="104" rx="18" fill="url(#empty-grad)" opacity="0.16" />
            <rect x="62" y="36" width="116" height="104" rx="18" fill="none" stroke="url(#empty-grad)" strokeWidth="6" />
            <rect x="62" y="36" width="116" height="28" rx="14" fill="url(#empty-grad)" />
            <path d="M90 28 v18 M150 28 v18" stroke="url(#empty-grad)" strokeWidth="7" strokeLinecap="round" />
            {[0, 1, 2].map((r) =>
              [0, 1, 2, 3].map((c) => (
                <rect
                  key={`${r}-${c}`}
                  x={78 + c * 22}
                  y={76 + r * 20}
                  width="12"
                  height="10"
                  rx="3"
                  fill="currentColor"
                  opacity={r === 1 && c === 2 ? 0.6 : 0.14}
                />
              ))
            )}
          </>
        )}
        {kind === "inbox" && (
          <>
            <path d="M58 92 L80 44 H160 L182 92 V130 a12 12 0 0 1 -12 12 H70 a12 12 0 0 1 -12 -12 Z" fill="url(#empty-grad)" opacity="0.16" />
            <path d="M58 92 L80 44 H160 L182 92 V130 a12 12 0 0 1 -12 12 H70 a12 12 0 0 1 -12 -12 Z" fill="none" stroke="url(#empty-grad)" strokeWidth="6" strokeLinejoin="round" />
            <path d="M58 92 H96 a24 24 0 0 0 48 0 H182" fill="none" stroke="url(#empty-grad)" strokeWidth="6" strokeLinejoin="round" />
          </>
        )}
      </g>
    </svg>
  );
}
