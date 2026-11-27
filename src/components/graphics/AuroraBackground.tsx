import { cn } from "@/lib/utils";

type AuroraBackgroundProps = {
  className?: string;
  /** hero = เข้มบนพื้นมืด, subtle = จาง ๆ บนพื้นสว่าง/มืด */
  variant?: "hero" | "subtle";
  /** แสดงเส้นกริดจาง ๆ ด้านบน */
  grid?: boolean;
};

/**
 * พื้นหลังแสงออโรรา — ใช้ radial-gradient + transform เท่านั้น
 * (ไม่มี filter: blur ขนาดใหญ่) จึงรันบน compositor ได้ลื่นและประหยัดแบต
 */
export default function AuroraBackground({
  className,
  variant = "subtle",
  grid = false,
}: AuroraBackgroundProps) {
  const strong = variant === "hero";
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}
    >
      <div
        className="absolute -left-[20%] -top-[30%] h-[80%] w-[70%] animate-aurora rounded-full will-change-transform"
        style={{
          background: `radial-gradient(closest-side, color-mix(in srgb, var(--brand-1) ${strong ? 55 : 22}%, transparent), transparent)`,
        }}
      />
      <div
        className="absolute -right-[15%] top-[5%] h-[75%] w-[60%] animate-aurora rounded-full will-change-transform [animation-delay:-6s] [animation-duration:22s]"
        style={{
          background: `radial-gradient(closest-side, color-mix(in srgb, var(--brand-2) ${strong ? 45 : 18}%, transparent), transparent)`,
        }}
      />
      <div
        className="absolute -bottom-[35%] left-[20%] h-[70%] w-[65%] animate-aurora rounded-full will-change-transform [animation-delay:-12s] [animation-duration:26s]"
        style={{
          background: `radial-gradient(closest-side, color-mix(in srgb, var(--brand-3) ${strong ? 38 : 16}%, transparent), transparent)`,
        }}
      />
      {grid && (
        <div
          className={cn(
            "absolute inset-0 bg-grid mask-radial",
            strong ? "text-white/60" : "text-[var(--page-text)] opacity-60"
          )}
        />
      )}
    </div>
  );
}
