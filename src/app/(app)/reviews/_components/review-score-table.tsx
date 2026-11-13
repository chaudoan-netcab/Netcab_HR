"use client";

import { useState } from "react";
import type { ReviewTemplate } from "@prisma/client";
import { BONUS_OPTIONS, GRADE_INFO, REVIEW_TEMPLATES, SCORE_SCALE, computeReview, criteriaOf } from "@/lib/review-templates";
import { gradeColor } from "@/app/(app)/kpi/_components/mobile-card";

type Scores = Record<string, number | null>;

// Điện thoại (< 768px): cùng một bảng (không nhân đôi ô chọn điểm) nhưng mỗi tiêu chí xếp thành một mục,
// hai cột điểm có nhãn riêng (data-label). Khi in luôn trả về dạng bảng.
const M_TABLE = "max-md:block max-md:min-w-0 print:table";
const M_HEAD = "max-md:hidden print:table-header-group";
const M_BODY = "max-md:block print:table-row-group";
const M_HIDE = "max-md:hidden print:table-cell";
const M_ROW =
  "max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-2 max-md:border-t max-md:border-border max-md:px-3 max-md:py-3 print:table-row print:border-0";
const M_TEXT = "max-md:col-span-2 max-md:block max-md:p-0 print:table-cell print:px-3 print:py-2.5";
const M_CELL =
  "max-md:block max-md:p-0 max-md:before:mb-1 max-md:before:block max-md:before:text-xs max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)] print:table-cell print:px-3 print:py-2.5 print:before:content-none";
const LABEL = "text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

