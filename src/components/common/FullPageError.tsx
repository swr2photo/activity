'use client';

import React from 'react';

/* =====================================================================
 * FullPageError — หน้าแสดงข้อผิดพลาดแบบเต็มจอ พร้อมภาพเวกเตอร์ประกอบ
 * ใช้ร่วมกันได้ทุกหน้า (register, short link, ฯลฯ)
 * ===================================================================== */

export type FullPageErrorVariant =
  | 'expired'      // QR / ลิงก์หมดอายุ
  | 'notfound'     // ไม่พบข้อมูล
  | 'locked'       // ถูกปิดใช้งาน / ไม่มีสิทธิ์ / ลงทะเบียนซ้ำไม่ได้
  | 'blocked'      // ถูกจำกัดการเข้าถึง (IP block)
  | 'maintenance'  // ระบบปิดปรับปรุง
  | 'warning';     // ข้อผิดพลาดทั่วไป

export interface FullPageErrorAction {
  label: string;
  onClick?: () => void;
  href?: string;
  kind?: 'primary' | 'ghost';
}

interface FullPageErrorProps {
  variant?: FullPageErrorVariant;
  title: string;
  message: string;
  /** โค้ดสั้น ๆ แสดงบน chip เช่น QR_EXPIRED */
  code?: string;
  actions?: FullPageErrorAction[];
  footerText?: string;
}

const THEME: Record<FullPageErrorVariant, {
  gradFrom: string;
  gradTo: string;
  soft: string;
  chipBg: string;
  chipText: string;
  blobA: string;
  blobB: string;
}> = {
  expired: {
    gradFrom: '#f59e0b', gradTo: '#ef4444',
    soft: 'rgba(245, 158, 11, 0.1)',
    chipBg: 'rgba(245, 158, 11, 0.12)', chipText: '#b45309',
    blobA: 'rgba(251, 191, 36, 0.22)', blobB: 'rgba(248, 113, 113, 0.18)',
  },
  notfound: {
    gradFrom: '#0ea5e9', gradTo: '#6366f1',
    soft: 'rgba(14, 165, 233, 0.1)',
    chipBg: 'rgba(14, 165, 233, 0.12)', chipText: '#0369a1',
    blobA: 'rgba(56, 189, 248, 0.22)', blobB: 'rgba(129, 140, 248, 0.18)',
  },
  locked: {
    gradFrom: '#6366f1', gradTo: '#9333ea',
    soft: 'rgba(99, 102, 241, 0.1)',
    chipBg: 'rgba(99, 102, 241, 0.12)', chipText: '#4338ca',
    blobA: 'rgba(129, 140, 248, 0.22)', blobB: 'rgba(192, 132, 252, 0.18)',
  },
  blocked: {
    gradFrom: '#f43f5e', gradTo: '#dc2626',
    soft: 'rgba(244, 63, 94, 0.1)',
    chipBg: 'rgba(244, 63, 94, 0.12)', chipText: '#be123c',
    blobA: 'rgba(251, 113, 133, 0.22)', blobB: 'rgba(252, 165, 165, 0.2)',
  },
  maintenance: {
    gradFrom: '#64748b', gradTo: '#334155',
    soft: 'rgba(100, 116, 139, 0.1)',
    chipBg: 'rgba(100, 116, 139, 0.12)', chipText: '#475569',
    blobA: 'rgba(148, 163, 184, 0.25)', blobB: 'rgba(251, 191, 36, 0.16)',
  },
  warning: {
    gradFrom: '#f59e0b', gradTo: '#f97316',
    soft: 'rgba(245, 158, 11, 0.1)',
    chipBg: 'rgba(245, 158, 11, 0.12)', chipText: '#b45309',
    blobA: 'rgba(252, 211, 77, 0.24)', blobB: 'rgba(253, 186, 116, 0.18)',
  },
};

/* ---------------------------------------------------------------------
 * ภาพเวกเตอร์ประกอบของแต่ละ variant (โครงร่วม: วงโคจร + ฉากกลาง)
 * ------------------------------------------------------------------- */

