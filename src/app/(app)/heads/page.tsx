import Link from "next/link";
import { BellRing } from "lucide-react";
import { requireHRM } from "@/lib/server/access";
import { getSummary, loadKpiSets, loadSummary, parseYq } from "@/lib/server/department-flow";
import { demo, summaryKey } from "@/lib/server/demo-store";
import { db } from "@/lib/server/db";
import { inQuarter, isApprovedPlan, kpiGrade, pct, periodRange, provisionalKpi } from "@/lib/kpi";
import { kpiStatusView, summaryStatusLabel, summaryStatusTone } from "@/lib/labels";
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

      <Card title={`Các phòng · ${q.label}`} pad={false}>
        {rows.length === 0 ? (
          <EmptyState title="Chưa có phòng ban" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table min-w-[980px]">
              <thead>
                <tr>
                  <th>Phòng · Trưởng phòng</th>
                  <th>KPI của trưởng phòng</th>
                  <th>Phiếu KPI nhân viên</th>
                  <th>Bộ KPI</th>
                  <th>Bản cuối gửi HR</th>
                  <th className="w-40" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const g = kpiGrade(r.headKpi);
                  const own = r.unit.headId === user.employeeId;
                  return (
                    <tr key={r.unit.id}>
                      <td>
                        <Link href={`/kpi/summary/${r.unit.id}?yq=${q.value}`} className="font-medium">{r.unit.name}</Link>
                        <div className="text-xs text-slate-500">
                          {r.unit.headName ? (
                            <>
                              <Link href={`/employees/${r.unit.headId}`} className="text-slate-600">{r.unit.headName}</Link>
                              {r.position && ` · ${r.position}`}
                              {own && " (bạn)"}
                            </>
                          ) : (
                            <span className="text-red-600">Chưa có trưởng phòng</span>
                          )}
                        </div>
                      </td>
                      <td>
                        {!r.headPlan ? (
                          <span className="text-xs text-slate-400">Chưa có phiếu quý</span>
                        ) : (
                          <Link href={`/kpi/${r.headPlan.id}`} className="block hover:no-underline">
                            <span className="font-semibold tabular-nums text-slate-900">{pct(r.headKpi)}</span>
                            {g && <span className="ml-2"><Badge tone={g.tone}>{g.label}</Badge></span>}
                            <div className="mt-0.5 text-xs text-slate-500">{kpiStatusView(r.headPlan.status, false).label}{!isApprovedPlan(r.headPlan.status) && " · tạm tính"}</div>
                          </Link>
                        )}
                      </td>
                      <td>
                        {r.staffTotal === 0 ? (
                          <span className="text-xs text-slate-400">Chưa giao phiếu</span>
                        ) : (
                          <>
                            <span className="tabular-nums font-medium">{r.staffDone}/{r.staffTotal}</span> <span className="text-xs text-slate-500">đã xác nhận</span>
                            {r.staffDone < r.staffTotal && <div className="text-xs text-amber-700">{r.staffTotal - r.staffDone} phiếu đang cập nhật / chờ xác nhận</div>}
                          </>
                        )}
                      </td>
                      <td>
                        <Link href="/kpi/sets" className="text-sm">{r.sets} bộ</Link>
                      </td>
                      <td>
                        <Badge tone={summaryStatusTone[r.status]}>{summaryStatusLabel[r.status]}</Badge>
                        {r.rec && <div className="mt-0.5 text-xs text-slate-500">{fmtDateTime(new Date(r.rec.sentAt))}</div>}
                        {r.status === "NONE" && ended && <div className="mt-0.5 text-xs text-red-600">Quá hạn (hết quý {fmtDate(quarterEnd)})</div>}
                        {r.reminder && r.status !== "SENT" && <div className="mt-0.5 text-xs text-amber-700">Đã nhắc {fmtDateTime(new Date(r.reminder.at))}</div>}
                      </td>
                      <td className="text-right">
                        {r.status !== "SENT" && r.unit.headId && !own ? (
                          <form action={remindHead.bind(null, r.unit.id, q.value)}>
                            <button className="btn btn-sm"><BellRing size={14} /> Nhắc gửi</button>
                          </form>
                        ) : (
                          <Link href={`/kpi/summary/${r.unit.id}?yq=${q.value}`} className="btn btn-sm">Xem bản cuối</Link>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <DemoNote>Trạng thái gửi và lời nhắc đang lưu tạm trong bộ nhớ server (giai đoạn chỉ làm UI), sẽ mất khi khởi động lại. Số liệu KPI lấy từ phiếu KPI trong database.</DemoNote>
    </div>
  );
}