/** Phần A của mẫu BM1-003: chấm 0–10 từng tiêu chí, tự cộng tổng, tỷ lệ và xếp hạng */
export function ReviewScoreTable({
  template,
  self,
  manager,
  editable,
  showManager,
  bonus: initialBonus,
  bonusEditable,
}: {
  template: ReviewTemplate;
  self: Scores;
  manager: Scores;
  editable: "self" | "manager" | null;
  showManager: boolean;
  bonus: number;
  bonusEditable: boolean;
}) {
  const [s, setS] = useState<Scores>(self);
  const [m, setM] = useState<Scores>(manager);
  const [bonus, setBonus] = useState(initialBonus);
  const keys = criteriaOf(template).map((c) => c.key);
  const selfRes = computeReview(template, keys.map((k) => s[k]), 0);
  const mgrRes = computeReview(template, keys.map((k) => m[k]), bonus);
  const mgrFilled = keys.filter((k) => m[k] !== null && m[k] !== undefined).length;
  let stt = 0;

  const cell = (col: "self" | "manager", key: string) => {
    const val = col === "self" ? s[key] : m[key];
    if (editable !== col) return <span className="tabular-nums">{val ?? "—"}</span>;
    return (
      <select
        name={`${col === "self" ? "self" : "mgr"}_${key}`}
        value={val ?? ""}
        onChange={(e) => {
          const v = e.target.value === "" ? null : Number(e.target.value);
          (col === "self" ? setS : setM)((prev) => ({ ...prev, [key]: v }));
        }}
        aria-label={col === "self" ? "Nhân viên tự chấm" : "Người đánh giá chấm"}
        className="input w-full md:w-36"
      >
        <option value="">— Chọn —</option>
        {SCORE_SCALE.map((o) => (
          <option key={o.value} value={o.value}>
            {o.value} · {o.label}
          </option>
        ))}
      </select>
    );
  };

  return (
    <div>
      <div className="overflow-x-auto">
        <table className={`table min-w-[760px] ${M_TABLE}`}>
          <thead className={M_HEAD}>
            <tr>
              <th className="w-10">#</th>
              <th>Tiêu chí (Phần A): Thành tích cơ bản &amp; cử chỉ hành vi</th>
              <th className="w-40">Nhân viên tự chấm</th>
              {showManager && <th className="w-40">Người đánh giá chấm</th>}
            </tr>
          </thead>
          <tbody className={M_BODY}>
            {REVIEW_TEMPLATES[template].sections.map((sec) => (
              <SectionBlock key={sec.title} title={sec.title} weight={sec.weightNote} cols={showManager ? 4 : 3}>
                {sec.criteria.map((c) => {
                  const n = ++stt;
                  return (
                    <tr key={c.key} className={M_ROW}>
                      <td className={`tabular-nums text-muted-foreground ${M_HIDE}`}>{n}</td>
                      <td className={`text-foreground ${M_TEXT}`}>
                        <span className="mr-1 tabular-nums text-muted-foreground md:hidden print:hidden">{n}.</span>
                        {c.text}
                      </td>
                      <td data-label="Nhân viên tự chấm" className={M_CELL}>{cell("self", c.key)}</td>
                      {showManager && <td data-label="Người đánh giá chấm" className={M_CELL}>{cell("manager", c.key)}</td>}
                    </tr>
                  );
                })}
              </SectionBlock>
            ))}
          </tbody>
          <tfoot className="bg-muted/50 text-sm font-semibold max-md:block print:table-footer-group">
            <tr className="max-md:grid max-md:grid-cols-2 max-md:gap-x-3 max-md:gap-y-1 max-md:px-3 max-md:py-2.5 print:table-row">
              <td colSpan={2} className="px-3 py-2 text-right max-md:col-span-2 max-md:p-0 max-md:text-left print:table-cell print:px-3 print:py-2 print:text-right">
                Tổng điểm đánh giá (tối đa {selfRes.max})
              </td>
              <td data-label="Tự chấm" className={`px-3 py-2 tabular-nums max-md:p-0 max-md:before:mr-1 max-md:before:text-xs max-md:before:font-normal max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)] print:px-3 print:py-2 print:before:content-none`}>
                {selfRes.total}
              </td>
              {showManager && (
                <td data-label="Người đánh giá" className={`px-3 py-2 tabular-nums max-md:p-0 max-md:before:mr-1 max-md:before:text-xs max-md:before:font-normal max-md:before:text-muted-foreground max-md:before:content-[attr(data-label)] print:px-3 print:py-2 print:before:content-none`}>
                  {mgrRes.total}
                </td>
              )}
            </tr>
          </tfoot>
        </table>
      </div>

      {showManager && (
        <div className="mx-5 mt-4 mb-5 grid gap-4 rounded-[4px] bg-muted/50 p-4 max-md:mx-3 max-md:mb-3 max-md:p-3 sm:grid-cols-3">
          <div>
            <div className={`mb-1.5 ${LABEL}`}>Điểm cộng Phần B (1, 3, 5)</div>
            {bonusEditable ? (
              <select name="bonus" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} aria-label="Điểm cộng Phần B" className="input">
                {BONUS_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b === 0 ? "Không cộng" : `+${b}%`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-[22px] font-medium leading-tight tabular-nums text-foreground">{bonus ? `+${bonus}%` : "Không cộng"}</div>
            )}
          </div>
          <div>
            <div className={LABEL}>Tỷ lệ đạt được</div>
            <div className="mt-1.5 text-[22px] font-medium leading-tight tabular-nums text-foreground">{mgrFilled ? `${mgrRes.rate}%` : "—"}</div>
            <div className="mt-1 text-xs tabular-nums text-muted-foreground">
              = {mgrRes.total}/{mgrRes.max} {bonus ? `+ ${bonus}% Phần B` : ""}
            </div>
          </div>
          <div>
            <div className={LABEL}>Xếp hạng</div>
            {mgrFilled === keys.length ? (
              <>
                <div className={`mt-1.5 text-[22px] font-medium leading-tight ${gradeColor(GRADE_INFO[mgrRes.grade].tone)}`}>Hạng {mgrRes.grade}</div>
                <div className="mt-1 text-xs text-muted-foreground">{GRADE_INFO[mgrRes.grade].range}</div>
              </>
            ) : (
              <div className="mt-1.5 text-sm text-muted-foreground">Chấm đủ {keys.length} tiêu chí để xếp hạng ({mgrFilled}/{keys.length})</div>
            )}
          </div>
        </div>
      )}
      {!showManager && <div className="h-3" aria-hidden />}
    </div>
  );
}

function SectionBlock({ title, weight, cols, children }: { title: string; weight?: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      <tr className="max-md:block print:table-row">
        <td colSpan={cols} className="bg-muted/50 text-xs font-semibold uppercase tracking-[0.06em] text-foreground max-md:block max-md:px-3 max-md:py-2 print:table-cell">
          {title} {weight && <span className="font-normal normal-case tracking-normal text-muted-foreground">({weight})</span>}
        </td>
      </tr>
      {children}
    </>
  );
}
