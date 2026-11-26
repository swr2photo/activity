import { cn } from "@/lib/utils";

type ScienceOrbitProps = {
  className?: string;
  /** light = ใช้บนพื้นมืด, brand = ใช้สีแบรนด์ */
  tone?: "light" | "brand";
};

/** เส้นทางวงรี rx=86 ry=30 รอบจุด (100,100) */
const ELLIPSE_PATH = "M14,100 a86,30 0 1,0 172,0 a86,30 0 1,0 -172,0";

/**
 * กราฟิกอะตอม (สื่อถึงคณะวิทยาศาสตร์) — SVG ล้วน
 * วงโคจร 3 วง อิเล็กตรอนวิ่งตามวงรีคนละความเร็ว
 */
export default function ScienceOrbit({ className, tone = "brand" }: ScienceOrbitProps) {
  const light = tone === "light";
  const ring = light ? "rgba(255,255,255,0.32)" : "color-mix(in srgb, var(--brand-1) 38%, transparent)";
  const dots = light ? ["#ffffff", "#a5f3fc", "#6ee7b7"] : ["var(--brand-1)", "var(--brand-2)", "var(--brand-3)"];
  const gradId = light ? "orbit-nucleus-light" : "orbit-nucleus-brand";

  return (
    <svg
      viewBox="0 0 200 200"
      aria-hidden="true"
      className={cn("pointer-events-none select-none", className)}
    >
      <defs>
        <radialGradient id={gradId} cx="40%" cy="35%" r="65%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="50%" stopColor={dots[1]} />
          <stop offset="100%" stopColor={dots[0]} />
        </radialGradient>
      </defs>

      {[0, 60, 120].map((deg, i) => (
        <g key={deg} transform={`rotate(${deg} 100 100)`}>
          <ellipse cx="100" cy="100" rx="86" ry="30" fill="none" stroke={ring} strokeWidth="1.3" />
          <circle r={5.5 - i * 0.5} fill={dots[i]}>
            <animateMotion
              dur={`${7 + i * 2.5}s`}
              begin={`${-i * 1.7}s`}
              repeatCount="indefinite"
              path={ELLIPSE_PATH}
              keyPoints={i % 2 ? "1;0" : "0;1"}
              keyTimes="0;1"
              calcMode="linear"
            />
          </circle>
        </g>
      ))}

      <circle cx="100" cy="100" r="25" fill="none" stroke={dots[1]} strokeOpacity="0.35" className="animate-blink" />
      <circle cx="100" cy="100" r="15" fill={`url(#${gradId})`} />
    </svg>
  );
}
