// app/privacy/page.tsx
'use client';

import React from 'react';
import Link from 'next/link';
import {
  Box,
  Container,
  Typography,
  Stack,
  Divider,
  Button,
} from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

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
        <a href="mailto:psuscc@psu.ac.th">psuscc@psu.ac.th</a> หรือช่องทางของคณะวิทยาศาสตร์ ม.อ.
      </>
    ),
  },
];

export default function PrivacyPage() {
  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        minHeight: '100vh',
        bgcolor: 'var(--page-bg)',
        color: 'var(--page-text)',
      }}
    >
      <Navbar />
      <Container maxWidth="md" sx={{ flex: 1, py: { xs: 4, md: 6 }, px: 2 }}>
        <Button
          component={Link}
          href="/"
          startIcon={<ArrowBack />}
          sx={{ mb: 2, fontWeight: 700, textTransform: 'none', color: 'text.secondary' }}
        >
          กลับหน้าแรก
        </Button>

        <Typography
          component="h1"
          sx={{
            fontWeight: 900,
            fontSize: { xs: '1.75rem', md: '2.25rem' },
            letterSpacing: '-0.03em',
            mb: 1,
          }}
        >
          นโยบายความเป็นส่วนตัว
        </Typography>
        <Typography variant="body2" sx={{ color: 'var(--page-text-secondary)', mb: 3 }}>
          อัปเดตล่าสุด: {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
        </Typography>

        <Box
          sx={{
            p: { xs: 2.5, sm: 3.5 },
            borderRadius: '20px',
            bgcolor: 'var(--page-card-solid)',
            border: '1px solid var(--page-border)',
            boxShadow: 'var(--page-shadow)',
          }}
        >
          <Typography variant="body1" sx={{ mb: 3, lineHeight: 1.7, color: 'text.secondary' }}>
            เอกสารนี้อธิบายวิธีที่ระบบ PSU REGISTER เก็บ ใช้ และคุ้มครองข้อมูลส่วนบุคคลของนักศึกษาและผู้ใช้งาน
            เมื่อเข้าใช้งานเว็บไซต์และบริการที่เกี่ยวข้อง
          </Typography>

          <Stack spacing={3} divider={<Divider flexItem />}>
            {sections.map((s) => (
              <Box key={s.title}>
                <Typography variant="h6" fontWeight={800} sx={{ mb: 1, fontSize: '1.05rem' }}>
                  {s.title}
                </Typography>
                <Typography
                  component="div"
                  variant="body2"
                  sx={{
                    lineHeight: 1.75,
                    color: 'text.secondary',
                    '& ul': { pl: 2.5, mt: 1, mb: 0 },
                    '& li': { mb: 0.5 },
                    '& a': { color: 'primary.main' },
                  }}
                >
                  {s.body}
                </Typography>
              </Box>
            ))}
          </Stack>
        </Box>
      </Container>
      <Footer />
    </Box>
  );
}