const SceneFrame: React.FC<{ variant: FullPageErrorVariant; children: React.ReactNode }> = ({ variant, children }) => {
  const t = THEME[variant];
  return (
    <svg
      width="320"
      height="240"
      viewBox="0 0 320 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="mx-auto drop-shadow-2xl animate-fpe-float w-[260px] h-[195px] md:w-[320px] md:h-[240px]"
    >
      {/* Orbits */}
      <circle cx="160" cy="120" r="92" fill={t.soft} />
      <circle cx="160" cy="120" r="78" stroke={t.gradFrom} strokeOpacity="0.18" strokeWidth="1.5" strokeDasharray="3 7" className="animate-fpe-spin" style={{ transformOrigin: '160px 120px' }} />
      <circle cx="160" cy="120" r="104" stroke={t.gradTo} strokeOpacity="0.1" strokeWidth="1.5" strokeDasharray="2 9" className="animate-fpe-spin-rev" style={{ transformOrigin: '160px 120px' }} />
      {/* Sparkles */}
      <circle cx="60" cy="70" r="4" fill={t.gradFrom} opacity="0.45" />
      <circle cx="262" cy="160" r="5" fill={t.gradTo} opacity="0.35" />
      <circle cx="250" cy="58" r="3" fill={t.gradFrom} opacity="0.55" />
      <circle cx="70" cy="180" r="3.5" fill={t.gradTo} opacity="0.4" />
      <path d="M285 100l3.2 7.2 7.2 3.2-7.2 3.2-3.2 7.2-3.2-7.2-7.2-3.2 7.2-3.2 3.2-7.2z" fill={t.gradFrom} opacity="0.35" />
      <path d="M38 120l2.4 5.4 5.4 2.4-5.4 2.4-2.4 5.4-2.4-5.4-5.4-2.4 5.4-2.4 2.4-5.4z" fill={t.gradTo} opacity="0.3" />
      {/* Ground shadow */}
      <ellipse cx="160" cy="204" rx="86" ry="9" fill="#0f172a" opacity="0.07" />
      {children}
    </svg>
  );
};

const ExpiredScene = () => (
  <SceneFrame variant="expired">
    <defs>
      <linearGradient id="fpeQr" x1="105" y1="70" x2="185" y2="160" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#334155" />
        <stop offset="100%" stopColor="#0f172a" />
      </linearGradient>
      <linearGradient id="fpeClock" x1="170" y1="115" x2="230" y2="180" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#ef4444" />
      </linearGradient>
    </defs>
    {/* QR tile */}
    <rect x="102" y="62" width="96" height="96" rx="16" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
    <rect x="114" y="74" width="26" height="26" rx="6" fill="url(#fpeQr)" />
    <rect x="120" y="80" width="14" height="14" rx="3" fill="#ffffff" />
    <rect x="160" y="74" width="26" height="26" rx="6" fill="url(#fpeQr)" />
    <rect x="166" y="80" width="14" height="14" rx="3" fill="#ffffff" />
    <rect x="114" y="120" width="26" height="26" rx="6" fill="url(#fpeQr)" />
    <rect x="120" y="126" width="14" height="14" rx="3" fill="#ffffff" />
    <rect x="160" y="120" width="10" height="10" rx="2.5" fill="url(#fpeQr)" />
    <rect x="176" y="120" width="10" height="10" rx="2.5" fill="url(#fpeQr)" opacity="0.55" />
    <rect x="160" y="136" width="10" height="10" rx="2.5" fill="url(#fpeQr)" opacity="0.55" />
    <rect x="176" y="136" width="10" height="10" rx="2.5" fill="url(#fpeQr)" />
    {/* Fading scanline */}
    <rect x="96" y="104" width="108" height="5" rx="2.5" fill="#f43f5e" opacity="0.5" />
    {/* Clock badge */}
    <circle cx="200" cy="148" r="34" fill="url(#fpeClock)" stroke="#ffffff" strokeWidth="5" />
    <circle cx="200" cy="148" r="24" fill="#ffffff" opacity="0.16" />
    <path d="M200 132v16l11 8" stroke="#ffffff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="200" cy="148" r="3" fill="#ffffff" />
  </SceneFrame>
);

