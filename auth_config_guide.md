# คู่มือการตั้งค่า Google OAuth ใน Google Cloud Console

เนื่องจากการประกาศปิดตัวของ **Firebase Dynamic Links** ส่งผลกระทบต่อระบบ Authentication (เช่น Google Sign-In, Email Link) ในแอปพลิเคชัน ดังนั้นเพื่อให้ระบบล็อกอินผ่าน Google ของผู้ดูแลระบบ (Admin) ทำงานได้ปกติโดยไม่หยุดชะงัก คุณต้องตั้งค่าผ่าน **Google Cloud Console** แทน Firebase Console ตามขั้นตอนดังต่อไปนี้:

---

## 1. ข้อมูลโครงการปัจจุบัน (จากไฟล์ `.env.local`)
* **Project ID**: `webapp-78231`
* **Custom Auth Domain**: `sci-login.psusci.club`
* **Base URL**: `https://psuscc-activity.psusci.club`

---

## 2. ขั้นตอนการตั้งค่าใน Google Cloud Console

1. เข้าสู่ระบบที่ [Google Cloud Console](https://console.cloud.google.com/)
2. ที่แถบเมนูด้านบน ให้เลือกโปรเจกต์ของคุณเป็น **`webapp-78231`**
3. ไปที่เมนู **APIs & Services** (API และบริการ) > **Credentials** (ใบรับรอง) จากเมนูด้านซ้าย
4. ภายใต้หัวข้อ **OAuth 2.0 Client IDs** ให้คลิกเลือก Client ID ของเว็บแอปพลิเคชันของคุณ (โดยทั่วไปจะมีชื่อเริ่มต้นเป็น `Web client (auto-created by Google Service)`)
5. ทำการอัปเดตการตั้งค่าในหัวข้อดังนี้:

### 2.1 Authorized JavaScript origins (ต้นกำเนิด JavaScript ที่ได้รับอนุญาต)
เพิ่มโดเมนต้นทางของแอปพลิเคชันของคุณ เพื่ออนุญาตให้สคริปต์ส่งคำขอล็อกอินได้:
* `http://localhost:3000` (สำหรับรันทดสอบในเครื่อง)
* `https://sci-login.psusci.club` (Custom Auth Domain)
* `https://psuscc-activity.psusci.club` (โดเมนหลักของระบบกิจกรรม)

### 2.2 Authorized redirect URIs (URI การเปลี่ยนเส้นทางที่ได้รับอนุญาต)
เพิ่มตำแหน่งที่ระบบจะส่ง Token กลับมาหลังจากผู้ใช้ลงชื่อเข้าใช้สำเร็จผ่าน Google:
* `https://sci-login.psusci.club/__/auth/handler` (สำคัญมาก: สำหรับการใช้ Custom Domain ในการล็อกอินแอดมิน)
* `https://webapp-78231.firebaseapp.com/__/auth/handler` (โดเมนสำรองของ Firebase)

6. กดปุ่ม **Save** (บันทึก) ด้านล่างสุด

---

## 3. ขั้นตอนการตั้งค่าเพิ่มเติมใน Firebase Console (สำหรับ Authorized Domains)

เพื่อให้การทำงานร่วมกันเสร็จสมบูรณ์ ให้ตรวจสอบ Authorized Domains ใน Firebase:
1. ไปที่ [Firebase Console](https://console.firebase.google.com/)
2. เลือกโปรเจกต์ของคุณ จากนั้นไปที่เมนู **Authentication** > แท็บ **Settings** > เลือก **Authorized domains**
3. ตรวจสอบให้แน่ใจว่าได้ทำการเพิ่มโดเมน **`sci-login.psusci.club`** เข้าไปในรายการแล้ว
