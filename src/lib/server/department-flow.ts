// Luồng theo PHÒNG: bản cuối KPI quý (trưởng phòng gửi HR, không có bước duyệt), bộ KPI của phòng,
// trạng thái "Đã khóa" của phiếu KPI. Trạng thái gửi nằm trong bộ nhớ server (demo-store.ts), KHÔNG ghi database.
// "Đã khóa" của phiếu KPI chỉ SUY RA khi hiển thị, không cập nhật cột status trong database.
import "server-only";
import type { KpiPeriodType, KpiStatus } from "@prisma/client";
import { KPI_SET_DEPARTMENTS } from "@/config/kpi-sets";
import { inQuarter, kpiGrade, periodLabel, provisionalKpi } from "../kpi";
import type { CurrentUser } from "./auth";
import { companyScope, isHRM } from "./access";
import { db } from "./db";
import { demo, SUMMARY_SAMPLES, summaryKey, type KpiSetRecord, type SummaryRecord } from "./demo-store";

// ───────── Đơn vị gửi bảng tổng hợp ─────────

/**
 * Đơn vị = phòng ban tự gửi bảng tổng hợp / tự soạn bộ KPI.
 * Phòng con CÓ trưởng phòng riêng (khác trưởng phòng cha) là đơn vị riêng, tự gửi bảng của mình.
 * Phòng con KHÔNG có trưởng riêng (để trống, hoặc cùng người với phòng cha) được gộp vào phòng cha. (Cơ cấu hiện tại không có phòng con; quy tắc giữ cho trường hợp tạo phòng con sau này.)
 */
export type Unit = { id: string; code: string; name: string; headId: string | null; headName: string | null; headManagerId: string | null; deptIds: string[]; deptNames: string[] };

export async function loadUnits() {
  const depts = await db.department.findMany({
    select: { id: true, code: true, name: true, parentId: true, headId: true, head: { select: { fullName: true, managerId: true, manager: { select: { fullName: true } } } } },
    orderBy: { name: "asc" },
  });
  const byId = new Map(depts.map((d) => [d.id, d]));
  const isOwnUnit = (d: (typeof depts)[number]) => !d.parentId || !byId.has(d.parentId) || (!!d.headId && d.headId !== byId.get(d.parentId)!.headId);
  const unitOfDept = (id: string) => {
    let d = byId.get(id);
    for (let i = 0; d && !isOwnUnit(d) && i < 20; i++) d = byId.get(d.parentId!);
    return d?.id ?? id;
  };
  const units: Unit[] = depts
    .filter(isOwnUnit)
    .map((d) => {
      const members = depts.filter((x) => unitOfDept(x.id) === d.id);
      return { id: d.id, code: d.code, name: d.name, headId: d.headId, headName: d.head?.fullName ?? null, headManagerId: d.head?.managerId ?? null, deptIds: members.map((x) => x.id), deptNames: members.map((x) => x.name) };
    });
  hydrateSummarySamples(units);
  return { units, unitOfDept, byId: new Map(units.map((u) => [u.id, u])) };
}

/** Nạp bản cuối mẫu (SUMMARY_SAMPLES, theo mã phòng) vào bộ nhớ server — 1 lần, khi đã biết ID phòng */
function hydrateSummarySamples(units: Unit[]) {
  if (demo.summariesHydrated) return;
  demo.summariesHydrated = true;
  for (const s of SUMMARY_SAMPLES) {
    const u = units.find((x) => x.code === s.deptCode);
    if (!u || !u.headId || !u.headName || demo.summaries.has(summaryKey(u.id, s.year, s.quarter))) continue;
    demo.summaries.set(summaryKey(u.id, s.year, s.quarter), {
      unitId: u.id, year: s.year, quarter: s.quarter, status: "SENT",
      senderEmployeeId: u.headId, senderName: u.headName, sentAt: s.sentAt,
      log: [{ at: s.sentAt, by: u.headName, action: "Gửi bản cuối cho HR · khóa phiếu KPI trong quý" }],
    });
  }
}

