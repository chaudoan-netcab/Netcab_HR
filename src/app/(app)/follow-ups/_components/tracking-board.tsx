"use client";
// Bảng theo dõi theo người: sắp xếp theo cột số, chọn nhiều dòng, đánh dấu "Cần chú ý", nút Nhắc
import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Bell, BellRing, CheckCircle2, Info } from "lucide-react";
import { Badge, EmptyState } from "@/components/ui";
import { Tip } from "@/components/tip";
import { TRACKING_THRESHOLDS as T } from "@/config/tracking";
import { fmtPct, REMINDER_LABEL, type TrackRow } from "@/lib/tracking";
import { ReminderDialog } from "./reminder-dialog";

type SortKey = "name" | "active" | "overdue" | "waiting" | "returned" | "kpi" | "last";
/** Ô vượt ngưỡng "Cần chú ý" (ngưỡng trong src/config/tracking.ts) */
// Chữ màu trạng thái, không tô nền ô: quá hạn = đỏ (trễ), KPI thấp / bị trả lại nhiều = vàng (rủi ro)
const HOT = "font-medium text-status-danger-text";
const RISK = "font-medium text-status-warning-text";
/** Định nghĩa "Cần chú ý" — hiện trong tooltip ⓘ */
const ATTENTION_DEF = `Cần chú ý khi thỏa ít nhất 1 điều kiện trong quý: KPI tạm tính dưới ${Math.round(T.kpiBelow * 100)}%, từ ${T.overdueAtLeast} việc quá hạn, hoặc từ ${T.returnedAtLeast} lần bị trả lại. % tạm tính chỉ tính trên các chỉ số đã cập nhật.`;

