'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as SparklesIcon,
  Close as CloseIcon,
  Image as ImageIcon,
} from '@mui/icons-material';
import { adminAuth as auth } from '../../lib/firebase';

export type MagnificAspectRatio =
  | 'widescreen_16_9'
  | 'square_1_1'
  | 'classic_4_3'
  | 'social_post_4_5'
  | 'social_story_9_16';

interface MagnificImageDialogProps {
  open: boolean;
  onClose: () => void;
  /** เรียกเมื่อผู้ใช้กด "ใช้รูปภาพนี้" — file คือรูปที่ดาวน์โหลดผ่าน proxy แล้ว */
  onUseImage: (file: File, objectUrl: string) => void | Promise<void>;
  title?: string;
  useButtonLabel?: string;
  initialPrompt?: string;
  initialRatio?: MagnificAspectRatio;
}

type TaskStatus = 'IDLE' | 'CREATED' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';

export const MagnificImageDialog: React.FC<MagnificImageDialogProps> = ({
  open,
  onClose,
  onUseImage,
  title = 'สร้างรูปภาพด้วย Magnific AI',
  useButtonLabel = 'ใช้รูปภาพนี้',
  initialPrompt = '',
  initialRatio = 'widescreen_16_9',
}) => {
  const [prompt, setPrompt] = useState(initialPrompt);
  const [ratio, setRatio] = useState<MagnificAspectRatio>(initialRatio);
  const [model, setModel] = useState('realism');
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<TaskStatus>('IDLE');
  const [taskId, setTaskId] = useState<string | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const openedRef = useRef(false);

  // Reset state each time the dialog opens
  useEffect(() => {
    if (open && !openedRef.current) {
      setPrompt(initialPrompt);
      setRatio(initialRatio);
      setStatus('IDLE');
      setTaskId(null);
      setResultUrl(null);
      setError('');
      setLoading(false);
    }
    openedRef.current = open;
  }, [open, initialPrompt, initialRatio]);

  // Poll task status
  useEffect(() => {
    if (!taskId || status === 'COMPLETED' || status === 'FAILED') return;

    const checkStatus = async () => {
      try {
        const idToken = await auth.currentUser?.getIdToken();
        if (!idToken) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

        const res = await fetch(`/api/magnific?taskId=${taskId}`, {
          headers: { Authorization: `Bearer ${idToken}` },
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'ตรวจสอบสถานะล้มเหลว');

        const data = json.data;
        if (!data) return;

        if (data.status === 'COMPLETED') {
          setStatus('COMPLETED');
          if (data.generated && data.generated.length > 0) {
            setResultUrl(data.generated[0]);
          } else {
            throw new Error('ไม่พบ URL รูปภาพที่สร้างขึ้น');
          }
        } else if (data.status === 'FAILED') {
          setStatus('FAILED');
          throw new Error('การสร้างรูปภาพล้มเหลว (Failed)');
        } else {
          setStatus('IN_PROGRESS');
        }
      } catch (err: any) {
        setError(err.message || 'เกิดข้อผิดพลาดในการตรวจสอบสถานะ');
        setStatus('FAILED');
        setTaskId(null);
      }
    };

    const timerId = setInterval(checkStatus, 3000);
    return () => clearInterval(timerId);
  }, [taskId, status]);

  const handleGenerate = async () => {
    try {
      setLoading(true);
      setError('');
      setResultUrl(null);
      setStatus('CREATED');

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

      const res = await fetch('/api/magnific', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ prompt, aspect_ratio: ratio, model }),
      });

      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'ไม่สามารถเริ่มต้นสร้างรูปภาพได้');

      if (json.data && json.data.task_id) {
        setTaskId(json.data.task_id);
        setStatus('IN_PROGRESS');
      } else {
        throw new Error('ไม่ได้รับข้อมูล Task ID จากระบบ');
      }
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการสร้างรูปภาพ');
      setStatus('FAILED');
    } finally {
      setLoading(false);
    }
  };

  const handleUse = async () => {
    if (!resultUrl) return;
    try {
      setLoading(true);
      setError('');

      const idToken = await auth.currentUser?.getIdToken();
      if (!idToken) throw new Error('ไม่พบข้อมูลการเข้าสู่ระบบ');

      // Fetch via proxy to avoid CORS
      const res = await fetch(`/api/magnific?proxyUrl=${encodeURIComponent(resultUrl)}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) throw new Error('ไม่สามารถดาวน์โหลดรูปภาพผ่าน proxy ได้');

      const blob = await res.blob();
      const ext = blob.type.split('/')[1] || 'jpg';
      const file = new File([blob], `magnific_${Date.now()}.${ext}`, { type: blob.type });

      await onUseImage(file, URL.createObjectURL(file));

      onClose();
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาดในการดึงรูปภาพมาใช้');
    } finally {
      setLoading(false);
    }
  };

  const busy = status === 'CREATED' || status === 'IN_PROGRESS';

  return (
    <Dialog
      open={open}
      onClose={() => !loading && onClose()}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: {
          borderRadius: '24px',
          boxShadow: '0 24px 48px rgba(0,0,0,0.2)',
          overflow: 'hidden',
        },
      }}
    >
      <DialogTitle
        sx={{
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid rgba(0,0,0,0.08)',
          py: 2,
          px: 3,
        }}
      >
        <Stack direction="row" spacing={1.5} alignItems="center">
          <SparklesIcon sx={{ color: '#0071e3' }} />
          <Typography variant="h6" fontWeight={700}>{title}</Typography>
        </Stack>
        {!loading && (
          <IconButton onClick={onClose} size="small">
            <CloseIcon />
          </IconButton>
        )}
      </DialogTitle>

      <DialogContent sx={{ px: 3, py: 3, bgcolor: '#f5f5f7' }}>
        <Grid container spacing={3}>
          {/* Left side: Inputs */}
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={2.5}>
              <TextField
                label="คำอธิบายรูปภาพ (Prompt) *เป็นภาษาอังกฤษจะดีที่สุด*"
                multiline
                rows={4}
                fullWidth
                required
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="เช่น A futuristic science lab with glowing holographic UI, widescreen, hyperrealistic..."
                disabled={loading || busy}
              />

              <FormControl fullWidth disabled={loading || busy}>
                <InputLabel>สัดส่วนภาพ (Aspect Ratio)</InputLabel>
                <Select
                  value={ratio}
                  label="สัดส่วนภาพ (Aspect Ratio)"
                  onChange={(e) => setRatio(e.target.value as MagnificAspectRatio)}
                >
                  <MenuItem value="widescreen_16_9">16:9 (แนะนำสำหรับแบนเนอร์/จอแสดงผล)</MenuItem>
                  <MenuItem value="square_1_1">1:1 (จัตุรัส)</MenuItem>
                  <MenuItem value="classic_4_3">4:3 (คลาสสิก)</MenuItem>
                  <MenuItem value="social_post_4_5">4:5 (โซเชียลแนวตั้ง)</MenuItem>
                  <MenuItem value="social_story_9_16">9:16 (สตอรี่)</MenuItem>
                </Select>
              </FormControl>

              <FormControl fullWidth disabled={loading || busy}>
                <InputLabel>โมเดล AI (Model)</InputLabel>
                <Select
                  value={model}
                  label="โมเดล AI (Model)"
                  onChange={(e) => setModel(e.target.value)}
                >
                  <MenuItem value="realism">Realism (ภาพถ่ายสมจริง)</MenuItem>
                  <MenuItem value="fluid">Fluid (จินตนาการ/อิง Prompt ดีที่สุด)</MenuItem>
                  <MenuItem value="zen">Zen (เรียบง่าย/สะอาดตา)</MenuItem>
                  <MenuItem value="flexible">Flexible (สีสันสดใส/อาร์ต)</MenuItem>
                  <MenuItem value="super_real">Super Real (เน้นความคมชัดสูงสุด)</MenuItem>
                </Select>
              </FormControl>

              {error && (
                <Alert severity="error" sx={{ borderRadius: '12px' }}>
                  {error}
                </Alert>
              )}

              <Button
                variant="contained"
                color="primary"
                size="large"
                disabled={!prompt.trim() || loading || busy}
                onClick={handleGenerate}
                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <SparklesIcon />}
                sx={{ py: 1.5, borderRadius: '12px', fontWeight: 600 }}
              >
                {busy ? 'กำลังส่งข้อมูล...' : 'เริ่มสร้างรูปภาพ'}
              </Button>
            </Stack>
          </Grid>

          {/* Right side: Preview and status */}
          <Grid size={{ xs: 12, md: 6 }} sx={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <Paper
              variant="outlined"
              sx={{
                width: '100%',
                height: 320,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                bgcolor: '#000000',
                borderRadius: '16px',
                overflow: 'hidden',
                position: 'relative',
                border: '1px solid rgba(0,0,0,0.08)',
              }}
            >
              {resultUrl ? (
                <img
                  src={resultUrl}
                  alt="Generated"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />
              ) : (
                <Stack spacing={2} alignItems="center" sx={{ color: '#a1a1a6', px: 4, textAlign: 'center' }}>
                  {busy ? (
                    <>
                      <CircularProgress size={48} sx={{ color: '#0071e3' }} />
                      <Typography variant="body1" fontWeight={600} color="#ffffff">
                        กำลังประมวลผลโดย Magnific AI...
                      </Typography>
                      <Typography variant="caption" color="grey.400">
                        (อาจใช้เวลาประมาณ 10-30 วินาที ระบบกำลังอัปเดตสถานะอัตโนมัติ)
                      </Typography>
                    </>
                  ) : (
                    <>
                      <ImageIcon sx={{ fontSize: 64, color: 'rgba(255,255,255,0.2)' }} />
                      <Typography variant="body2">
                        ยังไม่มีรูปภาพที่สร้างขึ้น กรุณากรอก Prompt และกดปุ่มเริ่มสร้างรูปภาพ
                      </Typography>
                    </>
                  )}
                </Stack>
              )}
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 2.5, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
        <Button onClick={onClose} disabled={loading}>
          ยกเลิก
        </Button>
        <Button
          variant="contained"
          color="success"
          disabled={!resultUrl || loading}
          onClick={handleUse}
          startIcon={loading ? <CircularProgress size={18} color="inherit" /> : null}
          sx={{ fontWeight: 600, borderRadius: '8px' }}
        >
          {useButtonLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MagnificImageDialog;
