import Link from "next/link";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import type { ReviewStatus } from "@prisma/client";
import { db } from "@/lib/server/db";
import { fmtDate } from "@/lib/dates";
import { reviewStatusLabel, reviewStatusTone } from "@/lib/labels";
import { GRADE_INFO } from "@/lib/review-templates";
import { cycleSummary } from "@/lib/server/review-summary";
import { Badge, Card, Flash, PageHeader, StatusChips } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { saveRemark, setCycleStatus, setCycleWeight } from "../../actions";
import { requireHRM } from "@/lib/server/access";
import { YearKpiCells, YearKpiHead } from "@/app/(app)/kpi/_components/year-kpi";

type SP = { dept?: string; group?: string; status?: string; ok?: string; err?: string };
const GROUPS = { staff: { level: "STAFF", label: "Đánh giá nhân viên" }, manager: { level: "SUPERVISOR", label: "Đánh giá quản lý" } } as const;

/** Bảng tổng hợp đánh giá cuối năm: KPI các kỳ + năng lực (BM1-003) → điểm tổng hợp, dùng để xét lương, thưởng */
export default async function CyclePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  await requireHRM();
  const { id } = await params;
  const sp = await searchParams;
  const [data, departments] = await Promise.all([cycleSummary(id, sp.dept), db.department.findMany({ orderBy: { name: "asc" } })]);
  if (!data) notFound();
  const { cycle, year, rows: allRows } = data;
  const group = sp.group === "staff" || sp.group === "manager" ? GROUPS[sp.group] : null;
  const inDept = group ? allRows.filter((x) => x.group === group.level) : allRows;
  const reviewed = inDept.filter((x) => x.review);
  const shown = sp.status ? inDept.filter((x) => x.review?.status === sp.status) : inDept;
  const graded = inDept.filter((x) => x.final);
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ dept: sp.dept, group: sp.group, status: sp.status, ...patch })) if (v) p.set(k, v);
    const s = p.toString();
    return s ? `?${s}` : "";
  };
  const deptName = departments.find((d) => d.id === sp.dept)?.name;
  const w = cycle.kpiWeight;

  return (
    <div>
      <PageHeader
        back={{ href: "/reviews/cycles", label: "Kỳ đánh giá" }}
        title={cycle.name}
        description={`${cycle.purpose} · ${fmtDate(cycle.periodStart)} – ${fmtDate(cycle.periodEnd)} · hạn ${fmtDate(cycle.dueDate)}`}
        actions={
          <>
            <a href={`/reviews/cycles/${id}/export${qs({ status: undefined })}`} className="btn">
              <Download size={15} /> Xuất Excel (CSV)
            </a>
            <PrintButton />
            <form action={setCycleStatus.bind(null, id)}>
              <input type="hidden" name="status" value={cycle.status === "OPEN" ? "CLOSED" : "OPEN"} />
              <button className="btn">{cycle.status === "OPEN" ? "Đóng kỳ" : "Mở lại kỳ"}</button>
            </form>
          </>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />

      <div className="mb-5 grid gap-5 lg:grid-cols-3">
        <Card title={`Xếp hạng tổng hợp: ${[group?.label, deptName ?? "Toàn công ty"].filter(Boolean).join(" · ")}`} className="lg:col-span-2" actions={<span className="text-xs text-slate-500">{graded.length}/{inDept.length} người đã có điểm</span>}>
          <div className="grid grid-cols-5 gap-2 text-center">
            {Object.entries(GRADE_INFO).map(([g, info]) => {
              const n = graded.filter((x) => x.final!.grade === g).length;
              return (
                <div key={g} className="rounded-lg border border-slate-200 p-3">
                  <div className="text-xs text-slate-500">Hạng {g}</div>
                  <div className="text-2xl font-semibold tabular-nums text-brand-900">{n}</div>
                  <div className="text-xs tabular-nums text-slate-600">{graded.length ? Math.round((n / graded.length) * 1000) / 10 : 0}%</div>
                  <div className="mt-1 text-[11px] text-slate-400">{info.range}</div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card title="Cách tính điểm tổng hợp">
          <form action={setCycleWeight.bind(null, id)} className="no-print flex items-end gap-2">
            <label className="flex-1">
              <span className="label">KPI các kỳ chiếm (%)</span>
              <input name="kpiWeight" type="number" min={0} max={100} step={5} defaultValue={w} className="input" />
            </label>
            <button className="btn">Lưu</button>
          </form>
          <p className="mt-3 text-xs leading-relaxed text-slate-500">
            Tổng hợp = KPI năm {year} × <b>{w}%</b> + Năng lực (phiếu BM1-003) × <b>{100 - w}%</b>. KPI năm = trung bình các quý đã được quản lý xác nhận trong năm. Chưa có quý nào được xác nhận thì chỉ tính điểm năng lực. Xếp hạng A–E theo cùng thang của phiếu đánh giá.
          </p>
        </Card>
      </div>

      <div className="no-print mb-3 inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-sm" role="tablist" aria-label="Nhóm đánh giá">
        {[
          { key: "", label: "Tất cả", n: allRows.length },
          { key: "staff", label: GROUPS.staff.label, n: allRows.filter((x) => x.group === "STAFF").length },
          { key: "manager", label: GROUPS.manager.label, n: allRows.filter((x) => x.group === "SUPERVISOR").length },
        ].map((g) => (
          <Link
            key={g.key}
            href={`/reviews/cycles/${id}${qs({ group: g.key || undefined, status: undefined })}`}
            role="tab"
            aria-selected={(sp.group ?? "") === g.key}
            className={`rounded-md px-3 py-1.5 font-medium hover:no-underline ${(sp.group ?? "") === g.key ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-100"}`}
          >
            {g.label} <span className="tabular-nums opacity-75">{g.n}</span>
          </Link>
        ))}
      </div>

      <div className="no-print mb-3 flex flex-wrap items-center justify-between gap-2">
        <StatusChips
          active={sp.status ?? "all"}
          items={[
            { key: "all", label: "Tất cả", count: inDept.length, href: `/reviews/cycles/${id}${qs({ status: undefined })}` },
            ...(Object.keys(reviewStatusLabel) as ReviewStatus[]).map((s) => ({ key: s, label: reviewStatusLabel[s], count: reviewed.filter((x) => x.review!.status === s).length, href: `/reviews/cycles/${id}${qs({ status: s })}` })),
          ]}
        />
        <form className="mb-3 flex gap-2">
          {sp.group && <input type="hidden" name="group" value={sp.group} />}
          <select name="dept" defaultValue={sp.dept ?? ""} className="input w-auto">
            <option value="">Tất cả phòng ban</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          <button className="btn">Xem</button>
        </form>
      </div>

      <Card pad={false}>
        <div className="overflow-x-auto">
          <table className="table min-w-[1100px]">
            <thead>
              <tr>
                <th className="min-w-[200px]">Nhân viên</th>
                <YearKpiHead year={year} />
                <th className="text-right">Năng lực</th>
                <th className="text-right">Tổng hợp</th>
                <th>Trạng thái phiếu</th>
                <th className="min-w-[260px]">Đề xuất lương / thưởng / khen thưởng</th>
              </tr>
            </thead>
            <tbody>
              {shown.length === 0 && (
                <tr>
                  <td colSpan={10} className="py-8 text-center text-sm text-slate-500">
                    {group ? `Chưa có ai thuộc nhóm “${group.label}” trong phạm vi đang xem.` : "Không có dữ liệu."}
                  </td>
                </tr>
              )}
              {shown.map(({ employee: e, review: r, year: y, final, noReview }) => (
                <tr key={e.id}>
                  <td>
                    {r ? (
                      <Link href={`/reviews/${r.id}`} className="font-medium">
                        {e.fullName}
                      </Link>
                    ) : (
                      <span className="font-medium">{e.fullName}</span>
                    )}
                    <div className="text-xs text-slate-500">{[e.code, e.position].filter(Boolean).join(" · ")}</div>
                    <div className="text-xs text-slate-400">{e.department?.name}</div>
                  </td>
                  <YearKpiCells y={y} />
                  <td className="text-right tabular-nums">
                    {r?.grade && r.rate !== null ? `${r.rate}%` : "—"}
                    {r?.grade && <div className="whitespace-nowrap text-[11px] text-slate-400">Hạng {r.grade}</div>}
                  </td>
                  <td className="text-right">
                    {final ? (
                      <>
                        <div className="font-semibold tabular-nums text-brand-900">{final.score}%</div>
                        <Badge tone={GRADE_INFO[final.grade].tone}>Hạng {final.grade}</Badge>
                      </>
                    ) : r ? (
                      "—"
                    ) : (
                      <span className="text-xs text-slate-500">Chỉ có KPI năm</span>
                    )}
                  </td>
                  <td>
                    {r ? (
                      <>
                        <Badge tone={reviewStatusTone[r.status]}>{reviewStatusLabel[r.status]}</Badge>
                        {!r.reviewerId && <div className="mt-1 text-[11px] text-red-600">Chưa có người đánh giá</div>}
                      </>
                    ) : (
                      <span className="text-xs text-slate-500">{noReview}</span>
                    )}
                  </td>
                  <td>
                    {r && (
                      <form action={saveRemark.bind(null, r.id)} className="flex gap-1">
                        <input type="hidden" name="qs" value={qs({})} />
                        <input name="remarks" defaultValue={r.remarks ?? ""} placeholder="VD: tăng lương 10%, thưởng…" className="input py-1 text-xs" />
                        <button className="btn btn-sm no-print">Lưu</button>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
      <div className="mt-10 hidden grid-cols-2 text-sm print:grid">
        <div>Ký tên (HOD): ____________________</div>
        <div>Ngày: ____________________</div>
      </div>
    </div>
  );
}