/** dd/mm hh:mm theo giờ Việt Nam */
const fmtAt = (iso: string) => {
  const d = new Date(new Date(iso).getTime() + 7 * 3_600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)} ${p(d.getUTCHours())}:${p(d.getUTCMinutes())}`;
};

export function TrackingBoard({
  rows,
  admin,
  readOnly = false,
  quarterLabel,
  sender,
  query,
  emptyKind,
  clearHref,
}: {
  rows: TrackRow[];
  /** Hiện tên phòng ban dưới tên nhân viên */
  admin: boolean;
  /** Chỉ xem (trang chi tiết phòng của HRM "Toàn công ty"): không có ô chọn, không có nút nhắc */
  readOnly?: boolean;
  quarterLabel: string;
  sender: string;
  /** Tham số lọc hiện tại, gắn vào link chi tiết để quay lại đúng bộ lọc */
  query: string;
  /** "none" = không có nhân viên trong phạm vi; "filtered" = bộ lọc không có kết quả */
  emptyKind: "none" | "filtered" | null;
  clearHref: string;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "name", dir: 1 });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ kind: "person"; rows: TrackRow[] } | null>(null);
  const setDialogRows = (rows: TrackRow[]) => setDialog({ kind: "person", rows });
  const [toast, setToast] = useState<string | null>(null);

  const sorted = useMemo(() => {
    const val = (r: TrackRow): number | string =>
      sort.key === "name" ? r.name : sort.key === "kpi" ? (r.kpi.score ?? -1) : sort.key === "last" ? (r.lastReminder?.at ?? "") : r[sort.key];
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
  const pickedRows = rows.filter((r) => selected.has(r.id));

  if (emptyKind)
    return (
      <div className="card">
        {emptyKind === "none" ? (
          <EmptyState title="Chưa có nhân viên trong phạm vi theo dõi" hint="Bảng hiển thị nhân viên báo cáo trực tiếp và nhân viên các phòng do tài khoản đang đăng nhập làm trưởng." />
        ) : (
          <EmptyState
            title="Không có kết quả phù hợp với bộ lọc"
            action={
              <Link href={clearHref} className="btn btn-sm">
                Xóa bộ lọc
              </Link>
            }
          />
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

  /** Nhãn "Cần chú ý": chấm + chữ vàng (rủi ro), rê chuột xem lý do */
  const attention = (r: TrackRow) => (
    <Tip content={<ul className="list-disc pl-4">{r.reasons.map((x) => <li key={x}>{x}</li>)}</ul>}>
      <span className="inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium text-status-warning-text">
        <span className="size-2 rounded-full bg-status-warning" aria-hidden /> Cần chú ý
      </span>
    </Tip>
  );
  const kpiCls = (r: TrackRow) => (r.kpi.score !== null && r.kpi.score < T.kpiBelow ? RISK : "");
  const kpiSub = (r: TrackRow) => (r.kpi.total && r.kpi.updated < r.kpi.total ? "text-status-warning-text" : "text-muted-foreground");
  const lastReminder = (r: TrackRow) =>
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
          <span className="tabular-nums">{rows.length}</span> người · <b className="font-medium tabular-nums text-status-warning-text">{rows.filter((r) => r.reasons.length).length}</b> cần chú ý
          <Tip content={ATTENTION_DEF}>
            <Info size={15} className="text-muted-foreground" aria-label="Định nghĩa Cần chú ý" />
          </Tip>
        </span>
        {!readOnly && (
          <button type="button" disabled={pickedRows.length === 0} onClick={() => setDialogRows(pickedRows)} className="btn btn-primary btn-sm ml-auto">
            <BellRing size={14} /> Nhắc các người đã chọn{pickedRows.length ? ` (${pickedRows.length})` : ""}
          </button>
        )}
      </div>

      <div className="card hidden overflow-x-auto md:block">
        <table className="table [&_td]:px-2.5 [&_th]:px-2.5">
          <thead>
            <tr>
              {!readOnly && (
                <th className="w-10">
                  <input
                    type="checkbox"
                    aria-label="Chọn tất cả"
                    checked={allChecked}
                    onChange={() => setSelected(allChecked ? new Set() : new Set(rows.map((r) => r.id)))}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </th>
              )}
              <Th k="name">Họ tên</Th>
              <Th k="active" className="text-right">Đang làm</Th>
              <Th k="overdue" className="text-right">Quá hạn</Th>
              <Th k="waiting" className="text-right">Chờ xác nhận</Th>
              <Th k="returned" className="hidden text-right xl:table-cell">Trả lại</Th>
              <Th k="kpi" className="text-right">KPI tạm tính</Th>
              <th className="hidden whitespace-nowrap xl:table-cell">Phiếu KPI</th>
              <Th k="last" className="hidden xl:table-cell">Nhắc gần nhất</Th>
              {!readOnly && <th className="sticky right-0 w-12 bg-card"><span className="sr-only">Nhắc</span></th>}
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const warn = r.reasons.length > 0;
              return (
                <tr key={r.id}>
                  {!readOnly && (
                    <td>
                      <input type="checkbox" aria-label={`Chọn ${r.name}`} checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 cursor-pointer accent-primary" />
                    </td>
                  )}
                  <td className="min-w-40">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Link href={`/follow-ups/people/${r.id}${query}`} className="font-medium">
                        {r.name}
                      </Link>
                      {warn && attention(r)}
                    </div>
                    <div className="text-xs text-muted-foreground">{[r.position, admin ? r.department : null].filter(Boolean).join(" · ")}</div>
                  </td>
                  <td className={`text-right tabular-nums ${r.active ? "" : "text-muted-foreground"}`}>{r.active}</td>
                  <td className={`text-right tabular-nums ${r.overdue >= T.overdueAtLeast ? HOT : r.overdue ? "" : "text-muted-foreground"}`}>{r.overdue}</td>
                  <td className={`text-right tabular-nums ${r.waiting ? "" : "text-muted-foreground"}`}>{r.waiting}</td>
                  <td className={`hidden text-right tabular-nums xl:table-cell ${r.returned >= T.returnedAtLeast ? RISK : r.returned ? "" : "text-muted-foreground"}`}>{r.returned}</td>
                  <td className={`whitespace-nowrap text-right ${kpiCls(r)}`}>
                    <div className={`font-medium tabular-nums ${r.kpi.score === null ? "text-muted-foreground" : kpiCls(r) ? "" : "text-foreground"}`}>{r.kpi.score === null ? "—" : fmtPct(r.kpi.score)}</div>
                    <div className={`text-[11px] font-normal tabular-nums ${kpiSub(r)}`}>{r.kpi.total ? `${r.kpi.updated}/${r.kpi.total} chỉ số` : "Chưa có phiếu"}</div>
                  </td>
                  <td className="hidden xl:table-cell">
                    {r.plan ? (
                      <>
                        <Link href={`/kpi/${r.plan.id}`} className="no-underline hover:no-underline">
                          <Badge tone={r.plan.tone}>{r.plan.statusLabel}</Badge>
                        </Link>
                        <div className="mt-0.5 text-[11px] text-muted-foreground">{r.plan.period}</div>
                      </>
                    ) : (
                      <span className="text-xs text-muted-foreground">Chưa có phiếu</span>
                    )}
                  </td>
                  <td className="hidden whitespace-nowrap text-xs xl:table-cell">{lastReminder(r)}</td>
                  {/* Cột nhắc cố định bên phải: luôn nhìn thấy kể cả khi bảng phải cuộn ngang */}
                  {!readOnly && (
                    <td className="sticky right-0 bg-card">
                      <button type="button" onClick={() => setDialogRows([r])} className="btn btn-ghost h-8 w-8 px-0 text-muted-foreground hover:text-foreground" aria-label={`Nhắc ${r.name}`} title={`Nhắc ${r.name}`}>
                        <Bell size={15} aria-hidden />
                      </button>
                    </td>
                  )}
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
                  <span className="min-w-0 truncate text-xs text-muted-foreground">{[r.position, admin ? r.department : null].filter(Boolean).join(" · ") || "—"}</span>
                  {warn && attention(r)}
                </div>
                <Link href={`/follow-ups/people/${r.id}${query}`} className="mt-0.5 block text-[14px] font-medium text-foreground">
                  {r.name}
                </Link>
                <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                  <div><dt className="inline text-muted-foreground">Đang làm:</dt> <dd className="inline tabular-nums">{r.active}</dd></div>
                  <div><dt className="inline text-muted-foreground">Quá hạn:</dt> <dd className={`inline tabular-nums ${r.overdue >= T.overdueAtLeast ? HOT : ""}`}>{r.overdue}</dd></div>
                  <div><dt className="inline text-muted-foreground">Chờ xác nhận:</dt> <dd className="inline tabular-nums">{r.waiting}</dd></div>
                  <div><dt className="inline text-muted-foreground">Trả lại:</dt> <dd className={`inline tabular-nums ${r.returned >= T.returnedAtLeast ? RISK : ""}`}>{r.returned}</dd></div>
                  <div>
                    <dt className="inline text-muted-foreground">KPI tạm tính:</dt>{" "}
                    <dd className={`inline tabular-nums ${kpiCls(r)}`}>{r.kpi.score === null ? "—" : fmtPct(r.kpi.score)}</dd>{" "}
                    <dd className={`inline text-xs tabular-nums ${kpiSub(r)}`}>({r.kpi.total ? `${r.kpi.updated}/${r.kpi.total} chỉ số` : "Chưa có phiếu"})</dd>
                  </div>
                  <div>
                    <dt className="inline text-muted-foreground">Phiếu KPI:</dt>{" "}
                    <dd className="inline">
                      {r.plan ? (
                        <Link href={`/kpi/${r.plan.id}`} className="no-underline hover:no-underline">
                          <Badge tone={r.plan.tone}>{r.plan.statusLabel}</Badge> <span className="text-xs text-muted-foreground">{r.plan.period}</span>
                        </Link>
                      ) : (
                        <span className="text-muted-foreground">Chưa có phiếu</span>
                      )}
                    </dd>
                  </div>
                  <div><dt className="inline text-muted-foreground">Nhắc gần nhất:</dt> <dd className="inline">{lastReminder(r)}</dd></div>
                </dl>
                {!readOnly && (
                  <div className="mt-3 flex gap-2">
                    <label className="btn btn-sm">
                      <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggle(r.id)} className="h-4 w-4 cursor-pointer accent-primary" /> Chọn
                    </label>
                    <button type="button" onClick={() => setDialogRows([r])} className="btn btn-sm">
                      <Bell size={14} aria-hidden /> Nhắc
                    </button>
                  </div>
                )}
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
