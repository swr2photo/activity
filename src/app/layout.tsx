// src/app/layout.tsx
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import ToastProvider from "@/components/common/ToastProvider";
import AppThemeProvider from "@/components/providers/AppThemeProvider";
import { ConfirmDialogProvider } from "@/components/providers/ConfirmDialogProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ระบบลงทะเบียนกิจกรรม | คณะวิทยาศาสตร์ ม.อ.",
  description: "ระบบลงทะเบียนกิจกรรมออนไลน์ คณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" className="h-full w-full" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased h-full w-full overflow-x-hidden bg-background text-foreground`}>
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
