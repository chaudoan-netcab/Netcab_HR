"use client";
// Bảng theo phòng ban — HRM, chế độ "Toàn công ty". Mỗi dòng 1 đơn vị có trưởng phòng riêng.
// Nhắc việc ở chế độ này luôn gửi Trưởng phòng; HRM không nhắc trực tiếp nhân viên.
import Link from "next/link";
import { useMemo, useState } from "react";
import { AlertTriangle, ArrowDown, ArrowUp, ArrowUpDown, Bell, BellRing, CheckCircle2, Info } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { Tip } from "@/components/tip";
import { DEPT_TRACKING_THRESHOLDS as DT } from "@/config/tracking";
import { summaryStatusLabel, summaryStatusTone } from "@/lib/labels";
import { fmtPct, REMINDER_LABEL, type DeptRow } from "@/lib/tracking";
import { ReminderDialog } from "./reminder-dialog";

type SortKey = "name" | "members" | "kpi" | "overdue" | "notUpdated" | "attentionPeople" | "last";
const HOT = "bg-red-100/70 font-semibold text-red-700";
const DEPT_ATTENTION_DEF = `Phòng cần chú ý khi thỏa ít nhất 1 điều kiện trong quý: KPI tạm tính phòng dưới ${Math.round(DT.deptKpiBelow * 100)}%, từ ${Math.round(DT.deptAttentionRatio * 100)}% số người trong phòng cần chú ý, hoặc đã hết quý mà chưa gửi bản cuối. KPI tạm tính phòng là trung bình KPI tạm tính của các nhân viên đã có số liệu.`;
const fmtAt = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

