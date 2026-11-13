import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import { isHRM, requireEmployeeUser } from "@/lib/server/access";
import { canViewSummary, loadSummary, loadUnits, parseYq } from "@/lib/server/department-flow";
import { kpiGradeTone, pct } from "@/lib/kpi";
import { kpiStatusView, summaryStatusLabel, summaryStatusTone } from "@/lib/labels";
import { fmtDateTime } from "@/lib/dates";
import { Badge, Card, EmptyState, Flash, PageHeader } from "@/components/ui";
import { DemoNote, FlowLog, QuarterPicker } from "@/components/flow-ui";
import { FLAT_ON_MOBILE, GradeText, MobileCard, MobileField, MobileList, TABLE_MD } from "../../_components/mobile-card";
import { sendSummary } from "../actions";

/** Bản cuối KPI quý của 1 phòng: trưởng phòng gửi HR (HR chỉ nhận, không duyệt); HRM xem toàn công ty */
export default async function SummaryDetailPage({ params, searchParams }: { params: Promise<{ unitId: string }>; searchParams: Promise<{ yq?: string; ok?: string; err?: string }> }) {
  const user = await requireEmployeeUser();
  const { unitId } = await params;
  const sp = await searchParams;
  const q = parseYq(sp.yq);
  const unit = (await loadUnits()).byId.get(unitId);
  if (!unit) notFound();
  const s = await loadSummary(unit, q.year, q.quarter);
  const rec = s.record;
  if (!canViewSummary(user, unit)) notFound();
  const isHead = unit.headId === user.employeeId;
  const st = rec?.status ?? "NONE";
  const canSend = isHead && (st === "NONE" || st === "REOPENED");
  const reopenedPlans = s.rows.flatMap((r) => r.plans.filter((p) => p.reopened).map((p) => ({ ...p, name: r.employee.fullName })));
  const back = isHead ? { href: `/kpi/summary?yq=${q.value}`, label: "Bản cuối gửi HR" } : isHRM(user) ? { href: `/heads?yq=${q.value}`, label: "Theo dõi trưởng phòng" } : { href: `/kpi/summary?yq=${q.value}`, label: "Bản cuối gửi HR" };

  return (
    <div>
      <PageHeader
        back={back}
        title={`Bản cuối KPI · ${unit.name}`}
        description={`${q.label} · Trưởng phòng: ${unit.headName ?? "chưa có"}${unit.deptNames.length > 1 ? ` · Gồm: ${unit.deptNames.join(", ")}` : ""}`}
        actions={
          <>
            <Badge tone={summaryStatusTone[st]}>{summaryStatusLabel[st]}</Badge>
            <QuarterPicker value={q.value} options={q.options} />
          </>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />

      <Card pad={false} className={`mb-5 ${s.rows.length ? FLAT_ON_MOBILE : ""}`}>
        {s.rows.length === 0 ? (
          <EmptyState title="Phòng chưa có nhân viên" />
        ) : (
          <>
            <div className={`overflow-x-auto ${TABLE_MD}`}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Phiếu KPI trong quý</th>
                    <th className="text-right">KPI quý</th>
                    <th>Xếp loại</th>
                  </tr>
                </thead>
                <tbody>
                  {s.rows.map((r) => (
                    <tr key={r.employee.id}>
                      <td>
                        <div className="font-medium text-foreground">{r.employee.fullName}</div>
                        <div className="text-xs text-muted-foreground">{r.employee.code} · {r.employee.position ?? "—"}{r.employee.department && unit.deptNames.length > 1 ? ` · ${r.employee.department.name}` : ""}</div>
                      </td>
                      <td>
                        <PlanLinks plans={r.plans} />
                      </td>
                      <td className="whitespace-nowrap text-right tabular-nums">
                        {r.kpi.score === null ? "—" : pct(r.kpi.score)}
                        {r.kpi.total > 0 && <div className="text-[11px] text-muted-foreground">{r.kpi.updated}/{r.kpi.total} chỉ số đã cập nhật</div>}
                      </td>
                      <td>{r.grade && <GradeText tone={kpiGradeTone(r.grade)}>{r.grade}</GradeText>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MobileList>
              {s.rows.map((r) => (
                <MobileCard
                  key={r.employee.id}
                  meta={`${r.employee.code} · ${r.employee.position ?? "—"}${r.employee.department && unit.deptNames.length > 1 ? ` · ${r.employee.department.name}` : ""}`}
                  title={r.employee.fullName}
                >
                  <MobileField label="KPI quý">
                    <span className="tabular-nums">{r.kpi.score === null ? "—" : pct(r.kpi.score)}</span>
                    {r.kpi.total > 0 && <span className="text-xs text-muted-foreground"> ({r.kpi.updated}/{r.kpi.total} chỉ số)</span>}
                  </MobileField>
                  {r.grade && (
                    <MobileField label="Xếp loại">
                      <GradeText tone={kpiGradeTone(r.grade)}>{r.grade}</GradeText>
                    </MobileField>
                  )}
                  <div className="basis-full">
                    <PlanLinks plans={r.plans} />
                  </div>
                </MobileCard>
              ))}
            </MobileList>
          </>
        )}
      </Card>
      <div className="grid gap-5 lg:grid-cols-3">
        <Card title="Gửi bản cuối cho HR" className="lg:col-span-2">
          <dl className="grid gap-3 text-sm sm:grid-cols-2">
            <div><dt className="text-xs text-muted-foreground">Trưởng phòng</dt><dd className="font-medium">{unit.headName ?? "Chưa có"}</dd></div>
            <div><dt className="text-xs text-muted-foreground">Đã gửi HR</dt><dd className="font-medium">{rec ? `${fmtDateTime(new Date(rec.sentAt))} · ${rec.senderName}` : "Chưa gửi"}</dd></div>
          </dl>
          {st === "REOPENED" && (
            <div role="status" className="mt-3 rounded-[4px] bg-muted/50 px-3 py-2 text-sm text-foreground">
              <b className="font-medium text-status-warning-text">Cần gửi lại:</b> HRM đã mở lại {reopenedPlans.length} phiếu ({reopenedPlans.map((p) => `${p.name} – ${p.label}`).join("; ")}). {isHead ? "Xác nhận lại các phiếu rồi bấm “Gửi lại bản cuối”." : "Chờ trưởng phòng xác nhận lại phiếu và gửi lại."} Các phiếu khác vẫn khóa.
            </div>
          )}
          {canSend && s.blocking.length > 0 && (
            <p role="status" className="mt-3 flex items-start gap-2 rounded-[4px] bg-muted/50 px-3 py-2 text-sm text-status-warning-text">
              <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />
              <span>Chưa gửi được: còn {s.blocking.length} phiếu KPI chưa được xác nhận ({s.blocking.map((b) => `${b.name} – ${b.label}`).join("; ")}).</span>
            </p>
          )}
          <div className="mt-4">
            {canSend && (
              <form action={sendSummary.bind(null, unit.id, q.value)} className="flex flex-wrap items-center justify-end gap-3">
                <span className="text-xs text-muted-foreground">HR chỉ nhận, không duyệt. Gửi xong toàn bộ phiếu KPI trong quý của phòng sẽ khóa.</span>
                <button className="btn btn-primary" disabled={s.blocking.length > 0}>{rec ? "Gửi lại bản cuối" : "Gửi bản cuối cho HR"}</button>
              </form>
            )}
            {!isHead && st === "NONE" && <p className="text-sm text-muted-foreground">Trưởng phòng chưa gửi bản cuối quý này.</p>}
          </div>
          <DemoNote>Trạng thái gửi lưu tạm trong bộ nhớ server (giai đoạn chỉ làm UI). &quot;Đã khóa&quot; chỉ hiển thị, không ghi vào database.</DemoNote>
        </Card>
        <Card title="Lịch sử">
          <FlowLog log={rec?.log ?? []} />
        </Card>
      </div>
    </div>
  );
}

/** Các phiếu KPI trong quý của một người: trạng thái chữ màu, bấm để mở phiếu */
function PlanLinks({ plans }: { plans: Awaited<ReturnType<typeof loadSummary>>["rows"][number]["plans"] }) {
  if (plans.length === 0) return <span className="text-xs text-muted-foreground">Chưa có phiếu</span>;
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1">
      {plans.map((p) => {
        const v = kpiStatusView(p.status, p.locked);
        return (
          <Link key={p.id} href={`/kpi/${p.id}`} className="no-underline hover:underline">
            <Badge tone={p.reopened ? "violet" : v.tone}>{p.label} · {p.reopened ? `Đã mở lại · ${v.label}` : v.label}</Badge>
          </Link>
        );
      })}
    </div>
  );
}
