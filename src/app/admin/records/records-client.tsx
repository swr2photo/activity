"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Search,
  X,
  Download,
  RefreshCw,
  ArrowLeft,
  Users,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { adminDb as db } from "../../../lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";

type ActivityRecord = {
  id: string;
  activityCode: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  timestamp: Date;
};

const RecordsTable: React.FC<{ rows: ActivityRecord[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        ไม่มีข้อมูลการลงทะเบียน
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {["วันที่/เวลา", "รหัสผู้เข้าร่วม", "ชื่อ", "นามสกุล", "สังกัด", "รหัสกิจกรรม"].map(
              (h) => (
                <th key={h} className="border-b p-4 text-left text-sm font-bold">
                  {h}
                </th>
              )
            )}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="whitespace-nowrap border-b p-4">
                <p className="text-sm font-semibold">
                  {r.timestamp.toLocaleDateString("th-TH")}
                </p>
                <p className="text-xs text-muted-foreground">
                  {r.timestamp.toLocaleTimeString("th-TH")}
                </p>
              </td>
              <td className="border-b p-4 font-mono font-bold">{r.studentId}</td>
              <td className="border-b p-4">{r.firstName}</td>
              <td className="border-b p-4">{r.lastName}</td>
              <td className="border-b p-4">
                <Badge variant="outline">{r.department || "-"}</Badge>
              </td>
              <td className="border-b p-4">
                <Badge className="font-bold">{r.activityCode}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default function RecordsClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activityFromQuery = (searchParams.get("activity") || "").trim();

  const [loading, setLoading] = useState(false);
  const [all, setAll] = useState<ActivityRecord[]>([]);
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    if (!q) return all;
    const s = q.toLowerCase();
    return all.filter(
      (r) =>
        r.activityCode.toLowerCase().includes(s) ||
        r.studentId.includes(q) ||
        r.firstName.toLowerCase().includes(s) ||
        r.lastName.toLowerCase().includes(s) ||
        (r.department || "").toLowerCase().includes(s)
    );
  }, [all, q]);

  const stats = useMemo(() => {
    const uniqueStudents = new Set(all.map((r) => r.studentId)).size;
    const uniqueActivities = new Set(all.map((r) => r.activityCode)).size;
    return { total: all.length, uniqueStudents, uniqueActivities };
  }, [all]);

  const fetchRecords = async () => {
    setLoading(true);
    try {
      const col = collection(db, "activityRecords");

      let snap;
      if (activityFromQuery) {
        snap = await getDocs(
          query(col, where("activityCode", "==", activityFromQuery))
        );
      } else {
        snap = await getDocs(query(col, orderBy("timestamp", "desc")));
      }

      let rows: ActivityRecord[] = snap.docs.map((d) => {
        const data: any = d.data();
        const ts: Date =
          data.timestamp?.toDate?.() ??
          (data.timestamp instanceof Date
            ? data.timestamp
            : new Date(data.timestamp || Date.now()));

        return {
          id: d.id,
          activityCode: data.activityCode || "",
          studentId: data.studentId || "",
          firstName: data.firstName || "",
          lastName: data.lastName || "",
          department: data.department || "",
          timestamp: ts,
        };
      });

      if (activityFromQuery) {
        rows = rows.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      }

      setAll(rows);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activityFromQuery]);

  const exportCSV = () => {
    const headers = [
      "วันที่/เวลา",
      "รหัสผู้เข้าร่วม",
      "ชื่อ",
      "นามสกุล",
      "สังกัด",
      "รหัสกิจกรรม",
    ];

    const body = filtered.map((r) => [
      r.timestamp.toLocaleString("th-TH"),
      r.studentId,
      r.firstName,
      r.lastName,
      r.department,
      r.activityCode,
    ]);

    const csv = [headers, ...body]
      .map((row) =>
        row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
      )
      .join("\n");

    const blob = new Blob(["\uFEFF" + csv], {
      type: "text/csv;charset=utf-8;",
    });

    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const codePart = activityFromQuery ? `_${activityFromQuery}` : "";
    a.download = `activity_records${codePart}_${
      new Date().toISOString().split("T")[0]
    }.csv`;
    a.click();
  };

  return (
    <div className="mx-auto max-w-[1200px] p-4 md:p-6">
      {/* Header */}
      <div className="mb-4 flex items-center gap-2">
        <Button size="icon" variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold">
          <Users className="h-6 w-6" /> รายชื่อผู้ลงทะเบียน
        </h1>
      </div>

      {/* Filters & Actions */}
      <Card className="mb-4">
        <CardContent className="flex flex-col gap-4 pt-6 md:flex-row md:items-center">
          <div className="flex flex-wrap items-center gap-2">
            {activityFromQuery ? (
              <Badge>กิจกรรม: {activityFromQuery}</Badge>
            ) : (
              <Badge variant="secondary">ทุกกิจกรรม</Badge>
            )}
            <Badge variant="outline">ทั้งหมด: {all.length}</Badge>
            <Badge variant="outline">ผู้เข้าร่วม: {stats.uniqueStudents}</Badge>
            <Badge variant="outline">กิจกรรม: {stats.uniqueActivities}</Badge>
          </div>

          <div className="flex-1" />

          <div className="relative w-full md:max-w-xs">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9 pr-9"
              placeholder="รหัสกิจกรรม, รหัสผู้เข้าร่วม, ชื่อ..."
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            {q && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 hover:bg-muted"
                onClick={() => setQ("")}
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={fetchRecords}
              disabled={loading}
            >
              <RefreshCw className="h-4 w-4" />
              รีเฟรช
            </Button>
            <Button
              size="sm"
              className="gap-2 bg-emerald-600 hover:bg-emerald-700"
              onClick={exportCSV}
              disabled={filtered.length === 0}
            >
              <Download className="h-4 w-4" />
              ส่งออก CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <Card>
        <CardContent className="pt-6">
          {loading ? (
            <div className="flex justify-center py-12">
              <Spinner size="lg" />
            </div>
          ) : (
            <RecordsTable rows={filtered} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
