// Hiển thị KPI năm = tổng hợp các quý: ô Q1–Q4 + KPI năm (dùng ở Phiếu KPI nhân viên, KPI cá nhân, bảng cuối năm)
import Link from "next/link";
import { kpiGrade, kpiGradeTone, pct } from "@/lib/kpi";
import type { QuarterCell, YearKpi } from "@/lib/server/kpi-year";
import { ProgressBar } from "@/components/ui";
import { GradeText, MobileField, gradeClass, gradeWarnClass } from "./mobile-card";

const QUARTERS = [1, 2, 3, 4] as const;

/** Màu chữ của 1 quý chưa duyệt: chờ xác nhận = vàng, đang cập nhật = xanh dương (đang làm) */
function pendingLabel(q: QuarterCell) {
  return { cls: q.status === "SUBMITTED" ? "text-status-warning-text" : "text-status-info-text" };
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
            <span className="text-xs text-muted-foreground">{currentQuarter && i + 1 > currentQuarter ? "" : "Chưa giao"}</span>
          ) : (
            <QuarterValue q={q} link={link} />
          )}
        </td>
      ))}
      <td className="text-right align-top">
        {y.avg === null ? (
          <span className="text-xs text-muted-foreground">Chưa có quý được xác nhận</span>
        ) : (
          <>
            <div className="font-semibold tabular-nums text-foreground">{pct(y.avg)}</div>
            <div className="mt-0.5 whitespace-nowrap text-[11px] text-muted-foreground">TB {y.approvedCount} quý đã xác nhận</div>
            {g && <div className="mt-0.5 text-xs"><GradeText tone={g.tone}>{g.label}</GradeText></div>}
          </>
        )}
      </td>
    </>
  );
}

function QuarterValue({ q, link }: { q: QuarterCell; link: boolean }) {
  const body = q.approved ? (
    <span className="font-medium tabular-nums text-foreground">{pct(q.score)}</span>
  ) : (
    <span className={`block whitespace-nowrap text-xs font-medium leading-tight ${pendingLabel(q).cls}`}>
      {q.status === "SUBMITTED" ? "Chờ xác nhận" : <>Đang cập nhật<br /><span className="font-normal text-muted-foreground">{q.updated}/{q.total} chỉ số</span></>}
    </span>
  );
  return link ? <Link href={`/kpi/${q.planId}`} className="no-underline hover:underline">{body}</Link> : body;
}

/** Bản điện thoại của YearKpiCells: các mục dl trong thẻ (Q1–Q4 + KPI năm) */
export function YearKpiMobile({ y, year, currentQuarter }: { y: YearKpi; year: number; currentQuarter?: number }) {
  const g = kpiGrade(y.avg);
  return (
    <>
      <div className="flex basis-full flex-wrap gap-x-4 gap-y-1">
        {y.quarters.map((q, i) =>
          !q && currentQuarter && i + 1 > currentQuarter ? null : (
            <MobileField key={i} label={`Q${i + 1}`}>
              {!q ? (
                <span className="text-muted-foreground">Chưa giao</span>
              ) : q.approved ? (
                <span className="tabular-nums">{pct(q.score)}</span>
              ) : (
                <span className={`text-xs font-medium ${pendingLabel(q).cls}`}>{q.status === "SUBMITTED" ? "Chờ xác nhận" : `Đang cập nhật ${q.updated}/${q.total}`}</span>
              )}
            </MobileField>
          ),
        )}
      </div>
      <div className="basis-full">
        <dt className="inline text-muted-foreground">KPI năm {year}:</dt>{" "}
        <dd className="inline">
          {y.avg === null ? (
            <span className="text-muted-foreground">Chưa có quý được xác nhận</span>
          ) : (
            <>
              <b className="font-semibold tabular-nums text-foreground">{pct(y.avg)}</b>
              {g && <span className={gradeClass(g.tone)}> · {g.label}</span>}
            </>
          )}
        </dd>
      </div>
    </>
  );
}

const TILE_LABEL = "text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground";

/** Thẻ KPI năm của 1 người: 4 quý + KPI năm (mẫu KPI: nhãn 11px uppercase → số lớn → dòng phụ) */
export function YearKpiStrip({ y, year, currentQuarter }: { y: YearKpi; year: number; currentQuarter: number }) {
  const g = kpiGrade(y.avg);
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
      {y.quarters.map((q, i) => {
        const future = year * 4 + i + 1 > year * 4 + currentQuarter;
        const inner = (
          <div className={`h-full rounded-[4px] bg-muted/50 px-4 py-3 max-md:px-3 ${q ? "transition-colors hover:bg-muted" : ""}`}>
            <div className={TILE_LABEL}>Quý {i + 1}/{year}</div>
            {!q ? (
              <div className="mt-1.5 text-[13px] text-muted-foreground">{future ? "Chưa tới kỳ" : "Chưa giao"}</div>
            ) : q.approved ? (
              <>
                <div className="mt-1.5 text-[22px] font-medium leading-tight tabular-nums text-foreground">{pct(q.score)}</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {q.grade ? <span className={gradeWarnClass(kpiGradeTone(q.grade))}>{q.grade}</span> : "Đã xác nhận"}
                </div>
              </>
            ) : (
              <>
                <div className={`mt-1.5 text-[13px] font-medium ${pendingLabel(q).cls}`}>{q.status === "SUBMITTED" ? "Chờ quản lý xác nhận" : "Đang cập nhật"}</div>
                <div className="mt-2">
                  <ProgressBar value={q.total ? q.updated / q.total : 0} />
                </div>
                <div className="mt-1 text-xs tabular-nums text-muted-foreground">{q.updated}/{q.total} chỉ số có số liệu</div>
              </>
            )}
          </div>
        );
        return q ? (
          <Link key={i} href={`/kpi/${q.planId}`} className="block text-foreground no-underline hover:no-underline">
            {inner}
          </Link>
        ) : (
          <div key={i}>{inner}</div>
        );
      })}
      <div className="col-span-2 rounded-[4px] bg-muted/50 px-4 py-3 max-md:px-3 sm:col-span-1">
        <div className={TILE_LABEL}>KPI năm {year}</div>
        <div className="mt-1.5 text-[24px] font-semibold leading-tight tabular-nums text-foreground">{y.avg === null ? "—" : pct(y.avg)}</div>
        <div className="mt-1 text-xs text-muted-foreground">
          {y.avg === null ? (
            "Chưa có quý được xác nhận"
          ) : (
            <>
              {g && <span className={gradeWarnClass(g.tone)}>{g.label}</span>} · TB {y.approvedCount} quý đã xác nhận
            </>
          )}
        </div>
      </div>
    </div>
  );
}
