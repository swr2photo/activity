'use client';
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  TextField,
  Button,
  Typography,
  Grid,
  Alert,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  SelectChangeEvent,
  Paper,
  Fade,
  Grow,
  Slide
} from '@mui/material';
import {
  Block as BlockIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  Refresh as RefreshIcon,
  Person as PersonIcon,
  LocationOn as LocationIcon,
  AccessTime as AccessTimeIcon,
  School as SchoolIcon,
  Badge as BadgeIcon
} from '@mui/icons-material';
import { collection, addDoc, serverTimestamp, query, where, getDocs, doc, setDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import LocationChecker from './LocationChecker';
import { ActivityRecord, AdminSettings } from '../types';
import { validateStudentId, validateThaiName } from '../utils/validation';

interface Department {
  id: string;
  name: string;
  isActive: boolean;
}

interface ActivityStatus {
  exists: boolean;
  isActive: boolean;
  activityCode: string;
  description?: string;
  userCode?: string; // เปลี่ยนจาก recommendationCode เป็น userCode
}

interface ActivityRegistrationFormProps {
  activityCode: string;
  adminSettings: AdminSettings;
}

const ActivityRegistrationForm: React.FC<ActivityRegistrationFormProps> = ({
  activityCode,
  adminSettings
}) => {
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [departmentsLoading, setDepartmentsLoading] = useState(true);
  const [activityStatusLoading, setActivityStatusLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [activityStatus, setActivityStatus] = useState<ActivityStatus>({
    exists: false,
    isActive: false,
    activityCode: '',
    userCode: ''
  });

  // เพิ่ม state สำหรับควบคุมการบังคับโหลดหน้าใหม่
  const [forceRefreshEnabled, setForceRefreshEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeListener, setRealtimeListener] = useState<(() => void) | null>(null);

  const [formData, setFormData] = useState({
    studentId: '',
    firstName: '',
    lastName: '',
    department: '',
    userCode: '' // เปลี่ยนจาก recommendationCode เป็น userCode
  });

  const steps = ['กรอกข้อมูล', 'ตรวจสอบตำแหน่ง', 'บันทึกสำเร็จ'];

  // ข้อมูลสาขาเริ่มต้น
  const defaultDepartments = [
    'วิศวกรรมศาสตร์',
    'วิทยาศาสตร์',
    'เทคโนโลยีสารสนเทศ',
    'บริหารธุรกิจ',
    'ศิลปศาสตร์',
    'ครุศาสตร์',
    'แพทยศาสตร์',
    'พยาบาลศาสตร์',
    'เภสัชศาสตร์',
    'ทันตแพทยศาสตร์',
    'วิศวกรรมคอมพิวเตอร์',
    'นิเทศศาสตร์',
    'นิติศาสตร์',
    'เศรษฐศาสตร์',
    'การจัดการ'
  ];

  // ฟังก์ชันสำหรับบังคับโหลดหน้าใหม่
  const handleForceRefresh = () => {
    console.log('🔄 Initiating force refresh...');
    setIsRefreshing(true);
    
    // ปิด real-time listener ก่อนโหลดหน้าใหม่
    if (realtimeListener) {
      realtimeListener();
      setRealtimeListener(null);
    }
    
    // รอสักครู่เพื่อแสดง loading state
    setTimeout(() => {
      window.location.reload();
    }, 1500);
  };

  // ตรวจสอบสถานะกิจกรรมจาก Firebase และตั้ง real-time listener
  const checkActivityStatus = async () => {
    try {
      setActivityStatusLoading(true);
      console.log('Checking activity status for:', activityCode);
      
      const q = query(
        collection(db, 'activityQRCodes'),
        where('activityCode', '==', activityCode)
      );
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        console.log('Activity not found in database');
        setActivityStatus({
          exists: false,
          isActive: false,
          activityCode: activityCode,
          userCode: ''
        });
      } else {
        const activityDoc = querySnapshot.docs[0];
        const data = activityDoc.data();
        console.log('Activity found:', data);
        
        setActivityStatus({
          exists: true,
          isActive: data.isActive !== undefined ? data.isActive : true,
          activityCode: data.activityCode,
          description: data.description || '',
          userCode: data.userCode || '' // เปลี่ยนจาก recommendationCode เป็น userCode
        });

        // ตั้งค่าเริ่มต้นของการบังคับโหลดหน้าใหม่
        setForceRefreshEnabled(data.forceRefresh === true);

        // ตั้ง real-time listener สำหรับการเปลี่ยนแปลงสถานะ
        const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityDoc.id), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const updatedData = docSnapshot.data();
            console.log('Activity status updated in real-time:', updatedData);
            
            // อัพเดทสถานะกิจกรรม
            setActivityStatus(prev => ({
              ...prev,
              isActive: updatedData.isActive !== undefined ? updatedData.isActive : true,
              description: updatedData.description || '',
              userCode: updatedData.userCode || '' // เปลี่ยนจาก recommendationCode เป็น userCode
            }));

            // ตรวจสอบการเปลี่ยนแปลงของ forceRefresh
            const newForceRefresh = updatedData.forceRefresh === true;
            
            if (newForceRefresh && !forceRefreshEnabled) {
              console.log('🔄 Force refresh enabled from server - initiating refresh...');
              setForceRefreshEnabled(true);
              
              // แสดงการแจ้งเตือนและบังคับโหลดหน้าใหม่ทันที
              setTimeout(() => {
                handleForceRefresh();
              }, 2000); // รอ 2 วินาทีเพื่อให้ผู้ใช้เห็นข้อความ
              
            } else if (!newForceRefresh && forceRefreshEnabled) {
              console.log('✅ Force refresh disabled from server');
              setForceRefreshEnabled(false);
            }
          }
        }, (error) => {
          console.error('Real-time listener error:', error);
        });

        // เก็บ unsubscribe function
        setRealtimeListener(() => unsubscribe);
      }
    } catch (error) {
      console.error('Error checking activity status:', error);
      setError('ไม่สามารถตรวจสอบสถานะกิจกรรมได้');
      setActivityStatus({
        exists: false,
        isActive: false,
        activityCode: activityCode,
        userCode: ''
      });
    } finally {
      setActivityStatusLoading(false);
    }
  };

  // สร้างข้อมูลสาขาเริ่มต้นในฐานข้อมูล
  const initializeDepartments = async () => {
    try {
      console.log('Initializing departments in database...');
      
      for (const deptName of defaultDepartments) {
        const deptDoc = doc(db, 'departments', deptName.replace(/\s+/g, '_'));
        await setDoc(deptDoc, {
          name: deptName,
          isActive: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        }, { merge: true });
      }
      
      console.log('✅ Departments initialized successfully');
    } catch (error) {
      console.error('Error initializing departments:', error);
    }
  };

  // ดึงข้อมูลสาขาจาก Firebase และสร้างหากยังไม่มี
  const fetchDepartments = async () => {
    try {
      setDepartmentsLoading(true);
      const departmentsQuery = query(
        collection(db, 'departments'),
        where('isActive', '==', true)
      );
      const querySnapshot = await getDocs(departmentsQuery);
      
      let departmentsList: Department[] = [];
      querySnapshot.forEach((doc) => {
        departmentsList.push({
          id: doc.id,
          ...doc.data()
        } as Department);
      });

      // หากไม่มีข้อมูลสาขาในฐานข้อมูล ให้สร้างข้อมูลเริ่มต้น
      if (departmentsList.length === 0) {
        console.log('No departments found, initializing default departments...');
        await initializeDepartments();
        
        // ดึงข้อมูลใหม่หลังจากสร้างเสร็จ
        const newQuerySnapshot = await getDocs(departmentsQuery);
        departmentsList = [];
        newQuerySnapshot.forEach((doc) => {
          departmentsList.push({
            id: doc.id,
            ...doc.data()
          } as Department);
        });
      }

      // เรียงลำดับตามชื่อ
      departmentsList.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setDepartments(departmentsList);
      
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง');
      
      // Fallback: ใช้ข้อมูลสาขาเดิมหากไม่สามารถดึงจาก Firebase ได้
      const fallbackDepartments = defaultDepartments.map((name, index) => ({
        id: `fallback-${index}`,
        name,
        isActive: true
      }));
      
      setDepartments(fallbackDepartments);
    } finally {
      setDepartmentsLoading(false);
    }
  };

  // โหลดข้อมูลเมื่อ component mount และ cleanup เมื่อ unmount
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        checkActivityStatus(),
        fetchDepartments()
      ]);
    };
    
    loadInitialData();

    // Cleanup function เพื่อหยุด real-time listener
    return () => {
      if (realtimeListener) {
        console.log('🔌 Cleaning up real-time listener');
        realtimeListener();
      }
    };
  }, [activityCode]);

  // useEffect แยกสำหรับติดตาม realtimeListener changes
  useEffect(() => {
    return () => {
      if (realtimeListener) {
        realtimeListener();
      }
    };
  }, [realtimeListener]);

  const handleInputChange = (field: string) => (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    // ถ้าเปิดบังคับโหลดหน้าใหม่ ห้ามแก้ไขข้อมูล
    if (forceRefreshEnabled) {
      return;
    }

    setFormData({
      ...formData,
      [field]: event.target.value
    });
    setError('');
  };

  const handleSelectChange = (field: string) => (
    event: SelectChangeEvent<string>
  ) => {
    // ถ้าเปิดบังคับโหลดหน้าใหม่ ห้ามแก้ไขข้อมูล
    if (forceRefreshEnabled) {
      return;
    }

    setFormData({
      ...formData,
      [field]: event.target.value
    });
    setError('');
  };

  // ฟังก์ชันตรวจสอบรหัสนักศึกษาใหม่
  const validateNewStudentId = (studentId: string): boolean => {
    // ต้องเป็นตัวเลข 10 หลักเท่านั้น
    if (!/^\d{10}$/.test(studentId)) {
      return false;
    }
    
    // ต้องขึ้นต้นด้วย 64-69
    const prefix = studentId.substring(0, 2);
    const prefixNum = parseInt(prefix);
    return prefixNum >= 64 && prefixNum <= 69;
  };

  const validateForm = async (): Promise<boolean> => {
    // ถ้าเปิดบังคับโหลดหน้าใหม่ ห้ามบันทึก
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      return false;
    }

    if (!validateNewStudentId(formData.studentId)) {
      setError('รหัสนักศึกษาไม่ถูกต้อง (ต้องเป็นตัวเลข 10 หลัก และขึ้นต้นด้วย 64-69)');
      return false;
    }
    
    if (!validateThaiName(formData.firstName)) {
      setError('ชื่อไม่ถูกต้อง (ต้องมีอย่างน้อย 2 ตัวอักษร)');
      return false;
    }
    
    if (!validateThaiName(formData.lastName)) {
      setError('นามสกุลไม่ถูกต้อง (ต้องมีอย่างน้อย 2 ตัวอักษร)');
      return false;
    }
    
    if (!formData.department) {
      setError('กรุณาเลือกสาขา');
      return false;
    }
    
    // ตรวจสอบรหัสผู้ใช้แทนรหัสแนะนำ
    if (!formData.userCode) {
      setError('กรุณาใส่รหัสผู้ใช้');
      return false;
    }

    // เปรียบเทียบกับรหัสผู้ใช้ของกิจกรรม
    if (formData.userCode !== activityStatus.userCode) {
      setError('รหัสผู้ใช้ไม่ถูกต้อง กรุณาตรวจสอบอีกครั้ง');
      return false;
    }

    // ตรวจสอบการลงทะเบียนซ้ำ
    try {
      const q = query(
        collection(db, 'activityRecords'),
        where('studentId', '==', formData.studentId),
        where('activityCode', '==', activityCode)
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        setError('คุณได้ลงทะเบียนกิจกรรมนี้แล้ว');
        return false;
      }
    } catch (error) {
      console.error('Error checking duplicate:', error);
    }

    return true;
  };

  const handleSubmit = async () => {
    // ถ้าเปิดบังคับโหลดหน้าใหม่ ห้ามส่งฟอร์ม
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      return;
    }

    if (!(await validateForm())) return;
    
    setLoading(true);
    setActiveStep(1);
  };

  const handleLocationVerified = async (location: {
    latitude: number;
    longitude: number;
  }) => {
    // ตรวจสอบอีกครั้งก่อนบันทึกจริง
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      setLoading(false);
      setActiveStep(0);
      return;
    }

    try {
      // สร้าง object โดยไม่ระบุ type เพื่อหลีกเลี่ยง type error
      const activityRecord = {
        studentId: formData.studentId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department,
        activityCode,
        location,
        userCode: formData.userCode // เก็บรหัสผู้ใช้แทนรหัสแนะนำ
      };

      await addDoc(collection(db, 'activityRecords'), {
        ...activityRecord,
        timestamp: serverTimestamp()
      });

      setActiveStep(2);
      setSuccess(true);
      setLoading(false);
    } catch (error) {
      console.error('Error saving record:', error);
      setError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
      setLoading(false);
      setActiveStep(0);
    }
  };

  const handleLocationError = (errorMessage: string) => {
    setError(errorMessage);
    setLoading(false);
    setActiveStep(0);
  };

  // แสดง Loading เมื่อกำลังโหลดหน้าใหม่
  if (isRefreshing) {
    return (
      <Fade in={true}>
        <Card elevation={8} sx={{ borderRadius: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RefreshIcon 
              sx={{ 
                fontSize: 80, 
                color: 'primary.main', 
                mb: 3, 
                animation: 'spin 1s linear infinite',
                '@keyframes spin': {
                  '0%': {
                    transform: 'rotate(0deg)',
                  },
                  '100%': {
                    transform: 'rotate(360deg)',
                  },
                }
              }} 
            />
            <Typography variant="h4" sx={{ mt: 2, fontWeight: 600, color: 'primary.main' }}>
              กำลังโหลดหน้าใหม่...
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              กรุณารอสักครู่
            </Typography>
          </CardContent>
        </Card>
      </Fade>
    );
  }

  // แสดง Loading เมื่อกำลังตรวจสอบสถานะกิจกรรม
  if (activityStatusLoading) {
    return (
      <Fade in={true}>
        <Card elevation={8} sx={{ borderRadius: 4 }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <CircularProgress size={80} thickness={4} sx={{ mb: 3 }} />
            <Typography variant="h4" sx={{ mt: 2, fontWeight: 600 }}>
              กำลังตรวจสอบสถานะกิจกรรม...
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
              รหัสกิจกรรม: <strong>{activityCode}</strong>
            </Typography>
          </CardContent>
        </Card>
      </Fade>
    );
  }

  // แสดงหน้าบังคับโหลดใหม่
  if (forceRefreshEnabled) {
    return (
      <Slide direction="up" in={true}>
        <Card elevation={12} sx={{ borderRadius: 4, border: '2px solid', borderColor: 'warning.main' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <RefreshIcon sx={{ fontSize: 100, color: 'warning.main', mb: 3 }} />
            <Typography variant="h3" color="warning.main" gutterBottom fontWeight="bold">
              {isRefreshing ? 'กำลังโหลดหน้าใหม่...' : 'จำเป็นต้องโหลดหน้าใหม่'}
            </Typography>
            <Typography variant="h6" paragraph color="text.secondary">
              {isRefreshing 
                ? 'กรุณารอสักครู่ ระบบกำลังโหลดหน้าใหม่...'
                : 'แอดมินได้เปิดใช้งานการบังคับโหลดหน้าใหม่แบบ Real-time'
              }
            </Typography>
            
            {!isRefreshing && (
              <>
                <Paper sx={{ 
                  p: 4, 
                  bgcolor: 'warning.50', 
                  border: '2px solid', 
                  borderColor: 'warning.200', 
                  mb: 4,
                  borderRadius: 3
                }}>
                  <Typography variant="h6" color="warning.main" sx={{ mb: 2, fontWeight: 600 }}>
                    🔄 ระบบได้รับสัญญาณจาก Server แล้ว
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                    • การดำเนินการทั้งหมดถูกปิดใช้งาน
                  </Typography>
                  <Typography variant="body1" color="text.secondary" sx={{ mb: 1 }}>
                    • ไม่สามารถกรอกข้อมูลหรือบันทึกได้
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    • กำลังโหลดหน้าใหม่อัตโนมัติใน 2 วินาที...
                  </Typography>
                </Paper>
                
                <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
                  <Button
                    variant="contained"
                    size="large"
                    onClick={handleForceRefresh}
                    disabled={isRefreshing}
                    startIcon={<RefreshIcon />}
                    sx={{ px: 4, py: 1.5, borderRadius: 3 }}
                  >
                    โหลดหน้าใหม่ทันที
                  </Button>
                  
                  <Button
                    variant="outlined"
                    size="large"
                    onClick={() => window.close()}
                    sx={{ px: 4, py: 1.5, borderRadius: 3 }}
                  >
                    ปิดหน้าต่าง
                  </Button>
                </Box>
              </>
            )}

            {isRefreshing && (
              <Box sx={{ mt: 4 }}>
                <CircularProgress size={60} thickness={4} />
                <Typography variant="body1" color="text.secondary" sx={{ mt: 3 }}>
                  กำลังเชื่อมต่อกับเซิร์ฟเวอร์...
                </Typography>
              </Box>
            )}
          </CardContent>
        </Card>
      </Slide>
    );
  }

  // แสดงข้อความเมื่อกิจกรรมไม่มีอยู่ในระบบ
  if (!activityStatus.exists) {
    return (
      <Grow in={true}>
        <Card elevation={8} sx={{ borderRadius: 4, border: '2px solid', borderColor: 'error.main' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ErrorIcon sx={{ fontSize: 100, color: 'error.main', mb: 3 }} />
            <Typography variant="h3" color="error.main" gutterBottom fontWeight="bold">
              ไม่พบกิจกรรมนี้
            </Typography>
            <Typography variant="h6" paragraph color="text.secondary">
              ไม่พบกิจกรรมที่มีรหัส "<strong>{activityCode}</strong>" ในระบบ
            </Typography>
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'grey.100', 
              mb: 4,
              borderRadius: 3
            }}>
              <Typography variant="body1" color="text.secondary">
                กรุณาตรวจสอบรหัสกิจกรรมหรือติดต่อเจ้าหน้าที่
              </Typography>
            </Paper>
            <Button
              variant="outlined"
              size="large"
              onClick={() => window.close()}
              sx={{ px: 4, py: 1.5, borderRadius: 3 }}
            >
              ปิดหน้าต่าง
            </Button>
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงข้อความเมื่อกิจกรรมปิดการลงทะเบียน
  if (!activityStatus.isActive) {
    return (
      <Grow in={true}>
        <Card elevation={8} sx={{ borderRadius: 4, border: '2px solid', borderColor: 'warning.main' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <BlockIcon sx={{ fontSize: 100, color: 'warning.main', mb: 3 }} />
            <Typography variant="h3" color="warning.main" gutterBottom fontWeight="bold">
              กิจกรรมปิดการลงทะเบียนแล้ว
            </Typography>
            <Typography variant="h6" paragraph color="text.secondary">
              กิจกรรม "<strong>{activityStatus.activityCode}</strong>" ได้ปิดการลงทะเบียนแล้ว
            </Typography>
            {activityStatus.description && (
              <Paper sx={{ 
                p: 3, 
                bgcolor: 'grey.100', 
                mb: 4,
                borderRadius: 3
              }}>
                <Typography variant="body1" color="text.secondary">
                  {activityStatus.description}
                </Typography>
              </Paper>
            )}
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'warning.50', 
              border: '2px solid', 
              borderColor: 'warning.200', 
              mb: 4,
              borderRadius: 3
            }}>
              <Typography variant="body1" color="warning.main" fontWeight="600">
                ⚠️ หากคุณคิดว่านี่เป็นข้อผิดพลาด กรุณาติดต่อเจ้าหน้าที่
              </Typography>
            </Paper>
            <Button
              variant="outlined"
              size="large"
              onClick={() => window.close()}
              sx={{ px: 4, py: 1.5, borderRadius: 3 }}
            >
              ปิดหน้าต่าง
            </Button>
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงข้อความเมื่อไม่มีรหัสผู้ใช้ในกิจกรรม
  if (!activityStatus.userCode) {
    return (
      <Grow in={true}>
        <Card elevation={8} sx={{ borderRadius: 4, border: '2px solid', borderColor: 'warning.main' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <PersonIcon sx={{ fontSize: 100, color: 'warning.main', mb: 3 }} />
            <Typography variant="h3" color="warning.main" gutterBottom fontWeight="bold">
              ไม่มีรหัสผู้ใช้
            </Typography>
            <Typography variant="h6" paragraph color="text.secondary">
              กิจกรรม "<strong>{activityStatus.activityCode}</strong>" ยังไม่ได้ตั้งค่ารหัสผู้ใช้
            </Typography>
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'warning.50', 
              border: '2px solid', 
              borderColor: 'warning.200', 
              mb: 4,
              borderRadius: 3
            }}>
              <Typography variant="body1" color="warning.main" fontWeight="600">
                ⚠️ กรุณาติดต่อเจ้าหน้าที่เพื่อตั้งค่ารหัสผู้ใช้สำหรับกิจกรรมนี้
              </Typography>
            </Paper>
            <Button
              variant="outlined"
              size="large"
              onClick={() => window.close()}
              sx={{ px: 4, py: 1.5, borderRadius: 3 }}
            >
              ปิดหน้าต่าง
            </Button>
          </CardContent>
        </Card>
      </Grow>
    );
  }

  // แสดงหน้าสำเร็จ
  if (success) {
    return (
      <Fade in={true}>
        <Card elevation={12} sx={{ borderRadius: 4, border: '3px solid', borderColor: 'success.main' }}>
          <CardContent sx={{ textAlign: 'center', py: 6 }}>
            <CheckCircleIcon sx={{ fontSize: 120, color: 'success.main', mb: 3 }} />
            <Typography variant="h3" color="success.main" gutterBottom fontWeight="bold">
              บันทึกสำเร็จ!
            </Typography>
            <Typography variant="h6" paragraph color="text.secondary">
              ข้อมูลการเข้าร่วมกิจกรรมของคุณได้รับการบันทึกเรียบร้อยแล้ว
            </Typography>
            <Paper sx={{ 
              p: 4, 
              bgcolor: 'success.50', 
              border: '2px solid', 
              borderColor: 'success.200', 
              mb: 4,
              borderRadius: 3
            }}>
              <Grid container spacing={2} sx={{ textAlign: 'left' }}>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BadgeIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">รหัสกิจกรรม</Typography>
                      <Typography variant="body1" fontWeight="600">{activityCode}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <PersonIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">ชื่อ-นามสกุล</Typography>
                      <Typography variant="body1" fontWeight="600">{formData.firstName} {formData.lastName}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <BadgeIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">รหัสนักศึกษา</Typography>
                      <Typography variant="body1" fontWeight="600">{formData.studentId}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <SchoolIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">สาขา</Typography>
                      <Typography variant="body1" fontWeight="600">{formData.department}</Typography>
                    </Box>
                  </Box>
                </Grid>
                <Grid item xs={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center' }}>
                    <AccessTimeIcon sx={{ mr: 2, color: 'success.main' }} />
                    <Box>
                      <Typography variant="caption" color="text.secondary">เวลาที่บันทึก</Typography>
                      <Typography variant="body1" fontWeight="600">{new Date().toLocaleString('th-TH')}</Typography>
                    </Box>
                  </Box>
                </Grid>
              </Grid>
            </Paper>
            
            <Box sx={{ display: 'flex', justifyContent: 'center', gap: 2 }}>
              <Button
                variant="contained"
                size="large"
                onClick={() => window.close()}
                sx={{ px: 4, py: 1.5, borderRadius: 3 }}
              >
                ปิดหน้าต่าง
              </Button>
              <Button
                variant="outlined"
                size="large"
                onClick={() => {
                  setSuccess(false);
                  setActiveStep(0);
                  setFormData({
                    studentId: '',
                    firstName: '',
                    lastName: '',
                    department: '',
                    userCode: ''
                  });
                }}
                sx={{ px: 4, py: 1.5, borderRadius: 3 }}
              >
                ลงทะเบียนคนอื่น
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Fade>
    );
  }

  // แสดงฟอร์มลงทะเบียน (เมื่อกิจกรรมเปิดใช้งาน)
  return (
    <Fade in={true}>
      <Card elevation={8} sx={{ borderRadius: 4 }}>
        <CardContent sx={{ p: 4 }}>
          <Box sx={{ textAlign: 'center', mb: 4 }}>
            <Typography variant="h3" gutterBottom fontWeight="bold" color="primary.main">
              ลงทะเบียนกิจกรรม
            </Typography>
            
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'success.50', 
              border: '2px solid', 
              borderColor: 'success.200', 
              mb: 3,
              borderRadius: 3
            }}>
              <Typography variant="h5" color="success.main" fontWeight="600">
                ✅ รหัสกิจกรรม: {activityStatus.activityCode}
              </Typography>
              {activityStatus.description && (
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2 }}>
                  {activityStatus.description}
                </Typography>
              )}
            </Paper>

            {/* แสดงข้อมูลรหัสผู้ใช้ */}
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'primary.50', 
              border: '2px solid', 
              borderColor: 'primary.200', 
              mb: 3,
              borderRadius: 3
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 2 }}>
                <PersonIcon color="primary" sx={{ fontSize: 32 }} />
                <Box>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">
                    รหัสผู้ใช้สำหรับกิจกรรมนี้
                  </Typography>
                  <Typography variant="h4" color="primary.main" fontWeight="800">
                    {activityStatus.userCode}
                  </Typography>
                </Box>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                กรุณาใช้รหัสนี้ในช่อง "รหัสผู้ใช้" ด้านล่าง
              </Typography>
            </Paper>
          </Box>

          <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
            {steps.map((label, index) => (
              <Step key={label}>
                <StepLabel 
                  sx={{
                    '& .MuiStepLabel-label': {
                      fontSize: '1.1rem',
                      fontWeight: activeStep === index ? 600 : 400
                    }
                  }}
                >
                  {label}
                </StepLabel>
              </Step>
            ))}
          </Stepper>

          {error && (
            <Slide direction="down" in={!!error}>
              <Alert 
                severity="error" 
                sx={{ 
                  mb: 3,
                  borderRadius: 2,
                  fontSize: '1rem'
                }}
                action={
                  forceRefreshEnabled && (
                    <Button
                      color="inherit"
                      size="small"
                      onClick={handleForceRefresh}
                      startIcon={<RefreshIcon />}
                    >
                      โหลดใหม่
                    </Button>
                  )
                }
              >
                {error}
                {forceRefreshEnabled && (
                  <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                    🔄 ระบบได้รับคำสั่งโหลดใหม่จาก Server แล้ว
                  </Typography>
                )}
              </Alert>
            </Slide>
          )}

          {activeStep === 0 && (
            <Grow in={true}>
              <Grid container spacing={3}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="รหัสนักศึกษา"
                    value={formData.studentId}
                    onChange={handleInputChange('studentId')}
                    required
                    placeholder="เช่น 6412345678"
                    helperText="รหัสนักศึกษา 10 หลัก ขึ้นต้นด้วย 64-69"
                    disabled={forceRefreshEnabled}
                    inputProps={{
                      maxLength: 10,
                      pattern: '[0-9]*'
                    }}
                    InputProps={{
                      startAdornment: <BadgeIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&.Mui-focused fieldset': {
                          borderWidth: 2
                        }
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="ชื่อ"
                    value={formData.firstName}
                    onChange={handleInputChange('firstName')}
                    required
                    placeholder="ชื่อจริง"
                    disabled={forceRefreshEnabled}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&.Mui-focused fieldset': {
                          borderWidth: 2
                        }
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="นามสกุล"
                    value={formData.lastName}
                    onChange={handleInputChange('lastName')}
                    required
                    placeholder="นามสกุลจริง"
                    disabled={forceRefreshEnabled}
                    InputProps={{
                      startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&.Mui-focused fieldset': {
                          borderWidth: 2
                        }
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth required disabled={departmentsLoading || forceRefreshEnabled}>
                    <InputLabel>สาขา</InputLabel>
                    <Select
                      value={formData.department}
                      label="สาขา"
                      onChange={handleSelectChange('department')}
                      sx={{
                        borderRadius: 2,
                        '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                          borderWidth: 2
                        }
                      }}
                    >
                      {departmentsLoading ? (
                        <MenuItem disabled>
                          <CircularProgress size={20} sx={{ mr: 2 }} />
                          กำลังโหลดข้อมูลสาขา...
                        </MenuItem>
                      ) : (
                        departments.map((dept) => (
                          <MenuItem key={dept.id} value={dept.name}>
                            <Box sx={{ display: 'flex', alignItems: 'center' }}>
                              <SchoolIcon sx={{ mr: 2, color: 'action.active' }} />
                              {dept.name}
                            </Box>
                          </MenuItem>
                        ))
                      )}
                    </Select>
                    {departmentsLoading && (
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        กำลังโหลดรายการสาขาจากฐานข้อมูล...
                      </Typography>
                    )}
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="รหัสผู้ใช้"
                    value={formData.userCode}
                    onChange={handleInputChange('userCode')}
                    required
                    helperText={`กรุณาใส่รหัสผู้ใช้ที่แสดงด้านบน: ${activityStatus.userCode}`}
                    placeholder="ใส่รหัสผู้ใช้ที่ได้รับ"
                    disabled={forceRefreshEnabled}
                    InputProps={{
                      startAdornment: (
                        <PersonIcon sx={{ mr: 1, color: 'primary.main' }} />
                      )
                    }}
                    sx={{
                      '& .MuiOutlinedInput-root': {
                        borderRadius: 2,
                        '&.Mui-focused fieldset': {
                          borderColor: 'primary.main',
                          borderWidth: 2
                        }
                      }
                    }}
                  />
                </Grid>
                <Grid item xs={12}>
                  <Button
                    fullWidth
                    variant="contained"
                    size="large"
                    onClick={handleSubmit}
                    disabled={loading || departmentsLoading || forceRefreshEnabled}
                    sx={{ 
                      py: 2,
                      borderRadius: 3,
                      fontSize: '1.1rem',
                      fontWeight: 600,
                      boxShadow: 3,
                      '&:hover': {
                        boxShadow: 6
                      }
                    }}
                    startIcon={<LocationIcon />}
                  >
                    {forceRefreshEnabled 
                      ? 'กรุณาโหลดหน้าใหม่' 
                      : departmentsLoading 
                        ? 'กำลังโหลดข้อมูล...' 
                        : 'ตรวจสอบตำแหน่งและบันทึก'}
                  </Button>
                </Grid>
              </Grid>
            </Grow>
          )}

          {activeStep === 1 && (
            <Fade in={true}>
              <Box sx={{ textAlign: 'center', py: 6 }}>
                <CircularProgress size={80} thickness={4} sx={{ mb: 3 }} />
                <Typography variant="h4" sx={{ mt: 2, fontWeight: 600 }}>
                  กำลังตรวจสอบตำแหน่งของคุณ...
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mt: 2, mb: 1 }}>
                  กรุณาอนุญาตการเข้าถึงตำแหน่งในเบราว์เซอร์
                </Typography>
                <Typography variant="body1" color="text.secondary" sx={{ mb: 4 }}>
                  ระบบจะตรวจสอบว่าคุณอยู่ในรัศมี <strong>{adminSettings.allowedLocation.radius}</strong> เมตร
                </Typography>
                
                <LocationChecker
                  allowedLocation={adminSettings.allowedLocation}
                  onLocationVerified={handleLocationVerified}
                  onLocationError={handleLocationError}
                />
                
                <Button
                  variant="outlined"
                  size="large"
                  onClick={() => {
                    setActiveStep(0);
                    setLoading(false);
                  }}
                  sx={{ mt: 4, px: 4, py: 1.5, borderRadius: 3 }}
                  disabled={forceRefreshEnabled}
                >
                  ยกเลิก
                </Button>
              </Box>
            </Fade>
          )}
        </CardContent>
      </Card>
    </Fade>
  );
};

export default ActivityRegistrationForm;