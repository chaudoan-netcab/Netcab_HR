import Link from "next/link";
import { BellRing } from "lucide-react";
import { requireHRM } from "@/lib/server/access";
import { getSummary, loadKpiSets, loadSummary, parseYq } from "@/lib/server/department-flow";
import { demo, summaryKey } from "@/lib/server/demo-store";
import { db } from "@/lib/server/db";
import { inQuarter, isApprovedPlan, kpiGrade, pct, periodRange, provisionalKpi } from "@/lib/kpi";
import { kpiStatusView, summaryStatusLabel, summaryStatusTone, type Tone } from "@/lib/labels";
import { fmtDate, fmtDateTime, today } from "@/lib/dates";
import { Badge, Card, EmptyState, Flash, PageHeader, StatTile } from "@/components/ui";
import { DemoNote, QuarterPicker } from "@/components/flow-ui";
import { remindHead } from "../kpi/summary/actions";

/**
 * Theo dõi trưởng phòng (HRM): mỗi phòng một dòng —
 * KPI của chính trưởng phòng, tiến độ xác nhận phiếu KPI của nhân viên, bộ KPI phòng đang dùng,
 * và trưởng phòng đã gửi bản cuối quý cho HR chưa. HR không duyệt; chỉ xem và nhắc.
 */