export function DeptBoard({
  rows,
  quarterLabel,
  sender,
  query,
  emptyKind,
  clearHref,
}: {
  rows: DeptRow[];
  quarterLabel: string;
  sender: string;
  /** Tham số quý, gắn vào link chi tiết phòng */
  query: string;
  emptyKind: "none" | "filtered" | null;
  clearHref: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ kind: "dept"; rows: DeptRow[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const val = (r: DeptRow): number | string => (sort.key === "name" ? r.name : sort.key === "kpi" ? (r.kpi.score ?? -1) : sort.key === "last" ? (r.lastReminder?.at ?? "") : r[sort.key]);
    return [...rows].sort((a, b) => {
      const x = val(a);
      const y = val(b);
      const c = typeof x === "string" ? x.localeCompare(y as string, "vi") : x - (y as number);
      return c * sort.dir || a.name.localeCompare(b.name, "vi");
    });
  }, [rows, sort]);

  const allChecked = rows.length > 0 && rows.every((r) => selected.has(r.id));
  const toggle = (id: string) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const picked = rows.filter((r) => selected.has(r.id));

  if (emptyKind)
    return (
      <div className="card">
        {emptyKind === "none" ? (
          <EmptyState title="Chưa có phòng ban nào có nhân viên" />
        ) : (
          <EmptyState title="Không có phòng ban phù hợp với bộ lọc" action={<Link href={clearHref} className="btn btn-sm">Xóa bộ lọc</Link>} />
        )}
      </div>
    );

  const Th = ({ k, children, className = "" }: { k: SortKey; children: React.ReactNode; className?: string }) => {
    const active = sort.key === k;
    const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
    return (
      <th className={className} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          onClick={() => setSort((s) => ({ key: k, dir: s.key === k ? (s.dir === 1 ? -1 : 1) : k === "name" ? 1 : -1 }))}
          className={`inline-flex items-center gap-1 whitespace-nowrap text-left font-semibold leading-tight hover:text-slate-800 ${active ? "text-slate-800" : ""}`}
        >
          {children}
          <Icon size={12} className={active ? "" : "opacity-40"} aria-hidden />
        </button>
      </th>
    );
  };

  return (
    <>
      {toast && (
        <div role="status" className="mb-3 flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-700">
          <CheckCircle2 size={16} /> {toast}
          <button type="button" onClick={() => setToast(null)} className="ml-auto text-xs text-emerald-700 underline">
            Đóng
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-sm text-slate-600">
          {rows.length} phòng · <b className="text-red-700">{rows.filter((r) => r.reasons.length).length}</b> cần chú ý
          <Tip content={DEPT_ATTENTION_DEF}>
            <Info size={15} className="text-slate-400" aria-label="Định nghĩa phòng Cần chú ý" />
          </Tip>
        </span>
        <button type="button" disabled={picked.length === 0} onClick={() => setDialog({ kind: "dept", rows: picked })} className="btn btn-primary btn-sm ml-auto">
          <BellRing size={14} /> Nhắc Trưởng phòng các phòng đã chọn{picked.length ? ` (${picked.length})` : ""}
        </button>
      </div>

      <div className="card overflow-x-auto">
        <table className="table [&_td]:px-2.5 [&_th]:px-2.5">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả phòng"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-4 w-4 cursor-pointer accent-brand-600"
                />
              </th>
              <Th k="name">Phòng ban · Trưởng phòng</Th>
              <Th k="members" className="text-right">Số NV</Th>
              <Th k="kpi" className="text-right">KPI tạm tính</Th>
              <Th k="overdue" className="text-right">Quá hạn</Th>
              <Th k="notUpdated" className="text-right">Chưa cập nhật KPI</Th>
              <Th k="attentionPeople" className="text-right">Cần chú ý</Th>
              <th className="whitespace-nowrap">Bản cuối gửi HR</th>
              <Th k="last">Nhắc gần nhất</Th>
              <th className="sticky right-0 w-12 bg-slate-50"><span className="sr-only">Nhắc Trưởng phòng</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const warn = r.reasons.length > 0;
              return (
                <tr key={r.id} className={warn ? "bg-[#fff7f7]" : "bg-white"}>
                  <td className={warn ? "border-l-2 border-l-red-500" : ""}>
                    <input type="checkbox" aria-label={`Chọn ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 cursor-pointer accent-brand-600" />
                  </td>
                  <td className="min-w-48">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5">
                      <Link href={`/follow-ups/units/${r.id}${query}`} className="font-medium">
                        {r.name}
                      </Link>
                      {warn && (
                        <Tip content={<ul className="list-disc pl-4">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}>
                          <span className="inline-flex items-center gap-0.5 whitespace-nowrap rounded bg-red-100 px-1.5 py-0.5 text-[11px] font-semibold text-red-700">
                            <AlertTriangle size={11} aria-hidden /> Cần chú ý
                          </span>
                        </Tip>
                      )}
                    </div>
                    <div className="text-xs text-slate-500">
                      {r.headName ?? "Chưa có trưởng phòng"}
                      {r.deptNames.length > 1 && ` · gồm ${r.deptNames.filter((n) => n !== r.name).join(", ")}`}
                    </div>
                  </td>
                  <td className="text-right tabular-nums">{r.members}</td>
                  <td className={`whitespace-nowrap text-right ${r.hot.kpi ? HOT : ""}`}>
                    <div className={`font-semibold tabular-nums ${r.kpi.score === null ? "text-slate-400" : r.hot.kpi ? "" : "text-slate-900"}`}>{r.kpi.score === null ? "—" : fmtPct(r.kpi.score)}</div>
                    <div className={`text-[11px] font-normal tabular-nums ${r.kpi.updatedPeople < r.kpi.totalPeople ? "text-amber-700" : "text-slate-500"}`}>
                      {r.kpi.totalPeople ? `${r.kpi.updatedPeople}/${r.kpi.totalPeople} người đã cập nhật` : "Chưa có phiếu"}
                    </div>
                  </td>
                  <td className={`text-right tabular-nums ${r.overdue ? "" : "text-slate-400"}`}>{r.overdue}</td>
                  <td className={`text-right tabular-nums ${r.notUpdated ? "" : "text-slate-400"}`}>{r.notUpdated}</td>
                  <td className={`text-right tabular-nums ${r.hot.attention ? HOT : r.attentionPeople ? "" : "text-slate-400"}`}>{r.attentionPeople}</td>
                  <td className={r.hot.summary ? HOT : ""}>
                    <Badge tone={summaryStatusTone[r.summary]}>{summaryStatusLabel[r.summary]}</Badge>
                  </td>
                  <td className="whitespace-nowrap text-xs">
                    {r.lastReminder ? (
                      <Tip content={REMINDER_LABEL[r.lastReminder.type]}>
                        <span className="tabular-nums text-slate-700">{fmtAt(r.lastReminder.at)}</span>
                      </Tip>
                    ) : (
                      <span className="text-slate-400">Chưa nhắc</span>
                    )}
                  </td>
                  <td className="sticky right-0 bg-inherit [tr:hover_&]:bg-slate-50">
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "dept", rows: [r] })}
                      disabled={!r.headId}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:border-brand-300 hover:text-brand-700 disabled:opacity-40"
                      aria-label={`Nhắc Trưởng phòng ${r.name}`}
                      title={r.headId ? `Nhắc ${r.headName} (Trưởng phòng ${r.name})` : "Phòng chưa có trưởng phòng"}
                    >
                      <Bell size={15} aria-hidden />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {dialog && (
        <ReminderDialog
          target={dialog}
          quarterLabel={quarterLabel}
          sender={sender}
          onClose={() => setDialog(null)}
          onSent={(m) => {
            setToast(m);
            setSelected(new Set());
          }}
        />
      )}
    </>
  );
}
