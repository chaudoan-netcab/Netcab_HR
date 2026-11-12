"use client";

import { useState } from "react";
import type { KpiFormula } from "@prisma/client";
import { itemCompletion, kpiGrade, pct, toDisplay } from "@/lib/kpi";

export type EntryItem = {
  id: string;
  section: string;
  name: string;
  measurement: string | null;
  unit: string;
  target: number;
  actual: number | null;
  weight: number;
  formula: KpiFormula;
  formulaLabel: string;
  note: string | null;
  /** Chỉ số thêm riêng cho người này (không có trong bộ KPI của phòng) */
  custom?: boolean;
};

const gradeColor: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  blue: "bg-brand-50 text-brand-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  gray: "bg-slate-100 text-slate-700",
  violet: "bg-violet-50 text-violet-700",
};

/** Bảng KPI giống file Excel, tự tính % hoàn thành khi gõ "Mức độ thực hiện" */
export function KpiEntryTable({ items, editable }: { items: EntryItem[]; editable: boolean }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(items.map((i) => [i.id, toDisplay(i.unit, i.actual)])));

  const actualOf = (i: EntryItem): number | null => {
    const raw = values[i.id];
    if (raw === undefined || raw.trim() === "") return null;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n)) return null;
    return i.unit.trim() === "%" ? n / 100 : n;
  };
  const scored = items.map((i) => ({ i, completion: itemCompletion(i.formula, i.target, actualOf(i)) }));
  const total = scored.reduce((s, x) => s + x.i.weight * x.completion, 0);
  const totalWeight = items.reduce((s, i) => s + i.weight, 0);
  const grade = kpiGrade(total);
  const sections = [...new Set(items.map((i) => i.section))];
  let stt = 0;

  return (
    <div className="overflow-x-auto">
      <table className="table min-w-[900px]">
        <thead>
          <tr>
            <th className="w-10">STT</th>
            <th>Tên chỉ số KPI</th>
            <th className="w-16">Đơn vị</th>
            <th className="w-20 text-right">Chỉ tiêu</th>
            <th className="w-32">Mức độ thực hiện</th>
            <th className="w-24 text-right">% hoàn thành</th>
            <th className="w-20 text-right">Tỉ trọng</th>
          </tr>
        </thead>
        <tbody>
          {sections.map((sec) => (
            <SectionRows key={sec} title={sec}>
              {scored
                .filter((x) => x.i.section === sec)
                .map(({ i, completion }) => {
                  stt++;
                  const isPct = i.unit.trim() === "%";
                  return (
                    <tr key={i.id}>
                      <td className="tabular-nums text-slate-500">{stt}</td>
                      <td>
                        <div className="font-medium text-slate-800">
                          {i.name}
                          {i.custom && <span className="ml-2 inline-block rounded bg-violet-50 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase text-violet-700">Riêng</span>}
                        </div>
                        {i.measurement && <div className="mt-0.5 text-xs text-slate-500">{i.measurement}</div>}
                        <div className="mt-1 text-[11px] text-slate-400">
                          Cách tính: {i.formulaLabel}
                          {i.note && <> · {i.note}</>}
                        </div>
                      </td>
                      <td>{i.unit}</td>
                      <td className="text-right tabular-nums">{isPct ? pct(i.target, 0) : i.target}</td>
                      <td>
                        {editable ? (
                          <div>
                            <div className="flex items-center gap-1">
                              <input
                                name={`actual_${i.id}`}
                                data-kpi-name={i.name}
                                value={values[i.id] ?? ""}
                                onChange={(ev) => setValues((v) => ({ ...v, [i.id]: ev.target.value }))}
                                inputMode="decimal"
                                aria-invalid={!(values[i.id] ?? "").trim() || undefined}
                                className={`input w-20 text-right tabular-nums ${(values[i.id] ?? "").trim() ? "" : "border-amber-300 bg-amber-50/40"}`}
                              />
                              <span className="text-xs text-slate-500">{isPct ? "%" : i.unit}</span>
                            </div>
                            {/* Ô trống không được tính là 0 vụ: phải nhập 0 thì mới gửi được */}
                            {!(values[i.id] ?? "").trim() && (i.formula === "VIOLATION_STEPS" || i.formula === "ZERO_TOLERANCE") && (
                              <div className="mt-0.5 text-[10px] leading-tight text-amber-700">Nhập 0 nếu không có vụ</div>
                            )}
                          </div>
                        ) : (
                          <span className="tabular-nums">{values[i.id] ? `${values[i.id]}${isPct ? "%" : ` ${i.unit}`}` : "—"}</span>
                        )}
                      </td>
                      <td className="text-right tabular-nums">
                        <div className="font-semibold">{pct(i.weight * completion)}</div>
                        <div className="text-[11px] text-slate-400">đạt {pct(completion, 0)}</div>
                      </td>
                      <td className="text-right tabular-nums">{pct(i.weight, 0)}</td>
                    </tr>
                  );
                })}
            </SectionRows>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-slate-50 font-semibold">
            <td colSpan={5} className="px-3 py-3 text-right">TỔNG</td>
            <td className="px-3 py-3 text-right text-base tabular-nums text-slate-900">{pct(total)}</td>
            <td className={`px-3 py-3 text-right tabular-nums ${Math.abs(totalWeight - 1) > 0.0001 ? "text-red-600" : ""}`}>{pct(totalWeight, 0)}</td>
          </tr>
          <tr>
            <td colSpan={5} className="px-3 py-3 text-right text-sm font-semibold">XẾP LOẠI HIỆU QUẢ CÔNG VIỆC (KPI)</td>
            <td colSpan={2} className="px-3 py-3 text-right">
              {grade && <span className={`badge text-sm ${gradeColor[grade.tone]}`}>{grade.label.toUpperCase()}</span>}
            </td>
          </tr>
        </tfoot>
      </table>
      <p className="mt-2 px-3 text-xs text-slate-500">
        Thang xếp loại: ≥90% Hoàn thành tốt · 80 – dưới 90% Hoàn thành · 60 – dưới 80% Cần cải thiện · 50 – dưới 60% Trung bình · &lt;50% Không hoàn thành.
        {Math.abs(totalWeight - 1) > 0.0001 && <span className="ml-1 font-medium text-red-600">Tổng tỉ trọng chưa bằng 100%.</span>}
      </p>
    </div>
  );
}

function SectionRows({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={7} className="bg-brand-50/60 text-xs font-semibold uppercase tracking-wide text-brand-900">
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}
