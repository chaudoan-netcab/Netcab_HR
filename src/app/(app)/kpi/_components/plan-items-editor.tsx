"use client";
// Chọn / sửa chỉ số của 1 phiếu KPI: mỗi nhân viên có thể có bộ chỉ số khác nhau.
// Dùng khi giao KPI và khi quản lý sửa chỉ số của phiếu đang ở bước nhân viên cập nhật.
import { useMemo, useState } from "react";
import { Plus, Scale, Trash2 } from "lucide-react";
import type { KpiFormula } from "@prisma/client";
import { kpiFormulaLabel } from "@/lib/labels";

export type SourceItem = {
  id?: string;
  section: string;
  name: string;
  measurement: string | null;
  unit: string;
  target: number;
  weight: number;
  formula: KpiFormula;
  note: string | null;
  /** Chỉ số thêm riêng cho người này (không có trong bộ KPI của phòng) */
  custom?: boolean;
};

type Row = {
  key: string;
  id?: string;
  on: boolean;
  custom: boolean;
  section: string;
  name: string;
  measurement: string | null;
  unit: string;
  target: string; // hiển thị: % nhập dạng 0–100
  weight: string; // % 0–100
  formula: KpiFormula;
  note: string | null;
};

const CUSTOM_SECTION = "CHỈ SỐ RIÊNG";
const isPct = (unit: string) => unit.trim() === "%";
const num = (s: string) => {
  const n = Number(s.replace(",", "."));
  return s.trim() === "" || !Number.isFinite(n) ? null : n;
};
const r1 = (n: number) => Math.round(n * 10) / 10;
let seq = 0;

const toRow = (i: SourceItem): Row => ({
  key: `r${seq++}`,
  id: i.id,
  on: true,
  custom: !!i.custom,
  section: i.section,
  name: i.name,
  measurement: i.measurement,
  unit: i.unit,
  target: String(isPct(i.unit) ? r1(i.target * 100) : i.target),
  weight: String(r1(i.weight * 100)),
  formula: i.formula,
  note: i.note,
});

export function usePlanItems(initial: SourceItem[]) {
  const [rows, setRows] = useState<Row[]>(() => initial.map(toRow));
  const chosen = rows.filter((r) => r.on);
  const total = r1(chosen.reduce((s, r) => s + (num(r.weight) ?? 0), 0));
  const problems = chosen.filter((r) => !r.name.trim() || !r.unit.trim() || num(r.target) === null || !(num(r.weight)! > 0)).length;
  const valid = chosen.length > 0 && problems === 0 && Math.abs(total - 100) < 0.05;
  const json = useMemo(
    () =>
      JSON.stringify(
        rows
          .filter((r) => r.on)
          .map((r) => ({
            id: r.id,
            section: r.section,
            name: r.name,
            measurement: r.measurement,
            unit: r.unit,
            target: isPct(r.unit) ? (num(r.target) ?? 0) / 100 : num(r.target),
            weight: (num(r.weight) ?? 0) / 100,
            formula: r.formula,
            note: r.note,
          })),
      ),
    [rows],
  );
  return { rows, setRows, reset: (items: SourceItem[]) => setRows(items.map(toRow)), chosen: chosen.length, total, problems, valid, json };
}

export type PlanItemsState = ReturnType<typeof usePlanItems>;

