// KPI năm = tổng hợp các QUÝ trong năm: trung bình điểm các phiếu quý đã được quản lý xác nhận.
// Dùng chung cho: KPI cá nhân, Phiếu KPI nhân viên (xem theo năm), bảng tổng hợp cuối năm.
import "server-only";
import type { KpiStatus } from "@prisma/client";
import { isApprovedPlan } from "../kpi";
import { db } from "./db";

export type QuarterCell = {
  planId: string;
  status: KpiStatus;
  /** Điểm chính thức (phiếu đã gửi) hoặc điểm đang nhập */
  score: number | null;
  grade: string | null;
  approved: boolean;
  updated: number;
  total: number;
};

export type YearKpi = {
  /** Q1..Q4, null = chưa giao phiếu quý đó */
  quarters: (QuarterCell | null)[];
  /** Trung bình các quý đã xác nhận; null nếu chưa có quý nào */
  avg: number | null;
  approvedCount: number;
};

export const emptyYear = (): YearKpi => ({ quarters: [null, null, null, null], avg: null, approvedCount: 0 });

/** KPI năm của nhiều nhân viên. Chỉ lấy phiếu theo QUÝ của năm đó. */
export async function loadYearKpi(employeeIds: string[], year: number): Promise<Map<string, YearKpi>> {
  const plans = await db.kpiPlan.findMany({
    where: { employeeId: { in: employeeIds }, year, periodType: "QUARTER" },
    select: { id: true, employeeId: true, period: true, status: true, score: true, grade: true, items: { select: { actual: true } } },
  });
  const out = new Map<string, YearKpi>(employeeIds.map((id) => [id, emptyYear()]));
  for (const p of plans) {
    const y = out.get(p.employeeId)!;
    y.quarters[p.period - 1] = {
      planId: p.id,
      status: p.status,
      score: p.score,
      grade: p.grade,
      approved: isApprovedPlan(p.status),
      updated: p.items.filter((i) => i.actual !== null).length,
      total: p.items.length,
    };
  }
  for (const y of out.values()) {
    const done = y.quarters.filter((q): q is QuarterCell => !!q && q.approved && q.score !== null);
    y.approvedCount = done.length;
    y.avg = done.length ? Math.round((done.reduce((s, q) => s + q.score!, 0) / done.length) * 10000) / 10000 : null;
  }
  return out;
}
