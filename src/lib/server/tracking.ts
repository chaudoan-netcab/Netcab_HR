// Nạp dữ liệu cho bảng "Theo dõi & nhắc việc": mỗi dòng 1 người trong phạm vi quản lý
import "server-only";
import type { Prisma } from "@prisma/client";
import { DEPT_TRACKING_THRESHOLDS as DT, TRACKING_THRESHOLDS as T } from "@/config/tracking";
import { diffDays, fmtDate, today } from "../dates";
import { inQuarter, periodLabel, provisionalKpi } from "../kpi";
import { kpiStatusView } from "../labels";
import { lastDeptReminderFor, lastReminderFor } from "../reminder-samples";
import { fmtPct, type DeptRow, type SummaryStatusKey, type TrackRow } from "../tracking";
import type { CurrentUser } from "./auth";
import { companyScope, teamScope } from "./access";
import { getSummary, loadUnits, lockedPlanIds } from "./department-flow";
import { db } from "./db";

/** Tiền tố dòng nhật ký do hệ thống ghi khi người giao trả lại nhiệm vụ (xem src/app/(app)/tasks/actions.ts) */
export const RETURN_LOG_PREFIX = "Trả lại:";

/** company: HRM đang xem "Toàn công ty" (công tắc trên trang); ngược lại dùng phạm vi Quản lý */
export type TrackFilter = { year: number; quarter: number; company: boolean; employeeId?: string };

export const currentQuarter = () => {
  const now = today();
  return { year: now.getUTCFullYear(), quarter: Math.floor(now.getUTCMonth() / 3) + 1 };
};

const open = (s: string) => s === "TODO" || s === "IN_PROGRESS";

/** Nhiệm vụ thuộc quý: hạn trong quý; không có hạn thì theo ngày giao; quý hiện tại thì cộng thêm việc quá hạn từ quý trước chưa xong */
export function quarterTaskFilter(year: number, quarter: number) {
  const qStart = new Date(Date.UTC(year, quarter * 3 - 3, 1));
  const qEnd = new Date(Date.UTC(year, quarter * 3, 1));
  const cur = currentQuarter();
  const isCurrent = cur.year === year && cur.quarter === quarter;
  const inQ = (d: Date) => d >= qStart && d < qEnd;
  return (t: { status: string; dueDate: Date | null; createdAt: Date }) => (t.dueDate ? inQ(t.dueDate) || (isCurrent && open(t.status) && t.dueDate < qStart) : inQ(t.createdAt));
}

