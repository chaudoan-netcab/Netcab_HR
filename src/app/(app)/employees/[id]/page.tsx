import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { db } from "@/lib/server/db";
import { lockedPlanIds } from "@/lib/server/department-flow";
import { loadYearKpi } from "@/lib/server/kpi-year";
import { canListEmployees, canManageEmployee, canViewEmployee, isHRM, requireEmployeeUser } from "@/lib/server/access";
import { fmtDate, tenure, today } from "@/lib/dates";
import { kpiGradeTone, periodLabel, pct } from "@/lib/kpi";
import { employeeStatusLabel, employeeStatusTone, employeeTypeLabel, employeeTypeTone, jobLevelLabel, kpiStatusView, reviewStatusLabel, reviewStatusTone } from "@/lib/labels";
import { GRADE_INFO } from "@/lib/review-templates";
import { Avatar, Badge, Card, EmptyState, Flash, Tabs } from "@/components/ui";
import { YearKpiStrip } from "@/app/(app)/kpi/_components/year-kpi";

type SP = { tab?: string; ok?: string; err?: string };

export default async function EmployeeDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SP> }) {
  const user = await requireEmployeeUser();
  const { id } = await params;
  const sp = await searchParams;
  if (!(await canViewEmployee(user, id))) notFound();

  const e = await db.employee.findUnique({
    where: { id },
    include: { department: true, manager: true, user: { select: { email: true, role: true } } },
  });
  if (!e) notFound();

  const hr = isHRM(user);
  const base = `/employees/${id}`;
  const tabs = [
    { key: "info", label: "Thông tin", href: base },
    { key: "performance", label: "KPI & Đánh giá", href: `${base}?tab=performance` },
  ];
  const tab = tabs.some((t) => t.key === sp.tab) ? sp.tab! : "info";
  const lastKpi = await db.kpiPlan.findFirst({ where: { employeeId: id, status: { in: ["MANAGER_APPROVED", "COMPLETED"] } }, orderBy: [{ year: "desc" }, { period: "desc" }] });

  return (
    <div>
      <Link href={canListEmployees(user) ? "/employees" : "/"} className="no-print mb-2 inline-block text-xs text-slate-500">
        ← {canListEmployees(user) ? "Nhân viên" : "Tổng quan"}
      </Link>
      <Flash ok={sp.ok} err={sp.err} />

      <section className="card mb-5 p-5">
        <div className="flex flex-wrap items-start gap-4">
          <Avatar name={e.fullName} size={64} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl">{e.fullName}</h1>
              <Badge tone={employeeTypeTone[e.employeeType]}>{employeeTypeLabel[e.employeeType]}</Badge>
              <Badge tone={employeeStatusTone[e.status]}>{employeeStatusLabel[e.status]}</Badge>
            </div>
            <div className="mt-1 text-sm text-slate-500">
              {e.code} · {e.position ?? "Chưa có chức danh"} · {e.department?.name ?? "Chưa có phòng ban"}
            </div>
          </div>
          {hr && (
            <Link href={`${base}/edit`} className="btn no-print">
              <Pencil size={15} /> Sửa hồ sơ
            </Link>
          )}
        </div>
        <div className="mt-5 flex flex-wrap gap-x-12 gap-y-4 border-t border-slate-100 pt-4 text-sm">
          <Quick label="Thâm niên" value={tenure(e.joinDate)} sub={`Vào làm ${fmtDate(e.joinDate)}`} />
          <Quick label="Quản lý trực tiếp" value={e.manager?.fullName ?? "—"} />
          <Quick label="KPI gần nhất" value={lastKpi ? pct(lastKpi.score) : "—"} sub={lastKpi ? `${periodLabel(lastKpi.periodType, lastKpi.period, lastKpi.year)} · ${lastKpi.grade}` : undefined} />
        </div>
      </section>

      <Tabs active={tab} tabs={tabs} />

      {tab === "info" && (
        <div className="grid gap-5 lg:grid-cols-2">
          <Card title="Công việc">
            <dl className="dl">
              <Item k="Mã nhân viên" v={e.code} />
              <Item k="Phòng ban" v={e.department?.name} />
              <Item k="Quản lý trực tiếp" v={e.manager?.fullName} />
              <Item k="Chức danh" v={e.position} />
              <Item k="Cấp bậc" v={jobLevelLabel[e.jobLevel]} />
              <Item k="Nơi làm việc" v={e.workLocation} />
              <Item k="Ngày vào làm" v={fmtDate(e.joinDate)} />
              <Item k="Ngày chính thức" v={fmtDate(e.officialDate)} />
              {e.leaveDate && <Item k="Ngày nghỉ việc" v={fmtDate(e.leaveDate)} />}
              {hr && <Item k="Tài khoản đăng nhập" v={e.user ? e.user.email : "Chưa thiết lập"} />}
            </dl>
          </Card>
          <Card title="Liên hệ">
            <dl className="dl lg:grid-cols-1">
              <Item k="Email công ty" v={e.workEmail} />
              <Item k="Điện thoại" v={e.phone} />
            </dl>
          </Card>
        </div>
      )}

      {tab === "performance" && <PerformanceTab employeeId={e.id} canManage={await canManageEmployee(user, e.id)} />}
    </div>
  );
}

