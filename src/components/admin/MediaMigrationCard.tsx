'use client';

import React, { useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Database,
  HardDrive,
  Pause,
  Play,
  RefreshCw,
  Search,
  Upload,
} from 'lucide-react';

import type { AdminProfile } from '@/types/admin';
import type { MigrateResult, ScanResult } from '@/lib/mediaMigration';
import { adminAuth as auth } from '@/lib/firebaseAdminClient';
import { invalidateActivitiesCache, logAdminEvent } from '@/lib/adminFirebase';
import { useConfirm } from '@/components/providers/ConfirmDialogProvider';
import { useSnackbar } from '@/lib/toast';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Progress } from '@/components/ui/progress';

type Props = {
  currentAdmin: AdminProfile;
};

type MigrationTotals = {
  processedDocs: number;
  migratedDocs: number;
  migratedItems: number;
  uploadedBytes: number;
  skipped: number;
  errors: { doc: string; error: string }[];
};

const EMPTY_TOTALS: MigrationTotals = {
  processedDocs: 0,
  migratedDocs: 0,
  migratedItems: 0,
  uploadedBytes: 0,
  skipped: 0,
  errors: [],
};

const FIELD_LABELS: Record<string, string> = {
  bannerUrl: 'แบนเนอร์กิจกรรม',
  dynamicQrBgUrl: 'พื้นหลัง Dynamic QR',
  description: 'รูปในรายละเอียดกิจกรรม',
  files: 'ไฟล์แนบกิจกรรม',
  sessions: 'ไฟล์แนบในรอบกิจกรรม',
  adImageUrl: 'รูปโฆษณาลิงก์ย่อ',
};

const COLLECTION_LABELS: Record<string, string> = {
  activityQRCodes: 'กิจกรรมหลัก (activityQRCodes)',
  activities: 'กิจกรรมสำรอง (activities)',
  customShortLinks: 'ลิงก์ย่อ (customShortLinks)',
};