/** Chi tiết 1 người cho trang /follow-ups/people/[id]: danh sách việc và phiếu KPI trong quý */
export async function loadPersonDetail(user: CurrentUser, employeeId: string, year: number, quarter: number, company: boolean) {
  const [row] = await loadTracking(user, { year, quarter, employeeId, company });
  if (!row) return null;
  const qStart = new Date(Date.UTC(year, quarter * 3 - 3, 1));
  const qEnd = new Date(Date.UTC(year, quarter * 3, 1));
  const [tasks, plans] = await Promise.all([
    db.task.findMany({
      where: { assigneeId: employeeId, status: { not: "CANCELLED" } },
      include: {
        createdBy: { include: { employee: { select: { fullName: true } } } },
        // TODO(backend): thay bằng cột đếm số lần trả lại trên Task
        comments: { where: { content: { startsWith: RETURN_LOG_PREFIX }, createdAt: { gte: qStart, lt: qEnd } }, select: { id: true } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
    }),
    db.kpiPlan.findMany({ where: { employeeId, year }, include: { items: { orderBy: { sortOrder: "asc" } } }, orderBy: [{ periodType: "desc" }, { period: "asc" }] }),
  ]);
  const inQuarterTask = quarterTaskFilter(year, quarter);
  return { row, tasks: tasks.filter(inQuarterTask), plans: plans.filter((p) => inQuarter(p, year, quarter)) };
}

export async function loadTracking(user: CurrentUser, f: TrackFilter): Promise<TrackRow[]> {
  const now = today();
  const qStart = new Date(Date.UTC(f.year, f.quarter * 3 - 3, 1));
  const qEnd = new Date(Date.UTC(f.year, f.quarter * 3, 1)); // không gồm
  const cur = currentQuarter();
  const curMonth = now.getUTCMonth() + 1;

  const where: Prisma.EmployeeWhereInput = {
    AND: [
      // HRM "Toàn công ty": mọi nhân viên (kể cả bản thân, để tính đủ số liệu của phòng);
      // "Phòng tôi" / Quản lý: managerScope dùng chung toàn app, trừ bản thân
      f.company ? companyScope() : teamScope(user),
      { status: { not: "RESIGNED" } },
      f.employeeId ? { id: f.employeeId } : {},
    ],
  };
  const people = await db.employee.findMany({
    where,
    select: { id: true, code: true, fullName: true, position: true, departmentId: true, department: { select: { name: true } }, manager: { select: { id: true, fullName: true } } },
    orderBy: { fullName: "asc" },
  });
  const ids = people.map((p) => p.id);
  if (ids.length === 0) return [];

  const [tasks, returns, plans] = await Promise.all([
    db.task.findMany({ where: { assigneeId: { in: ids }, status: { not: "CANCELLED" } }, select: { assigneeId: true, title: true, status: true, dueDate: true, createdAt: true } }),
    // TODO(backend): thay bằng cột đếm số lần trả lại trên Task. Hiện đếm dòng nhật ký "Trả lại:" trong quý.
    db.taskComment.findMany({
      where: { content: { startsWith: RETURN_LOG_PREFIX }, createdAt: { gte: qStart, lt: qEnd }, task: { assigneeId: { in: ids } } },
      select: { task: { select: { assigneeId: true } } },
    }),
    db.kpiPlan.findMany({
      where: { employeeId: { in: ids }, year: { in: [...new Set([f.year, now.getUTCFullYear()])] } },
      select: { id: true, employeeId: true, periodType: true, period: true, year: true, status: true, items: { select: { name: true, actual: true, target: true, weight: true, formula: true, sortOrder: true }, orderBy: { sortOrder: "asc" } } },
    }),
  ]);

  const taskInQuarter = quarterTaskFilter(f.year, f.quarter);
  const locked = await lockedPlanIds(plans);

  return people.map((p) => {
    const mine = tasks.filter((t) => t.assigneeId === p.id && taskInQuarter(t));
    const overdueTasks = mine
      .filter((t) => open(t.status) && t.dueDate && t.dueDate < now)
      .sort((a, b) => a.dueDate!.getTime() - b.dueDate!.getTime())
      .map((t) => ({ title: t.title, due: fmtDate(t.dueDate), daysLate: diffDays(t.dueDate!, now) }));
    const returned = returns.filter((r) => r.task.assigneeId === p.id).length;

    const qPlans = plans.filter((x) => x.employeeId === p.id && inQuarter(x, f.year, f.quarter));
    const kpi = provisionalKpi(qPlans.flatMap((x) => x.items));
    // Trạng thái phiếu: ưu tiên phiếu quý, không có thì phiếu tháng gần nhất trong quý
    const shown = qPlans.find((x) => x.periodType === "QUARTER") ?? qPlans.filter((x) => x.periodType === "MONTH").sort((a, b) => b.period - a.period)[0];

    // Phiếu "tháng này" để nhắc cập nhật: phiếu tháng hiện tại, không có thì phiếu quý hiện tại
    const monthPlan =
      plans.find((x) => x.employeeId === p.id && x.year === now.getUTCFullYear() && x.periodType === "MONTH" && x.period === curMonth) ??
      plans.find((x) => x.employeeId === p.id && x.year === cur.year && x.periodType === "QUARTER" && x.period === cur.quarter);

    const reasons: string[] = [];
    if (kpi.score !== null && kpi.score < T.kpiBelow) reasons.push(`KPI tạm tính ${fmtPct(kpi.score)} < ${Math.round(T.kpiBelow * 100)}%`);
    if (overdueTasks.length >= T.overdueAtLeast) reasons.push(`${overdueTasks.length} việc quá hạn`);
    if (returned >= T.returnedAtLeast) reasons.push(`${returned} lần bị trả lại`);

    const last = lastReminderFor(p.code);
    return {
      id: p.id,
      code: p.code,
      name: p.fullName,
      position: p.position,
      departmentId: p.departmentId,
      department: p.department?.name ?? null,
      managerId: p.manager?.id ?? null,
      managerName: p.manager?.fullName ?? null,
      active: mine.filter((t) => open(t.status)).length,
      overdue: overdueTasks.length,
      waiting: mine.filter((t) => t.status === "REVIEW").length,
      returned,
      kpi,
      plan: shown ? { id: shown.id, period: periodLabel(shown.periodType, shown.period, shown.year), status: shown.status, statusLabel: kpiStatusView(shown.status, locked.has(shown.id)).label, tone: kpiStatusView(shown.status, locked.has(shown.id)).tone } : null,
      lastReminder: last ? { at: last.at, type: last.type } : null,
      reasons,
      overdueTasks,
      missingKpi: monthPlan ? { period: periodLabel(monthPlan.periodType, monthPlan.period, monthPlan.year), items: monthPlan.items.filter((i) => i.actual === null).map((i) => i.name) } : null,
      submitPlan: shown ? { period: periodLabel(shown.periodType, shown.period, shown.year), statusLabel: kpiStatusView(shown.status, locked.has(shown.id)).label, isDraft: shown.status === "DRAFT" } : null,
    };
  });
}

/**
 * Bảng theo phòng ban (HRM, chế độ "Toàn công ty"): mỗi dòng 1 đơn vị có trưởng phòng riêng
 * (phòng con không có trưởng riêng gộp vào phòng cha — cùng quy tắc với bảng tổng hợp).
 * Trả về cả dòng nhân viên để dùng cho trang chi tiết phòng.
 */
export async function loadDeptTracking(user: CurrentUser, year: number, quarter: number) {
  const [people, { units, unitOfDept }] = await Promise.all([loadTracking(user, { year, quarter, company: true }), loadUnits()]);
  const heads = await db.employee.findMany({ where: { id: { in: units.map((u) => u.headId).filter((x): x is string => !!x) } }, select: { id: true, code: true } });
  const headCode = new Map(heads.map((h) => [h.id, h.code]));
  const cur = currentQuarter();
  const ended = year < cur.year || (year === cur.year && quarter < cur.quarter);
  const unitOfPerson = (r: TrackRow) => (r.departmentId ? unitOfDept(r.departmentId) : null);

  const rows: DeptRow[] = units
    .map((u) => {
      const members = people.filter((r) => unitOfPerson(r) === u.id);
      const scored = members.filter((r) => r.kpi.score !== null);
      const score = scored.length ? scored.reduce((n, r) => n + r.kpi.score!, 0) / scored.length : null;
      const withPlans = members.filter((r) => r.kpi.total > 0);
      const attentionPeople = members.filter((r) => r.reasons.length > 0).length;
      const summary: SummaryStatusKey = getSummary(u.id, year, quarter)?.status ?? "NONE";
      const hot = {
        kpi: score !== null && score < DT.deptKpiBelow,
        attention: members.length > 0 && attentionPeople / members.length >= DT.deptAttentionRatio,
        summary: ended && summary === "NONE",
      };
      const reasons: string[] = [];
      if (hot.kpi) reasons.push(`KPI tạm tính phòng ${fmtPct(score!)} < ${Math.round(DT.deptKpiBelow * 100)}%`);
      if (hot.attention) reasons.push(`${attentionPeople}/${members.length} người cần chú ý (≥ ${Math.round(DT.deptAttentionRatio * 100)}%)`);
      if (hot.summary) reasons.push(`Đã hết quý ${quarter}/${year}, chưa gửi bản cuối`);
      const last = u.headId && headCode.get(u.headId) ? lastDeptReminderFor(headCode.get(u.headId)!) : null;
      return {
        id: u.id,
        name: u.name,
        deptNames: u.deptNames,
        headId: u.headId,
        headName: u.headName,
        members: members.length,
        kpi: { score, updatedPeople: withPlans.filter((r) => r.kpi.updated === r.kpi.total).length, totalPeople: withPlans.length },
        overdue: members.reduce((n, r) => n + r.overdue, 0),
        notUpdated: withPlans.filter((r) => r.kpi.updated < r.kpi.total).length,
        attentionPeople,
        summary,
        lastReminder: last ? { at: last.at, type: last.type } : null,
        reasons,
        hot,
      };
    })
    .filter((r) => r.members > 0);
  return { rows, people, unitOfPerson };
}
