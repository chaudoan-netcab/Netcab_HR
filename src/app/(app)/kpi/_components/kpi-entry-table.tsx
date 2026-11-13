"use client";

import { useState } from "react";
import type { KpiFormula } from "@prisma/client";
import { itemCompletion, kpiGrade, pct, toDisplay } from "@/lib/kpi";
import { gradeColor } from "./mobile-card";

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

// Điện thoại (< 768px): cùng một bảng (không nhân đôi ô nhập) nhưng mỗi dòng xếp thành một mục danh sách,
// các ô số có nhãn riêng (data-label). Khi in luôn trả về dạng bảng.
const M_TABLE = "max-md:block print:table";
const M_HEAD = "max-md:hidden print:table-header-group";
const M_BODY = "max-md:block print:table-row-group";
const M_FOOT = "max-md:block print:table-footer-group";
const M_HIDE = "max-md:hidden print:table-cell";
const M_ROW =
  "max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-3 max-md:border-t max-md:border-border max-md:px-3 max-md:py-3 print:table-row print:border-0";
const M_NAME = "max-md:col-span-2 max-md:block max-md:p-0 print:table-cell print:px-3 print:py-2.5";
const M_CELL =
  "max-md:block max-md:p-0 max-md:text-left max-md:before:mb-1 max-md:before:block max-md:before:text-xs max-md:before:font-normal max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)] print:table-cell print:px-3 print:py-2.5 print:before:content-none";
const M_FOOT_ROW = "max-md:flex max-md:items-baseline max-md:gap-3 max-md:px-3 max-md:py-2.5 print:table-row";
const M_FOOT_CELL = "max-md:p-0 print:table-cell print:px-3 print:py-3";

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
  const weightOff = Math.abs(totalWeight - 1) > 0.0001;
  let stt = 0;

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={`table md:min-w-[720px] ${M_TABLE}`}>
          <thead className={M_HEAD}>
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
          <tbody className={M_BODY}>
            {sections.map((sec) => (
              <SectionRows key={sec} title={sec}>
                {scored
                  .filter((x) => x.i.section === sec)
                  .map(({ i, completion }) => {
                    stt++;
                    const isPct = i.unit.trim() === "%";
                    const empty = !(values[i.id] ?? "").trim();
                    return (
                      <tr key={i.id} className={M_ROW}>
                        <td className={`tabular-nums text-muted-foreground ${M_HIDE}`}>{stt}</td>
                        <td className={M_NAME}>
                          <div className="font-medium text-foreground">
                            <span className="mr-1 tabular-nums text-muted-foreground md:hidden print:hidden">{stt}.</span>
                            {i.name}
                            {i.custom && <span className="ml-2 align-middle text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Riêng</span>}
                          </div>
                          {i.measurement && <div className="mt-0.5 text-xs text-muted-foreground">{i.measurement}</div>}
                          <div className="mt-1 text-[11px] text-muted-foreground">
                            Cách tính: {i.formulaLabel}
                            {i.note && <> · {i.note}</>}
                          </div>
                        </td>
                        <td className={M_HIDE}>{i.unit}</td>
                        <td data-label="Chỉ tiêu" className={`whitespace-nowrap text-right tabular-nums ${M_CELL} print:text-right`}>
                          {isPct ? pct(i.target, 0) : i.target}
                          {!isPct && <span className="text-muted-foreground md:hidden print:hidden"> {i.unit}</span>}
                        </td>
                        <td data-label="Mức độ thực hiện" className={M_CELL}>
                          {editable ? (
                            <div>
                              <div className="flex items-center gap-1.5">
                                <input
                                  name={`actual_${i.id}`}
                                  data-kpi-name={i.name}
                                  value={values[i.id] ?? ""}
                                  onChange={(ev) => setValues((v) => ({ ...v, [i.id]: ev.target.value }))}
                                  inputMode="decimal"
                                  aria-invalid={empty || undefined}
                                  aria-label={`Mức độ thực hiện: ${i.name}`}
                                  className={`input w-20 text-right tabular-nums max-md:w-24 ${empty ? "border-status-warning" : ""}`}
                                />
                                <span className="text-xs text-muted-foreground">{isPct ? "%" : i.unit}</span>
                              </div>
                              {/* Ô trống không được tính là 0 vụ: phải nhập 0 thì mới gửi được */}
                              {empty && (i.formula === "VIOLATION_STEPS" || i.formula === "ZERO_TOLERANCE") && (
                                <div className="mt-1 text-[11px] leading-tight text-status-warning-text">Nhập 0 nếu không có vụ</div>
                              )}
                            </div>
                          ) : (
                            <span className="tabular-nums">{values[i.id] ? `${values[i.id]}${isPct ? "%" : ` ${i.unit}`}` : "—"}</span>
                          )}
                        </td>
                        <td data-label="% hoàn thành" className={`text-right tabular-nums ${M_CELL} print:text-right`}>
                          <div className="font-semibold text-foreground">{pct(i.weight * completion)}</div>
                          <div className="text-[11px] text-muted-foreground">đạt {pct(completion, 0)}</div>
                        </td>
                        <td data-label="Tỉ trọng" className={`text-right tabular-nums ${M_CELL} print:text-right`}>{pct(i.weight, 0)}</td>
                      </tr>
                    );
                  })}
              </SectionRows>
            ))}
          </tbody>
          <tfoot className={M_FOOT}>
            <tr className={`bg-muted/50 font-semibold max-md:border-t max-md:border-border ${M_FOOT_ROW}`}>
              <td colSpan={5} className={`px-3 py-3 text-right max-md:flex-1 max-md:text-left ${M_FOOT_CELL} print:text-right`}>TỔNG</td>
              <td className={`px-3 py-3 text-right text-base tabular-nums text-foreground ${M_FOOT_CELL}`}>{pct(total)}</td>
              <td
                data-label="Tỉ trọng"
                className={`px-3 py-3 text-right tabular-nums max-md:before:mr-1 max-md:before:text-xs max-md:before:font-normal max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)] print:before:content-none ${M_FOOT_CELL} ${weightOff ? "text-status-danger-text" : ""}`}
              >
                {pct(totalWeight, 0)}
              </td>
            </tr>
            <tr className={M_FOOT_ROW}>
              <td colSpan={5} className={`px-3 py-3 text-right text-sm font-semibold max-md:flex-1 max-md:text-left ${M_FOOT_CELL} print:text-right`}>XẾP LOẠI HIỆU QUẢ CÔNG VIỆC (KPI)</td>
              <td colSpan={2} className={`px-3 py-3 text-right ${M_FOOT_CELL}`}>
                {grade && <span className={`whitespace-nowrap text-sm font-semibold ${gradeColor(grade.tone)}`}>{grade.label.toUpperCase()}</span>}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="px-5 pt-2 pb-4 text-xs text-muted-foreground max-md:px-3">
        Thang xếp loại: ≥90% Hoàn thành tốt · 80 – dưới 90% Hoàn thành · 60 – dưới 80% Cần cải thiện · 50 – dưới 60% Trung bình · &lt;50% Không hoàn thành.
        {weightOff && <span className="ml-1 font-medium text-status-danger-text">Tổng tỉ trọng chưa bằng 100%.</span>}
      </p>
    </div>
  );
}

function SectionRows({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <tr className="max-md:block print:table-row">
        <td colSpan={7} className="bg-muted/50 text-xs font-semibold uppercase tracking-[0.06em] text-foreground max-md:block max-md:px-3 max-md:py-2 print:table-cell">
          {title}
        </td>
      </tr>
      {children}
    </>
  );
}