const NotFoundScene = () => (
  <SceneFrame variant="notfound">
    <defs>
      <linearGradient id="fpeMap" x1="100" y1="70" x2="200" y2="160" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#0ea5e9" />
        <stop offset="100%" stopColor="#3b82f6" />
      </linearGradient>
      <linearGradient id="fpeMag" x1="170" y1="120" x2="225" y2="180" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#4f46e5" />
      </linearGradient>
    </defs>
    {/* Folded map */}
    <path d="M96 78l38-14 40 14 42-14v82l-42 14-40-14-38 14V78z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
    <path d="M134 64v82" stroke="#e2e8f0" strokeWidth="2" />
    <path d="M174 78v82" stroke="#e2e8f0" strokeWidth="2" />
    <path d="M104 96c14 6 22-8 34 0s20-6 30 2 18-4 32-1" stroke="url(#fpeMap)" strokeWidth="3.5" strokeLinecap="round" strokeDasharray="1 8" fill="none" />
    {/* Question pin */}
    <path d="M150 84c-9 0-16 7-16 16 0 12 16 26 16 26s16-14 16-26c0-9-7-16-16-16z" fill="url(#fpeMap)" />
    <circle cx="150" cy="100" r="6.5" fill="#ffffff" />
    {/* Magnifier */}
    <circle cx="196" cy="142" r="26" fill="#ffffff" fillOpacity="0.85" stroke="url(#fpeMag)" strokeWidth="6" />
    <path d="M196 132v12" stroke="#6366f1" strokeWidth="4.5" strokeLinecap="round" />
    <circle cx="196" cy="152" r="2.6" fill="#6366f1" />
    <line x1="215" y1="161" x2="234" y2="180" stroke="url(#fpeMag)" strokeWidth="8" strokeLinecap="round" />
  </SceneFrame>
);

const LockedScene = () => (
  <SceneFrame variant="locked">
    <defs>
      <linearGradient id="fpeLockBody" x1="120" y1="110" x2="200" y2="175" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#6366f1" />
        <stop offset="100%" stopColor="#9333ea" />
      </linearGradient>
      <linearGradient id="fpeShackle" x1="130" y1="60" x2="190" y2="110" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#818cf8" />
        <stop offset="100%" stopColor="#6366f1" />
      </linearGradient>
    </defs>
    {/* Shield backdrop */}
    <path d="M160 52l52 18v34c0 34-22 56-52 66-30-10-52-32-52-66V70l52-18z" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
    {/* Shackle */}
    <path d="M136 112V96c0-13.3 10.7-24 24-24s24 10.7 24 24v16" stroke="url(#fpeShackle)" strokeWidth="9" strokeLinecap="round" fill="none" />
    {/* Lock body */}
    <rect x="124" y="112" width="72" height="54" rx="14" fill="url(#fpeLockBody)" />
    <circle cx="160" cy="134" r="7" fill="#ffffff" />
    <path d="M160 140v12" stroke="#ffffff" strokeWidth="4" strokeLinecap="round" />
    {/* Keyhole shine */}
    <path d="M132 120c4-5 10-8 16-9" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" opacity="0.45" />
  </SceneFrame>
);

const BlockedScene = () => (
  <SceneFrame variant="blocked">
    <defs>
      <linearGradient id="fpeShield" x1="115" y1="65" x2="205" y2="175" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f43f5e" />
        <stop offset="100%" stopColor="#dc2626" />
      </linearGradient>
    </defs>
    {/* Shield */}
    <path d="M160 52l56 20v36c0 36-24 58-56 68-32-10-56-32-56-68V72l56-20z" fill="url(#fpeShield)" />
    <path d="M160 62l46 16.5V108c0 30-20 48-46 57-26-9-46-27-46-57V78.5L160 62z" fill="#ffffff" opacity="0.14" />
    {/* Hand / stop */}
    <circle cx="160" cy="116" r="34" fill="#ffffff" opacity="0.95" />
    <path d="M147 106v22M156 100v28M165 102v26M174 108v18" stroke="url(#fpeShield)" strokeWidth="6" strokeLinecap="round" />
    <path d="M145 122c-4-3-9-1-9 4 0 8 8 16 20 18" stroke="url(#fpeShield)" strokeWidth="6" strokeLinecap="round" fill="none" />
    {/* Timer dots */}
    <circle cx="219" cy="80" r="4" fill="#fda4af" />
    <circle cx="101" cy="80" r="4" fill="#fda4af" />
  </SceneFrame>
);

