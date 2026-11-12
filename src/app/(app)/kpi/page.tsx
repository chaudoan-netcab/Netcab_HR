import Link from "next/link";
import { BellRing, ChevronLeft, ChevronRight } from "lucide-react";
import { kpiTabs } from "@/lib/nav";
import { db } from "@/lib/server/db";
import { kpiGradeTone, periodLabel, periodRange, pct } from "@/lib/kpi";
import { kpiStatusView } from "@/lib/labels";
import { diffDays, fmtDate, today } from "@/lib/dates";
import { lockedPlanIds } from "@/lib/server/department-flow";
import { demo } from "@/lib/server/demo-store";
import { emptyYear, loadYearKpi } from "@/lib/server/kpi-year";
import { Badge, Card, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { capsOf, requireEmployeeUser } from "@/lib/server/access";
import { YearKpiStrip } from "./_components/year-kpi";

export default async function MyKpiPage({ searchParams }: { searchParams: Promise<{ year?: string; ok?: string; err?: string }> }) {
  const user = await requireEmployeeUser();
  const sp = await searchParams;
  const now = today();
  const thisYear = now.getUTCFullYear();
  const year = Number(sp.year) || thisYear;
  const currentQuarter = year === thisYear ? Math.floor(now.getUTCMonth() / 3) + 1 : year < thisYear ? 4 : 0;
  const plans = user.employeeId
    ? await db.kpiPlan.findMany({ where: { employeeId: user.employeeId }, include: { items: { select: { actual: true } } }, orderBy: [{ year: "desc" }, { periodType: "asc" }, { period: "desc" }] })
    : [];
  const locked = await lockedPlanIds(plans);
  const yearKpi = user.employeeId ? ((await loadYearKpi([user.employeeId], year)).get(user.employeeId) ?? emptyYear()) : emptyYear();
  // Phiếu đang cập nhật của kỳ đã bắt đầu → nhắc cập nhật tiến độ
  const updating = plans
    .filter((p) => p.status === "DRAFT" && !locked.has(p.id))
    .map((p) => ({ p, range: periodRange(p.periodType, p.period, p.year), reminder: demo.kpiReminders.get(p.id) }))
    .filter((x) => x.range.start <= now);

  return (
    <div>
      <PageHeader title="KPI cá nhân" description="Cập nhật tiến độ KPI bất cứ lúc nào trong quý; cuối quý gửi báo cáo cho quản lý xác nhận. KPI năm = trung bình các quý đã xác nhận." />
      <Tabs tabs={kpiTabs(capsOf(user))} active="mine" />
      <Flash ok={sp.ok} err={sp.err} />
      {plans.length === 0 ? (
        <Card>
          <EmptyState title="Chưa có phiếu KPI được giao" hint="Phiếu KPI do quản lý trực tiếp giao theo từng quý." />
        </Card>
      ) : (
        <>
          {updating.map(({ p, range, reminder }) => {
            const left = diffDays(now, range.end);
            const filled = p.items.filter((i) => i.actual !== null).length;
            return (
              <Link
                key={p.id}
                href={`/kpi/${p.id}`}
                className={`mb-4 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg border px-4 py-3 text-sm hover:no-underline ${reminder || left < 0 ? "border-amber-200 bg-amber-50 text-amber-900" : "border-brand-200 bg-brand-50 text-brand-900"}`}
              >
                <BellRing size={16} className="shrink-0" aria-hidden />
                <span className="min-w-0 flex-1">
                  <b>{left < 0 ? "Đã hết kỳ, cần gửi kết quả" : "Cập nhật tiến độ"} KPI {periodLabel(p.periodType, p.period, p.year)}</b>
                  {" · "}
                  {filled}/{p.items.length} chỉ số có số liệu
                  {reminder && <> · <b>{reminder.by}</b> đã nhắc cập nhật</>}
                </span>
                <span className="text-xs">
                  {left < 0 ? `Hết kỳ ${fmtDate(range.end)}` : `Còn ${left} ngày (đến ${fmtDate(range.end)})`}
                </span>
                <span className="btn btn-sm">Cập nhật</span>
              </Link>
            );
          })}

          <Card
            className="mb-5"
            title={`KPI năm ${year}`}
            actions={
              <div className="flex items-center gap-1">
                <Link href={`/kpi?year=${year - 1}`} className="btn btn-sm" aria-label="Năm trước">
                  <ChevronLeft size={15} />
                </Link>
                <Link href={`/kpi?year=${year + 1}`} className="btn btn-sm" aria-label="Năm sau">
                  <ChevronRight size={15} />
                </Link>
              </div>
            }
          >
            <YearKpiStrip y={yearKpi} year={year} currentQuarter={currentQuarter} />
          </Card>

          <Card title="Các phiếu KPI" pad={false}>
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Kỳ</th>
                    <th>Bảng KPI</th>
                    <th className="text-right">Kết quả</th>
                    <th>Xếp loại</th>
                    <th>Trạng thái</th>
                  </tr>
                </thead>
                <tbody>
                  {plans.map((p) => {
                    const st = kpiStatusView(p.status, locked.has(p.id));
                    const filled = p.items.filter((i) => i.actual !== null).length;
                    return (
                      <tr key={p.id}>
                        <td className="whitespace-nowrap font-medium">
                          <Link href={`/kpi/${p.id}`}>{periodLabel(p.periodType, p.period, p.year)}</Link>
                        </td>
                        <td className="text-xs text-slate-600">{p.title}</td>
                        <td className="text-right tabular-nums">
                          {p.status === "DRAFT" ? <span className="text-xs text-slate-500">{filled}/{p.items.length} chỉ số</span> : pct(p.score)}
                        </td>
                        <td>{p.grade && p.status !== "DRAFT" && <Badge tone={kpiGradeTone(p.grade)}>{p.grade}</Badge>}</td>
                        <td>
                          <Badge tone={st.tone}>{p.status === "DRAFT" && !locked.has(p.id) ? "Đang cập nhật" : st.label}</Badge>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}