/** Các đơn vị user đang làm trưởng (được gửi bảng tổng hợp / soạn bộ KPI) */
export function unitsHeadedBy(units: Unit[], u: CurrentUser) {
  return units.filter((x) => !!u.employeeId && x.headId === u.employeeId);
}

// ───────── Bản cuối KPI quý ─────────

/** Chọn quý: tham số ?yq=YYYY-Q. Mặc định quý vừa kết thúc (bảng tổng hợp gửi sau khi hết quý). */
export function parseYq(yq: string | undefined) {
  const now = new Date();
  let y = now.getUTCFullYear();
  let q = Math.floor(now.getUTCMonth() / 3); // quý trước (0 = quý 4 năm trước)
  if (q === 0) {
    q = 4;
    y--;
  }
  const m = /^(\d{4})-([1-4])$/.exec(yq ?? "");
  if (m) [y, q] = [Number(m[1]), Number(m[2])];
  const options: { value: string; label: string }[] = [];
  let [oy, oq] = [now.getUTCFullYear(), Math.floor(now.getUTCMonth() / 3) + 1];
  for (let i = 0; i < 6; i++) {
    options.push({ value: `${oy}-${oq}`, label: `Quý ${oq}/${oy}` });
    if (--oq === 0) [oy, oq] = [oy - 1, 4];
  }
  return { year: y, quarter: q, value: `${y}-${q}`, label: `Quý ${q}/${y}`, options };
}

export const quarterOfPlan = (p: { periodType: KpiPeriodType; period: number }) => (p.periodType === "QUARTER" ? p.period : Math.ceil(p.period / 3));
const APPROVED: KpiStatus[] = ["MANAGER_APPROVED", "COMPLETED"];

/** Đã gửi bản cuối (kể cả đang "Cần gửi lại") → khóa phiếu của quý (trừ phiếu HRM đã mở lại) */
export const locksPlans = (rec: SummaryRecord | null | undefined) => !!rec;

export function getSummary(unitId: string, year: number, quarter: number): SummaryRecord | null {
  return demo.summaries.get(summaryKey(unitId, year, quarter)) ?? null;
}

/** Nội dung bảng tổng hợp của 1 đơn vị trong 1 quý — số liệu lấy thật từ phiếu KPI trong database */
export async function loadSummary(unit: Unit, year: number, quarter: number) {
  const record = getSummary(unit.id, year, quarter);
  const employees = await db.employee.findMany({
    where: { AND: [companyScope(), { departmentId: { in: unit.deptIds } }, { status: { not: "RESIGNED" } }] },
    select: { id: true, code: true, fullName: true, position: true, department: { select: { name: true } } },
    orderBy: { fullName: "asc" },
  });
  const plans = (
    await db.kpiPlan.findMany({
      where: { employeeId: { in: employees.map((e) => e.id) }, year },
      select: { id: true, employeeId: true, status: true, periodType: true, year: true, period: true, items: { select: { actual: true, target: true, weight: true, formula: true } } },
      orderBy: [{ periodType: "desc" }, { period: "asc" }],
    })
  ).filter((p) => inQuarter(p, year, quarter));
  const confirmed = locksPlans(record);
  const locked = (p: { id: string; status: KpiStatus }) => p.status === "COMPLETED" || (confirmed && !demo.reopenedPlans.has(p.id));
  const rows = employees.map((e) => {
    const ps = plans.filter((p) => p.employeeId === e.id);
    const k = provisionalKpi(ps.flatMap((p) => p.items));
    return {
      employee: e,
      plans: ps.map((p) => ({ id: p.id, label: periodLabel(p.periodType, p.period, p.year), status: p.status, locked: locked(p), reopened: confirmed && demo.reopenedPlans.has(p.id) })),
      kpi: k,
      grade: k.score === null ? null : kpiGrade(k.score)?.label ?? null,
    };
  });
  const blocking = plans.filter((p) => !APPROVED.includes(p.status)).map((p) => ({ id: p.id, name: employees.find((e) => e.id === p.employeeId)!.fullName, label: periodLabel(p.periodType, p.period, p.year), status: p.status }));
  return { unit, year, quarter, record, rows, blocking, planIds: plans.map((p) => p.id) };
}