const MaintenanceScene = () => (
  <SceneFrame variant="maintenance">
    <defs>
      <linearGradient id="fpeGear" x1="110" y1="80" x2="190" y2="160" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#64748b" />
        <stop offset="100%" stopColor="#334155" />
      </linearGradient>
      <linearGradient id="fpeWrench" x1="170" y1="120" x2="230" y2="180" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#d97706" />
      </linearGradient>
    </defs>
    {/* Big gear */}
    <g className="animate-fpe-spin" style={{ transformOrigin: '148px 116px' }}>
      <path d="M148 66l7 14 15-3 2 15 15 4-6 14 12 10-12 10 6 14-15 4-2 15-15-3-7 14-7-14-15 3-2-15-15-4 6-14-12-10 12-10-6-14 15-4 2-15 15 3 7-14z" fill="url(#fpeGear)" />
      <circle cx="148" cy="116" r="22" fill="#ffffff" />
      <circle cx="148" cy="116" r="10" fill="url(#fpeGear)" />
    </g>
    {/* Wrench */}
    <g transform="rotate(38 205 152)">
      <path d="M188 132a17 17 0 0 1 22-16l-9 12 4 9 9 4 12-9a17 17 0 0 1-25 19l-34 34a8 8 0 0 1-11-11l34-34a17 17 0 0 1-2-8z" fill="url(#fpeWrench)" transform="translate(14 8)" />
    </g>
  </SceneFrame>
);

const WarningScene = () => (
  <SceneFrame variant="warning">
    <defs>
      <linearGradient id="fpeWarn" x1="120" y1="66" x2="200" y2="165" gradientUnits="userSpaceOnUse">
        <stop offset="0%" stopColor="#f59e0b" />
        <stop offset="100%" stopColor="#f97316" />
      </linearGradient>
    </defs>
    {/* Browser window */}
    <rect x="94" y="72" width="132" height="96" rx="14" fill="#ffffff" stroke="#e2e8f0" strokeWidth="2" />
    <rect x="94" y="72" width="132" height="24" rx="14" fill="#f1f5f9" />
    <rect x="94" y="86" width="132" height="10" fill="#f1f5f9" />
    <circle cx="108" cy="84" r="3.5" fill="#f87171" />
    <circle cx="120" cy="84" r="3.5" fill="#fbbf24" />
    <circle cx="132" cy="84" r="3.5" fill="#34d399" />
    <rect x="108" y="108" width="64" height="7" rx="3.5" fill="#e2e8f0" />
    <rect x="108" y="124" width="44" height="7" rx="3.5" fill="#e2e8f0" />
    <rect x="108" y="140" width="54" height="7" rx="3.5" fill="#e2e8f0" />
    {/* Warning triangle badge */}
    <path d="M196 106l34 58h-68l34-58z" fill="url(#fpeWarn)" stroke="#ffffff" strokeWidth="5" strokeLinejoin="round" />
    <path d="M196 128v16" stroke="#ffffff" strokeWidth="5.5" strokeLinecap="round" />
    <circle cx="196" cy="153" r="3.5" fill="#ffffff" />
  </SceneFrame>
);

const SCENES: Record<FullPageErrorVariant, React.FC> = {
  expired: ExpiredScene,
  notfound: NotFoundScene,
  locked: LockedScene,
  blocked: BlockedScene,
  maintenance: MaintenanceScene,
  warning: WarningScene,
};

/* ---------------------------------------------------------------------
 * Component หลัก
 * ------------------------------------------------------------------- */

