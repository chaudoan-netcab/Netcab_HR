// Bảng tổng hợp cuối năm: KPI năm (tổng hợp các quý trong năm) + điểm năng lực (phiếu BM1-003)
import "server-only";
import type { JobLevel } from "@prisma/client";
import { db } from "./db";
import { reviewGrade } from "../review-templates";
import { loadYearKpi, emptyYear } from "./kpi-year";

/**
 * Điểm tổng hợp (%) = KPI năm × kpiWeight% + Tỷ lệ năng lực × (100 − kpiWeight)%.
 * Nhân viên chưa có quý KPI nào được duyệt → chỉ lấy điểm năng lực.
 */
export function combine(rate: number | null, kpiAvg: number | null, kpiWeight: number) {
  if (rate === null) return null;
  const score = kpiAvg === null ? rate : Math.round(((kpiAvg * 100 * kpiWeight) / 100 + (rate * (100 - kpiWeight)) / 100) * 100) / 100;
  return { score, grade: reviewGrade(score) };
}

/**
 * Toàn bộ nhân sự của 1 kỳ đánh giá: phiếu đánh giá (nếu có) + KPI năm + điểm tổng hợp.
 * KPI năm = trung bình các phiếu QUÝ đã được quản lý xác nhận trong năm của kỳ (năm của ngày kết thúc kỳ).
 * Người chưa có phiếu đánh giá (VD HRM — cấp cao nhất, không có người chấm) vẫn hiện với KPI năm.
 * group: nhóm đánh giá — Nhân viên (STAFF) / Quản lý (SUPERVISOR).
 */
export async function cycleSummary(cycleId: string, departmentId?: string | null) {
  const cycle = await db.reviewCycle.findUnique({ where: { id: cycleId } });
  if (!cycle) return null;
  const year = cycle.periodEnd.getUTCFullYear();
  const deptWhere = departmentId ? { departmentId } : {};
  const [reviews, others] = await Promise.all([
    db.review.findMany({
      where: { cycleId, ...(departmentId ? { employee: { departmentId } } : {}) },
      include: { employee: { include: { department: true } }, reviewer: true },
    }),
    db.employee.findMany({
      where: { ...deptWhere, status: "ACTIVE", reviews: { none: { cycleId } } },
      include: { department: true },
    }),
  ]);
  const people = [...reviews.map((r) => ({ employee: r.employee, review: r })), ...others.map((e) => ({ employee: e, review: null }))];
  people.sort((a, b) => (a.employee.department?.name ?? "").localeCompare(b.employee.department?.name ?? "", "vi") || a.employee.code.localeCompare(b.employee.code));
  const kpi = await loadYearKpi(people.map((p) => p.employee.id), year);
  const rows = people.map(({ employee, review: r }) => {
    const y = kpi.get(employee.id) ?? emptyYear();
    const group: JobLevel = r?.template ?? employee.jobLevel;
    return {
      employee,
      review: r,
      group,
      year: y,
      kpiAvg: y.avg,
      kpiCount: y.approvedCount,
      final: r ? combine(r.grade ? r.rate : null, y.avg, cycle.kpiWeight) : null,
      /** Lý do chưa có phiếu đánh giá */
      noReview: r ? null : employee.managerId ? "Chưa có phiếu đánh giá" : "Cấp cao nhất · không đánh giá năng lực",
    };
  });
  return { cycle, year, rows };
}
