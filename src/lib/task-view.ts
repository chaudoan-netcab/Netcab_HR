// Dữ liệu hiển thị cho mục Nhiệm vụ (danh sách + chi tiết) — CHỈ ĐỌC, suy ra từ dữ liệu hiện có (không đổi database).
// Nhật ký hệ thống và bình luận đang nằm chung bảng TaskComment; sự kiện hệ thống nhận ra qua câu mở đầu
// mà tasks/actions.ts ghi ("Bắt đầu thực hiện", "Báo cáo hoàn thành: …", "Trả lại: …", "Xác nhận hoàn thành", "Hủy nhiệm vụ").
// TODO(backend): thêm cột loại sự kiện (kind) cho TaskComment để không phải đoán theo câu chữ.
import type { TaskPriority, TaskStatus } from "@prisma/client";
import { diffDays, fmtDate } from "@/lib/dates";
import type { Tone } from "@/lib/labels";

export type EventKind = "assign" | "start" | "submit" | "return" | "approve" | "cancel" | "comment";
export type TaskEvent = { id: string; kind: EventKind; at: Date; by: string; text: string | null };

type RawComment = { id: string; content: string; createdAt: Date; authorName: string };

const RULES: { kind: Exclude<EventKind, "assign" | "comment">; re: RegExp }[] = [
  { kind: "start", re: /^Bắt đầu thực hiện\s*$/ },
  { kind: "submit", re: /^Báo cáo hoàn thành:\s*([\s\S]*)$/ },
  { kind: "return", re: /^Trả lại:\s*([\s\S]*)$/ },
  { kind: "approve", re: /^Xác nhận hoàn thành(?::\s*([\s\S]*))?$/ },
  { kind: "cancel", re: /^Hủy nhiệm vụ(?::\s*([\s\S]*))?$/ },
];

export function buildEvents(task: { id: string; createdAt: Date }, giver: string, assignee: string, comments: RawComment[]): TaskEvent[] {
  const events: TaskEvent[] = [{ id: `assign-${task.id}`, kind: "assign", at: task.createdAt, by: giver, text: assignee }];
  for (const c of comments) {
    const rule = RULES.find((r) => r.re.test(c.content));
    if (rule) {
      const m = c.content.match(rule.re)!;
      events.push({ id: c.id, kind: rule.kind, at: c.createdAt, by: c.authorName, text: m[1]?.trim() || null });
    } else {
      events.push({ id: c.id, kind: "comment", at: c.createdAt, by: c.authorName, text: c.content });
    }
  }
  return events.sort((a, b) => a.at.getTime() - b.at.getTime());
}

/** Bị trả lại = đang làm và lần "Trả lại" gần nhất xảy ra sau lần báo cáo gần nhất */
export function returnedInfo(status: TaskStatus, events: TaskEvent[]): TaskEvent | null {
  if (status !== "IN_PROGRESS") return null;
  const last = [...events].reverse().find((e) => e.kind === "submit" || e.kind === "return");
  return last?.kind === "return" ? last : null;
}

/** Trạng thái hiển thị: thêm "Bị trả lại" (suy ra, không lưu) */
export type ViewStatus = TaskStatus | "RETURNED";
export const viewStatusLabel: Record<ViewStatus, string> = {
  TODO: "Chưa bắt đầu",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Chờ xác nhận",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
  RETURNED: "Bị trả lại",
};
export const viewStatusTone: Record<ViewStatus, Tone> = {
  TODO: "gray",
  IN_PROGRESS: "blue",
  REVIEW: "amber",
  DONE: "green",
  CANCELLED: "gray",
  RETURNED: "red",
};

export const priorityChip: Record<TaskPriority, { label: string; tone: Tone }> = {
  HIGH: { label: "Ưu tiên cao", tone: "red" },
  NORMAL: { label: "Ưu tiên bình thường", tone: "gray" },
  LOW: { label: "Ưu tiên thấp", tone: "gray" },
};

/** Tiền tố nhật ký dùng để suy ra "Bị trả lại" ở trang danh sách (chỉ cần lần báo cáo / trả lại gần nhất) */
export const SUBMIT_PREFIX = "Báo cáo hoàn thành:";
export const RETURN_PREFIX = "Trả lại:";

/** Bị trả lại, tính từ dòng nhật ký báo cáo / trả lại gần nhất (dùng ở danh sách) */
export function isReturned(status: TaskStatus, lastSubmitOrReturn: string | null | undefined) {
  return status === "IN_PROGRESS" && !!lastSubmitOrReturn?.startsWith(RETURN_PREFIX);
}

/**
 * Nhãn hạn — ngày luôn đủ dd/mm/yyyy:
 * bình thường khi còn > 3 ngày, cam khi ≤ 3 ngày hoặc hôm nay, đỏ khi trễ.
 * Việc đã báo cáo đúng hạn (chờ xác nhận) không tính trễ. Việc đã xong / đã hủy chỉ hiện ngày hạn.
 */
export function dueChip(t: { status: TaskStatus; dueDate: Date | null; submittedAt: Date | null }, now: Date): { date: string; note: string | null; label: string; tone: Tone; late: boolean } {
  const make = (date: string, note: string | null, tone: Tone, late = false) => ({ date, note, label: note ? `Hạn ${date} · ${note}` : `Hạn ${date}`, tone, late });
  if (!t.dueDate) return { date: "—", note: null, label: "Không có hạn", tone: "gray", late: false };
  const d = fmtDate(t.dueDate);
  if (t.status === "DONE" || t.status === "CANCELLED") return make(d, null, "gray");
  if (t.status === "REVIEW" && t.submittedAt && t.submittedAt.getTime() < t.dueDate.getTime() + 86_400_000) return make(d, "đã báo cáo đúng hạn", "gray");
  const left = diffDays(now, t.dueDate);
  if (left < 0) return make(d, `Trễ ${-left} ngày`, "red", true);
  if (left === 0) return make(d, "hôm nay", "amber");
  return make(d, `còn ${left} ngày`, left <= 3 ? "amber" : "gray");
}

/** Việc người đang xem cần làm tiếp với nhiệm vụ này (hiện ở danh sách); null = không cần làm gì */
export function nextStep(t: { status: TaskStatus; returned: boolean; isAssignee: boolean; isReviewer: boolean }): string | null {
  if (t.isAssignee) {
    if (t.status === "TODO") return "Cần bắt đầu";
    if (t.status === "IN_PROGRESS") return t.returned ? "Cần báo cáo lại" : "Cần báo cáo";
  }
  if (t.isReviewer && t.status === "REVIEW") return "Chờ bạn xác nhận";
  return null;
}

/** "12/11/2026 09:36" (giờ Việt Nam) — ngày trước, giờ sau, dễ đọc trên dòng thời gian */
const WHEN = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: false });
export function fmtWhen(d: Date | null | undefined): string {
  if (!d) return "—";
  const p = Object.fromEntries(WHEN.formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}
