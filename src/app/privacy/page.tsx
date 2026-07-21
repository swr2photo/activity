// app/privacy/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { pageLayoutClass, glassCardClass } from '@/lib/uiTheme';
import { cn } from '@/lib/utils';

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: '1. ข้อมูลที่เราเก็บรวบรวม',
    body: (
      <>
        ระบบลงทะเบียนกิจกรรมคณะวิทยาศาสตร์ มหาวิทยาลัยสงขลานครินทร์ อาจเก็บข้อมูลดังนี้เมื่อคุณใช้งาน:
        <ul>
          <li>ข้อมูลบัญชีจาก Microsoft / มหาวิทยาลัย เช่น ชื่อ อีเมล และรหัสนักศึกษา</li>
          <li>ข้อมูลโปรไฟล์ที่คุณกรอก เช่น คณะ สาขา Username และรูปโปรไฟล์</li>
          <li>ข้อมูลการลงทะเบียนกิจกรรม เวลา และสถานะการเข้าร่วม</li>
          <li>ตำแหน่งพิกัด (GPS) เมื่อคุณอนุญาต เพื่อตรวจสอบว่าอยู่ในพื้นที่กิจกรรม</li>
          <li>ข้อมูลทางเทคนิคที่จำเป็น เช่น ที่อยู่ IP สำหรับจำกัดการเข้าสู่ระบบ</li>
        </ul>
      </>
    ),
  },
  {
    title: '2. วัตถุประสงค์การใช้ข้อมูล',
    body: (
      <>
        เราใช้ข้อมูลเพื่อดำเนินการลงทะเบียนและเช็คอินกิจกรรม ยืนยันตัวตนผู้ใช้
        ป้องกันการใช้งานผิดปกติ ปรับปรุงระบบ และติดต่อสื่อสารที่เกี่ยวข้องกับกิจกรรม
        โดยไม่ขายข้อมูลส่วนบุคคลให้บุคคลภายนอก
      </>
    ),
  },
  {
    title: '3. ตำแหน่งที่ตั้ง (Location)',
    body: (
      <>
        การขอตำแหน่งใช้เฉพาะตอนลงทะเบียนหรือเช็คอินกิจกรรมที่กำหนดพื้นที่
        คุณสามารถปฏิเสธการอนุญาตได้ แต่ระบบอาจไม่สามารถยืนยันการอยู่ในพื้นที่ได้
        ข้อมูลตำแหน่งไม่ได้ถูกใช้เพื่อติดตามนอกเหนือจากวัตถุประสงค์ของกิจกรรม
      </>
    ),
  },
  {
    title: '4. การเก็บรักษาและการเข้าถึง',
    body: (
      <>
        ข้อมูลถูกเก็บในบริการคลาวด์ที่ได้รับอนุญาต และเข้าถึงได้โดยผู้ดูแลระบบที่มีสิทธิ์
        ตามสังกัด/บทบาท เพื่อจัดการกิจกรรมและรายงานที่จำเป็นเท่านั้น
      </>
    ),
  },
  {
    title: '5. สิทธิ์ของคุณ',
    body: (
      <>
        คุณสามารถขอแก้ไขข้อมูลโปรไฟล์ผ่านระบบ หรือติดต่อผู้ดูแลเพื่อสอบถามเกี่ยวกับข้อมูลของคุณ
        หากต้องการระงับบัญชีหรือลบข้อมูลที่ไม่จำเป็นต่อการปฏิบัติตามภารกิจของหน่วยงาน
        โปรดติดต่อผู้ดูแลระบบ
      </>
    ),
  },
  {
    title: '6. การติดต่อ',
    body: (
      <>
        หากมีคำถามเกี่ยวกับนโยบายความเป็นส่วนตัว กรุณาติดต่อ{' '}
        <a href="mailto:psuscc@psu.ac.th" className="text-primary hover:underline">
          psuscc@psu.ac.th
        </a>{' '}
        หรือช่องทางของคณะวิทยาศาสตร์ ม.อ.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <div className={pageLayoutClass}>
      <Navbar />
      <div className="mx-auto w-full max-w-3xl flex-1 px-4 py-8 md:py-12">
        <Button
          asChild
          variant="ghost"
          className="mb-2 font-bold text-muted-foreground"
        >
          <Link href="/">
            <ArrowLeft className="h-4 w-4" />
            กลับหน้าแรก
          </Link>
        </Button>

        <h1 className="mb-1 text-3xl font-black tracking-tight text-[var(--page-text)] md:text-4xl">
          นโยบายความเป็นส่วนตัว
        </h1>
        <p className="mb-6 text-sm text-[var(--page-text-secondary)]">
          อัปเดตล่าสุด:{' '}
          {new Date().toLocaleDateString('th-TH', {
            year: 'numeric',
            month: 'long',
            day: 'numeric',
          })}
        </p>

        <div className={cn(glassCardClass, 'p-5 sm:p-7')}>
          <p className="mb-6 text-base leading-relaxed text-muted-foreground">
            เอกสารนี้อธิบายวิธีที่ระบบ PSU REGISTER เก็บ ใช้ และคุ้มครองข้อมูลส่วนบุคคลของนักศึกษาและผู้ใช้งาน
            เมื่อเข้าใช้งานเว็บไซต์และบริการที่เกี่ยวข้อง
          </p>

          <div className="flex flex-col gap-6">
            {sections.map((s, i) => (
              <React.Fragment key={s.title}>
                {i > 0 && <Separator />}
                <div>
                  <h2 className="mb-2 text-[1.05rem] font-extrabold text-foreground">
                    {s.title}
                  </h2>
                  <div className="text-sm leading-relaxed text-muted-foreground [&_ul]:mt-2 [&_ul]:mb-0 [&_ul]:list-disc [&_ul]:pl-6 [&_li]:mb-1">
                    {s.body}
                  </div>
                </div>
              </React.Fragment>
            ))}
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