function Quick({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="font-semibold text-slate-900">{value}</div>
      {sub && <div className="text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

function Item({ k, v }: { k: string; v: string | null | undefined }) {
  return (
    <div>
      <dt>{k}</dt>
      <dd>{v && v !== "—" ? v : <span className="font-normal text-slate-400">—</span>}</dd>
    </div>
  );
}
async function PerformanceTab({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const [plans, reviews] = await Promise.all([
    db.kpiPlan.findMany({ where: { employeeId }, orderBy: [{ year: "desc" }, { periodType: "asc" }, { period: "desc" }] }),
    db.review.findMany({ where: { employeeId }, include: { cycle: true }, orderBy: { createdAt: "desc" } }),
  ]);
  const locked = await lockedPlanIds(plans);
  const year = today().getUTCFullYear();
  const yearKpi = (await loadYearKpi([employeeId], year)).get(employeeId)!;
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title={`KPI năm ${year}`} className="lg:col-span-2">
        <YearKpiStrip y={yearKpi} year={year} currentQuarter={Math.floor(today().getUTCMonth() / 3) + 1} />
      </Card>
      <Card title="Phiếu KPI" pad={false} actions={canManage && <Link href={`/kpi/plans?employee=${employeeId}`} className="btn btn-sm">Giao KPI</Link>}>
        {plans.length === 0 ? (
          <EmptyState title="Chưa có phiếu KPI" />
        ) : (
          <table className="table">
            <tbody>
              {plans.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link href={`/kpi/${p.id}`}>{periodLabel(p.periodType, p.period, p.year)}</Link>
                    <div className="text-xs text-slate-500">{p.title}</div>
                  </td>
                  <td className="tabular-nums">{pct(p.score)}</td>
                  <td>{p.grade && <Badge tone={kpiGradeTone(p.grade)}>{p.grade}</Badge>}</td>
                  <td>
                    <Badge tone={kpiStatusView(p.status, locked.has(p.id)).tone}>{kpiStatusView(p.status, locked.has(p.id)).label}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
      <Card title="Đánh giá thành tích (BM1-003)" pad={false}>
        {reviews.length === 0 ? (
          <EmptyState title="Chưa có phiếu đánh giá" />
        ) : (
          <table className="table">
            <tbody>
              {reviews.map((r) => (
                <tr key={r.id}>
                  <td>
                    <Link href={`/reviews/${r.id}`}>{r.cycle.name}</Link>
                  </td>
                  <td className="tabular-nums">{r.rate !== null ? `${r.rate}%` : "—"}</td>
                  <td>{r.grade && <Badge tone={GRADE_INFO[r.grade].tone}>Hạng {r.grade}</Badge>}</td>
                  <td>
                    <Badge tone={reviewStatusTone[r.status]}>{reviewStatusLabel[r.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}
