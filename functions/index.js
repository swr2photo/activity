const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const admin = require("firebase-admin");

// 1. เริ่มต้นใช้งาน Admin SDK
admin.initializeApp();

// 2. ตั้งค่า Global Options
// - maxInstances: 10 (จำกัดจำนวนเพื่อคุมงบประมาณ)
// - region: "asia-southeast1" (สำคัญ! ตั้งให้ตรงกับ Database ของคุณที่สิงคโปร์ เพื่อลด Error และทำงานเร็วขึ้น)
setGlobalOptions({ 
    maxInstances: 10,
    region: "asia-southeast1"
});

// 3. ฟังก์ชัน syncAdminRole (Gen 2)
exports.syncAdminRole = onDocumentWritten("adminUsers/{uid}", async (event) => {
    // ดึง UID ของ User จาก Path
    const uid = event.params.uid;

    // ดึงข้อมูลเก่า (Before) และใหม่ (After)
    // event.data.after คือข้อมูลหลังการแก้ไข
    // event.data.before คือข้อมูลก่อนการแก้ไข
    const newData = event.data && event.data.after.exists ? event.data.after.data() : null;
    const oldData = event.data && event.data.before.exists ? event.data.before.data() : null;

    try {
        // กรณีที่ 1: ข้อมูลถูกลบออกจาก adminUsers (User คนนี้ไม่ได้เป็น Admin แล้ว)
        if (!newData) {
            console.log(`Removing admin claim for user ${uid}`);
            // ล้าง Custom Claims ทั้งหมด หรือ set role: null
            await admin.auth().setCustomUserClaims(uid, { role: null });
            return;
        }

        // กรณีที่ 2: มีการสร้างใหม่ หรือแก้ไขข้อมูล
        const newRole = newData.role;
        const oldRole = oldData ? oldData.role : null;
        
        // ตรวจสอบว่า Role มีการเปลี่ยนแปลงจริงไหม (เพื่อประหยัดทรัพยากร)
        // หรือถ้าเป็นการสร้างใหม่ (oldRole เป็น null) ก็จะเข้าเงื่อนไขนี้เช่นกัน
        if (newRole !== oldRole) {
            console.log(`Updating role for user ${uid} to ${newRole}`);
            
            // 🔥 หัวใจสำคัญ: ฝัง Role และ Department ลงไปใน Token ของ User
            await admin.auth().setCustomUserClaims(uid, { 
                role: newRole,
                department: newData.department 
            });
        }
    } catch (error) {
        console.error("Error updating custom claims:", error);
    }
});