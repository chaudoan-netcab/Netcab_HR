"use client";

import { useState } from "react";
import type { ReviewTemplate } from "@prisma/client";
import { BONUS_OPTIONS, GRADE_INFO, REVIEW_TEMPLATES, SCORE_SCALE, computeReview, criteriaOf } from "@/lib/review-templates";

type Scores = Record<string, number | null>;

const gradeColor: Record<string, string> = {
  A: "bg-emerald-50 text-emerald-700",
  B: "bg-brand-50 text-brand-700",
  C: "bg-violet-50 text-violet-700",
  D: "bg-amber-50 text-amber-700",
  E: "bg-red-50 text-red-700",
};

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
        className="input w-36 py-1"
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
        <table className="table min-w-[760px]">
          <thead>
            <tr>
              <th className="w-10">#</th>
              <th>Tiêu chí (Phần A): Thành tích cơ bản &amp; cử chỉ hành vi</th>
              <th className="w-40">Nhân viên tự chấm</th>
              {showManager && <th className="w-40">Người đánh giá chấm</th>}
            </tr>
          </thead>
          <tbody>
            {REVIEW_TEMPLATES[template].sections.map((sec) => (
              <SectionBlock key={sec.title} title={sec.title} weight={sec.weightNote} cols={showManager ? 4 : 3}>
                {sec.criteria.map((c) => (
                  <tr key={c.key}>
                    <td className="tabular-nums text-slate-400">{++stt}</td>
                    <td>{c.text}</td>
                    <td>{cell("self", c.key)}</td>
                    {showManager && <td>{cell("manager", c.key)}</td>}
                  </tr>
                ))}
              </SectionBlock>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 text-sm font-semibold">
            <tr>
              <td colSpan={2} className="px-3 py-2 text-right">Tổng điểm đánh giá (tối đa {selfRes.max})</td>
              <td className="px-3 py-2 tabular-nums">{selfRes.total}</td>
              {showManager && <td className="px-3 py-2 tabular-nums">{mgrRes.total}</td>}
            </tr>
          </tfoot>
        </table>
      </div>

      {showManager && (
        <div className="mt-4 grid gap-4 rounded-lg border border-slate-200 p-4 sm:grid-cols-3">
          <div>
            <div className="label">Điểm cộng Phần B (1, 3, 5)</div>
            {bonusEditable ? (
              <select name="bonus" value={bonus} onChange={(e) => setBonus(Number(e.target.value))} className="input">
                {BONUS_OPTIONS.map((b) => (
                  <option key={b} value={b}>
                    {b === 0 ? "Không cộng" : `+${b}%`}
                  </option>
                ))}
              </select>
            ) : (
              <div className="text-lg font-semibold">{bonus ? `+${bonus}%` : "Không cộng"}</div>
            )}
          </div>
          <div>
            <div className="label">Tỷ lệ đạt được</div>
            <div className="text-2xl font-semibold tabular-nums text-slate-900">{mgrFilled ? `${mgrRes.rate}%` : "—"}</div>
            <div className="text-xs text-slate-500">
              = {mgrRes.total}/{mgrRes.max} {bonus ? `+ ${bonus}% Phần B` : ""}
            </div>
          </div>
          <div>
            <div className="label">Xếp hạng</div>
            {mgrFilled === keys.length ? (
              <span className={`badge px-3 py-1 text-lg ${gradeColor[mgrRes.grade]}`}>
                Hạng {mgrRes.grade} <span className="text-xs font-normal">({GRADE_INFO[mgrRes.grade].range})</span>
              </span>
            ) : (
              <div className="text-sm text-slate-500">Chấm đủ {keys.length} tiêu chí để xếp hạng ({mgrFilled}/{keys.length})</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function SectionBlock({ title, weight, cols, children }: { title: string; weight?: string; cols: number; children: React.ReactNode }) {
  return (
    <>
      <tr>
        <td colSpan={cols} className="bg-brand-50/60 text-xs font-semibold uppercase tracking-wide text-brand-900">
          {title} {weight && <span className="font-normal normal-case text-brand-700">({weight})</span>}
        </td>
      </tr>
      {children}
    </>
  );
}
