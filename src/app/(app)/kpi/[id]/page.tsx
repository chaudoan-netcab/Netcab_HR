import Link from "next/link";
import { notFound } from "next/navigation";
import { BellRing, CheckCircle2, Circle, Lock } from "lucide-react";
import { db } from "@/lib/server/db";
import { canManageEmployee, canViewEmployee, isHRM, requireEmployeeUser } from "@/lib/server/access";
import { planLock } from "@/lib/server/department-flow";
import { diffDays, fmtDate, fmtDateTime, today, toInputDate } from "@/lib/dates";
import { pct, periodLabel, periodRange, provisionalKpi } from "@/lib/kpi";
import { demo } from "@/lib/server/demo-store";
import { kpiFormulaLabel, kpiStatusView } from "@/lib/labels";
import { Badge, Card, Field, Flash, PageHeader, ProgressBar } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { KpiEntryTable } from "@/app/(app)/kpi/_components/kpi-entry-table";
import { SubmitPlanButton } from "@/app/(app)/kpi/_components/submit-plan-button";
import { EditPlanItemsDialog } from "@/app/(app)/kpi/_components/kpi-dialogs";
import { deletePlan, remindPlan, savePlan, updatePlanItems } from "../actions";
import { DateInput } from "@/components/date-input";

/** Nhãn thông tin (giống `.dl dt`): 12px xám */
const META_LABEL = "text-xs text-muted-foreground";