export function PlanItemsEditor({ state }: { state: PlanItemsState }) {
  const { rows, setRows, total, chosen, problems } = state;
  const patch = (key: string, p: Partial<Row>) => setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...p } : r)));
  const sections = [...new Set(rows.map((r) => r.section))];
  const off = Math.abs(total - 100) >= 0.05;

  /** Chia lại tỉ trọng các chỉ số đang chọn theo đúng tỉ lệ cũ để tổng = 100% */
  const rebalance = () =>
    setRows((rs) => {
      const on = rs.filter((r) => r.on);
      const sum = on.reduce((s, r) => s + (num(r.weight) ?? 0), 0);
      if (!on.length) return rs;
      const base = sum > 0 ? on.map((r) => ((num(r.weight) ?? 0) * 100) / sum) : on.map(() => 100 / on.length);
      const rounded = base.map(r1);
      rounded[rounded.length - 1] = r1(100 - rounded.slice(0, -1).reduce((s, x) => s + x, 0));
      let k = 0;
      return rs.map((r) => (r.on ? { ...r, weight: String(rounded[k++]) } : r));
    });

  const addCustom = () =>
    setRows((rs) => [
      ...rs,
      { key: `r${seq++}`, on: true, custom: true, section: CUSTOM_SECTION, name: "", measurement: null, unit: "%", target: "100", weight: "", formula: "HIGHER_BETTER", note: null },
    ]);

  let stt = 0;
  return (
    <div>
      <input type="hidden" name="items" value={state.json} />
      <div className="flex flex-col gap-4">
        {sections.map((sec) => (
          <section key={sec}>
            <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-[0.06em] text-muted-foreground">{sec}</h3>
            <ul className="divide-y divide-border rounded-[4px] border border-border">
              {rows
                .filter((r) => r.section === sec)
                .map((r) => {
                  if (r.on) stt++;
                  const pctUnit = isPct(r.unit);
                  return (
                    <li key={r.key} className={`grid gap-x-3 gap-y-2 px-3 py-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] ${r.on ? "" : "bg-muted/50"}`}>
                      <label className="flex items-start gap-2 pt-1 sm:pt-1.5">
                        <input
                          type="checkbox"
                          checked={r.on}
                          onChange={(e) => (r.custom && !e.target.checked ? setRows((rs) => rs.filter((x) => x.key !== r.key)) : patch(r.key, { on: e.target.checked }))}
                          className="h-4 w-4 accent-primary"
                          aria-label={`Dùng chỉ số ${r.name || "mới"}`}
                        />
                        <span className="w-5 text-xs tabular-nums text-muted-foreground sm:hidden">{r.on ? stt : ""}</span>
                      </label>
                      <div className={`min-w-0 ${r.on ? "" : "opacity-50"}`}>
                        {r.custom ? (
                          <div className="flex flex-col gap-2">
                            <input value={r.name} onChange={(e) => patch(r.key, { name: e.target.value })} placeholder="Tên chỉ số riêng, VD: Hoàn thành số hóa hồ sơ nhân sự" className="input" aria-label="Tên chỉ số" />
                            <div className="flex flex-wrap gap-2">
                              <input value={r.unit} onChange={(e) => patch(r.key, { unit: e.target.value })} placeholder="Đơn vị" className="input w-24" aria-label="Đơn vị" />
                              <select value={r.formula} onChange={(e) => patch(r.key, { formula: e.target.value as KpiFormula })} className="input w-auto min-w-0 flex-1" aria-label="Cách tính">
                                {Object.entries(kpiFormulaLabel).map(([k, v]) => (
                                  <option key={k} value={k}>{v}</option>
                                ))}
                              </select>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="flex flex-wrap items-baseline gap-x-2">
                              <span className="hidden w-5 text-xs tabular-nums text-muted-foreground sm:inline">{r.on ? stt : ""}</span>
                              <span className="font-medium text-foreground">{r.name}</span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground sm:pl-7">
                              Đơn vị: {r.unit} · {kpiFormulaLabel[r.formula]}
                            </div>
                          </>
                        )}
                      </div>
                      <div className={`flex items-center gap-2 pl-6 sm:pl-0 ${r.on ? "" : "opacity-50"}`}>
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          Chỉ tiêu
                          <input
                            value={r.target}
                            disabled={!r.on}
                            onChange={(e) => patch(r.key, { target: e.target.value })}
                            inputMode="decimal"
                            className="input w-20 text-right tabular-nums"
                          />
                          <span className="w-6">{pctUnit ? "%" : ""}</span>
                        </label>
                        <label className="flex items-center gap-1 text-xs text-muted-foreground">
                          Tỉ trọng
                          <input
                            value={r.weight}
                            disabled={!r.on}
                            onChange={(e) => patch(r.key, { weight: e.target.value })}
                            inputMode="decimal"
                            aria-invalid={r.on && !(num(r.weight)! > 0) ? true : undefined}
                            className={`input w-16 text-right tabular-nums ${r.on && !(num(r.weight)! > 0) ? "border-status-warning" : ""}`}
                          />
                          %
                        </label>
                        {r.custom && (
                          <button type="button" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="btn btn-ghost btn-sm text-status-danger-text" aria-label="Xóa chỉ số riêng">
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button type="button" onClick={addCustom} className="btn btn-sm">
          <Plus size={15} /> Thêm chỉ số riêng
        </button>
        {off && chosen > 0 && (
          <button type="button" onClick={rebalance} className="btn btn-sm">
            <Scale size={15} /> Chia lại tỉ trọng cho đủ 100%
          </button>
        )}
      </div>

      <div
        role="status"
        className={`mt-3 flex flex-wrap items-center justify-between gap-2 rounded-[4px] bg-muted/50 px-3 py-2 text-sm ${off || problems ? "text-status-warning-text" : "text-status-success-text"}`}
      >
        <span>
          Dùng <b>{chosen}</b>/{rows.length} chỉ số
          {problems > 0 && <> · {problems} chỉ số chưa nhập đủ tên, đơn vị, chỉ tiêu hoặc tỉ trọng</>}
        </span>
        <span className="tabular-nums">
          Tổng tỉ trọng <b>{total}%</b>
          {off && " · cần đúng 100%"}
        </span>
      </div>
    </div>
  );
}
