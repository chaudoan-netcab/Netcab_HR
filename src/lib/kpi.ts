// Cách tính KPI — lấy đúng công thức trong file "20261027 Netcab KPI HR và kho.xlsx"
import type { KpiFormula, KpiPeriodType } from "@prisma/client";
import type { Tone } from "./labels";

/**
 * Mức đạt của 1 chỉ số (0 → 1). Ô "Mức độ thực hiện" để trống được xử lý giống Excel:
 * - Càng cao càng tốt / càng thấp càng tốt: trống = 0 điểm
 * - Kiểu đếm số vụ vi phạm: trống = 0 vụ = đủ điểm
 */
export function itemCompletion(formula: KpiFormula, target: number, actual: number | null): number {
  const a = actual ?? 0;
  switch (formula) {
    case "HIGHER_BETTER": // =H*MIN(1,F/E)
      if (actual === null) return 0;
      if (target <= 0) return 1;
      return Math.max(0, Math.min(1, a / target));
    case "LOWER_BETTER": // =IF(F="",0,IF(F=0,H,H*MIN(1,E/F)))
      if (actual === null) return 0;
      if (a <= 0) return 1;
      return Math.max(0, Math.min(1, target / a));
    case "ZERO_TOLERANCE": // =IF(F=0,H,MAX(0,H-F*(H*0.5)))
      return Math.max(0, 1 - a * 0.5);
    case "VIOLATION_STEPS": // =H*IF(F<=1,1,IF(F=2,0.7,IF(F=3,0.5,0)))
      if (a <= 1) return 1;
      if (a === 2) return 0.7;
      if (a === 3) return 0.5;
      return 0;
  }
}

type ItemLike = { formula: KpiFormula; target: number; actual: number | null; weight: number };

/** % hoàn thành có trọng số của 1 dòng (cột G trong Excel) */
export function itemScore(item: ItemLike): number {
  return item.weight * itemCompletion(item.formula, item.target, item.actual);
}

export function planScore(items: ItemLike[]): number {
  return round4(items.reduce((s, it) => s + itemScore(it), 0));
}

/**
 * % KPI tạm tính — CHỈ tính trên các chỉ số đã có số liệu, chia lại theo tỷ trọng:
 *   % tạm tính = Σ(tỷ trọng × % đạt) / Σ(tỷ trọng), chỉ lấy chỉ số đã cập nhật.
 * Chỉ số chưa nhập không tính là đạt và cũng không kéo % xuống.
 * Luôn hiển thị kèm "updated/total chỉ số đã cập nhật".
 * Dùng chung cho trang Theo dõi & nhắc việc và trang Tổng quan.
 */
export function provisionalKpi(items: ItemLike[]): { score: number | null; updated: number; total: number } {
  const done = items.filter((it) => it.actual !== null);
  const w = done.reduce((s, it) => s + it.weight, 0);
  return {
    score: w > 0 ? round4(done.reduce((s, it) => s + itemScore(it), 0) / w) : null,
    updated: done.length,
    total: items.length,
  };
}

/** Các tháng thuộc quý (1–4) */
export const quarterMonths = (q: number) => [q * 3 - 2, q * 3 - 1, q * 3];

/** Phiếu thuộc quý: phiếu quý đó, hoặc phiếu tháng nằm trong quý */
export function inQuarter(p: { periodType: KpiPeriodType; year: number; period: number }, year: number, q: number) {
  return p.year === year && (p.periodType === "QUARTER" ? p.period === q : quarterMonths(q).includes(p.period));
}

/** Ngày đầu – ngày cuối của kỳ KPI (UTC, 00:00) */
export function periodRange(type: KpiPeriodType, period: number, year: number): { start: Date; end: Date } {
  const firstMonth = type === "QUARTER" ? period * 3 - 2 : period;
  const lastMonth = type === "QUARTER" ? period * 3 : period;
  return { start: new Date(Date.UTC(year, firstMonth - 1, 1)), end: new Date(Date.UTC(year, lastMonth, 0)) };
}

/** Phiếu đã được quản lý duyệt (tính vào KPI năm) */
export const isApprovedPlan = (status: string) => status === "MANAGER_APPROVED" || status === "COMPLETED";

export function totalWeight(items: { weight: number }[]): number {
  return round4(items.reduce((s, it) => s + it.weight, 0));
}

/** Thang xếp loại KPI của Netcab */
export const KPI_GRADES: { min: number; label: string; tone: Tone }[] = [
  { min: 0.9, label: "Hoàn thành tốt", tone: "green" },
  { min: 0.8, label: "Hoàn thành", tone: "blue" },
  { min: 0.6, label: "Cần cải thiện", tone: "amber" },
  { min: 0.5, label: "Trung bình", tone: "amber" },
  { min: 0, label: "Không hoàn thành", tone: "red" },
];

export function kpiGrade(score: number | null | undefined) {
  if (score === null || score === undefined) return null;
  const s = round4(score);
  return KPI_GRADES.find((g) => s >= g.min) ?? KPI_GRADES[KPI_GRADES.length - 1];
}

export function kpiGradeTone(label: string | null | undefined): Tone {
  return KPI_GRADES.find((g) => g.label === label)?.tone ?? "gray";
}

/** Đơn vị "%" lưu dạng 0–1 (giống Excel), hiển thị/nhập dạng 0–100 */
export function toDisplay(unit: string, v: number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return unit.trim() === "%" ? String(round4(v * 100)) : String(v);
}

export function fromInput(unit: string, raw: FormDataEntryValue | null): number | null {
  if (raw === null || typeof raw !== "string" || raw.trim() === "") return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n)) return null;
  return unit.trim() === "%" ? n / 100 : n;
}

export function pct(v: number | null | undefined, digits = 1): string {
  if (v === null || v === undefined) return "—";
  return `${(v * 100).toFixed(digits).replace(/\.0+$/, "")}%`;
}

export function periodLabel(type: KpiPeriodType, period: number, year: number): string {
  return type === "MONTH" ? `Tháng ${period}/${year}` : `Quý ${period}/${year}`;
}

function round4(n: number) {
  return Math.round(n * 10000) / 10000;
}