export const FullPageError: React.FC<FullPageErrorProps> = ({
  variant = 'warning',
  title,
  message,
  code,
  actions = [],
  footerText = 'ระบบลงทะเบียนกิจกรรม | ชุมนุมคอมพิวเตอร์ มหาวิทยาลัยสงขลานครินทร์ วิทยาเขตหาดใหญ่',
}) => {
  const t = THEME[variant];
  const Scene = SCENES[variant];

  return (
    <div className="min-h-[100svh] w-full flex flex-col items-center justify-center relative overflow-hidden font-sans bg-gradient-to-b from-slate-50 via-white to-slate-50 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950 px-6 py-12">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes fpe-float {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-10px); }
        }
        @keyframes fpe-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes fpe-spin-rev {
          from { transform: rotate(360deg); }
          to { transform: rotate(0deg); }
        }
        @keyframes fpe-rise {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fpe-float { animation: fpe-float 4.5s ease-in-out infinite; }
        .animate-fpe-spin { animation: fpe-spin 26s linear infinite; }
        .animate-fpe-spin-rev { animation: fpe-spin-rev 34s linear infinite; }
        .fpe-rise { animation: fpe-rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) both; }
        .fpe-rise-1 { animation-delay: 0.05s; }
        .fpe-rise-2 { animation-delay: 0.14s; }
        .fpe-rise-3 { animation-delay: 0.22s; }
        .fpe-rise-4 { animation-delay: 0.3s; }
      `}} />

      {/* Decorative background blobs */}
      <div
        className="absolute top-[-18%] left-[-12%] w-[520px] h-[520px] rounded-full blur-[90px] pointer-events-none"
        style={{ background: t.blobA }}
      />
      <div
        className="absolute bottom-[-18%] right-[-12%] w-[520px] h-[520px] rounded-full blur-[90px] pointer-events-none"
        style={{ background: t.blobB }}
      />
      {/* Dot grid texture */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.35]"
        style={{
          backgroundImage: 'radial-gradient(rgba(100, 116, 139, 0.14) 1px, transparent 1px)',
          backgroundSize: '26px 26px',
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 45%, black 30%, transparent 75%)',
        }}
      />

      <div className="relative z-10 w-full max-w-xl text-center flex-1 flex flex-col items-center justify-center">
        {/* Vector illustration */}
        <div className="fpe-rise fpe-rise-1 mb-2">
          <Scene />
        </div>

        {/* Error code chip */}
        {code && (
          <div className="fpe-rise fpe-rise-2 mb-4">
            <span
              className="inline-block text-[11px] font-black tracking-[0.18em] uppercase px-3.5 py-1.5 rounded-full font-mono"
              style={{ background: t.chipBg, color: t.chipText }}
            >
              {code}
            </span>
          </div>
        )}

        <h1 className="fpe-rise fpe-rise-2 text-2xl md:text-[28px] font-black text-slate-900 dark:text-slate-50 tracking-tight mb-3 leading-snug">
          {title}
        </h1>
        <p className="fpe-rise fpe-rise-3 text-[15px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium max-w-md mx-auto mb-9">
          {message}
        </p>

        {/* Actions */}
        {actions.length > 0 && (
          <div className="fpe-rise fpe-rise-4 flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-sm mx-auto">
            {actions.map((action, idx) => {
              const isPrimary = (action.kind ?? (idx === 0 ? 'primary' : 'ghost')) === 'primary';
              const className = isPrimary
                ? 'w-full sm:w-auto flex-1 py-3 px-7 rounded-2xl font-bold text-white text-sm shadow-lg transition-all duration-200 hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]'
                : 'w-full sm:w-auto flex-1 py-3 px-7 rounded-2xl font-bold text-sm text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-sm transition-all duration-200 hover:bg-slate-50 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 active:scale-[0.98]';
              const style = isPrimary
                ? { background: `linear-gradient(135deg, ${t.gradFrom}, ${t.gradTo})`, boxShadow: `0 12px 24px -8px ${t.gradTo}55` }
                : undefined;

              return action.href ? (
                <a key={idx} href={action.href} className={className} style={style}>
                  {action.label}
                </a>
              ) : (
                <button key={idx} onClick={action.onClick} className={className} style={style}>
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer branding */}
      <div className="relative z-10 mt-10 text-center">
        <div className="w-48 h-[1px] bg-gradient-to-r from-transparent via-slate-300 to-transparent mx-auto mb-4" />
        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.14em] px-6">
          {footerText}
        </div>
      </div>
    </div>
  );
};

export default FullPageError;
