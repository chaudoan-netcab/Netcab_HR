"use server";
// Import chấm công FastWork — GIAI ĐOẠN CHỈ LÀM UI.
// Hệ thống CHƯA đọc nội dung file: kết quả kiểm tra cột và bản xem trước là dữ liệu mẫu (riêng 3 vị trí HCNS tháng 10/2026 lấy từ file thật).
// Lịch sử import lưu tạm trong bộ nhớ server (demo-store.ts), KHÔNG ghi database.
// TODO(backend): đọc file FastWork (xlsx/csv): thời gian xuất ở dòng 2, tiêu đề dòng 3–4, khớp nhân viên theo Họ tên + Phòng ban; lưu bảng chấm công và lịch sử import vào database.
import { revalidatePath } from "next/cache";
import { ATTENDANCE_REQUIRED_COLUMNS } from "@/config/attendance";
import { companyScope, isHRM } from "@/lib/server/access";
import { requireUser } from "@/lib/server/auth";
import { applicableMonths, monthLabel, monthState } from "@/lib/server/attendance";
import { db } from "@/lib/server/db";
import { ATTENDANCE_FILE_SAMPLE, demo, nowIso } from "@/lib/server/demo-store";

export type CheckItem = { level: "ok" | "warning" | "error"; title: string; detail: string };
/** Dòng xem trước theo cột của file FastWork; khớp nhân viên theo Họ tên + Phòng ban (file không có Email) */
export type PreviewRow = { code: string; name: string; department: string; matched: boolean; days: number; hours: number; lateCount: number; lateMinutes: number; earlyCount: number; leave: number; fromFile: boolean };
export type CheckResult =
  | { ok: true; month: string; monthLabel: string; fileName: string; exportedAtLabel: string; exportedFromFile: boolean; checks: CheckItem[]; preview: PreviewRow[]; alreadyImported: boolean; blocked: boolean }
  | { ok: false; error: string };

const ALLOWED = /\.(xlsx|xls|csv)$/i;

/** Số ngày làm việc (T2–T6) trong tháng — dùng làm "ngày công chuẩn" cho bản xem trước mẫu */
function workingDays(month: string) {
  const [y, m] = month.split("-").map(Number);
  let n = 0;
  for (let d = 1; d <= new Date(Date.UTC(y, m, 0)).getUTCDate(); d++) {
    const w = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
    if (w !== 0 && w !== 6) n++;
  }
  return n;
}

/** Số giả lập ổn định theo mã nhân viên + tháng (để bản xem trước không đổi mỗi lần bấm) */
const seeded = (s: string) => [...s].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);

async function guard() {
  const u = await requireUser();
  return isHRM(u) ? u : null;
}

