// Theo dõi & nhắc việc — kiểu dữ liệu và mẫu nội dung nhắc (dùng chung server + trình duyệt, không truy cập DB)
import type { KpiStatus } from "@prisma/client";
import { summaryStatusLabel, type Tone } from "./labels";

/** Mẫu nhắc nhân viên (Quản lý; HRM ở "Phòng tôi") và mẫu nhắc Trưởng phòng (HRM ở "Toàn công ty") */
export type PersonReminderType = "OVERDUE" | "KPI_MONTH" | "KPI_SUBMIT" | "CUSTOM";
export type DeptReminderType = "DEPT_SUMMARY" | "DEPT_PUSH" | "DEPT_CUSTOM";
export type ReminderType = PersonReminderType | DeptReminderType;

export const REMINDER_LABEL: Record<ReminderType, string> = {
  OVERDUE: "Nhắc việc quá hạn",
  KPI_MONTH: "Nhắc cập nhật KPI tháng này",
  KPI_SUBMIT: "Nhắc gửi duyệt phiếu KPI quý",
  CUSTOM: "Nội dung tùy chỉnh",
  DEPT_SUMMARY: "Nhắc gửi bản cuối KPI quý",
  DEPT_PUSH: "Nhắc đôn đốc phòng",
  DEPT_CUSTOM: "Nội dung tùy chỉnh (gửi Trưởng phòng)",
};

export const PERSON_REMINDER_TYPES: PersonReminderType[] = ["OVERDUE", "KPI_MONTH", "KPI_SUBMIT", "CUSTOM"];
export const DEPT_REMINDER_TYPES: DeptReminderType[] = ["DEPT_SUMMARY", "DEPT_PUSH", "DEPT_CUSTOM"];
export const isDeptReminder = (t: ReminderType): t is DeptReminderType => (DEPT_REMINDER_TYPES as ReminderType[]).includes(t);

export type ReminderStatus = "SENT" | "FAILED";
export const REMINDER_STATUS_LABEL: Record<ReminderStatus, string> = { SENT: "Đã gửi", FAILED: "Lỗi" };
export const REMINDER_STATUS_TONE: Record<ReminderStatus, Tone> = { SENT: "green", FAILED: "red" };

/** 1 dòng của bảng theo dõi */
export type TrackRow = {
  id: string;
  code: string;
  name: string;
  position: string | null;
  departmentId: string | null;
  department: string | null;
  managerId: string | null;
  managerName: string | null;
  /** Việc đang làm (Chưa bắt đầu + Đang làm) */
  active: number;
  overdue: number;
  /** Chờ người giao xác nhận */
  waiting: number;
  /** Số lần bị trả lại trong quý */
  returned: number;
  kpi: { score: number | null; updated: number; total: number };
  /** Trạng thái phiếu KPI của quý: phiếu quý, nếu không có thì phiếu tháng gần nhất trong quý */
  plan: { id: string; period: string; status: KpiStatus; statusLabel: string; tone: Tone } | null;
  lastReminder: { at: string; type: ReminderType } | null;
  /** Lý do "Cần chú ý" (rỗng = bình thường) */
  reasons: string[];
  // ── Dữ liệu tự điền vào mẫu nhắc ──
  overdueTasks: { title: string; due: string; daysLate: number }[];
  /** Phiếu KPI tháng hiện tại (không có thì phiếu quý hiện tại): các chỉ số chưa cập nhật */
  missingKpi: { period: string; items: string[] } | null;
  /** Phiếu KPI quý đang xem cần gửi duyệt (null = không có phiếu) */
  submitPlan: { period: string; statusLabel: string; isDraft: boolean } | null;
};

export type ReminderMessage = { recipientId: string; recipientName: string; about: string[]; body: string };

const greet = (name: string) => `Chào ${name.split(" ").pop()},`;

/**
 * Tạo nội dung nhắc nhân viên theo mẫu: mỗi người được chọn nhận 1 tin.
 * Người không có dữ liệu phù hợp được đưa vào danh sách bỏ qua.
 */
