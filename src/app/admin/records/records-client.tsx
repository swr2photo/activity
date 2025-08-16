"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  Box, Typography, TextField, InputAdornment, IconButton, Button, Chip,
  Stack, Paper, CircularProgress, Grid, ButtonGroup
} from "@mui/material";
import {
  Search as SearchIcon, Clear as ClearIcon, Download as DownloadIcon,
  Refresh as RefreshIcon, ArrowBack as ArrowBackIcon, People as PeopleIcon
} from "@mui/icons-material";
import { useRouter, useSearchParams } from "next/navigation";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";
import { db } from "../../../lib/firebase";

type ActivityRecord = {
  id: string;
  activityCode: string;
  studentId: string;
  firstName: string;
  lastName: string;
  department: string;
  timestamp: Date;
};

const Table: React.FC<{ rows: ActivityRecord[] }> = ({ rows }) => {
  if (rows.length === 0) {
    return (
      <Box sx={{ textAlign: "center", py: 6, color: "text.secondary" }}>
        ไม่มีข้อมูลการลงทะเบียน
      </Box>
    );
  }

  return (
    <Box sx={{ overflowX: "auto" }}>
      <Box component="table" sx={{ width: "100%", borderCollapse: "collapse" }}>
        <Box component="thead">
          <Box component="tr">
            {["วันที่/เวลา","รหัสนักศึกษา","ชื่อ","นามสกุล","สาขา","รหัสกิจกรรม"].map((h) => (
              <Box key={h} component="th" sx={{ p: 2, textAlign: "left", borderBottom: "1px solid", borderColor: "divider" }}>
                <Typography variant="subtitle2" fontWeight="bold">{h}</Typography>
              </Box>
            ))}
          </Box>
        </Box>
        <Box component="tbody">
          {rows.map((r) => (
            <Box key={r.id} component="tr">
              <Box component="td" sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", whiteSpace: "nowrap" }}>
                <Stack spacing={0}>
                  <Typography variant="body2" fontWeight={600}>{r.timestamp.toLocaleDateString("th-TH")}</Typography>
                  <Typography variant="caption" color="text.secondary">{r.timestamp.toLocaleTimeString("th-TH")}</Typography>
                </Stack>
              </Box>
              <Box component="td" sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider", fontFamily: "monospace", fontWeight: 700 }}>
                {r.studentId}
              </Box>
              <Box component="td" sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>{r.firstName}</Box>
              <Box component="td" sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>{r.lastName}</Box>
              <Box component="td" sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <Chip size="small" variant="outlined" color="secondary" label={r.department || "-"} />
              </Box>
              <Box component="td" sx={{ p: 2, borderBottom: "1px solid", borderColor: "divider" }}>
                <Chip size="small" color="primary" label={r.activityCode} sx={{ fontWeight: 700 }} />
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    </Box>
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
    return all.filter((r) =>
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

      // ถ้ามี where ให้ตัด orderBy ออก แล้ว sort ฝั่ง client
      let snap;
      if (activityFromQuery) {
        snap = await getDocs(query(col, where("activityCode", "==", activityFromQuery)));
      } else {
        snap = await getDocs(query(col, orderBy("timestamp", "desc")));
      }

      let rows: ActivityRecord[] = snap.docs.map((d) => {
        const data: any = d.data();
        const ts: Date =
          data.timestamp?.toDate?.() ??
          (data.timestamp instanceof Date ? data.timestamp : new Date(data.timestamp || Date.now()));
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

  useEffect(() => { fetchRecords(); /* eslint-disable-next-line */ }, [activityFromQuery]);

  const exportCSV = () => {
    const headers = ["วันที่/เวลา", "รหัสนักศึกษา", "ชื่อ", "นามสกุล", "สาขา", "รหัสกิจกรรม"];
    const body = filtered.map((r) => [
      r.timestamp.toLocaleString("th-TH"),
      r.studentId,
      r.firstName,
      r.lastName,
      r.department,
      r.activityCode,
    ]);
    const csv = [headers, ...body].map((row) =>
      row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(",")
    ).join("\n");

    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const codePart = activityFromQuery ? `_${activityFromQuery}` : "";
    a.download = `activity_records${codePart}_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
  };

  return (
    <Box sx={{ p: { xs: 2, md: 3 }, maxWidth: 1200, mx: "auto" }}>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton onClick={() => router.back()}><ArrowBackIcon /></IconButton>
        <Typography variant="h5" fontWeight={800} sx={{ display: "flex", alignItems: "center", gap: 1 }}>
          <PeopleIcon /> รายชื่อผู้ลงทะเบียน
        </Typography>
      </Stack>

      {/* Filters & Actions */}
      <Paper sx={{ p: 2, mb: 2 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md="auto">
            <Stack direction="row" spacing={1} alignItems="center">
              {activityFromQuery
                ? <Chip color="primary" label={`กิจกรรม: ${activityFromQuery}`} />
                : <Chip color="default" label="ทุกกิจกรรม" />}
              <Chip label={`ทั้งหมด: ${all.length}`} />
              <Chip label={`นักศึกษา: ${stats.uniqueStudents}`} />
              <Chip label={`กิจกรรม: ${stats.uniqueActivities}`} />
            </Stack>
          </Grid>
          <Grid item xs />
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              label="ค้นหา"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="รหัสกิจกรรม, รหัสนักศึกษา, ชื่อ..."
              InputProps={{
                startAdornment: (<InputAdornment position="start"><SearchIcon /></InputAdornment>),
                endAdornment: q && (
                  <InputAdornment position="end">
                    <IconButton size="small" onClick={() => setQ("")}><ClearIcon /></IconButton>
                  </InputAdornment>
                )
              }}
            />
          </Grid>
          <Grid item xs={12} md="auto">
            <ButtonGroup variant="contained" size="small">
              <Button startIcon={<RefreshIcon />} onClick={fetchRecords} disabled={loading}>
                รีเฟรช
              </Button>
              <Button startIcon={<DownloadIcon />} color="success" onClick={exportCSV} disabled={filtered.length === 0}>
                ส่งออก CSV
              </Button>
            </ButtonGroup>
          </Grid>
        </Grid>
      </Paper>

      {/* Table */}
      <Paper sx={{ p: 2 }}>
        {loading ? (
          <Box sx={{ textAlign: "center", py: 6 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Table rows={filtered} />
        )}
      </Paper>
    </Box>
  );
}
