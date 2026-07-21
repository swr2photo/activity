'use client';

import React from 'react';
import Link from 'next/link';
import { Mail, Phone } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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

const Footer: React.FC = () => {
  const socialLinks = [
    { icon: FacebookIcon, url: 'https://www.facebook.com/psuscc', color: '#1877F2' },
    { icon: InstagramIcon, url: 'https://www.instagram.com/psuscc', color: '#E4405F' },
    { icon: Mail, url: 'mailto:psuscc@psu.ac.th', color: 'hsl(var(--primary))' },
    { icon: Phone, url: 'tel:+66-81-2345678', color: 'hsl(var(--primary))' },
  ];

  return (
    <footer
      className="mt-auto border-t border-border/40 bg-background/80 pt-6 pb-12 backdrop-blur-[20px] backdrop-saturate-180 sm:pb-4"
    >
      <div className="mx-auto w-full max-w-6xl px-4">
        <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
          {/* Brand Section */}
          <div className="flex flex-col items-center gap-1.5 md:items-start">
            <h2 className="text-lg font-black tracking-tight text-foreground">
              PSU REGISTER
            </h2>
            <p className="max-w-80 text-center text-sm leading-relaxed text-muted-foreground md:text-left">
              ระบบลงทะเบียนกิจกรรมชุมนุม คณะวิทยาศาสตร์ <br />
              มหาวิทยาลัยสงขลานครินทร์
            </p>
          </div>

          {/* Social & Contact Section */}
          <div className="flex flex-col items-center gap-2 md:items-end">
            <div className="flex gap-1">
              {socialLinks.map(({ icon: Icon, url, color }, index) => (
                <a
                  key={index}
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-border/20 text-muted-foreground transition-all duration-300 hover:-translate-y-0.5"
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = color;
                    e.currentTarget.style.backgroundColor = `${color}1a`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = '';
                    e.currentTarget.style.backgroundColor = '';
                  }}
                >
                  <Icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          </div>
        </div>

        <Separator className="my-8 opacity-50" />

        {/* Bottom Bar */}
        <div className="flex flex-col items-center justify-between gap-2 sm:flex-row">
          <p className="order-2 text-xs text-muted-foreground/70 sm:order-1">
            © {new Date().getFullYear()} Prince of Songkla University.
          </p>

          <div className="order-1 flex gap-6 sm:order-2">
            <Link
              href="/privacy"
              className="cursor-pointer text-xs text-muted-foreground/70 no-underline hover:text-primary"
            >
              ความเป็นส่วนตัว
            </Link>
            <Link
              href="/admin"
              className="cursor-pointer text-xs text-muted-foreground/70 no-underline hover:text-primary"
            >
              สำหรับแอดมิน
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
