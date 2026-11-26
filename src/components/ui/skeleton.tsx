import { cn } from "@/lib/utils";

/** Skeleton แบบแสงวิ่ง (shimmer) — ใช้ transform จึงไม่ trigger layout/paint ทุกเฟรม */
function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-md bg-primary/[0.07] dark:bg-white/[0.06]",
        "after:absolute after:inset-0 after:animate-shimmer after:bg-gradient-to-r after:from-transparent after:via-white/55 after:to-transparent dark:after:via-white/[0.07]",
        className
      )}
      {...props}
    />
  );
}

export { Skeleton };
