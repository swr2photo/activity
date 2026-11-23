"use client";

import React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, ShieldAlert, Users } from "lucide-react";
import { useAdminAuth } from "@/hooks/useAdminAuth";
import AdminAttendancePanel from "@/components/admin/AdminAttendancePanel";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export default function RecordsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityFromQuery = (searchParams.get("activity") || "").trim().toUpperCase();
  const { currentAdmin, loading } = useAdminAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!currentAdmin) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">ต้องเข้าสู่ระบบผู้ดูแลระบบ</h1>
        <p className="text-sm text-muted-foreground">
          หน้านี้จำกัดสิทธิ์เฉพาะผู้ดูแลระบบที่เข้าสู่ระบบแล้วเท่านั้น
        </p>
        <Button asChild>
          <Link href="/admin">ไปหน้าเข้าสู่ระบบแอดมิน</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px] space-y-4 p-4 md:p-6">
      <div className="flex items-center gap-2">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            if (window.history.length > 1) router.back();
            else router.push("/admin");
          }}
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Users className="h-6 w-6" />
          รายชื่อผู้ลงทะเบียน {activityFromQuery ? `(${activityFromQuery})` : ""}
        </h1>
      </div>

      <AdminAttendancePanel
        currentAdmin={currentAdmin}
        fixedActivityCode={activityFromQuery || undefined}
        embedded
      />
    </div>
  );
}
