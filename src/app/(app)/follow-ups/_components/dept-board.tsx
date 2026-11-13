"use client";
// Bảng theo phòng ban — HRM, chế độ "Toàn công ty". Mỗi dòng 1 đơn vị có trưởng phòng riêng.
// Nhắc việc ở chế độ này luôn gửi Trưởng phòng; HRM không nhắc trực tiếp nhân viên.
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, BellRing, CheckCircle2, Info } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { Tip } from "@/components/tip";
import { DEPT_TRACKING_THRESHOLDS as DT } from "@/config/tracking";
import { summaryStatusLabel, summaryStatusTone } from "@/lib/labels";
import { fmtPct, REMINDER_LABEL, type DeptRow } from "@/lib/tracking";
import { ReminderDialog } from "./reminder-dialog";

type SortKey = "name" | "members" | "kpi" | "overdue" | "notUpdated" | "attentionPeople" | "last";
// Chữ màu trạng thái, không tô nền ô: vượt ngưỡng rủi ro = vàng
const RISK = "font-medium text-status-warning-text";
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
          className={`inline-flex items-center gap-1 whitespace-nowrap text-left font-medium leading-tight hover:text-foreground ${active ? "text-foreground" : ""}`}
        >
          {children}
          <Icon size={12} className={active ? "" : "opacity-40"} aria-hidden />
        </button>
      </th>
    );
  };

  const attention = (r: DeptRow) => (
    <Tip content={<ul className="list-disc pl-4">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-status-warning-text">
        <span className="size-2 rounded-full bg-status-warning" aria-hidden /> Cần chú ý
      </span>
    </Tip>
  );
  const kpiSub = (r: DeptRow) => (r.kpi.updatedPeople < r.kpi.totalPeople ? "text-status-warning-text" : "text-muted-foreground");
  const kpiSubText = (r: DeptRow) => (r.kpi.totalPeople ? `${r.kpi.updatedPeople}/${r.kpi.totalPeople} người đã cập nhật` : "Chưa có phiếu");
  const headLine = (r: DeptRow) => (
    <>
      {r.headName ?? "Chưa có trưởng phòng"}
      {r.deptNames.length > 1 && ` · gồm ${r.deptNames.filter((n) => n !== r.name).join(", ")}`}
    </>
  );
  /** Hết quý mà chưa gửi bản cuối (hot.summary) = trễ → chữ đỏ */
  const summary = (r: DeptRow) => <Badge tone={r.hot.summary ? "red" : summaryStatusTone[r.summary]}>{summaryStatusLabel[r.summary]}</Badge>;
  const lastReminder = (r: DeptRow) =>
    r.lastReminder ? (
      <Tip content={REMINDER_LABEL[r.lastReminder.type]}>
        <span className="tabular-nums text-foreground">{fmtAt(r.lastReminder.at)}</span>
      </Tip>
    ) : (
      <span className="text-muted-foreground">Chưa nhắc</span>
    );

  return (
    <>
      {toast && (
        <div role="status" className="card mb-3 flex items-center gap-2 px-4 py-2.5 text-[13px] text-status-success-text">
          <CheckCircle2 size={16} className="shrink-0" aria-hidden /> {toast}
          <button type="button" onClick={() => setToast(null)} className="ml-auto text-xs text-muted-foreground underline hover:text-foreground">
            Đóng
          </button>
        </div>
      )}

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1.5 text-[13px] text-muted-foreground">
          <span className="tabular-nums">{rows.length}</span> phòng · <b className="font-medium tabular-nums text-status-warning-text">{rows.filter((r) => r.reasons.length).length}</b> cần chú ý
          <Tip content={DEPT_ATTENTION_DEF}>
            <Info size={15} className="text-muted-foreground" aria-label="Định nghĩa phòng Cần chú ý" />
          </Tip>
        </span>
        <button type="button" disabled={picked.length === 0} onClick={() => setDialog({ kind: "dept", rows: picked })} className="btn btn-primary btn-sm ml-auto">
          <BellRing size={14} /> Nhắc Trưởng phòng các phòng đã chọn{picked.length ? ` (${picked.length})` : ""}
        </button>
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="table [&_td]:px-2.5 [&_th]:px-2.5">
          <thead>
            <tr>
              <th className="w-10">
                <input
                  type="checkbox"
                  aria-label="Chọn tất cả phòng"
                  checked={allChecked}
                  onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                  className="h-4 w-4 cursor-pointer accent-primary"
                />
              </th>
              <Th k="name">Phòng ban · Trưởng phòng</Th>
              <Th k="members" className="hidden text-right xl:table-cell">Số NV</Th>
              <Th k="kpi" className="text-right">KPI tạm tính</Th>
              <Th k="overdue" className="text-right">Quá hạn</Th>
              <Th k="notUpdated" className="hidden text-right xl:table-cell">Chưa cập nhật KPI</Th>
              <Th k="attentionPeople" className="text-right">Cần chú ý</Th>
              <th className="whitespace-nowrap">Bản cuối gửi HR</th>
              <Th k="last" className="hidden xl:table-cell">Nhắc gần nhất</Th>
              <th className="sticky right-0 w-12 bg-card"><span className="sr-only">Nhắc Trưởng phòng</span></th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const warn = r.reasons.length > 0;
              return (
                <tr key={r.id}>
                  <td>
                    <input type="checkbox" aria-label={`Chọn ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 cursor-pointer accent-primary" />
                  </td>
                  <td className="min-w-48">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Link href={`/follow-ups/units/${r.id}${query}`} className="font-medium">
                        {r.name}
                      </Link>
                      {warn && attention(r)}
                    </div>
                    <div className="text-xs text-muted-foreground">{headLine(r)}</div>
                  </td>
                  <td className="hidden text-right tabular-nums xl:table-cell">{r.members}</td>
                  <td className={`whitespace-nowrap text-right ${r.hot.kpi ? RISK : ""}`}>
                    <div className={`font-medium tabular-nums ${r.kpi.score === null ? "text-muted-foreground" : r.hot.kpi ? "" : "text-foreground"}`}>{r.kpi.score === null ? "—" : fmtPct(r.kpi.score)}</div>
                    <div className={`text-[11px] font-normal tabular-nums ${kpiSub(r)}`}>{kpiSubText(r)}</div>
                  </td>
                  <td className={`text-right tabular-nums ${r.overdue ? "" : "text-muted-foreground"}`}>{r.overdue}</td>
                  <td className={`hidden text-right tabular-nums xl:table-cell ${r.notUpdated ? "" : "text-muted-foreground"}`}>{r.notUpdated}</td>
                  <td className={`text-right tabular-nums ${r.hot.attention ? RISK : r.attentionPeople ? "" : "text-muted-foreground"}`}>{r.attentionPeople}</td>
                  <td>{summary(r)}</td>
                  <td className="hidden whitespace-nowrap text-xs xl:table-cell">{lastReminder(r)}</td>
                  <td className="sticky right-0 bg-card">
                    <button
                      type="button"
                      onClick={() => setDialog({ kind: "dept", rows: [r] })}
                      disabled={!r.headId}
                      className="btn btn-ghost h-8 w-8 px-0 text-muted-foreground hover:text-foreground"
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

      {/* Điện thoại: danh sách thẻ, cùng dữ liệu với bảng */}
      <ul className="space-y-3 md:hidden">
        {sorted.map((r) => {
          const warn = r.reasons.length > 0;
          return (
            <li key={r.id}>
              <article className="rounded-[6px] border border-border bg-card p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{headLine(r)}</span>
                  {warn ? attention(r) : summary(r)}
                </div>
                <Link href={`/follow-ups/units/${r.id}${query}`} className="mt-0.5 block text-[14px] font-medium text-foreground">
                  {r.name}
                </Link>
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                  <div><dt className="inline text-muted-foreground">Số NV:</dt> <dd className="inline tabular-nums">{r.members}</dd></div>
                  <div>
                    <dt className="inline text-muted-foreground">KPI tạm tính:</dt>{" "}
                    <dd className={`inline tabular-nums ${r.hot.kpi ? RISK : ""}`}>{r.kpi.score === null ? "—" : fmtPct(r.kpi.score)}</dd>{" "}
                    <dd className={`inline text-xs tabular-nums ${kpiSub(r)}`}>({kpiSubText(r)})</dd>
                  </div>
                  <div><dt className="inline text-muted-foreground">Quá hạn:</dt> <dd className="inline tabular-nums">{r.overdue}</dd></div>
                  <div><dt className="inline text-muted-foreground">Chưa cập nhật KPI:</dt> <dd className="inline tabular-nums">{r.notUpdated}</dd></div>
                  <div><dt className="inline text-muted-foreground">Cần chú ý:</dt> <dd className={`inline tabular-nums ${r.hot.attention ? RISK : ""}`}>{r.attentionPeople}</dd></div>
                  {warn && <div><dt className="inline text-muted-foreground">Bản cuối:</dt> <dd className="inline">{summary(r)}</dd></div>}
                  <div><dt className="inline text-muted-foreground">Nhắc gần nhất:</dt> <dd className="inline">{lastReminder(r)}</dd></div>
                </dl>
                <div className="mt-3 flex gap-2">
                  <label className="btn btn-sm">
                    <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 cursor-pointer accent-primary" /> Chọn
                  </label>
                  <button type="button" onClick={() => setDialog({ kind: "dept", rows: [r] })} disabled={!r.headId} className="btn btn-sm">
                    <Bell size={14} aria-hidden /> Nhắc Trưởng phòng
                  </button>
                </div>
              </article>
            </li>
          );
        })}
      </ul>

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
