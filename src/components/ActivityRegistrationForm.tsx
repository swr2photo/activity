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
  Slide,
  Divider,
  Avatar
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
  Badge as BadgeIcon,
  Security as SecurityIcon,
  Edit as EditIcon,
  AccountCircle as AccountCircleIcon
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
  userCode?: string;
  requiresUniversityLogin?: boolean;
  latitude?: number;
  longitude?: number;
  checkInRadius?: number;
}

interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  givenName?: string;
  surname?: string;
  jobTitle?: string;
  department?: string;
  officeLocation?: string;
  mobilePhone?: string;
}

interface ActivityRegistrationFormProps {
  activityCode: string;
  adminSettings: AdminSettings;
  onSuccess?: () => Promise<void>;
  // รับข้อมูล Microsoft ที่ login แล้วมาจาก RegisterPage
  existingUserProfile?: UserProfile; // Made optional with ?
  existingAuthStatus: boolean;
}

const ActivityRegistrationForm: React.FC<ActivityRegistrationFormProps> = ({
  activityCode,
  adminSettings,
  onSuccess,
  existingUserProfile,
  existingAuthStatus
}) => {
  // เริ่มต้นที่ขั้นตอนกรอกข้อมูล (ข้าม Microsoft login)
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
    userCode: '',
    requiresUniversityLogin: false,
    latitude: 0,
    longitude: 0,
    checkInRadius: 100
  });

  // เพิ่ม state สำหรับควบคุมการบังคับโหลดหน้าใหม่
  const [forceRefreshEnabled, setForceRefreshEnabled] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [realtimeListener, setRealtimeListener] = useState<(() => void) | null>(null);

  // ฟังก์ชันดึงข้อมูลจาก Microsoft Profile
  function extractUserDataFromMicrosoft(profile?: UserProfile) {
    // ตรวจสอบว่า profile มีค่าหรือไม่
    if (!profile) {
      return {
        studentId: '',
        firstName: '',
        lastName: '',
        department: ''
      };
    }

    // พยายามดึงรหัสนักศึกษาจาก email หรือ displayName
    let studentId = '';
    
    // วิธีที่ 1: จากรูปแบบ email (เช่น 6412345678@university.edu)
    if (profile.email) {
      const emailMatch = profile.email.match(/^(\d{10})@/);
      if (emailMatch) {
        studentId = emailMatch[1];
      }
    }
    
    // วิธีที่ 2: จาก displayName หรือ jobTitle
    if (!studentId && profile.displayName) {
      const displayNameMatch = profile.displayName.match(/(\d{10})/);
      if (displayNameMatch) {
        studentId = displayNameMatch[1];
      }
    }

    // ตรวจสอบและดึงชื่อ-นามสกุล
    let firstName = profile.givenName || '';
    let lastName = profile.surname || '';
    
    // ถ้าไม่มีชื่อแยก ลองแยกจาก displayName
    if (!firstName && !lastName && profile.displayName) {
      const nameParts = profile.displayName.trim().split(/\s+/);
      if (nameParts.length >= 2) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      } else {
        firstName = profile.displayName;
      }
    }

    // พยายามระบุสาขาจากข้อมูล Microsoft
    let department = '';
    if (profile.department) {
      // หาสาขาที่ตรงกันหรือใกล้เคียง
      const matchedDept = defaultDepartments.find(dept => 
        dept.toLowerCase().includes(profile.department!.toLowerCase()) ||
        profile.department!.toLowerCase().includes(dept.toLowerCase())
      );
      department = matchedDept || profile.department;
    }

    return {
      studentId,
      firstName,
      lastName,
      department
    };
  }

  // ตั้งค่า formData จากข้อมูล Microsoft ที่ได้รับมา
  const [formData, setFormData] = useState(() => {
    const extractedData = extractUserDataFromMicrosoft(existingUserProfile);
    return {
      ...extractedData,
      userCode: '',
      email: existingUserProfile?.email || '',
      microsoftId: existingUserProfile?.id || ''
    };
  });

  // ขั้นตอนใหม่ (เอา Microsoft login ออก)
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
    
    if (realtimeListener) {
      realtimeListener();
      setRealtimeListener(null);
    }
    
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
          userCode: '',
          requiresUniversityLogin: false,
          latitude: 0,
          longitude: 0,
          checkInRadius: 100
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
          userCode: data.userCode || '',
          requiresUniversityLogin: data.requiresUniversityLogin || false,
          latitude: data.latitude || 13.7563,
          longitude: data.longitude || 100.5018,
          checkInRadius: data.checkInRadius || 100
        });

        setForceRefreshEnabled(data.forceRefresh === true);

        // ตั้ง real-time listener
        const unsubscribe = onSnapshot(doc(db, 'activityQRCodes', activityDoc.id), (docSnapshot) => {
          if (docSnapshot.exists()) {
            const updatedData = docSnapshot.data();
            console.log('Activity status updated in real-time:', updatedData);
            
            setActivityStatus(prev => ({
              ...prev,
              isActive: updatedData.isActive !== undefined ? updatedData.isActive : true,
              description: updatedData.description || '',
              userCode: updatedData.userCode || '',
              requiresUniversityLogin: updatedData.requiresUniversityLogin || false,
              latitude: updatedData.latitude || prev.latitude,
              longitude: updatedData.longitude || prev.longitude,
              checkInRadius: updatedData.checkInRadius || prev.checkInRadius
            }));

            const newForceRefresh = updatedData.forceRefresh === true;
            
            if (newForceRefresh && !forceRefreshEnabled) {
              console.log('🔄 Force refresh enabled from server - initiating refresh...');
              setForceRefreshEnabled(true);
              setTimeout(() => {
                handleForceRefresh();
              }, 2000);
            } else if (!newForceRefresh && forceRefreshEnabled) {
              console.log('✅ Force refresh disabled from server');
              setForceRefreshEnabled(false);
            }
          }
        });

        setRealtimeListener(() => unsubscribe);
      }
    } catch (error) {
      console.error('Error checking activity status:', error);
      setError('ไม่สามารถตรวจสอบสถานะกิจกรรมได้');
      setActivityStatus({
        exists: false,
        isActive: false,
        activityCode: activityCode,
        userCode: '',
        requiresUniversityLogin: false,
        latitude: 0,
        longitude: 0,
        checkInRadius: 100
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

  // ดึงข้อมูลสาขาจาก Firebase
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

      if (departmentsList.length === 0) {
        console.log('No departments found, initializing default departments...');
        await initializeDepartments();
        
        const newQuerySnapshot = await getDocs(departmentsQuery);
        departmentsList = [];
        newQuerySnapshot.forEach((doc) => {
          departmentsList.push({
            id: doc.id,
            ...doc.data()
          } as Department);
        });
      }

      departmentsList.sort((a, b) => a.name.localeCompare(b.name, 'th'));
      setDepartments(departmentsList);
      
    } catch (error) {
      console.error('Error fetching departments:', error);
      setError('ไม่สามารถโหลดข้อมูลสาขาได้ กรุณาลองใหม่อีกครั้ง');
      
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

  // โหลดข้อมูลเมื่อ component mount
  useEffect(() => {
    const loadInitialData = async () => {
      await Promise.all([
        checkActivityStatus(),
        fetchDepartments()
      ]);
    };
    
    loadInitialData();

    return () => {
      if (realtimeListener) {
        console.log('🔌 Cleaning up real-time listener');
        realtimeListener();
      }
    };
  }, [activityCode]);

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
    if (forceRefreshEnabled) return;

    setFormData({
      ...formData,
      [field]: event.target.value
    });
    setError('');
  };

  const handleSelectChange = (field: string) => (
    event: SelectChangeEvent<string>
  ) => {
    if (forceRefreshEnabled) return;

    setFormData({
      ...formData,
      [field]: event.target.value
    });
    setError('');
  };

  // ฟังก์ชันตรวจสอบรหัสนักศึกษาใหม่
  const validateNewStudentId = (studentId: string): boolean => {
    if (!/^\d{10}$/.test(studentId)) {
      return false;
    }
    
    const prefix = studentId.substring(0, 2);
    const prefixNum = parseInt(prefix);
    return prefixNum >= 64 && prefixNum <= 69;
  };

  const validateForm = async (): Promise<boolean> => {
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
    
    if (!formData.userCode) {
      setError('กรุณาใส่รหัสผู้ใช้');
      return false;
    }

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
    if (forceRefreshEnabled) {
      setError('ไม่สามารถบันทึกข้อมูลได้ กรุณาโหลดหน้านี้ใหม่');
      setLoading(false);
      setActiveStep(0);
      return;
    }

    try {
      const activityRecord = {
        studentId: formData.studentId,
        firstName: formData.firstName,
        lastName: formData.lastName,
        department: formData.department,
        activityCode,
        location,
        userCode: formData.userCode,
        email: formData.email,
        microsoftId: formData.microsoftId,
        microsoftProfile: existingUserProfile
      };

      await addDoc(collection(db, 'activityRecords'), {
        ...activityRecord,
        timestamp: serverTimestamp()
      });

      setActiveStep(2);
      setSuccess(true);
      setLoading(false);

      if (onSuccess) {
        try {
          await onSuccess();
        } catch (error) {
          console.error('Error in onSuccess callback:', error);
        }
      }
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

  const getActivityAllowedLocation = () => {
    return {
      latitude: activityStatus.latitude || 13.7563,
      longitude: activityStatus.longitude || 100.5018,
      radius: activityStatus.checkInRadius || 100
    };
  };

  // Show error if no user profile provided
  if (!existingUserProfile) {
    return (
      <Grow in={true}>
        <Card elevation={8} sx={{ borderRadius: 4, border: '2px solid', borderColor: 'error.main' }}>
          <CardContent sx={{ textAlign: 'center', py: 8 }}>
            <ErrorIcon sx={{ fontSize: 100, color: 'error.main', mb: 3 }} />
            <Typography variant="h3" color="error.main" gutterBottom fontWeight="bold">
              ไม่พบข้อมูลผู้ใช้
            </Typography>
            <Typography variant="h6" paragraph color="text.secondary">
              ไม่พบข้อมูลบัญชี Microsoft กรุณาเข้าสู่ระบบใหม่
            </Typography>
          </CardContent>
        </Card>
      </Grow>
    );
  }

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
                  '0%': { transform: 'rotate(0deg)' },
                  '100%': { transform: 'rotate(360deg)' },
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

            {/* แสดงข้อมูลผู้ใช้ Microsoft */}
            <Paper sx={{ 
              p: 3, 
              bgcolor: 'primary.50', 
              border: '2px solid', 
              borderColor: 'primary.200', 
              mb: 3,
              borderRadius: 3
            }}>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
                <Avatar sx={{ bgcolor: 'primary.main', mr: 2 }}>
                  <AccountCircleIcon />
                </Avatar>
                <Box>
                  <Typography variant="h6" color="primary.main" fontWeight="bold">
                    บัญชี Microsoft
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {existingUserProfile.email}
                  </Typography>
                </Box>
              </Box>
            </Paper>
            
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
                  const extractedData = extractUserDataFromMicrosoft(existingUserProfile);
                  setFormData({
                    ...extractedData,
                    userCode: '',
                    email: existingUserProfile?.email || '',
                    microsoftId: existingUserProfile?.id || ''
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

          {/* ขั้นตอนที่ 1: กรอกข้อมูล */}
          {activeStep === 0 && (
            <Grow in={true}>
              <Box>
                {/* แสดงข้อมูลผู้ใช้ Microsoft */}
                <Paper sx={{ 
                  p: 3, 
                  bgcolor: 'success.50', 
                  border: '2px solid', 
                  borderColor: 'success.200', 
                  mb: 4,
                  borderRadius: 3
                }}>
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Avatar sx={{ bgcolor: 'success.main', mr: 2 }}>
                      <AccountCircleIcon />
                    </Avatar>
                    <Box sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" color="success.main" fontWeight="bold">
                        ✅ ใช้บัญชี Microsoft ที่เข้าสู่ระบบแล้ว
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {existingUserProfile.displayName} ({existingUserProfile.email})
                      </Typography>
                      <Typography variant="caption" color="success.main" sx={{ mt: 1, display: 'block' }}>
                        📝 ข้อมูลด้านล่างถูกดึงจาก Microsoft อัตโนมัติและไม่สามารถแก้ไขได้
                      </Typography>
                    </Box>
                  </Box>
                  
                  <Divider sx={{ my: 2 }} />
                  
                  <Typography variant="body2" color="text.secondary">
                    ข้อมูลส่วนตัวจะถูกป้องกันและใช้เฉพาะการลงทะเบียนกิจกรรมนี้เท่านั้น
                  </Typography>
                </Paper>

                <Grid container spacing={3}>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="รหัสนักศึกษา"
                      value={formData.studentId}
                      onChange={handleInputChange('studentId')}
                      required
                      placeholder="เช่น 6412345678"
                      helperText="รหัสนักศึกษา 10 หลัก ขึ้นต้นด้วย 64-69 (ดึงจาก Microsoft อัตโนมัติ)"
                      disabled={true} // ไม่สามารถแก้ไขได้
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
                          bgcolor: 'action.hover', // สีพื้นหลังแสดงว่าไม่สามารถแก้ไขได้
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
                      disabled={true} // ไม่สามารถแก้ไขได้
                      helperText="ดึงจาก Microsoft อัตโนมัติ"
                      InputProps={{
                        startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: 'action.hover', // สีพื้นหลังแสดงว่าไม่สามารถแก้ไขได้
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
                      disabled={true} // ไม่สามารถแก้ไขได้
                      helperText="ดึงจาก Microsoft อัตโนมัติ"
                      InputProps={{
                        startAdornment: <PersonIcon sx={{ mr: 1, color: 'action.active' }} />
                      }}
                      sx={{
                        '& .MuiOutlinedInput-root': {
                          borderRadius: 2,
                          bgcolor: 'action.hover', // สีพื้นหลังแสดงว่าไม่สามารถแก้ไขได้
                          '&.Mui-focused fieldset': {
                            borderWidth: 2
                          }
                        }
                      }}
                    />
                  </Grid>
                  <Grid item xs={12}>
                    <FormControl fullWidth required disabled={true}>
                      <InputLabel>สาขา</InputLabel>
                      <Select
                        value={formData.department}
                        label="สาขา"
                        onChange={handleSelectChange('department')}
                        sx={{
                          borderRadius: 2,
                          bgcolor: 'action.hover', // สีพื้นหลังแสดงว่าไม่สามารถแก้ไขได้
                          '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
                            borderWidth: 2
                          }
                        }}
                      >
                        <MenuItem value={formData.department}>
                          <Box sx={{ display: 'flex', alignItems: 'center' }}>
                            <SchoolIcon sx={{ mr: 2, color: 'action.active' }} />
                            {formData.department}
                          </Box>
                        </MenuItem>
                      </Select>
                      <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                        ดึงจาก Microsoft อัตโนมัติ
                      </Typography>
                    </FormControl>
                  </Grid>
                  <Grid item xs={12}>
                    <TextField
                      fullWidth
                      label="รหัสผู้ใช้"
                      value={formData.userCode}
                      onChange={handleInputChange('userCode')}
                      required
                      helperText={`กรุณาใส่รหัสผู้ใช้สำหรับกิจกรรมนี้: ${activityStatus.userCode}`}
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
              </Box>
            </Grow>
          )}

          {/* ขั้นตอนที่ 2: ตรวจสอบตำแหน่ง */}
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
                  ระบบจะตรวจสอบว่าคุณอยู่ในรัศมี <strong>{activityStatus.checkInRadius}</strong> เมตร
                </Typography>
                
                <LocationChecker
                  allowedLocation={getActivityAllowedLocation()}
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