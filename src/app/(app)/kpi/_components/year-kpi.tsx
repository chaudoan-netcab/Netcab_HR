// Hiển thị KPI năm = tổng hợp các quý: ô Q1–Q4 + KPI năm (dùng ở Phiếu KPI nhân viên, KPI cá nhân, bảng cuối năm)
import Link from "next/link";
import { kpiGrade, pct } from "@/lib/kpi";
import type { QuarterCell, YearKpi } from "@/lib/server/kpi-year";
import { Badge, ProgressBar } from "@/components/ui";

const QUARTERS = [1, 2, 3, 4] as const;

/** Màu chữ của 1 quý chưa duyệt */
function pendingLabel(q: QuarterCell) {
  return { cls: q.status === "SUBMITTED" ? "text-amber-700" : "text-slate-500" };
}

export function YearKpiHead({ year }: { year: number }) {
  return (
    <>
      {QUARTERS.map((q) => (
        <th key={q} className="w-24 whitespace-nowrap text-right">Quý {q}</th>
      ))}
      <th className="w-36 whitespace-nowrap text-right">KPI năm {year}</th>
    </>
  );
}

/** 5 ô: Q1–Q4 + KPI năm. link = có quyền mở phiếu */
export function YearKpiCells({ y, link = true, currentQuarter }: { y: YearKpi; link?: boolean; currentQuarter?: number }) {
  const g = kpiGrade(y.avg);
  return (
    <>
      {y.quarters.map((q, i) => (
        <td key={i} className="text-right align-top">
          {!q ? (
            <span className="text-xs text-slate-400">{currentQuarter && i + 1 > currentQuarter ? "" : "Chưa giao"}</span>
          ) : (
            <QuarterValue q={q} link={link} />
          )}
        </td>
      ))}
      <td className="text-right align-top">
        {y.avg === null ? (
          <span className="text-xs text-slate-400">Chưa có quý được xác nhận</span>
        ) : (
          <>
            <div className="font-semibold tabular-nums text-brand-900">{pct(y.avg)}</div>
            <div className="mt-0.5 text-[11px] text-slate-500">TB {y.approvedCount} quý đã xác nhận</div>
            {g && <div className="mt-1"><Badge tone={g.tone}>{g.label}</Badge></div>}
          </>
        )}
      </td>
    </>
  );
}

function QuarterValue({ q, link }: { q: QuarterCell; link: boolean }) {
  const body = q.approved ? (
    <span className="font-medium tabular-nums text-slate-800">{pct(q.score)}</span>
  ) : (
    <span className={`block whitespace-nowrap text-xs leading-tight ${pendingLabel(q).cls}`}>
      {q.status === "SUBMITTED" ? "Chờ xác nhận" : <>Đang cập nhật<br />{q.updated}/{q.total} chỉ số</>}
    </span>
  );
  return link ? <Link href={`/kpi/${q.planId}`} className="hover:underline">{body}</Link> : body;
}

/** Thẻ KPI năm của 1 người: 4 quý + KPI năm */
export function YearKpiStrip({ y, year, currentQuarter }: { y: YearKpi; year: number; currentQuarter: number }) {
  const g = kpiGrade(y.avg);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {y.quarters.map((q, i) => {
        const future = year * 4 + i + 1 > year * 4 + currentQuarter;
        const inner = (
          <div className={`h-full rounded-lg border p-3 ${q && !q.approved ? "border-brand-200 bg-brand-50/40" : "border-slate-200"}`}>
            <div className="text-xs text-slate-500">Quý {i + 1}/{year}</div>
            {!q ? (
              <div className="mt-1 text-sm text-slate-400">{future ? "Chưa tới kỳ" : "Chưa giao"}</div>
            ) : q.approved ? (
              <>
                <div className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{pct(q.score)}</div>
                <div className="mt-0.5 text-[11px] text-slate-500">{q.grade ?? "Đã xác nhận"}</div>
              </>
            ) : (
              <>
                <div className="mt-1 text-sm font-medium text-brand-700">{q.status === "SUBMITTED" ? "Chờ quản lý xác nhận" : "Đang cập nhật"}</div>
                <div className="mt-2">
                  <ProgressBar value={q.total ? q.updated / q.total : 0} />
                </div>
                <div className="mt-1 text-[11px] tabular-nums text-slate-500">{q.updated}/{q.total} chỉ số có số liệu</div>
              </>
            )}
          </div>
        );
        return q ? (
          <Link key={i} href={`/kpi/${q.planId}`} className="block hover:no-underline">
            {inner}
          </Link>
        ) : (
          <div key={i}>{inner}</div>
        );
      })}
      <div className="col-span-2 rounded-lg bg-brand-900 p-3 text-white sm:col-span-1">
        <div className="text-xs text-brand-100">KPI năm {year}</div>
        <div className="mt-1 text-2xl font-semibold tabular-nums">{y.avg === null ? "—" : pct(y.avg)}</div>
        <div className="mt-0.5 text-[11px] text-brand-100">{y.avg === null ? "Chưa có quý được xác nhận" : `${g?.label} · TB ${y.approvedCount} quý đã xác nhận`}</div>
      </div>
    </div>
  );
}
