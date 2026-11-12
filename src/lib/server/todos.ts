// "Việc cần làm của tôi": gom việc đang chờ người dùng (nhiệm vụ, đánh giá, KPI, bản cuối KPI quý của phòng, chấm công).
// Hiển thị ở nút "Việc cần làm" trên thanh trên cùng.
import "server-only";
import { diffDays, today } from "../dates";
import { periodLabel, periodRange } from "../kpi";
import type { CurrentUser } from "./auth";
import { isAdmin, isHRM, isManager, teamScope } from "./access";
import { missingAttendanceMonths, monthLabel } from "./attendance";
import { getSummary, loadUnits, parseYq, unitsHeadedBy } from "./department-flow";
import { demo, summaryKey } from "./demo-store";
import { db } from "./db";

export type TodoKind = "task" | "review" | "kpi" | "summary" | "attendance";
export type Todo = { href: string; title: string; meta: string; kind: TodoKind; due: string | null; daysLeft: number | null };

export async function getTodos(user: CurrentUser): Promise<Todo[]> {
  const me = user.employeeId ?? "__none__";
  const now = today();
  if (isAdmin(user)) return []; // Admin không có việc nghiệp vụ
  const hr = isHRM(user);
  const manager = isManager(user);

  const [reviews, kpiMine, kpiApprove, myTasks, tasksToConfirm] = await Promise.all([
    db.review.findMany({
      where: {
        cycle: { status: "OPEN" },
        OR: [
          { employeeId: me, status: { in: ["SELF_REVIEW", "EMPLOYEE_ACK"] } },
          { reviewerId: me, status: "MANAGER_REVIEW" },
          { hodId: me, status: "HOD_APPROVAL" },
        ],
      },
      include: { employee: true, cycle: true },
    }),
    db.kpiPlan.findMany({ where: { employeeId: me, status: "DRAFT" }, include: { items: { select: { actual: true } } } }),
    manager ? db.kpiPlan.findMany({ where: { status: "SUBMITTED", employee: teamScope(user) }, include: { employee: true } }) : [],
    db.task.findMany({ where: { assigneeId: me, status: { in: ["TODO", "IN_PROGRESS"] } }, include: { createdBy: { include: { employee: true } } } }),
    db.task.findMany({ where: { createdById: user.id, status: "REVIEW" }, include: { assignee: true } }),
  ]);

  type Raw = Omit<Todo, "due" | "daysLeft"> & { due?: Date | null };
  const raw: Raw[] = [
    ...myTasks.map((t) => ({ kind: "task" as const, href: `/tasks/${t.id}`, title: t.title, meta: `Nhiệm vụ · Người giao: ${t.createdBy?.employee?.fullName ?? "Quản trị hệ thống"}`, due: t.dueDate })),
    ...tasksToConfirm.map((t) => ({ kind: "task" as const, href: `/tasks/${t.id}`, title: `Xác nhận kết quả: ${t.title}`, meta: `Nhiệm vụ · ${t.assignee.fullName} đã báo cáo hoàn thành`, due: t.dueDate })),
    ...reviews.map((r) => ({
      kind: "review" as const,
      href: `/reviews/${r.id}`,
      due: r.cycle.dueDate,
      title:
        r.employeeId === me
          ? r.status === "SELF_REVIEW"
            ? "Tự đánh giá thành tích"
            : "Xác nhận kết quả đánh giá"
          : r.status === "MANAGER_REVIEW"
            ? `Đánh giá thành tích: ${r.employee.fullName}`
            : `Duyệt phiếu đánh giá (HOD): ${r.employee.fullName}`,
      meta: r.cycle.name,
    })),
    // KPI: nhân viên tự cập nhật tiến độ bất cứ lúc nào; nhắc khi kỳ đã bắt đầu (hạn = cuối kỳ) hoặc khi quản lý bấm "Nhắc cập nhật"
    ...kpiMine.flatMap((p) => {
      const r = periodRange(p.periodType, p.period, p.year);
      if (r.start > now) return [];
      const reminder = demo.kpiReminders.get(p.id);
      const filled = p.items.filter((i) => i.actual !== null).length;
      const ended = r.end < now;
      return [{
        kind: "kpi" as const,
        href: `/kpi/${p.id}`,
        title: reminder ? `${reminder.by} nhắc cập nhật KPI ${periodLabel(p.periodType, p.period, p.year)}` : ended ? `Gửi kết quả KPI ${periodLabel(p.periodType, p.period, p.year)}` : `Cập nhật tiến độ KPI ${periodLabel(p.periodType, p.period, p.year)}`,
        meta: `${filled}/${p.items.length} chỉ số có số liệu${ended ? " · đã hết kỳ" : ""}`,
        due: r.end,
      }];
    }),
    ...kpiApprove.map((p) => ({ kind: "kpi" as const, href: `/kpi/${p.id}`, title: `Xác nhận kết quả KPI: ${p.employee.fullName}`, meta: periodLabel(p.periodType, p.period, p.year) })),
  ];
  // Trưởng phòng: gửi bản cuối KPI quý vừa kết thúc cho HR (HR không duyệt), hoặc gửi lại khi HRM mở lại phiếu
  if (manager) {
    const { units } = await loadUnits();
    const q = parseYq(undefined); // quý vừa kết thúc
    for (const u of unitsHeadedBy(units, user)) {
      const rec = getSummary(u.id, q.year, q.quarter);
      if (rec?.status === "SENT") continue;
      const hrNote = demo.headReminders.get(summaryKey(u.id, q.year, q.quarter));
      raw.push({
        kind: "summary",
        href: `/kpi/summary/${u.id}?yq=${q.value}`,
        title: rec?.status === "REOPENED" ? `Gửi lại bản cuối KPI ${q.label}: ${u.name}` : `Gửi bản cuối KPI ${q.label} cho HR: ${u.name}`,
        meta: rec?.status === "REOPENED" ? "HRM đã mở lại phiếu · xác nhận lại rồi gửi lại" : hrNote ? `${hrNote.by} (HR) đã nhắc gửi` : "Đã hết quý",
      });
    }
  }
  if (hr) {
    const missing = missingAttendanceMonths();
    if (missing.length) raw.push({ kind: "attendance", href: "/attendance", title: `Tháng chưa import chấm công: ${missing.length}`, meta: missing.map(monthLabel).join(", ") });
  }

  raw.sort((a, b) => (a.due?.getTime() ?? Infinity) - (b.due?.getTime() ?? Infinity));
  return raw.map((t) => ({ ...t, due: t.due ? t.due.toISOString() : null, daysLeft: t.due ? diffDays(now, t.due) : null }));
}
