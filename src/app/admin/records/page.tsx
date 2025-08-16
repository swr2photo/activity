import { Suspense } from "react";
import RecordsClient from "./records-client";

// ถ้าหน้านี้เคย pre-render พัง ให้เปิดบรรทัดนี้ช่วยกัน static pre-render
// export const dynamic = "force-dynamic";

export default function Page() {
  return (
    <Suspense fallback={<div className="p-4">Loading records…</div>}>
      <RecordsClient />
    </Suspense>
  );
}
