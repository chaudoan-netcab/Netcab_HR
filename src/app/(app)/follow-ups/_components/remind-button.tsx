"use client";
// Nút "Nhắc" cho 1 người (trang chi tiết), mở cùng cửa sổ soạn nhắc với bảng theo dõi
import { useState } from "react";
import { BellRing, CheckCircle2 } from "lucide-react";
import type { TrackRow } from "@/lib/tracking";
import { ReminderDialog } from "./reminder-dialog";

export function RemindButton({ row, quarterLabel, sender }: { row: TrackRow; quarterLabel: string; sender: string }) {
  const [open, setOpen] = useState(false);
  const [target] = useState(() => ({ kind: "person" as const, rows: [row] }));
  const [toast, setToast] = useState<string | null>(null);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        <BellRing size={15} /> Nhắc
      </button>
      {toast && (
        <div role="status" className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 shadow-lg">
          <CheckCircle2 size={16} /> {toast}
          <button type="button" onClick={() => setToast(null)} className="ml-2 text-xs underline">
            Đóng
          </button>
        </div>
      )}
      {open && <ReminderDialog target={target} quarterLabel={quarterLabel} sender={sender} onClose={() => setOpen(false)} onSent={setToast} />}
    </>
  );
}
