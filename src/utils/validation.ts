// utils/validation.ts

/**
 * ตรวจสอบรหัสนักศึกษา
 * ต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 64-69
 */
export const validateStudentId = (studentId: string): boolean => {
  // ตรวจสอบว่าเป็นตัวเลข 10 หลักเท่านั้น
  if (!/^\d{10}$/.test(studentId)) {
    return false;
  }
  
  // ตรวจสอบว่าขึ้นต้นด้วย 64-69
  const prefix = studentId.substring(0, 2);
  const prefixNum = parseInt(prefix, 10);
  
  return prefixNum >= 64 && prefixNum <= 69;
};

/**
 * ตรวจสอบชื่อและนามสกุลภาษาไทย
 * อนุญาตให้ใช้ตัวอักษรไทยและอังกฤษ ต้องมีอย่างน้อย 2 ตัวอักษร
 */
export const validateThaiName = (name: string): boolean => {
  if (!name || typeof name !== 'string') {
    return false;
  }
  
  // อนุญาตให้ใช้ตัวอักษรไทยและอังกฤษ
  const nameRegex = /^[a-zA-Zก-ฮะ-ฺเ-๎\s]+$/;
  return nameRegex.test(name) && name.trim().length >= 2;
};

/**
 * สร้างรหัสสุ่ม
 * สำหรับสร้างรหัสกิจกรรมหรือรหัสแอดมิน
 */
export const generateRandomCode = (length: number = 6): string => {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
};

/**
 * ตรวจสอบรหัสผ่านแอดมิน
 * ต้องมีอย่างน้อย 4 ตัวอักษร
 */
export const validateAdminCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  const trimmedCode = code.trim();
  return trimmedCode.length >= 4;
};

/**
 * ตรวจสอบรหัสกิจกรรม
 * ต้องมีอย่างน้อย 3 ตัวอักษร และประกอบด้วยตัวอักษรและตัวเลขเท่านั้น
 */
export const validateActivityCode = (code: string): boolean => {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  const trimmedCode = code.trim();
  
  // ต้องมีอย่างน้อย 3 ตัวอักษร
  if (trimmedCode.length < 3) {
    return false;
  }
  
  // ประกอบด้วยตัวอักษรอังกฤษและตัวเลขเท่านั้น
  const validCodePattern = /^[a-zA-Z0-9]+$/;
  return validCodePattern.test(trimmedCode);
};

/**
 * ตรวจสอบพิกัดที่ตั้ง
 * ละติจูดต้องอยู่ระหว่าง -90 ถึง 90
 * ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180
 */
export const validateCoordinates = (lat: number, lng: number): boolean => {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !isNaN(lat) &&
    !isNaN(lng)
  );
};

/**
 * ตรวจสอบรัศมี
 * ต้องเป็นตัวเลขบวกและไม่เกิน 10000 เมตร (10 กิโลเมตร)
 */
export const validateRadius = (radius: number): boolean => {
  return (
    typeof radius === 'number' &&
    radius > 0 &&
    radius <= 10000 &&
    !isNaN(radius)
  );
};

/**
 * ฟังก์ชันช่วยในการแสดงข้อความแสดงข้อผิดพลาด
 */
export const getValidationErrorMessage = (field: string, value: any): string => {
  switch (field) {
    case 'studentId':
      if (!value) return 'กรุณากรอกรหัสนักศึกษา';
      if (!validateStudentId(value)) {
        return 'รหัสนักศึกษาต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 64-69';
      }
      return '';
      
    case 'firstName':
    case 'lastName':
      if (!value) return field === 'firstName' ? 'กรุณากรอกชื่อ' : 'กรุณากรอกนามสกุล';
      if (!validateThaiName(value)) {
        return field === 'firstName' 
          ? 'ชื่อต้องมีอย่างน้อย 2 ตัวอักษร'
          : 'นามสกุลต้องมีอย่างน้อย 2 ตัวอักษร';
      }
      return '';
      
    case 'adminCode':
      if (!value) return 'กรุณากรอกรหัสแอดมิน';
      if (!validateAdminCode(value)) {
        return 'รหัสแอดมินต้องมีอย่างน้อย 4 ตัวอักษร';
      }
      return '';
      
    case 'activityCode':
      if (!value) return 'กรุณากรอกรหัสกิจกรรม';
      if (!validateActivityCode(value)) {
        return 'รหัสกิจกรรมต้องมีอย่างน้อย 3 ตัวอักษร และประกอบด้วยตัวอักษรอังกฤษและตัวเลขเท่านั้น';
      }
      return '';
      
    default:
      return 'ข้อมูลไม่ถูกต้อง';
  }
};

/**
 * ตรวจสอบข้อมูลฟอร์มทั้งหมด
 */
export const validateRegistrationForm = (formData: {
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  adminCode: string;
}): { isValid: boolean; errors: Record<string, string> } => {
  const errors: Record<string, string> = {};
  
  // ตรวจสอบรหัสนักศึกษา
  const studentIdError = getValidationErrorMessage('studentId', formData.studentId);
  if (studentIdError) errors.studentId = studentIdError;
  
  // ตรวจสอบชื่อ
  const firstNameError = getValidationErrorMessage('firstName', formData.firstName);
  if (firstNameError) errors.firstName = firstNameError;
  
  // ตรวจสอบนามสกุล
  const lastNameError = getValidationErrorMessage('lastName', formData.lastName);
  if (lastNameError) errors.lastName = lastNameError;
  
  // ตรวจสอบสาขา
  if (!formData.department?.trim()) {
    errors.department = 'กรุณาเลือกสาขา';
  }
  
  // ตรวจสอบรหัสแอดมิน
  const adminCodeError = getValidationErrorMessage('adminCode', formData.adminCode);
  if (adminCodeError) errors.adminCode = adminCodeError;
  
  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
};

/**
 * ฟังก์ชันสำหรับจัดรูปแบบรหัสนักศึกษา
 * เพิ่มขีดกลางเพื่อให้อ่านง่าย เช่น 6412345678 -> 64-1234-5678
 */
export const formatStudentId = (studentId: string): string => {
  if (!studentId || studentId.length !== 10) {
    return studentId;
  }
  
  return `${studentId.substring(0, 2)}-${studentId.substring(2, 6)}-${studentId.substring(6, 10)}`;
};

/**
 * ฟังก์ชันสำหรับลบการจัดรูปแบบออกจากรหัสนักศึกษา
 */
export const unformatStudentId = (formattedStudentId: string): string => {
  return formattedStudentId.replace(/-/g, '');
};