/** Ai xem được bảng tổng hợp: trưởng đơn vị và HRM (toàn công ty) */
export function canViewSummary(u: CurrentUser, unit: Unit) {
  return isHRM(u) || (!!unit.headId && unit.headId === u.employeeId);
}

/**
 * Phiếu KPI nào đang "Đã khóa" (chỉ suy ra khi hiển thị):
 * - phiếu COMPLETED cũ trong database, hoặc
 * - bảng tổng hợp của đơn vị + quý chứa phiếu đã được xác nhận, và phiếu chưa được HRM mở lại.
 */
export async function lockedPlanIds(plans: { id: string; employeeId: string; status: KpiStatus; periodType: KpiPeriodType; year: number; period: number }[]): Promise<Set<string>> {
  const out = new Set<string>();
  if (plans.length === 0) return out;
  for (const p of plans) if (p.status === "COMPLETED") out.add(p.id);
  if (demo.summariesHydrated && demo.summaries.size === 0) return out;
  const [{ unitOfDept }, emps] = await Promise.all([loadUnits(), db.employee.findMany({ where: { id: { in: [...new Set(plans.map((p) => p.employeeId))] } }, select: { id: true, departmentId: true } })]);
  const deptOf = new Map(emps.map((e) => [e.id, e.departmentId]));
  for (const p of plans) {
    const dept = deptOf.get(p.employeeId);
    if (!dept || demo.reopenedPlans.has(p.id)) continue;
    if (locksPlans(getSummary(unitOfDept(dept), p.year, quarterOfPlan(p)))) out.add(p.id);
  }
  return out;
}

/** Thông tin khóa của 1 phiếu KPI (trang chi tiết phiếu + action) */
export async function planLock(plan: { id: string; employeeId: string; status: KpiStatus; periodType: KpiPeriodType; year: number; period: number }) {
  const [emp, { unitOfDept, byId }] = await Promise.all([db.employee.findUnique({ where: { id: plan.employeeId }, select: { departmentId: true } }), loadUnits()]);
  const unitId = emp?.departmentId ? unitOfDept(emp.departmentId) : null;
  const quarter = quarterOfPlan(plan);
  const summary = unitId ? getSummary(unitId, plan.year, quarter) : null;
  const reopened = demo.reopenedPlans.has(plan.id);
  const bySummary = locksPlans(summary) && !reopened;
  return { locked: plan.status === "COMPLETED" || bySummary, bySummary, legacy: plan.status === "COMPLETED", summary, unit: unitId ? byId.get(unitId) : undefined, quarter };
}

// ───────── Bộ KPI của phòng ─────────

/** Phòng của 1 bộ KPI; lần đầu lấy từ src/config/kpi-sets.ts */
export function kpiSetOf(t: { id: string; name: string }, units: Unit[]): KpiSetRecord {
  let rec = demo.kpiSets.get(t.id);
  if (!rec) {
    const code = KPI_SET_DEPARTMENTS[t.name];
    const unit = code ? units.find((u) => u.code === code) : undefined;
    rec = { templateId: t.id, unitId: unit?.id ?? null };
    demo.kpiSets.set(t.id, rec);
  }
  return rec;
}

export async function loadKpiSets() {
  const { units, byId, unitOfDept } = await loadUnits();
  const templates = await db.kpiTemplate.findMany({ include: { _count: { select: { items: true, plans: true } } }, orderBy: { name: "asc" } });
  return { units, unitById: byId, unitOfDept, sets: templates.map((t) => ({ template: t, rec: kpiSetOf(t, units) })) };
}

/** Trưởng đơn vị sửa bộ KPI của đơn vị mình bất cứ lúc nào (không có bước duyệt) */
export function canEditKpiSet(u: CurrentUser, rec: KpiSetRecord, unit: Unit | undefined) {
  return !!unit && !!u.employeeId && unit.headId === u.employeeId && rec.unitId === unit.id;
}

/** HRM xem bộ KPI của mọi phòng; trưởng phòng xem bộ của phòng mình */
export function canViewKpiSet(u: CurrentUser, unit: Unit | undefined) {
  return isHRM(u) || (!!unit && unit.headId === u.employeeId);
}
