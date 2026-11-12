import Link from "next/link";
import { notFound } from "next/navigation";
import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { ReviewStatus } from "@prisma/client";
import { db } from "@/lib/server/db";
import { canViewEmployee, isHRM, requireEmployeeUser } from "@/lib/server/access";
import { fmtDate, fmtDateTime } from "@/lib/dates";
import { kpiGradeTone, periodLabel, pct } from "@/lib/kpi";
import { contractRecLabel, jobLevelLabel, reviewStatusLabel, reviewStatusTone } from "@/lib/labels";
import { REVIEW_TEMPLATES, WEIGHT_NOTE } from "@/lib/review-templates";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { ReviewScoreTable } from "@/app/(app)/reviews/_components/review-score-table";
import { saveReview } from "../actions";

const STEPS: { key: ReviewStatus; label: string }[] = [
  { key: "SELF_REVIEW", label: "Nhân viên tự đánh giá" },
  { key: "MANAGER_REVIEW", label: "Người đánh giá chấm" },
  { key: "EMPLOYEE_ACK", label: "Nhân viên xem & cho ý kiến" },
  { key: "HOD_APPROVAL", label: "Trưởng bộ phận (HOD) duyệt" },
  { key: "COMPLETED", label: "Hoàn tất" },
];

export default async function ReviewPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireEmployeeUser();
  const { id } = await params;
  const sp = await searchParams;
  const r = await db.review.findUnique({
    where: { id },
    include: {
      cycle: true,
      scores: true,
      employee: { include: { department: true } },
      reviewer: true,
      hod: true,
    },
  });
  if (!r) notFound();
  const me = user.employeeId;
  const hr = isHRM(user);
  const isEmployee = me === r.employeeId;
  if (!(isEmployee || me === r.reviewerId || me === r.hodId || hr || (await canViewEmployee(user, r.employeeId)))) notFound();

  const notSelf = !isEmployee;
  const open = r.cycle.status === "OPEN";
  const can: Record<ReviewStatus, boolean> = {
    SELF_REVIEW: open && (isEmployee || hr),
    MANAGER_REVIEW: open && (me === r.reviewerId || hr) && notSelf,
    EMPLOYEE_ACK: open && (isEmployee || hr),
    HOD_APPROVAL: open && (me === r.hodId || hr) && notSelf,
    COMPLETED: open && hr && notSelf,
  };
  const myTurn = can[r.status];
  const st = r.status;
  const managerPhaseReached = st !== "SELF_REVIEW";
  // Nhân viên chỉ thấy điểm của quản lý khi phiếu đã tới bước xác nhận
  const showManager = managerPhaseReached && (!isEmployee || st === "EMPLOYEE_ACK" || st === "HOD_APPROVAL" || st === "COMPLETED");
  const editing = myTurn ? (st === "SELF_REVIEW" ? "self" : st === "MANAGER_REVIEW" ? "manager" : null) : null;
  const mgrEdit = st === "MANAGER_REVIEW" && myTurn;

  const selfScores = Object.fromEntries(r.scores.map((s) => [s.criterionKey, s.selfScore]));
  const mgrScores = Object.fromEntries(r.scores.map((s) => [s.criterionKey, s.managerScore]));
  const year = r.cycle.periodEnd.getUTCFullYear();
  const kpis = await db.kpiPlan.findMany({ where: { employeeId: r.employeeId, year, status: "COMPLETED" }, orderBy: [{ periodType: "asc" }, { period: "asc" }] });
  const idx = STEPS.findIndex((s) => s.key === st);

  return (
    <div>
      <PageHeader
        back={{ href: isEmployee ? "/reviews" : hr ? `/reviews/cycles/${r.cycleId}` : "/reviews", label: isEmployee ? "Đánh giá cá nhân" : r.cycle.name }}
        title="Bảng kế hoạch & đánh giá thành tích"
        description={`Mẫu BM1-003 · ${REVIEW_TEMPLATES[r.template].title}`}
        actions={
          <>
            <Badge tone={reviewStatusTone[st]}>{reviewStatusLabel[st]}</Badge>
            <PrintButton />
          </>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />

      {/* Thanh tiến trình các bước (giống Workday) */}
      <ol className="no-print mb-5 grid grid-cols-5 gap-2">
        {STEPS.map((s, i) => (
          <li key={s.key} className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-xs ${i === idx ? "border-brand-500 bg-brand-50 font-semibold text-brand-700" : i < idx ? "border-emerald-200 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
            {i < idx ? <CheckCircle2 size={15} /> : i === idx ? <CircleDot size={15} /> : <Circle size={15} />}
            {s.label}
          </li>
        ))}
      </ol>

      {!open && <Flash err="Kỳ đánh giá đã đóng. Phiếu ở chế độ chỉ xem." />}
      {open && myTurn && st !== "COMPLETED" && (
        <div className="mb-4 rounded-lg border border-brand-200 bg-brand-50 px-4 py-2.5 text-sm text-brand-800">
          {hr && !(isEmployee || me === r.reviewerId || me === r.hodId) ? "Đang thao tác với quyền HRM. " : "Bước cần xử lý: "}
          <b>{reviewStatusLabel[st]}</b>
          {r.cycle.dueDate && ` · hạn ${fmtDate(r.cycle.dueDate)}`}
        </div>
      )}

      <form action={saveReview.bind(null, r.id)} className="flex flex-col gap-5">
        <Card>
          <div className="grid gap-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <Info k="Nhân viên" v={<Link href={`/employees/${r.employeeId}`}>{r.employee.fullName}</Link>} />
            <Info k="Mã số nhân viên" v={r.employee.code} />
            <Info k="Bộ phận" v={r.employee.department?.name} />
            <Info k="Chức vụ" v={`${r.employee.position ?? ""} (${jobLevelLabel[r.template]})`} />
            <Info k="Mục đích đánh giá" v={r.cycle.purpose} />
            <Info k="Thời kỳ đánh giá" v={`${fmtDate(r.cycle.periodStart)} – ${fmtDate(r.cycle.periodEnd)}`} />
            <Info k="Ngày vào làm" v={fmtDate(r.employee.joinDate)} />
            <Info k="Người đánh giá / HOD" v={`${r.reviewer?.fullName ?? "HRM"} / ${r.hod?.fullName ?? "HRM"}`} />
          </div>
        </Card>

        {kpis.length > 0 && (
          <Card title={`Tham khảo: kết quả KPI năm ${year}`}>
            <div className="flex flex-wrap gap-2">
              {kpis.map((k) => (
                <Link key={k.id} href={`/kpi/${k.id}`} className="no-underline hover:no-underline">
                  <Badge tone={kpiGradeTone(k.grade)}>
                    {periodLabel(k.periodType, k.period, k.year)}: {pct(k.score)}
                  </Badge>
                </Link>
              ))}
            </div>
          </Card>
        )}

        <Card title="Phần A: Thành tích cơ bản & cử chỉ hành vi" pad={false}>
          <div className="p-5">
            <p className="mb-3 text-xs text-slate-500">
              Thang điểm: 0 Không đạt · 1–4 Ít đạt · 5 Đạt yêu cầu · 6–9 Đạt hoàn toàn · 10 Xuất sắc. Tỷ trọng: {WEIGHT_NOTE[r.template]}
            </p>
            <ReviewScoreTable template={r.template} self={selfScores} manager={mgrScores} editable={editing} showManager={showManager} bonus={r.bonus} bonusEditable={mgrEdit} />
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Phần B: Đóng góp & cải tiến">
            <p className="mb-2 text-xs text-slate-500">Thành tích xuất sắc phải được giải thích tại phần này. Điểm cộng 1/3/5 do người đánh giá chọn ở Phần A.</p>
            {(st === "SELF_REVIEW" && myTurn) || mgrEdit ? (
              <textarea name="contributions" defaultValue={r.contributions ?? ""} className="input" />
            ) : (
              <Text v={r.contributions} />
            )}
          </Card>
          <Card title="Phần C: Thiếu sót cần cải tiến">
            <p className="mb-2 text-xs text-slate-500">Thành tích chưa đạt phải được giải thích tại phần này.</p>
            {mgrEdit ? <textarea name="shortcomings" defaultValue={r.shortcomings ?? ""} className="input" /> : <Text v={showManager ? r.shortcomings : null} />}
          </Card>
        </div>

        {/* Phần D (chương trình cải tiến) đã bỏ cùng tính năng follow-up.
            TODO(backend): khi HRM chốt mẫu phiếu đánh giá mới, nếu có mục kế hoạch cải tiến thì thêm trường văn bản riêng
            trên phiếu đánh giá (Review), không dùng lại bảng FollowUp. */}

        {(showManager || mgrEdit) && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Đề nghị về hợp đồng kỳ này">
              {mgrEdit ? (
                <div className="flex flex-col gap-3">
                  <div className="flex flex-wrap gap-4 text-sm">
                    {Object.entries(contractRecLabel).map(([k, v]) => (
                      <label key={k} className="flex items-center gap-1.5">
                        <input type="radio" name="contractRecommendation" value={k} defaultChecked={r.contractRecommendation === k} /> {v}
                      </label>
                    ))}
                  </div>
                  <input name="contractNote" defaultValue={r.contractNote ?? ""} placeholder="Ghi chú đề nghị khác…" className="input" />
                </div>
              ) : (
                <div className="text-sm">
                  <b>{r.contractRecommendation ? contractRecLabel[r.contractRecommendation] : "—"}</b> {r.contractNote && <span className="text-slate-600">· {r.contractNote}</span>}
                </div>
              )}
            </Card>
            <Card title="Phần E: Kế hoạch phát triển quản lý">
              {mgrEdit ? (
                <div className="flex flex-col gap-3">
                  <div className="flex gap-4 text-sm">
                    <label className="flex items-center gap-1.5"><input type="radio" name="devPlan" value="yes" defaultChecked={r.devPlan === true} /> Có</label>
                    <label className="flex items-center gap-1.5"><input type="radio" name="devPlan" value="no" defaultChecked={r.devPlan === false} /> Không</label>
                  </div>
                  <input name="devPlanReason" defaultValue={r.devPlanReason ?? ""} placeholder="Lý do…" className="input" />
                </div>
              ) : (
                <div className="text-sm">
                  <b>{r.devPlan === null ? "—" : r.devPlan ? "Có" : "Không"}</b> {r.devPlanReason && <span className="text-slate-600">· {r.devPlanReason}</span>}
                </div>
              )}
            </Card>
          </div>
        )}

        {["EMPLOYEE_ACK", "HOD_APPROVAL", "COMPLETED"].includes(st) && (
          <div className="grid gap-5 lg:grid-cols-2">
            <Card title="Ý kiến của nhân viên">
              {st === "EMPLOYEE_ACK" && myTurn ? (
                <Field label="Ý kiến (không bắt buộc). “Xác nhận đã xem” thể hiện nhân viên đã đọc kết quả, không đồng nghĩa với việc đồng ý.">
                  <textarea name="employeeComment" defaultValue={r.employeeComment ?? ""} className="input" />
                </Field>
              ) : (
                <Text v={r.employeeComment} />
              )}
            </Card>
            <Card title="Ý kiến của Trưởng bộ phận (HOD)">
              {st === "HOD_APPROVAL" && myTurn ? <textarea name="hodComment" defaultValue={r.hodComment ?? ""} className="input" /> : <Text v={r.hodComment} />}
            </Card>
          </div>
        )}

        <Card title="Chữ ký điện tử">
          <div className="grid gap-4 text-sm sm:grid-cols-4">
            <Sign label="Nhân viên tự đánh giá" at={r.selfSubmittedAt} who={r.employee.fullName} />
            <Sign label="Người đánh giá" at={r.managerSubmittedAt} who={r.reviewer?.fullName} />
            <Sign label="Nhân viên xác nhận" at={r.employeeAckAt} who={r.employee.fullName} />
            <Sign label="HOD" at={r.hodApprovedAt} who={r.hod?.fullName} />
          </div>
        </Card>

        {open && myTurn && (
          <div className="action-bar">
            {st !== "COMPLETED" && <button name="intent" value="save" className="btn">Lưu nháp</button>}
            {(st === "MANAGER_REVIEW" || st === "HOD_APPROVAL") && <button name="intent" value="back" className="btn">Trả lại bước trước</button>}
            {st === "SELF_REVIEW" && <button name="intent" value="next" className="btn btn-primary">Gửi người đánh giá</button>}
            {st === "MANAGER_REVIEW" && <button name="intent" value="next" className="btn btn-primary">Gửi nhân viên xác nhận</button>}
            {st === "EMPLOYEE_ACK" && <button name="intent" value="next" className="btn btn-primary">Xác nhận đã xem</button>}
            {st === "HOD_APPROVAL" && <button name="intent" value="next" className="btn btn-primary">Duyệt & hoàn tất</button>}
            {st === "COMPLETED" && <button name="intent" value="reopen" className="btn">Mở lại phiếu (HRM)</button>}
          </div>
        )}
      </form>
    </div>
  );
}

function Info({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{k}</div>
      <div className="font-medium text-slate-800">{v || "—"}</div>
    </div>
  );
}

function Text({ v }: { v: string | null | undefined }) {
  return v ? <p className="whitespace-pre-line text-sm text-slate-700">{v}</p> : <p className="text-sm text-slate-400">Chưa có nội dung</p>;
}

function Sign({ label, at, who }: { label: string; at: Date | null; who?: string | null }) {
  return (
    <div className={`rounded-lg border p-3 ${at ? "border-emerald-200 bg-emerald-50/50" : "border-dashed border-slate-300"}`}>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-medium">{at ? who ?? "—" : "Chưa ký"}</div>
      {at && <div className="text-xs text-slate-500">{fmtDateTime(at)}</div>}
    </div>
  );
}
