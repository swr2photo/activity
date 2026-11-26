import React from 'react';
import Link from 'next/link';
import { FlaskConical, Mail, Phone } from 'lucide-react';

const FacebookIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M22 12a10 10 0 1 0-11.5 9.9v-7H8v-3h2.5V9.5c0-2.5 1.5-3.9 3.8-3.9 1.1 0 2.2.2 2.2.2v2.4h-1.2c-1.2 0-1.6.8-1.6 1.5V12H16l-.4 3h-2.5v7A10 10 0 0 0 22 12z" />
  </svg>
);

const InstagramIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M7 2h10a5 5 0 0 1 5 5v10a5 5 0 0 1-5 5H7a5 5 0 0 1-5-5V7a5 5 0 0 1 5-5zm10 2H7a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h10a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3zm-5 3.5A4.5 4.5 0 1 1 7.5 12 4.5 4.5 0 0 1 12 7.5zm0 2A2.5 2.5 0 1 0 14.5 12 2.5 2.5 0 0 0 12 9.5zm5.25-3.25a1 1 0 1 1-1 1 1 1 0 0 1 1-1z" />
  </svg>
);

// สี hover ผ่าน CSS variable — ไม่ต้องใช้ JS onMouseEnter/Leave
const socialLinks = [
  { label: 'Facebook PSU SCC', icon: FacebookIcon, url: 'https://www.facebook.com/psuscc', color: '#1877F2' },
  { label: 'Instagram PSU SCC', icon: InstagramIcon, url: 'https://www.instagram.com/psuscc', color: '#E4405F' },
  { label: 'ส่งอีเมลถึง PSU SCC', icon: Mail, url: 'mailto:psuscc@psu.ac.th', color: '#0a6bcf' },
  { label: 'โทรหา PSU SCC', icon: Phone, url: 'tel:+66-81-2345678', color: '#10b981' },
];

/** Footer ไม่มี state/handler — ใช้ได้ทั้ง Server และ Client Component */
const Footer: React.FC = () => {
  return (
    <footer className="relative mt-auto overflow-hidden bg-[var(--page-bg)] pb-28 pt-0 lg:pb-8">
      {/* คลื่นไล่สีด้านบน */}
      <svg
        aria-hidden
        viewBox="0 0 1440 80"
        preserveAspectRatio="none"
        className="block h-10 w-full text-[var(--page-card-solid)] md:h-14"
      >
        <defs>
          <linearGradient id="footer-wave" x1="0" x2="1">
            <stop offset="0%" stopColor="var(--brand-1)" stopOpacity="0.25" />
            <stop offset="50%" stopColor="var(--brand-2)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--brand-3)" stopOpacity="0.25" />
          </linearGradient>
        </defs>
        <path d="M0 40 C 240 80 480 0 720 30 C 960 60 1200 10 1440 40 L1440 80 L0 80 Z" fill="url(#footer-wave)" />
        <path d="M0 55 C 300 20 560 80 840 50 C 1080 25 1260 70 1440 50 L1440 80 L0 80 Z" fill="currentColor" />
      </svg>

      <div className="relative bg-[var(--page-card-solid)] pb-2 pt-6">
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-dots text-[var(--page-text)] opacity-[0.35] mask-fade-b" />
        <div className="relative mx-auto w-full max-w-6xl px-4">
          <div className="flex flex-col justify-between gap-8 md:flex-row md:items-center">
            {/* Brand Section */}
            <div className="flex flex-col items-center gap-3 md:flex-row md:items-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-gradient text-white shadow-[0_10px_24px_-10px_rgba(10,107,207,0.7)]">
                <FlaskConical className="h-6 w-6" />
              </div>
              <div className="text-center md:text-left">
                <h2 className="text-lg font-black tracking-tight text-foreground">PSU REGISTER</h2>
                <p className="max-w-80 text-sm leading-relaxed text-muted-foreground">
                  ระบบลงทะเบียนกิจกรรม คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์
                </p>
              </div>
            </div>

            {/* Social & Contact Section */}
            <div className="flex justify-center gap-2">
              {socialLinks.map(({ label, icon: Icon, url, color }) => (
                <a
                  key={url}
                  href={url}
                  aria-label={label}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ '--c': color } as React.CSSProperties}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[var(--page-border)] bg-[var(--page-bg)] text-muted-foreground transition-[color,background-color,border-color,translate] duration-300 hover:-translate-y-1 hover:border-[color-mix(in_srgb,var(--c)_40%,transparent)] hover:bg-[color-mix(in_srgb,var(--c)_12%,transparent)] hover:text-[var(--c)]"
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>

          <div className="my-6 h-px bg-gradient-to-r from-transparent via-[var(--page-border)] to-transparent" />

          {/* Bottom Bar */}
          <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
            <p className="order-2 text-xs text-muted-foreground/80 sm:order-1">
              © {new Date().getFullYear()} Prince of Songkla University.
            </p>

            <div className="order-1 flex gap-6 sm:order-2">
              <Link
                href="/privacy"
                className="text-xs text-muted-foreground/80 no-underline transition-colors hover:text-primary"
              >
                ความเป็นส่วนตัว
              </Link>
              <Link
                href="/admin"
                prefetch={false}
                className="text-xs text-muted-foreground/80 no-underline transition-colors hover:text-primary"
              >
                สำหรับแอดมิน
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