export async function checkAttendanceFile(fd: FormData): Promise<CheckResult> {
  if (!(await guard())) return { ok: false, error: "Chỉ HRM được import chấm công" };
  const month = String(fd.get("month") ?? "");
  const file = fd.get("file");
  if (!applicableMonths().includes(month)) return { ok: false, error: "Chọn tháng cần import" };
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "Chọn file xuất từ FastWork" };
  if (!ALLOWED.test(file.name)) return { ok: false, error: "File phải có định dạng .xlsx, .xls hoặc .csv" };

  const checks: CheckItem[] = [];
  // 1. Thiếu cột — TODO(backend): đọc dòng tiêu đề thật. Hiện giả định file đủ cột.
  checks.push({ level: "ok", title: "Đủ cột bắt buộc", detail: ATTENDANCE_REQUIRED_COLUMNS.join(" · ") });

  // 2. Ngày xuất file sớm hơn cuối tháng.
  //    KHÔNG dùng ngày sửa đổi file trên máy: nhân viên HCNS mở file rà soát trước khi import nên ngày sửa luôn muộn hơn.
  //    TODO(backend): đọc thời gian xuất ở dòng 2 của file bảng công FastWork.
  //    Hiện dùng dữ liệu mẫu: chọn đúng file thật "Netcab 10 2026 Bang cong.xlsx" cho tháng 10/2026 → thời gian xuất
  //    ghi ở dòng 2 của file đó (29/10/2026 10:59, trước khi hết tháng); file khác → 08:30 ngày 2 của tháng sau.
  const [y, m] = month.split("-").map(Number);
  const monthEnd = Date.UTC(y, m, 1) - 7 * 3600_000; // 00:00 ngày đầu tháng sau, giờ Việt Nam
  const realFile = month === ATTENDANCE_FILE_SAMPLE.month && file.name === ATTENDANCE_FILE_SAMPLE.fileName;
  const exportedAt = realFile ? Date.parse(ATTENDANCE_FILE_SAMPLE.exportedAt) : Date.UTC(y, m, 2, 1, 30);
  const exportedLabel = new Date(exportedAt).toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit", year: "numeric" });
  if (exportedAt < monthEnd)
    checks.push({ level: "error", title: "Ngày xuất file sớm hơn cuối tháng", detail: `Thời gian xuất ${exportedLabel}, trước khi hết ${monthLabel(month).toLowerCase()}. Chưa có số liệu những ngày còn lại của tháng, cần xuất lại từ FastWork sau khi hết tháng.` });
  else checks.push({ level: "ok", title: "Ngày xuất file hợp lệ", detail: `Thời gian xuất ${exportedLabel}, sau khi hết tháng.` });

  // 3. Tháng đã import
  const state = monthState(month);
  if (state.status === "LOCKED")
    checks.push({ level: "warning", title: "Tháng đã import và khóa", detail: `${monthLabel(month)} đã import ${state.imports.length} lần. Import lại sẽ ghi đè dữ liệu cũ và bắt buộc nhập lý do.` });
  else checks.push({ level: "ok", title: "Tháng chưa import", detail: monthLabel(month) });

  // 4. Khớp nhân viên theo Họ tên + Phòng ban (file FastWork không có cột Email).
  //    Bản xem trước: nhân viên đang làm; tháng 10/2026 dùng số liệu thật của 3 vị trí HCNS, người khác là số mẫu.
  const people = await db.employee.findMany({
    where: { AND: [companyScope(), { status: "ACTIVE" }] },
    select: { code: true, fullName: true, department: { select: { name: true } } },
    orderBy: { code: "asc" },
  });
  const std = workingDays(month);
  const preview: PreviewRow[] = people.map((p) => {
    const real = month === ATTENDANCE_FILE_SAMPLE.month ? ATTENDANCE_FILE_SAMPLE.rows[p.code] : undefined;
    const base = { code: p.code, name: p.fullName, department: p.department?.name ?? "—", matched: true };
    if (real) return { ...base, days: real.days, hours: real.hours, lateCount: real.lateCount, lateMinutes: real.lateMinutes, earlyCount: real.earlyCount, leave: real.leave, fromFile: true };
    const h = seeded(p.code + month);
    const days = std - (h % 3) * 0.5;
    const lateCount = h % 6;
    return { ...base, days, hours: Math.round(days * 8 * 100) / 100, lateCount, lateMinutes: lateCount * (10 + (h % 20)), earlyCount: h % 3 === 0 ? 1 : 0, leave: h % 7 === 0 ? 1 : 0, fromFile: false };
  });
  preview.push({ code: "—", name: "Nguyễn Thị Mẫu (dòng mẫu)", department: "Dự án", matched: false, days: std, hours: std * 8, lateCount: 0, lateMinutes: 0, earlyCount: 0, leave: 0, fromFile: false });
  const unmatched = preview.filter((r) => !r.matched);
  if (unmatched.length)
    checks.push({ level: "warning", title: `${unmatched.length} dòng không khớp nhân viên trong hệ thống`, detail: `Khớp theo Họ tên + Phòng ban. Các dòng này sẽ bị bỏ qua: ${unmatched.map((r) => `${r.name} (${r.department})`).join(", ")}` });
  else checks.push({ level: "ok", title: "Tất cả dòng khớp nhân viên", detail: "Khớp theo Họ tên + Phòng ban" });

  return { ok: true, month, monthLabel: monthLabel(month), fileName: file.name, exportedAtLabel: exportedLabel, exportedFromFile: realFile, checks, preview, alreadyImported: state.status === "LOCKED", blocked: checks.some((c) => c.level === "error") };
}

export async function commitAttendanceImport(input: { month: string; fileName: string; rows: number; reason: string }): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  const u = await guard();
  if (!u) return { ok: false, error: "Chỉ HRM được import chấm công" };
  if (!applicableMonths().includes(input.month)) return { ok: false, error: "Tháng không hợp lệ" };
  const state = monthState(input.month);
  const reason = input.reason.trim();
  if (state.status === "LOCKED" && !reason) return { ok: false, error: "Tháng đã khóa: bắt buộc nhập lý do import lại" };
  demo.attendance.push({
    id: crypto.randomUUID(),
    month: input.month,
    fileName: input.fileName,
    importedBy: u.employee?.fullName ?? u.email,
    importedAt: nowIso(),
    reason: state.status === "LOCKED" ? reason : null,
    rows: input.rows,
  });
  revalidatePath("/attendance");
  return { ok: true, message: state.status === "LOCKED" ? `Đã import lại ${monthLabel(input.month)} và khóa tháng.` : `Đã import ${monthLabel(input.month)} và khóa tháng.` };
}
