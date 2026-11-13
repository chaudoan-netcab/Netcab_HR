import Link from "next/link";
import { BellRing } from "lucide-react";
import { kpiTabs } from "@/lib/nav";
import { capsOf, requireManager } from "@/lib/server/access";
import { getSummary, loadSummary, loadUnits, parseYq, unitsHeadedBy } from "@/lib/server/department-flow";
import { demo, summaryKey } from "@/lib/server/demo-store";
import { pct } from "@/lib/kpi";
import { summaryStatusLabel, summaryStatusTone } from "@/lib/labels";
import { fmtDateTime } from "@/lib/dates";
import { Badge, Card, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { DemoNote, QuarterPicker } from "@/components/flow-ui";

/**
 * Tab "Bản cuối gửi HR" (trưởng phòng): tổng hợp KPI quý của phòng mình, gửi bản cuối cho HR.
 * HR chỉ nhận, không duyệt. Phòng con có trưởng riêng tự gửi; phòng con không có trưởng riêng gộp vào phòng cha.
 */
export default async function KpiSummaryTab({ searchParams }: { searchParams: Promise<{ yq?: string; ok?: string; err?: string }> }) {
  const user = await requireManager();
  const sp = await searchParams;
  const q = parseYq(sp.yq);
  const { units } = await loadUnits();
  const mine = await Promise.all(unitsHeadedBy(units, user).map((u) => loadSummary(u, q.year, q.quarter)));

  return (
    <div>
      <PageHeader
        title="Bản cuối gửi HR"
        description="Cuối quý, khi các phiếu KPI của nhân viên đã được xác nhận, trưởng phòng gửi bản cuối cho HR. HR chỉ nhận, không duyệt. Gửi xong các phiếu trong quý được khóa."
        actions={<QuarterPicker value={q.value} options={q.options} />}
      />
      <Tabs tabs={kpiTabs(capsOf(user))} active="summary" />
      <Flash ok={sp.ok} err={sp.err} />

      {mine.length === 0 ? (
        <Card>
          <EmptyState title="Bạn chưa làm trưởng phòng ban nào" hint="Bản cuối do trưởng phòng gửi. Phòng con có trưởng riêng tự gửi bản của mình." />
        </Card>
      ) : (
        <div className="flex flex-col gap-4">
          {mine.map((s) => {
            const rec = getSummary(s.unit.id, q.year, q.quarter);
            const st = rec?.status ?? "NONE";
            const scored = s.rows.filter((r) => r.kpi.score !== null);
            const reminder = st !== "SENT" ? demo.headReminders.get(summaryKey(s.unit.id, q.year, q.quarter)) : undefined;
            return (
              <Card key={s.unit.id} title={`${s.unit.name} · ${q.label}`} actions={<Badge tone={summaryStatusTone[st]}>{summaryStatusLabel[st]}</Badge>}>
                {reminder && (
                  <p className="mb-3 flex items-start gap-2 text-sm text-status-warning-text">
                    <BellRing size={15} className="mt-0.5 shrink-0" aria-hidden /> <span>{reminder.by} (HR) nhắc gửi bản cuối lúc {fmtDateTime(new Date(reminder.at))}</span>
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <div className="min-w-0 text-muted-foreground">
                    {s.rows.length} nhân viên{s.unit.deptNames.length > 1 && ` (gồm ${s.unit.deptNames.join(", ")})`} · {s.rows.reduce((n, r) => n + r.plans.length, 0)} phiếu KPI trong quý
                    {scored.length > 0 && <> · KPI trung bình {pct(scored.reduce((n, r) => n + r.kpi.score!, 0) / scored.length)}</>}
                    {s.blocking.length > 0 && <span className="font-medium text-status-warning-text"> · còn {s.blocking.length} phiếu chưa xác nhận</span>}
                    {rec && <> · gửi lúc {fmtDateTime(new Date(rec.sentAt))}</>}
                  </div>
                  <Link href={`/kpi/summary/${s.unit.id}?yq=${q.value}`} className="btn btn-sm btn-primary">
                    {st === "NONE" ? "Xem và gửi" : st === "REOPENED" ? "Xác nhận lại và gửi lại" : "Xem bản đã gửi"}
                  </Link>
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <DemoNote>Trạng thái gửi đang lưu tạm trong bộ nhớ server (giai đoạn chỉ làm UI), sẽ mất khi khởi động lại. Số liệu KPI lấy từ phiếu KPI trong database.</DemoNote>
    </div>
  );
}