export function buildReminders(type: PersonReminderType, rows: TrackRow[], ctx: { quarterLabel: string; sender: string }) {
  const messages: ReminderMessage[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const sign = `\n\nTrân trọng,\n${ctx.sender}`;

  for (const r of rows) {
    if (type === "OVERDUE") {
      if (r.overdueTasks.length === 0) {
        skipped.push({ name: r.name, reason: "không có việc quá hạn" });
        continue;
      }
      const lines = r.overdueTasks.map((t) => `- ${t.title} (hạn ${t.due}, quá hạn ${t.daysLate} ngày)`);
      messages.push({ recipientId: r.id, recipientName: r.name, about: [r.name], body: `${greet(r.name)}\n\nHiện có ${r.overdueTasks.length} việc đã quá hạn:\n${lines.join("\n")}\n\nĐề nghị cập nhật tiến độ hoặc báo cáo hoàn thành trong hôm nay.${sign}` });
    } else if (type === "KPI_MONTH") {
      if (!r.missingKpi || r.missingKpi.items.length === 0) {
        skipped.push({ name: r.name, reason: r.missingKpi ? "đã cập nhật đủ chỉ số" : "chưa có phiếu KPI tháng này" });
        continue;
      }
      const lines = r.missingKpi.items.map((n) => `- ${n}`);
      messages.push({ recipientId: r.id, recipientName: r.name, about: [r.name], body: `${greet(r.name)}\n\nPhiếu KPI ${r.missingKpi.period} còn ${r.missingKpi.items.length} chỉ số chưa cập nhật số liệu:\n${lines.join("\n")}\n\nĐề nghị cập nhật trước ngày làm việc cuối cùng của tháng.${sign}` });
    } else if (type === "KPI_SUBMIT") {
      if (!r.submitPlan || !r.submitPlan.isDraft) {
        skipped.push({ name: r.name, reason: r.submitPlan ? `phiếu đã ở bước “${r.submitPlan.statusLabel}”` : "chưa có phiếu KPI trong quý" });
        continue;
      }
      messages.push({ recipientId: r.id, recipientName: r.name, about: [r.name], body: `${greet(r.name)}\n\nPhiếu KPI ${r.submitPlan.period} hiện ở trạng thái “${r.submitPlan.statusLabel}” (${r.kpi.updated}/${r.kpi.total} chỉ số đã cập nhật). Đề nghị cập nhật đủ số liệu và gửi báo cáo cuối kỳ cho quản lý trực tiếp.${sign}` });
    } else {
      messages.push({ recipientId: r.id, recipientName: r.name, about: [r.name], body: `${greet(r.name)}\n\n${sign}` });
    }
  }
  return { messages, skipped };
}

export const fmtPct = (v: number) => `${String(Math.round(v * 1000) / 10).replace(".", ",")}%`;

// ───────── Bảng theo phòng ban (HRM, chế độ "Toàn công ty") ─────────

export type SummaryStatusKey = keyof typeof summaryStatusLabel;

/** 1 dòng của bảng theo phòng ban = 1 đơn vị có trưởng phòng riêng (phòng con không có trưởng riêng gộp vào phòng cha) */
export type DeptRow = {
  id: string;
  name: string;
  /** Các phòng ban gộp trong đơn vị (nếu có phòng con) */
  deptNames: string[];
  headId: string | null;
  headName: string | null;
  members: number;
  /** KPI tạm tính phòng = trung bình KPI tạm tính của các NV đã có số liệu */
  kpi: { score: number | null; updatedPeople: number; totalPeople: number };
  overdue: number;
  /** Số người còn chỉ số KPI chưa cập nhật */
  notUpdated: number;
  attentionPeople: number;
  summary: SummaryStatusKey;
  lastReminder: { at: string; type: ReminderType } | null;
  /** Lý do "Cần chú ý" của phòng (rỗng = bình thường) */
  reasons: string[];
  /** Ô vượt ngưỡng cần tô đỏ */
  hot: { kpi: boolean; attention: boolean; summary: boolean };
};

/**
 * Tạo nội dung nhắc Trưởng phòng. Người nhận luôn là Trưởng phòng của dòng được chọn;
 * nhiều phòng cùng 1 Trưởng phòng được gộp thành 1 tin.
 */
export function buildDeptReminders(type: DeptReminderType, rows: DeptRow[], ctx: { quarterLabel: string; sender: string }) {
  const messages: ReminderMessage[] = [];
  const skipped: { name: string; reason: string }[] = [];
  const sign = `\n\nTrân trọng,\n${ctx.sender}`;
  const byHead = new Map<string, { name: string; rows: DeptRow[] }>();
  for (const r of rows) {
    if (!r.headId || !r.headName) {
      skipped.push({ name: r.name, reason: "chưa có trưởng phòng" });
      continue;
    }
    if (type === "DEPT_SUMMARY" && r.summary === "SENT") {
      skipped.push({ name: r.name, reason: `bản cuối ${summaryStatusLabel[r.summary].toLowerCase()}` });
      continue;
    }
    const g = byHead.get(r.headId) ?? { name: r.headName, rows: [] };
    g.rows.push(r);
    byHead.set(r.headId, g);
  }
  for (const [headId, g] of byHead) {
    const depts = g.rows.map((r) => r.name);
    let body: string;
    if (type === "DEPT_SUMMARY") {
      const lines = g.rows.map((r) => `- ${r.name}: ${summaryStatusLabel[r.summary].toLowerCase()}`);
      body = `${greet(g.name)}\n\nĐề nghị anh/chị rà soát và gửi bản cuối KPI ${ctx.quarterLabel} cho HR:\n${lines.join("\n")}${sign}`;
    } else if (type === "DEPT_PUSH") {
      const lines = g.rows.map((r) => `- ${r.name}: ${r.notUpdated} người chưa cập nhật KPI, ${r.overdue} việc quá hạn, ${r.attentionPeople} người cần chú ý`);
      body = `${greet(g.name)}\n\nTình hình ${ctx.quarterLabel} của phòng:\n${lines.join("\n")}\n\nĐề nghị anh/chị đôn đốc nhân viên cập nhật KPI và xử lý các việc quá hạn.${sign}`;
    } else {
      body = `${greet(g.name)}\n\n${sign}`;
    }
    messages.push({ recipientId: headId, recipientName: g.name, about: depts, body });
  }
  return { messages, skipped };
}
