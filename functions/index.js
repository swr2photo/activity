const { onDocumentWritten } = require("firebase-functions/v2/firestore");
const { setGlobalOptions } = require("firebase-functions/v2/options");
const admin = require("firebase-admin");

admin.initializeApp();

setGlobalOptions({
  maxInstances: 10,
  region: "asia-southeast1",
});

// syncAdminRole: ฝัง role, department และ isActive ลง Custom Claims ทุกครั้งที่มีการเปลี่ยนแปลง
exports.syncAdminRole = onDocumentWritten("adminUsers/{uid}", async (event) => {
  const uid = event.params.uid;
  const newData = event.data && event.data.after.exists ? event.data.after.data() : null;
  const oldData = event.data && event.data.before.exists ? event.data.before.data() : null;

  try {
    // ถูกลบหรือถูกระงับสิทธิ์ -> ล้าง Custom Claims ทันที
    if (!newData || newData.isActive === false) {
      console.log(`Clearing admin claims for user ${uid}`);
      await admin.auth().setCustomUserClaims(uid, {
        role: null,
        department: null,
        isActive: false,
      });
      return;
    }

    const newRole = newData.role || null;
    const newDept = newData.department || null;
    const newActive = newData.isActive === true;

    const oldRole = oldData ? (oldData.role || null) : null;
    const oldDept = oldData ? (oldData.department || null) : null;
    const oldActive = oldData ? (oldData.isActive === true) : null;

    if (newRole !== oldRole || newDept !== oldDept || newActive !== oldActive) {
      console.log(`Updating admin claims for user ${uid}: role=${newRole}, dept=${newDept}, active=${newActive}`);
      await admin.auth().setCustomUserClaims(uid, {
        role: newRole,
        department: newDept,
        isActive: newActive,
      });
    }
  } catch (error) {
    console.error("Error updating custom claims:", error);
  }
});
