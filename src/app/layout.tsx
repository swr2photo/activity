// src/app/layout.tsx
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/common/ToastProvider";
import AppThemeProvider from "@/components/providers/AppThemeProvider";
import { ConfirmDialogProvider } from "@/components/providers/ConfirmDialogProvider";
import { themeInitScript } from "@/lib/themeInitScript";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false,
});

/** ฟอนต์ไทยแบบ variable ไฟล์เดียว — เบราว์เซอร์โหลดเฉพาะช่วงอักขระไทย (unicode-range) */
const notoThai = Noto_Sans_Thai({
  variable: "--font-thai",
  subsets: ["thai"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "ระบบลงทะเบียนกิจกรรม | คณะวิทยาศาสตร์ ม.อ.",
  description: "ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f7fb" },
    { media: "(prefers-color-scheme: dark)", color: "#070b14" },
  ],
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className="h-full w-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* เชื่อมต่อล่วงหน้ากับโฮสต์รูปแบนเนอร์/รูปโปรไฟล์ */}
        <link rel="preconnect" href="https://firebasestorage.googleapis.com" crossOrigin="" />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${notoThai.variable} antialiased h-full w-full overflow-x-hidden bg-background text-foreground`}
        suppressHydrationWarning
      >
        <AppThemeProvider>
          <ConfirmDialogProvider>
            <ToastProvider>
              <div className="min-h-[100svh] w-full">
                {children}
              </div>
            </ToastProvider>
          </ConfirmDialogProvider>
        </AppThemeProvider>
      </body>
    </html>
  );
}