const formatBytes = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export default function MediaMigrationCard({ currentAdmin }: Props) {
  const confirm = useConfirm();
  const { enqueueSnackbar } = useSnackbar();

  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<ScanResult | null>(null);
  const [scanError, setScanError] = useState('');

  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [finished, setFinished] = useState(false);
  const [resumeCursor, setResumeCursor] = useState<string | null>(null);
  const [storageError, setStorageError] = useState('');
  const [totals, setTotals] = useState<MigrationTotals>(EMPTY_TOTALS);

  const pauseRef = useRef(false);

  const getToken = async (): Promise<string> => {
    const token = await auth.currentUser?.getIdToken();
    if (!token) throw new Error('ไม่พบสิทธิ์เข้าสู่ระบบ กรุณาเข้าสู่ระบบใหม่อีกครั้ง');
    return token;
  };

  const runScan = async (silent = false) => {
    setScanning(true);
    setScanError('');
    try {
      const token = await getToken();
      const res = await fetch('/api/admin/migrate-media', {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || `ตรวจสอบไม่สำเร็จ (${res.status})`);
      const result = json as ScanResult;
      setScan(result);
      if (result.items === 0) {
        setResumeCursor(null);
        setPaused(false);
        setStorageError('');
      }
      if (!silent) {
        const items = result.items;
        enqueueSnackbar(
          items > 0
            ? `พบไฟล์ base64 ค้างอยู่ ${items.toLocaleString('th-TH')} รายการ`
            : 'ไม่พบไฟล์ base64 ค้างใน Firestore',
          { variant: items > 0 ? 'info' : 'success' }
        );
      }
    } catch (err: any) {
      const msg = err?.message || 'ตรวจสอบข้อมูลไม่สำเร็จ';
      setScanError(msg);
      if (!silent) enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setScanning(false);
    }
  };

  const startOrResumeMigration = async (resume: boolean) => {
    if (running) return;

    if (!resume) {
      const ok = await confirm({
        title: 'ยืนยันการย้ายไฟล์ base64 ไปยัง Firebase Storage',
        description: (
          <>
            ระบบจะอัปโหลดรูปแบนเนอร์ พื้นหลัง QR รูปในรายละเอียด และไฟล์แนบที่เก็บเป็น base64 ใน Firestore
            ขึ้นไปยัง Firebase Storage แล้วเปลี่ยนเป็น URL อัตโนมัติทีละชุด
            <br />
            <br />
            หาก Firebase Storage ยังไม่พร้อมใช้งาน (เช่น โควตาเต็มหรือยังไม่เปิด Billing) ระบบจะหยุดทันทีโดยไม่แก้ข้อมูลเดิม
          </>
        ),
        confirmText: 'เริ่มย้ายไฟล์',
        cancelText: 'ยกเลิก',
      });
      if (!ok) return;
    }

    pauseRef.current = false;
    setRunning(true);
    setPaused(false);
    setFinished(false);
    setStorageError('');

    let cursor: string | null = resume ? resumeCursor : null;
    let acc: MigrationTotals = resume
      ? { ...totals, errors: [...totals.errors] }
      : { ...EMPTY_TOTALS, errors: [] };

    if (!resume) {
      setTotals(acc);
      setResumeCursor(null);
    }

    try {
      while (!pauseRef.current) {
        const token = await getToken();
        const res = await fetch('/api/admin/migrate-media', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ cursor, batchSize: 10 }),
        });

        const data = (await res.json().catch(() => ({}))) as Partial<MigrateResult> & { error?: string };

        if (!res.ok && !data.storageError) {
          throw new Error(data.error || `ย้ายไฟล์ไม่สำเร็จ (${res.status})`);
        }

        acc = {
          processedDocs: acc.processedDocs + (data.processedDocs || 0),
          migratedDocs: acc.migratedDocs + (data.migratedDocs || 0),
          migratedItems: acc.migratedItems + (data.migratedItems || 0),
          uploadedBytes: acc.uploadedBytes + (data.uploadedBytes || 0),
          skipped: acc.skipped + (data.skipped || 0),
          errors: [...acc.errors, ...(data.errors || [])],
        };
        setTotals(acc);

        cursor = data.nextCursor ?? null;
        setResumeCursor(cursor);

        if (data.storageError) {
          setStorageError(data.storageError);
          setPaused(true);
          enqueueSnackbar('Firebase Storage ยังไม่พร้อมใช้งาน — หยุดการย้ายชั่วคราวแล้ว', {
            variant: 'warning',
          });
          break;
        }

        if (data.done) {
          setFinished(true);
          setResumeCursor(null);
          invalidateActivitiesCache();
          await logAdminEvent(
            'MIGRATE_MEDIA_TO_STORAGE',
            {
              processedDocs: acc.processedDocs,
              migratedDocs: acc.migratedDocs,
              migratedItems: acc.migratedItems,
              uploadedBytes: acc.uploadedBytes,
              skipped: acc.skipped,
              errorCount: acc.errors.length,
            },
            { uid: currentAdmin.uid, email: currentAdmin.email }
          );
          enqueueSnackbar(
            acc.migratedItems > 0
              ? `ย้ายสำเร็จ ${acc.migratedItems.toLocaleString('th-TH')} ไฟล์ (${formatBytes(acc.uploadedBytes)})`
              : 'ตรวจสอบครบแล้ว ไม่พบไฟล์ที่ต้องย้ายเพิ่มเติม',
            { variant: 'success' }
          );
          void runScan(true);
          break;
        }
      }

      if (pauseRef.current) {
        setPaused(true);
        enqueueSnackbar('หยุดการย้ายชั่วคราวแล้ว — กด "ทำต่อ" เพื่อทำต่อจากจุดเดิม', {
          variant: 'info',
        });
      }
    } catch (err: any) {
      const msg = err?.message || 'เกิดข้อผิดพลาดระหว่างย้ายไฟล์';
      setStorageError(msg);
      setPaused(true);
      enqueueSnackbar(msg, { variant: 'error' });
    } finally {
      setRunning(false);
    }
  };

  const progressPct =
    scan && scan.docs > 0
      ? Math.min(100, Math.round((totals.processedDocs / scan.docs) * 100))
      : finished
        ? 100
        : 0;

  const fieldEntries = scan ? Object.entries(scan.byField) : [];
  const collectionEntries = scan ? Object.entries(scan.byCollection || {}) : [];

  return (
    <Card className="border-0 shadow-sm">
      <CardContent className="p-6 space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">ย้ายรูปภาพ Base64 ไปยัง Firebase Storage</h3>
              <Badge variant="secondary" className="text-[11px]">
                เฉพาะ Super Admin
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              เมื่อโควตา Storage กลับมาใช้งานได้ สามารถย้ายแบนเนอร์ พื้นหลัง Dynamic QR รูปในรายละเอียด และไฟล์แนบที่เก็บเป็น
              base64 ใน Firestore ขึ้น Storage เพื่อลดขนาดเอกสารและเพิ่มความเร็วในการโหลด
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={scanning || running}
              onClick={() => void runScan(false)}
              className="gap-1.5"
            >
              {scanning ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Search className="h-4 w-4" />
              )}
              {scan ? 'ตรวจสอบอีกครั้ง' : 'ตรวจสอบไฟล์ค้าง'}
            </Button>

            {running ? (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  pauseRef.current = true;
                }}
                className="gap-1.5"
              >
                <Pause className="h-4 w-4" />
                หยุดชั่วคราว
              </Button>
            ) : resumeCursor ? (
              <Button
                size="sm"
                disabled={scanning}
                onClick={() => void startOrResumeMigration(true)}
                className="gap-1.5"
              >
                <Play className="h-4 w-4" />
                ทำต่อจากจุดเดิม
              </Button>
            ) : (
              <Button
                size="sm"
                disabled={scanning || !scan || scan.items === 0}
                onClick={() => void startOrResumeMigration(false)}
                className="gap-1.5"
              >
                <Upload className="h-4 w-4" />
                ย้ายไปยัง Storage
              </Button>
            )}
          </div>
        </div>

        {scanError && (
          <Alert variant="destructive">
            <AlertDescription>{scanError}</AlertDescription>
          </Alert>
        )}

        {storageError && (
          <Alert variant="warning">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <p className="font-medium">หยุดการย้ายเนื่องจาก Firebase Storage ยังไม่พร้อมใช้งาน</p>
              <p className="text-xs break-all opacity-90">{storageError}</p>
              <p className="text-xs">
                ข้อมูลใน Firestore ยังคงเดิมไม่เสียหาย เมื่อโควตาหรือสิทธิ์ Storage พร้อมแล้วสามารถกด &quot;ทำต่อจากจุดเดิม&quot; ได้ทันที
              </p>
            </AlertDescription>
          </Alert>
        )}

        {/* ผลการสำรวจ */}
        {scan && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">เอกสารทั้งหมด</p>
                <p className="text-lg font-bold tabular-nums">{scan.docs.toLocaleString('th-TH')}</p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">เอกสารที่มี base64</p>
                <p className="text-lg font-bold tabular-nums">
                  {scan.docsWithMedia.toLocaleString('th-TH')}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">ไฟล์ base64 ค้างอยู่</p>
                <p className="text-lg font-bold tabular-nums text-amber-600 dark:text-amber-400">
                  {scan.items.toLocaleString('th-TH')}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <p className="text-xs text-muted-foreground">ขนาดรวมโดยประมาณ</p>
                <p className="text-lg font-bold tabular-nums">{formatBytes(scan.bytes)}</p>
              </div>
            </div>

            {scan.items === 0 ? (
              <div className="flex items-center gap-2 rounded-xl border border-emerald-200 dark:border-emerald-900/60 bg-emerald-50/60 dark:bg-emerald-950/30 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>ไม่พบไฟล์ base64 ค้างในเอกสาร Firestore — รูปภาพทั้งหมดอยู่ใน Storage แล้ว</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                {fieldEntries.length > 0 && (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <p className="font-semibold text-foreground">แยกตามประเภทฟิลด์</p>
                    <div className="space-y-1.5">
                      {fieldEntries.map(([field, stat]) => (
                        <div key={field} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">
                            {FIELD_LABELS[field] || field}
                          </span>
                          <span className="font-medium tabular-nums">
                            {stat.items.toLocaleString('th-TH')} ไฟล์ · {formatBytes(stat.bytes)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {collectionEntries.length > 0 && (
                  <div className="rounded-xl border border-border p-3 space-y-2">
                    <p className="font-semibold text-foreground flex items-center gap-1.5">
                      <Database className="h-3.5 w-3.5 text-muted-foreground" />
                      แยกตามคอลเลกชัน
                    </p>
                    <div className="space-y-1.5">
                      {collectionEntries.map(([col, stat]) => (
                        <div key={col} className="flex items-center justify-between gap-2">
                          <span className="text-muted-foreground">
                            {COLLECTION_LABELS[col] || col}
                          </span>
                          <span className="font-medium tabular-nums">
                            {stat.items.toLocaleString('th-TH')} ไฟล์ ({stat.docsWithMedia}/{stat.docs} เอกสาร)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* ความคืบหน้าการย้าย */}
        {(running || paused || finished || totals.processedDocs > 0) && (
          <div className="rounded-xl border border-border bg-muted/20 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                {running && <RefreshCw className="h-3.5 w-3.5 animate-spin text-primary" />}
                {finished && !running && (
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
                )}
                {running
                  ? 'กำลังย้ายไฟล์ไปยัง Firebase Storage…'
                  : finished
                    ? 'ย้ายไฟล์เสร็จสิ้น'
                    : 'หยุดชั่วคราว'}
              </span>
              <span className="tabular-nums text-muted-foreground">
                ตรวจแล้ว {totals.processedDocs.toLocaleString('th-TH')}
                {scan ? ` / ${scan.docs.toLocaleString('th-TH')}` : ''} เอกสาร ({progressPct}%)
              </span>
            </div>

            <Progress value={progressPct} />

            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                อัปเดตเอกสารแล้ว:{' '}
                <b className="text-foreground tabular-nums">
                  {totals.migratedDocs.toLocaleString('th-TH')}
                </b>
              </span>
              <span>
                ย้ายไฟล์สำเร็จ:{' '}
                <b className="text-emerald-600 dark:text-emerald-400 tabular-nums">
                  {totals.migratedItems.toLocaleString('th-TH')}
                </b>
              </span>
              <span>
                ขนาดที่อัปโหลด:{' '}
                <b className="text-foreground tabular-nums">{formatBytes(totals.uploadedBytes)}</b>
              </span>
              {totals.skipped > 0 && (
                <span>
                  ข้าม (ถูกแก้ระหว่างย้าย):{' '}
                  <b className="text-amber-600 tabular-nums">
                    {totals.skipped.toLocaleString('th-TH')}
                  </b>
                </span>
              )}
              {totals.errors.length > 0 && (
                <span>
                  ผิดพลาด:{' '}
                  <b className="text-destructive tabular-nums">
                    {totals.errors.length.toLocaleString('th-TH')}
                  </b>
                </span>
              )}
            </div>

            {totals.errors.length > 0 && (
              <div className="max-h-36 overflow-y-auto rounded-lg border border-destructive/30 bg-destructive/5 p-2.5 text-xs space-y-1">
                {totals.errors.map((e, idx) => (
                  <p key={`${e.doc}-${idx}`} className="text-destructive break-all">
                    <span className="font-mono font-semibold">{e.doc}</span>: {e.error}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
