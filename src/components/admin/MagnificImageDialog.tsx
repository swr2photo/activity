'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Image as ImageIcon } from 'lucide-react';
import { adminAuth as auth } from '../../lib/firebase';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Spinner } from '@/components/ui/spinner';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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
      onOpenChange={(v) => {
        if (!v && !loading) onClose();
      }}
    >
      <DialogContent className="max-w-3xl overflow-hidden rounded-3xl p-0 gap-0">
        <DialogHeader className="flex-row items-center justify-between space-y-0 border-b px-6 py-4">
          <DialogTitle className="flex items-center gap-3 text-lg font-bold">
            <Sparkles className="h-5 w-5 text-[#0071e3]" />
            {title}
          </DialogTitle>
        </DialogHeader>

        <div className="bg-muted/30 px-6 py-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            {/* Left side: Inputs */}
            <div className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="magnific-prompt">
                  คำอธิบายรูปภาพ (Prompt) *เป็นภาษาอังกฤษจะดีที่สุด*
                </Label>
                <Textarea
                  id="magnific-prompt"
                  rows={4}
                  required
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="เช่น A futuristic science lab with glowing holographic UI, widescreen, hyperrealistic..."
                  disabled={loading || busy}
                />
              </div>

              <div className="space-y-2">
                <Label>สัดส่วนภาพ (Aspect Ratio)</Label>
                <Select
                  value={ratio}
                  onValueChange={(v) => setRatio(v as MagnificAspectRatio)}
                  disabled={loading || busy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="widescreen_16_9">16:9 (แนะนำสำหรับแบนเนอร์/จอแสดงผล)</SelectItem>
                    <SelectItem value="square_1_1">1:1 (จัตุรัส)</SelectItem>
                    <SelectItem value="classic_4_3">4:3 (คลาสสิก)</SelectItem>
                    <SelectItem value="social_post_4_5">4:5 (โซเชียลแนวตั้ง)</SelectItem>
                    <SelectItem value="social_story_9_16">9:16 (สตอรี่)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>โมเดล AI (Model)</Label>
                <Select
                  value={model}
                  onValueChange={setModel}
                  disabled={loading || busy}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="realism">Realism (ภาพถ่ายสมจริง)</SelectItem>
                    <SelectItem value="fluid">Fluid (จินตนาการ/อิง Prompt ดีที่สุด)</SelectItem>
                    <SelectItem value="zen">Zen (เรียบง่าย/สะอาดตา)</SelectItem>
                    <SelectItem value="flexible">Flexible (สีสันสดใส/อาร์ต)</SelectItem>
                    <SelectItem value="super_real">Super Real (เน้นความคมชัดสูงสุด)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <Alert variant="destructive" className="rounded-xl">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              <Button
                size="lg"
                disabled={!prompt.trim() || loading || busy}
                onClick={handleGenerate}
                className="w-full gap-2 py-6 font-semibold"
              >
                {loading ? <Spinner size="sm" className="text-primary-foreground" /> : <Sparkles className="h-4 w-4" />}
                {busy ? 'กำลังส่งข้อมูล...' : 'เริ่มสร้างรูปภาพ'}
              </Button>
            </div>

            {/* Right side: Preview and status */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative flex h-80 w-full flex-col items-center justify-center overflow-hidden rounded-2xl border border-border bg-black">
                {resultUrl ? (
                  <img
                    src={resultUrl}
                    alt="Generated"
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-3 px-8 text-center text-[#a1a1a6]">
                    {busy ? (
                      <>
                        <Spinner size="lg" className="h-12 w-12 text-[#0071e3]" />
                        <p className="font-semibold text-white">
                          กำลังประมวลผลโดย Magnific AI...
                        </p>
                        <p className="text-xs text-gray-400">
                          (อาจใช้เวลาประมาณ 10-30 วินาที ระบบกำลังอัปเดตสถานะอัตโนมัติ)
                        </p>
                      </>
                    ) : (
                      <>
                        <ImageIcon className="h-16 w-16 text-white/20" />
                        <p className="text-sm">
                          ยังไม่มีรูปภาพที่สร้างขึ้น กรุณากรอก Prompt และกดปุ่มเริ่มสร้างรูปภาพ
                        </p>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t px-6 py-4 sm:justify-end">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            ยกเลิก
          </Button>
          <Button
            className="gap-2 bg-emerald-600 font-semibold hover:bg-emerald-700"
            disabled={!resultUrl || loading}
            onClick={handleUse}
          >
            {loading && <Spinner size="sm" className="text-white" />}
            {useButtonLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default MagnificImageDialog;
