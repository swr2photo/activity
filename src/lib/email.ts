// src/lib/email.ts
// ใช้ Google Workspace (Service Account + Domain-Wide Delegation) ส่งอีเมลผ่าน Gmail API
// ต้องตั้งค่า GOOGLE_WORKSPACE_SA_JSON และ GOOGLE_WORKSPACE_SENDER ใน .env (ดูตัวอย่างด้านล่าง)

import { google } from 'googleapis';

// ===== ENV =====
const SA_JSON_RAW =
  process.env.GOOGLE_WORKSPACE_SA_JSON || // แนะนำใช้ตัวนี้
  process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON; // สำรอง: ใช้ตัวเดียวกับ Firebase Admin ได้

const WORKSPACE_SENDER = process.env.GOOGLE_WORKSPACE_SENDER; // เช่น no-reply@psusci.club
const MAIL_FROM_NAME = process.env.MAIL_FROM_NAME || 'Activity Admin'; // ปรับชื่อผู้ส่งได้

if (!SA_JSON_RAW) {
  // โยน error ตอนเรียกใช้งานฟังก์ชันจริง เพื่อไม่ให้แอปร่วงตอน import
  // throw new Error('Missing GOOGLE_WORKSPACE_SA_JSON/FIREBASE_SERVICE_ACCOUNT_KEY_JSON');
}
if (!WORKSPACE_SENDER) {
  // throw new Error('Missing GOOGLE_WORKSPACE_SENDER');
}

// ===== Helpers =====
function parseServiceAccount() {
  if (!SA_JSON_RAW) throw new Error('Service account JSON is missing.');
  const raw = SA_JSON_RAW.trim();
  const jsonStr = raw.startsWith('{')
    ? raw
    : Buffer.from(raw, 'base64').toString('utf8'); // รองรับกรณีเก็บเป็น base64
  const key = JSON.parse(jsonStr);
  if (!key.client_email || !key.private_key) {
    throw new Error('Invalid service account JSON (missing client_email/private_key).');
  }
  return key as { client_email: string; private_key: string };
}

// เข้ารหัสหัวเรื่องตาม RFC 2047
function encodeSubjectRFC2047(subject: string) {
  const b64 = Buffer.from(subject, 'utf8').toString('base64');
  return `=?UTF-8?B?${b64}?=`;
}

let jwtClient: InstanceType<typeof google.auth.JWT> | null = null;
function getJwtClient() {
  if (!jwtClient) {
    const sa = parseServiceAccount();
    jwtClient = new google.auth.JWT({
      email: sa.client_email,
      key: sa.private_key,
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      subject: WORKSPACE_SENDER, // impersonate ผู้ส่งในโดเมน (ต้องเปิด DWD)
    });
  }
  return jwtClient;
}

export type SendMailInput = {
  to: string;
  subject: string;
  html: string;
  text?: string;
  cc?: string;
  bcc?: string;
  replyTo?: string;
};

export async function sendMail({ to, subject, html, text, cc, bcc, replyTo }: SendMailInput) {
  if (!WORKSPACE_SENDER) throw new Error('GOOGLE_WORKSPACE_SENDER is not set');
  const auth = getJwtClient();

  // ขอ access token ด้วย Domain-Wide Delegation
  await auth.authorize().catch((e) => {
    throw new Error(`Workspace JWT authorize failed: ${e?.message || e}`);
  });

  const gmail = google.gmail({ version: 'v1', auth });

  // สร้าง MIME (simple HTML; ถ้าต้อง multipart/alternative ก็ประกอบเพิ่มได้)
  const lines: string[] = [
    `From: "${MAIL_FROM_NAME.replace(/"/g, '\\"')}" <${WORKSPACE_SENDER}>`,
    `To: ${to}`,
    ...(cc ? [`Cc: ${cc}`] : []),
    ...(bcc ? [`Bcc: ${bcc}`] : []),
    ...(replyTo ? [`Reply-To: ${replyTo}`] : []),
    `Subject: ${encodeSubjectRFC2047(subject)}`,
    'MIME-Version: 1.0',
    'Content-Type: text/html; charset="UTF-8"',
    '',
    html,
  ];

  // base64url ตามข้อกำหนดของ Gmail API
  const raw = Buffer.from(lines.join('\r\n'), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');

  await gmail.users.messages.send({
    userId: 'me', // เมื่อใช้ subject impersonation, 'me' = WORKSPACE_SENDER
    requestBody: { raw },
  });
}