export default async function HeadsPage({ searchParams }: { searchParams: Promise<{ yq?: string; ok?: string; err?: string }> }) {
  const user = await requireHRM();
  const sp = await searchParams;
  const q = parseYq(sp.yq);
  const { units, sets } = await loadKpiSets();
  const quarterEnd = periodRange("QUARTER", q.quarter, q.year).end;
  const ended = quarterEnd < today();

  const headIds = units.map((u) => u.headId).filter((x): x is string => !!x);
  const [heads, headPlans] = await Promise.all([
    db.employee.findMany({ where: { id: { in: headIds } }, select: { id: true, position: true } }),
    db.kpiPlan.findMany({
      where: { employeeId: { in: headIds }, year: q.year },
      select: { id: true, employeeId: true, status: true, periodType: true, year: true, period: true, score: true, items: { select: { actual: true, target: true, weight: true, formula: true } } },
    }),
  ]);
  const rows = await Promise.all(
    units.map(async (u) => {
      const s = await loadSummary(u, q.year, q.quarter);
      const rec = getSummary(u.id, q.year, q.quarter);
      const staffPlans = s.rows.filter((r) => r.employee.id !== u.headId).flatMap((r) => r.plans);
      const headPlan = headPlans.find((p) => p.employeeId === u.headId && inQuarter(p, q.year, q.quarter));
      return {
        unit: u,
        rec,
        status: (rec?.status ?? "NONE") as keyof typeof summaryStatusLabel,
        position: heads.find((h) => h.id === u.headId)?.position ?? null,
        headPlan,
        headKpi: headPlan ? (isApprovedPlan(headPlan.status) ? headPlan.score : provisionalKpi(headPlan.items).score) : null,
        staffTotal: staffPlans.length,
        staffDone: staffPlans.filter((p) => isApprovedPlan(p.status)).length,
        sets: sets.filter((x) => x.rec.unitId === u.id && x.template.active).length,
        reminder: demo.headReminders.get(summaryKey(u.id, q.year, q.quarter)),
      };
    }),
  );
  const sent = rows.filter((r) => r.status === "SENT").length;
  const waiting = rows.filter((r) => r.status !== "SENT" && r.unit.headId);

  /** Xếp loại là phân loại: chữ thường; chỉ tô màu khi báo cần chú ý (vàng/đỏ) */
  const gradeText = (tone: Tone) => (tone === "red" ? "text-status-danger-text" : tone === "amber" ? "text-status-warning-text" : "text-foreground");
  type Row = (typeof rows)[number];
  const headLine = (r: Row, own: boolean) =>
    r.unit.headName ? (
      <>
        <Link href={`/employees/${r.unit.headId}`} className="text-muted-foreground hover:text-foreground">{r.unit.headName}</Link>
        {r.position && ` · ${r.position}`}
        {own && " (bạn)"}
      </>
    ) : (
      <span className="text-status-warning-text">Chưa có trưởng phòng</span>
    );
  const headKpi = (r: Row) => {
    const g = kpiGrade(r.headKpi);
    return !r.headPlan ? (
      <span className="text-xs text-muted-foreground">Chưa có phiếu quý</span>
    ) : (
      <Link href={`/kpi/${r.headPlan.id}`} className="block text-foreground hover:no-underline">
        <span className="font-medium tabular-nums text-foreground">{pct(r.headKpi)}</span>
        {g && <span className={`ml-2 whitespace-nowrap text-xs ${gradeText(g.tone)}`}>{g.label}</span>}
        <div className="mt-0.5 text-xs text-muted-foreground">{kpiStatusView(r.headPlan.status, false).label}{!isApprovedPlan(r.headPlan.status) && " · tạm tính"}</div>
      </Link>
    );
  };
  const staff = (r: Row) =>
    r.staffTotal === 0 ? (
      <span className="text-xs text-muted-foreground">Chưa giao phiếu</span>
    ) : (
      <>
        <span className="font-medium tabular-nums">{r.staffDone}/{r.staffTotal}</span> <span className="text-xs text-muted-foreground">đã xác nhận</span>
        {r.staffDone < r.staffTotal && <div className="text-xs text-status-warning-text">{r.staffTotal - r.staffDone} phiếu đang cập nhật / chờ xác nhận</div>}
      </>
    );
  const summary = (r: Row, detail: boolean) => (
    <>
      <Badge tone={summaryStatusTone[r.status]}>{summaryStatusLabel[r.status]}</Badge>
      {detail && r.rec && <div className="mt-0.5 whitespace-nowrap text-xs tabular-nums text-muted-foreground">{fmtDateTime(new Date(r.rec.sentAt))}</div>}
      {detail && r.status === "NONE" && ended && <div className="mt-0.5 text-xs text-status-danger-text">Quá hạn (hết quý {fmtDate(quarterEnd)})</div>}
      {detail && r.reminder && r.status !== "SENT" && <div className="mt-0.5 text-xs text-muted-foreground">Đã nhắc {fmtDateTime(new Date(r.reminder.at))}</div>}
    </>
  );
  const action = (r: Row, own: boolean) =>
    r.status !== "SENT" && r.unit.headId && !own ? (
      <form action={remindHead.bind(null, r.unit.id, q.value)}>
        <button className="btn btn-sm"><BellRing size={14} /> Nhắc gửi</button>
      </form>
    ) : (
      <Link href={`/kpi/summary/${r.unit.id}?yq=${q.value}`} className="btn btn-sm">Xem bản cuối</Link>
    );
  return (
    <div>
      <PageHeader
        title="Theo dõi trưởng phòng"
        description="KPI của các trưởng phòng và tình trạng gửi bản cuối KPI quý của từng phòng. HR không duyệt: chỉ xem, nhắc trưởng phòng gửi, và mở lại phiếu khi cần sửa."
        actions={<QuarterPicker value={q.value} options={q.options} />}
      />
      <Flash ok={sp.ok} err={sp.err} />

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile label="Số phòng" value={units.length} hint={`${headIds.length} phòng có trưởng phòng`} />
        <StatTile label={`Đã gửi bản cuối ${q.label}`} value={`${sent}/${units.length}`} tone={sent === units.length ? "green" : "blue"} />
        <StatTile label="Chưa gửi" value={waiting.length} hint={ended ? `Quý kết thúc ${fmtDate(quarterEnd)}` : `Quý kết thúc ${fmtDate(quarterEnd)} (chưa hết quý)`} tone={waiting.length && ended ? "amber" : "green"} />
        <StatTile label="Bộ KPI đang dùng" value={sets.filter((x) => x.template.active && x.rec.unitId).length} hint="Do các trưởng phòng tự soạn" />
      </div>

      <Card title={`Các phòng · ${q.label}`} pad={false} className={rows.length ? "max-md:border-0 max-md:bg-transparent max-md:[&>div:first-child]:px-0" : ""}>
        {rows.length === 0 ? (
          <EmptyState title="Chưa có phòng ban" />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Phòng · Trưởng phòng</th>
                    <th>KPI của trưởng phòng</th>
                    <th>Phiếu KPI nhân viên</th>
                    <th className="hidden xl:table-cell">Bộ KPI</th>
                    <th>Bản cuối gửi HR</th>
                    <th className="w-32"><span className="sr-only">Thao tác</span></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const own = r.unit.headId === user.employeeId;
                    return (
                      <tr key={r.unit.id}>
                        <td>
                          <Link href={`/kpi/summary/${r.unit.id}?yq=${q.value}`} className="font-medium">{r.unit.name}</Link>
                          <div className="text-xs text-muted-foreground">{headLine(r, own)}</div>
                        </td>
                        <td>{headKpi(r)}</td>
                        <td>{staff(r)}</td>
                        <td className="hidden xl:table-cell">
                          <Link href="/kpi/sets" className="text-sm">{r.sets} bộ</Link>
                        </td>
                        <td>{summary(r, true)}</td>
                        <td className="text-right">{action(r, own)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Điện thoại: danh sách thẻ, cùng dữ liệu với bảng */}
            <ul className="space-y-3 md:hidden">
              {rows.map((r) => {
                const own = r.unit.headId === user.employeeId;
                return (
                  <li key={r.unit.id}>
                    <article className="rounded-[6px] border border-border bg-card p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="min-w-0 truncate text-xs text-muted-foreground">{headLine(r, own)}</span>
                        {summary(r, false)}
                      </div>
                      <Link href={`/kpi/summary/${r.unit.id}?yq=${q.value}`} className="mt-0.5 block text-[14px] font-medium text-foreground">{r.unit.name}</Link>
                      <dl className="mt-2 flex flex-col gap-y-1.5 text-[13px]">
                        <div><dt className="text-xs text-muted-foreground">KPI của trưởng phòng</dt><dd>{headKpi(r)}</dd></div>
                        <div><dt className="text-xs text-muted-foreground">Phiếu KPI nhân viên</dt><dd>{staff(r)}</dd></div>
                        <div><dt className="inline text-muted-foreground">Bộ KPI:</dt> <dd className="inline"><Link href="/kpi/sets">{r.sets} bộ</Link></dd></div>
                        {(r.rec || (r.status === "NONE" && ended) || (r.reminder && r.status !== "SENT")) && (
                          <div><dt className="text-xs text-muted-foreground">Bản cuối gửi HR</dt><dd>{summary(r, true)}</dd></div>
                        )}
                      </dl>
                      <div className="mt-3 flex gap-2">{action(r, own)}</div>
                    </article>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Card>
      <DemoNote>Trạng thái gửi và lời nhắc đang lưu tạm trong bộ nhớ server (giai đoạn chỉ làm UI), sẽ mất khi khởi động lại. Số liệu KPI lấy từ phiếu KPI trong database.</DemoNote>
    </div>
  );
}
