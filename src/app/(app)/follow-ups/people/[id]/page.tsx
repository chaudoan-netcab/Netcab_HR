import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { companyView, requireTracker } from "@/lib/server/access";
import { currentQuarter, loadPersonDetail } from "@/lib/server/tracking";
import { diffDays, fmtDate, today } from "@/lib/dates";
import { itemCompletion, pct, periodLabel, provisionalKpi, toDisplay } from "@/lib/kpi";
import { kpiStatusView, taskStatusLabel, taskStatusTone } from "@/lib/labels";
import { lockedPlanIds } from "@/lib/server/department-flow";
import { fmtPct } from "@/lib/tracking";
import { Badge, Card, EmptyState, PageHeader, StatTile } from "@/components/ui";
import { RemindButton } from "../../_components/remind-button";

/** Chi tiết 1 người trên trang Theo dõi & nhắc việc: việc và phiếu KPI trong quý */
export default async function PersonTrackingPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ yq?: string; view?: string; unit?: string }> }) {
  const user = await requireTracker();
  const { id } = await params;
  const sp = await searchParams;
  const cur = currentQuarter();
  const [yy, qq] = (sp.yq ?? "").split("-");
  const year = Number(yy) || cur.year;
  const quarter = Math.min(4, Math.max(1, Number(qq) || cur.quarter));

  // Ngoài phạm vi xem (HRM Toàn công ty; Quản lý / HRM "Phòng tôi": managerScope) → không tìm thấy.
  // HRM "Toàn công ty": chỉ đọc, không nhắc trực tiếp nhân viên (nhắc qua Trưởng phòng).
  const company = companyView(user, sp.view);
  const yq = `${year}-${quarter}`;
  const back = company && sp.unit
    ? { href: `/follow-ups/units/${sp.unit}?yq=${yq}`, label: "Chi tiết phòng" }
    : { href: `/follow-ups?yq=${yq}${sp.view === "mine" ? "&view=mine" : ""}`, label: "Theo dõi & nhắc việc" };
  const data = await loadPersonDetail(user, id, year, quarter, company);
  if (!data) notFound();
  const { row, tasks, plans } = data;
  const locked = await lockedPlanIds(plans);
  const now = today();
  const quarterLabel = `Quý ${quarter}/${year}`;

  return (
    <div>
      <PageHeader
        back={back}
        title={row.name}
        description={[row.position, row.department, row.managerName ? `Quản lý: ${row.managerName}` : null, quarterLabel].filter(Boolean).join(" · ")}
        actions={company ? undefined : <RemindButton row={row} quarterLabel={quarterLabel} sender={user.employee?.fullName ?? "Quản lý"} />}
      />

      {row.reasons.length > 0 && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2.5 text-sm text-red-700">
          <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            <b>Cần chú ý:</b> {row.reasons.join("; ")}
          </span>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-5">
        <StatTile label="Việc đang làm" value={row.active} />
        <StatTile label="Quá hạn" value={row.overdue} tone={row.overdue ? "red" : "gray"} />
        <StatTile label="Chờ xác nhận" value={row.waiting} tone={row.waiting ? "amber" : "gray"} />
        <StatTile label="Bị trả lại trong quý" value={row.returned} tone={row.returned ? "amber" : "gray"} />
        <StatTile label="% KPI quý tạm tính" value={row.kpi.score === null ? "—" : fmtPct(row.kpi.score)} hint={row.kpi.total ? `${row.kpi.updated}/${row.kpi.total} chỉ số đã cập nhật` : "Chưa có phiếu"} />
      </div>

      <Card title={`Nhiệm vụ ${quarterLabel}`} pad={false} className="mb-5">
        {tasks.length === 0 ? (
          <EmptyState title="Không có nhiệm vụ trong quý" />
        ) : (
          <div className="overflow-x-auto">
            <table className="table">
              <thead>
                <tr>
                  <th>Nhiệm vụ</th>
                  <th>Người giao</th>
                  <th>Hạn</th>
                  <th>Trạng thái</th>
                  <th className="text-right">Bị trả lại</th>
                </tr>
              </thead>
              <tbody>
                {tasks.map((t) => {
                  const late = t.dueDate && (t.status === "TODO" || t.status === "IN_PROGRESS") ? diffDays(t.dueDate, now) : 0;
                  return (
                    <tr key={t.id}>
                      <td>
                        <Link href={`/tasks/${t.id}`} className="font-medium">
                          {t.title}
                        </Link>
                      </td>
                      <td>{t.createdBy?.employee?.fullName ?? t.createdBy?.email ?? "—"}</td>
                      <td className="whitespace-nowrap">
                        {fmtDate(t.dueDate)}
                        {late > 0 && (
                          <div>
                            <Badge tone="red">Quá hạn {late} ngày</Badge>
                          </div>
                        )}
                      </td>
                      <td>
                        <Badge tone={taskStatusTone[t.status]}>{taskStatusLabel[t.status]}</Badge>
                      </td>
                      <td className={`text-right tabular-nums ${t.comments.length ? "font-semibold text-amber-700" : "text-slate-400"}`}>{t.comments.length}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {plans.length === 0 ? (
        <Card title={`Phiếu KPI ${quarterLabel}`}>
          <EmptyState title="Chưa có phiếu KPI trong quý" />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          {plans.map((p) => {
            const k = provisionalKpi(p.items);
            return (
              <Card
                key={p.id}
                pad={false}
                title={`Phiếu KPI ${periodLabel(p.periodType, p.period, p.year)}`}
                actions={
                  <div className="flex items-center gap-3 text-xs">
                    <span className="tabular-nums text-slate-600">
                      Tạm tính <b className="text-slate-900">{k.score === null ? "—" : fmtPct(k.score)}</b> · {k.updated}/{k.total} chỉ số đã cập nhật
                    </span>
                    <Badge tone={kpiStatusView(p.status, locked.has(p.id)).tone}>{kpiStatusView(p.status, locked.has(p.id)).label}</Badge>
                    <Link href={`/kpi/${p.id}`}>Mở phiếu</Link>
                  </div>
                }
              >
                <div className="overflow-x-auto">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Chỉ số</th>
                        <th className="text-right">Tỷ trọng</th>
                        <th className="text-right">Chỉ tiêu</th>
                        <th className="text-right">Thực hiện</th>
                        <th className="text-right">% đạt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.items.map((i) => (
                        <tr key={i.id}>
                          <td>
                            <div className="font-medium text-slate-800">{i.name}</div>
                            <div className="text-xs text-slate-500">{i.section}</div>
                          </td>
                          <td className="text-right tabular-nums">{pct(i.weight, 0)}</td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {toDisplay(i.unit, i.target)} {i.unit}
                          </td>
                          <td className="whitespace-nowrap text-right tabular-nums">
                            {i.actual === null ? <Badge tone="amber">Chưa cập nhật</Badge> : `${toDisplay(i.unit, i.actual)} ${i.unit}`}
                          </td>
                          <td className="text-right tabular-nums">{i.actual === null ? "—" : pct(itemCompletion(i.formula, i.target, i.actual), 0)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