export default async function KpiPlanPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireEmployeeUser();
  const { id } = await params;
  const sp = await searchParams;
  const plan = await db.kpiPlan.findUnique({
    where: { id },
    include: { items: { orderBy: { sortOrder: "asc" } }, employee: { include: { department: true, manager: true } } },
  });
  if (!plan || !(await canViewEmployee(user, plan.employeeId))) notFound();

  const self = user.employeeId === plan.employeeId;
  const manager = !self && (await canManageEmployee(user, plan.employeeId));
  const hrm = isHRM(user);
  const s = plan.status;
  // "Đã khóa" suy ra khi hiển thị: trưởng phòng đã gửi bản cuối quý cho HR (hoặc phiếu COMPLETED cũ)
  const lock = await planLock(plan);
  const editable = !lock.locked && ((self && s === "DRAFT") || (manager && (s === "DRAFT" || s === "SUBMITTED")));
  const status = kpiStatusView(s, lock.locked);
  const action = savePlan.bind(null, plan.id);

  // Chỉ số riêng = không có trong bộ KPI gốc của phòng
  const setNames = plan.templateId ? new Set((await db.kpiTemplateItem.findMany({ where: { templateId: plan.templateId }, select: { name: true } })).map((i) => i.name)) : null;
  const items = plan.items.map((i) => ({ ...i, custom: !!setNames && !setNames.has(i.name) }));
  const customCount = items.filter((i) => i.custom).length;

  // Tiến độ trong kỳ: nhân viên cập nhật bất cứ lúc nào, cuối kỳ gửi báo cáo cho quản lý xác nhận
  const updating = s === "DRAFT" && !lock.locked;
  const range = periodRange(plan.periodType, plan.period, plan.year);
  const daysLeft = diffDays(today(), range.end);
  const prov = provisionalKpi(plan.items);
  const lastUpdate = demo.kpiProgress.get(plan.id);
  const reminder = updating ? demo.kpiReminders.get(plan.id) : undefined;
  const canManageItems = manager && updating;

  const sumAt = lock.bySummary && lock.summary ? new Date(lock.summary.sentAt) : null;
  const steps = [
    { label: "Nhân viên", at: plan.employeeSignedAt, who: plan.employee.fullName },
    { label: "Quản lý trực tiếp xác nhận", at: plan.managerSignedAt, who: plan.employee.manager?.fullName ?? (plan.employee.managerId ? "—" : "Tự chốt (không có cấp trên)") },
    lock.legacy
      ? { label: "Khóa phiếu", at: plan.hrSignedAt, who: "HRM" }
      : { label: `Bản cuối quý ${lock.quarter} gửi HR`, at: sumAt, who: lock.summary?.senderName ?? "—", pending: "Phiếu khóa khi trưởng phòng gửi bản cuối cho HR" },
  ];

  return (
    <div>
      <PageHeader
        back={{ href: self ? "/kpi" : "/kpi/plans", label: self ? "KPI cá nhân" : "Phiếu KPI nhân viên" }}
        title={plan.title}
        description={`${plan.subtitle ?? ""} · ${periodLabel(plan.periodType, plan.period, plan.year)}`}
        actions={
          <>
            <Badge tone={status.tone}>{status.label}</Badge>
            {canManageItems && (
              <form action={remindPlan.bind(null, plan.id)}>
                <button className="btn" title="Nhân viên sẽ thấy lời nhắc trong “Việc cần làm”">
                  <BellRing size={16} /> Nhắc cập nhật
                </button>
              </form>
            )}
            {canManageItems && (
              <EditPlanItemsDialog
                action={updatePlanItems.bind(null, plan.id)}
                employeeName={plan.employee.fullName}
                items={items.map(({ id, section, name, measurement, unit, target, weight, formula, note, custom }) => ({ id, section, name, measurement, unit, target, weight, formula, note, custom }))}
              />
            )}
            <PrintButton />
          </>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />
      {lock.locked && (
        <div role="status" className="card mb-4 flex items-start gap-2 px-4 py-3 text-sm text-foreground max-md:px-3">
          <Lock size={16} className="mt-0.5 shrink-0 text-status-success-text" aria-hidden />
          <span>
            {lock.bySummary
              ? `Phiếu đã khóa: ${lock.unit?.name ?? "phòng"} đã gửi bản cuối quý ${lock.quarter}/${plan.year} cho HR${sumAt ? ` ngày ${fmtDate(sumAt)}` : ""}.`
              : "Phiếu đã khóa."}{" "}
            {hrm ? "HRM có thể mở lại phiếu nếu cần sửa." : "Liên hệ HRM nếu cần mở lại."}
          </span>
        </div>
      )}

      {reminder && (
        <div role="status" className="card mb-4 flex items-start gap-2 px-4 py-3 text-sm text-foreground max-md:px-3">
          <BellRing size={16} className="mt-0.5 shrink-0 text-status-warning-text" aria-hidden />
          <span>
            {self ? <><b className="font-medium">{reminder.by}</b> nhắc bạn cập nhật tiến độ KPI</> : <>Đã nhắc nhân viên cập nhật tiến độ</>} lúc {fmtDateTime(new Date(reminder.at))}.
          </span>
        </div>
      )}

      {updating && (
        <Card className="mb-5">
          <div className="grid gap-4 text-sm md:grid-cols-3">
            <div>
              <div className={META_LABEL}>Thời gian của kỳ</div>
              <div className="mt-1 font-medium tabular-nums text-foreground">{fmtDate(range.start)} – {fmtDate(range.end)}</div>
              <div className={`mt-0.5 text-xs ${daysLeft < 0 ? "font-medium text-status-danger-text" : daysLeft <= 15 ? "font-medium text-status-warning-text" : "text-muted-foreground"}`}>
                {range.start > today() ? `Chưa tới kỳ · bắt đầu ${fmtDate(range.start)}` : daysLeft < 0 ? `Đã hết kỳ ${-daysLeft} ngày · cần gửi kết quả` : daysLeft === 0 ? "Hôm nay là ngày cuối kỳ" : `Còn ${daysLeft} ngày đến cuối kỳ`}
              </div>
            </div>
            <div>
              <div className={`flex items-baseline justify-between gap-2 ${META_LABEL}`}>
                <span>Tiến độ cập nhật</span>
                <span className="tabular-nums">{prov.updated}/{prov.total} chỉ số</span>
              </div>
              <div className="mt-2">
                <ProgressBar value={prov.total ? prov.updated / prov.total : 0} tone={prov.updated === prov.total ? "green" : "blue"} />
              </div>
              <div className="mt-1.5 text-xs text-muted-foreground">
                KPI tạm tính <b className="font-semibold tabular-nums text-foreground">{pct(prov.score)}</b> (chỉ tính các chỉ số đã có số liệu)
              </div>
            </div>
            <div>
              <div className={META_LABEL}>Cập nhật lần cuối</div>
              <div className="mt-1 font-medium tabular-nums text-foreground">{lastUpdate ? fmtDateTime(new Date(lastUpdate.at)) : "—"}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{lastUpdate ? lastUpdate.by : "Chưa ghi nhận lần cập nhật nào"}</div>
            </div>
          </div>
          <p className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">
            {self
              ? "Cập nhật số liệu bất cứ lúc nào trong kỳ rồi bấm “Lưu tiến độ”. Cuối kỳ nhập đủ các chỉ số và gửi báo cáo cho quản lý xác nhận."
              : "Nhân viên tự cập nhật tiến độ trong kỳ. Bấm “Nhắc cập nhật” để gửi lời nhắc vào mục Việc cần làm của nhân viên."}
          </p>
        </Card>
      )}

      <form action={action}>
        <Card className="mb-5">
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <div className={META_LABEL}>Họ và tên</div>
              <Link href={`/employees/${plan.employeeId}`} className="mt-1 inline-block font-medium">{plan.employee.fullName}</Link>
            </div>
            <div>
              <div className={META_LABEL}>Chức vụ</div>
              <div className="mt-1 font-medium text-foreground">{plan.employee.position ?? "—"}</div>
            </div>
            <div>
              <div className={META_LABEL}>Phòng ban</div>
              <div className="mt-1 font-medium text-foreground">{plan.employee.department?.name ?? "—"}</div>
            </div>
            {editable && manager ? (
              <Field label="Ngày đánh giá">
                <DateInput name="evaluationDate" defaultValue={toInputDate(plan.evaluationDate)} />
              </Field>
            ) : (
              <div>
                <div className={META_LABEL}>Ngày đánh giá</div>
                <div className="mt-1 font-medium tabular-nums text-foreground">{fmtDate(plan.evaluationDate)}</div>
              </div>
            )}
          </div>
        </Card>

        <Card
          pad={false}
          className="mb-5"
          title={`Chỉ số đánh giá (${items.length})`}
          actions={customCount > 0 ? <span className="text-xs text-muted-foreground">Có {customCount} chỉ số riêng cho người này</span> : undefined}
        >
          <KpiEntryTable
            editable={editable}
            items={items.map((i) => ({ ...i, formulaLabel: kpiFormulaLabel[i.formula] }))}
          />
        </Card>

        <div className="grid gap-5 lg:grid-cols-3">
          <Card title="Nhận xét của quản lý" className="lg:col-span-2">
            {manager && !lock.locked ? (
              <textarea name="managerComment" defaultValue={plan.managerComment ?? ""} className="input" placeholder="Điểm tốt, điểm cần cải thiện trong kỳ…" />
            ) : (
              <p className="whitespace-pre-line text-sm text-foreground">{plan.managerComment ?? <span className="text-muted-foreground">Chưa có nhận xét</span>}</p>
            )}
          </Card>
          <Card title="Các bước">
            <ol className="flex flex-col gap-3 text-sm">
              {steps.map((st) => (
                <li key={st.label} className="flex items-start gap-2">
                  {st.at ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-status-success-text" aria-hidden /> : <Circle size={16} className="mt-0.5 shrink-0 text-muted-foreground" aria-hidden />}
                  <div>
                    <div className="font-medium text-foreground">{st.label}</div>
                    <div className="text-xs text-muted-foreground">{st.at ? `${st.who} · ${fmtDateTime(st.at)}` : ("pending" in st && st.pending) || "Chưa xác nhận"}</div>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </div>

        <div className="action-bar">
          {manager && !lock.locked && (
            <button formAction={deletePlan.bind(null, plan.id)} className="btn btn-danger mr-auto">
              Xóa phiếu
            </button>
          )}
          {editable && <button name="intent" value="save" className="btn">Lưu tiến độ</button>}
          {!lock.locked && s === "DRAFT" && (self || manager) && <SubmitPlanButton initialMissing={plan.items.filter((i) => i.actual === null).map((i) => i.name)} autoApprove={self && !plan.employee.managerId} />}
          {!lock.locked && s === "SUBMITTED" && manager && (
            <>
              <button name="intent" value="return" className="btn">Trả lại nhân viên</button>
              <button name="intent" value="approve" className="btn btn-primary">Xác nhận kết quả</button>
            </>
          )}
          {!lock.locked && s === "MANAGER_APPROVED" && manager && <button name="intent" value="return" className="btn">Trả lại nhân viên để sửa</button>}
          {lock.locked && hrm && (
            <span className="flex flex-wrap items-center gap-2">
              <label className="sr-only" htmlFor="reopenReason">Lý do mở lại</label>
              <input id="reopenReason" name="reopenReason" required className="input w-full sm:w-72" placeholder="Lý do mở lại (bắt buộc)" />
              <button name="intent" value="reopen" className="btn">Mở lại phiếu</button>
            </span>
          )}
        </div>
      </form>

    </div>
  );
}
