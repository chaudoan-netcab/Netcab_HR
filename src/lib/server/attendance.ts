// Import chấm công FastWork — GIAI ĐOẠN CHỈ LÀM UI.
// Lịch sử import nằm trong bộ nhớ server (demo-store.ts), không ghi database.
// TODO(backend): đọc file thật, lưu dữ liệu chấm công + lịch sử import vào database.
import "server-only";
import { ATTENDANCE_START_MONTH } from "@/config/attendance";
import { today } from "../dates";
import { demo, type AttendanceImport } from "./demo-store";

export type MonthState = { month: string; label: string; imports: AttendanceImport[]; status: "NONE" | "LOCKED"; reimported: boolean };

export const monthLabel = (m: string) => `Tháng ${Number(m.slice(5))}/${m.slice(0, 4)}`;
const key = (y: number, m: number) => `${y}-${String(m).padStart(2, "0")}`;

/** Tháng trước của hôm nay ("YYYY-MM") */
export function previousMonth() {
  const d = today();
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth(); // 0-based → tháng trước theo 1-based
  return m === 0 ? key(y - 1, 12) : key(y, m);
}

/** Danh sách tháng từ tháng bắt đầu áp dụng đến tháng trước (mới nhất trước). Rỗng nếu chưa tới tháng bắt đầu. */
export function applicableMonths(): string[] {
  const out: string[] = [];
  const end = previousMonth();
  let [y, m] = ATTENDANCE_START_MONTH.split("-").map(Number);
  while (key(y, m) <= end) {
    out.push(key(y, m));
    if (++m > 12) {
      m = 1;
      y++;
    }
  }
  return out.reverse();
}

export function monthState(month: string): MonthState {
  const imports = demo.attendance.filter((a) => a.month === month).sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  return { month, label: monthLabel(month), imports, status: imports.length ? "LOCKED" : "NONE", reimported: imports.length > 1 };
}

/** Tháng chưa import (tính từ ATTENDANCE_START_MONTH đến tháng trước) — dùng cho mục "Cần xử lý" của HRM */
export function missingAttendanceMonths(): string[] {
  return applicableMonths().filter((m) => monthState(m).status === "NONE");
}
