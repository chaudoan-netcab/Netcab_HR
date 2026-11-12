// DỮ LIỆU MẪU cho tab "Lịch sử nhắc" và cột "Lần nhắc gần nhất".
// TODO(backend): thay bằng bảng lưu lịch sử nhắc trong database (ghi tại sendReminder trong src/lib/server/reminders.ts).
// Người nhận gắn theo mã nhân viên (MSNV) để khớp với dữ liệu seed.
import { isDeptReminder, type ReminderStatus, type ReminderType } from "./tracking";

export type ReminderLog = {
  id: string;
  senderEmail: string;
  senderName: string;
  recipientCode: string;
  recipientName: string;
  type: ReminderType;
  /** ISO, giờ Việt Nam */
  at: string;
  channel: "Teams";
  status: ReminderStatus;
};

export const REMINDER_SAMPLES: ReminderLog[] = [
  { id: "r06", senderEmail: "nhung.le@netcab.vn", senderName: "Lê Thị Hồng Nhung", recipientCode: "NC004", recipientName: "Nguyễn Văn Hùng", type: "KPI_MONTH", at: "2026-11-08T09:00:00+07:00", channel: "Teams", status: "SENT" },
  { id: "r07", senderEmail: "nhung.le@netcab.vn", senderName: "Lê Thị Hồng Nhung", recipientCode: "NC003", recipientName: "Phạm Thu Trang", type: "CUSTOM", at: "2026-10-28T15:40:00+07:00", channel: "Teams", status: "SENT" },
];

/** Lần nhắc gần nhất gửi tới 1 người (theo MSNV) — chỉ các mẫu nhắc nhân viên */
export function lastReminderFor(code: string) {
  return REMINDER_SAMPLES.filter((r) => r.recipientCode === code && !isDeptReminder(r.type)).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}

/** Lần HRM nhắc Trưởng phòng gần nhất (theo MSNV của Trưởng phòng) */
export function lastDeptReminderFor(headCode: string) {
  return REMINDER_SAMPLES.filter((r) => r.recipientCode === headCode && isDeptReminder(r.type)).sort((a, b) => b.at.localeCompare(a.at))[0] ?? null;
}
