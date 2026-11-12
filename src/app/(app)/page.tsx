import Link from "next/link";
import { redirect } from "next/navigation";
import { ClipboardCheck, ListTodo, Target, Users } from "lucide-react";
import type { EmployeeType, Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { companyScope, companyView, isAdmin, isHRM, isManager, requireEmployeeUser, teamScope } from "@/lib/server/access";
import { getCurrentUser, type CurrentUser } from "@/lib/server/auth";
import { getSummary, loadUnits, lockedPlanIds, parseYq } from "@/lib/server/department-flow";
import { missingAttendanceMonths, monthLabel as attMonthLabel } from "@/lib/server/attendance";
import { ViewToggle } from "@/components/flow-ui";
import { today } from "@/lib/dates";
import { inQuarter, kpiGrade, periodLabel, provisionalKpi } from "@/lib/kpi";
import { employeeTypeLabel, kpiStatusLabel, taskStatusLabel } from "@/lib/labels";
import { GRADE_INFO } from "@/lib/review-templates";
import { OPEN_TASK } from "@/lib/server/tasks";
import { Card, Flash } from "@/components/ui";
import { ColumnChart, Donut, Gauge, HBarChart, LineChart, ProgressRing, type Segment } from "@/components/dashboard-charts";
import { AutoRefresh } from "@/components/live-refresh";

/** KPI dưới mức này = dưới "Hoàn thành" */
const KPI_OK = 0.8;
/** KPI từ mức này trở lên = "Hoàn thành tốt" */
const KPI_GOOD = 0.9;
const DAY = 86_400_000;

/** Màu theo vai trò của dữ liệu (token trong globals.css) */
const C = {
  s1: "var(--viz-1)",
  s2: "var(--viz-2)",
  s3: "var(--viz-3)",
  s4: "var(--viz-4)",
  neutral: "var(--viz-neutral)",
  warning: "var(--st-warning)",
  // thang thứ bậc: nhạt = bước đầu, đậm = bước cuối / hạng cao
  seq: ["var(--seq-250)", "var(--seq-300)", "var(--seq-400)", "var(--seq-500)", "var(--seq-600)"],
};

/** Kỳ nào mới hơn: quy về tháng kết thúc kỳ để so được tháng với quý */
const periodKey = (p: { year: number; periodType: string; period: number }) => p.year * 12 + (p.periodType === "MONTH" ? p.period : p.period * 3);
const monthLabel = (k: number) => {
  const y = Math.floor((k - 1) / 12);
  return `T${k - y * 12}/${String(y).slice(2)}`;
};
const shortPeriod = (p: { periodType: string; period: number; year: number }) => `${p.periodType === "MONTH" ? "T" : "Q"}${p.period}/${String(p.year).slice(2)}`;
const pct1 = (v: number) => `${Math.round(v * 1000) / 10}%`;

/**
 * Trang Tổng quan — chỉ số và biểu đồ, không có danh sách chữ.
 * Việc cần làm của từng người nằm ở nút "Việc cần làm" trên thanh trên cùng.
 * Số liệu tự cập nhật mỗi 30 giây.
 */
export default async function Dashboard({ searchParams }: { searchParams: Promise<{ view?: string; ok?: string; err?: string }> }) {
  // Admin không có trang Tổng quan nghiệp vụ → vào thẳng Quản trị hệ thống (vd ngay sau khi đăng nhập)
  const me = await getCurrentUser();
  if (me && isAdmin(me)) redirect("/admin");
  const user = await requireEmployeeUser();
  const sp = await searchParams;
  const hrm = isHRM(user);
  // HRM: công tắc "Phòng tôi / Toàn công ty" (mặc định Toàn công ty); ở "Phòng tôi" giống hệt một Quản lý
  const company = companyView(user, sp.view);
  return (
    <div className="flex flex-col gap-5">
      <AutoRefresh seconds={30} />
      {hrm && (
        <div className="flex justify-end">
          <ViewToggle company={company} hrefMine="/?view=mine" hrefCompany="/" />
        </div>
      )}
      {sp.ok || sp.err ? <Flash ok={sp.ok} err={sp.err} /> : null}
      {hrm && company && <HrmInbox />}
      {company ? <Overview user={user} company /> : isManager(user) || hrm ? <Overview user={user} company={false} /> : <Personal employeeId={user.employeeId} />}
    </div>
  );
}

/** HRM — mục "Cần xử lý": tháng chưa import chấm công, phòng chưa gửi bản cuối KPI quý vừa kết thúc */
async function HrmInbox() {
  const missing = missingAttendanceMonths();
  const { units } = await loadUnits();
  const q = parseYq(undefined);
  const notSent = units.filter((u) => getSummary(u.id, q.year, q.quarter)?.status !== "SENT");
  const items = [
    { href: "/attendance", label: "Tháng chưa import chấm công", value: missing.length, sub: missing.length ? missing.map(attMonthLabel).join(", ") : "Đã import đủ" },
    { href: `/heads?yq=${q.value}`, label: `Phòng chưa gửi bản cuối ${q.label}`, value: notSent.length, sub: notSent.length ? notSent.map((u) => u.name).join(", ") : "Các phòng đã gửi đủ" },
  ];
  return (
    <section aria-label="Cần xử lý">
      <h2 className="mb-2 text-sm font-semibold text-slate-700">Cần xử lý</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {items.map((i) => (
          <StatCard key={i.href} icon={ClipboardCheck} label={i.label} value={String(i.value)} sub={i.sub} tone={i.value ? "amber" : "green"} href={i.href} />
        ))}
      </div>
    </section>
  );
}

// ───────────────────────── HRM: toàn công ty · Quản lý (và HRM "Phòng tôi"): nhóm của mình ─────────────────────────

async function Overview({ user, company }: { user: CurrentUser; company: boolean }) {
  const now = today();
  const scope: Prisma.EmployeeWhereInput = company ? companyScope() : teamScope(user);
  const inScope = { employee: scope };
  const WEEKS = 8;
  const monday = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - ((now.getUTCDay() + 6) % 7));
  const since = new Date(monday - (WEEKS - 1) * 7 * DAY);

  const [employees, plans, openTasks, lateTasks, cycle, recentTasks] = await Promise.all([
    db.employee.findMany({ where: { AND: [scope, { status: { not: "RESIGNED" } }] }, select: { id: true, employeeType: true, departmentId: true, fullName: true, department: { select: { name: true } } } }),
    db.kpiPlan.findMany({
      where: { ...inScope, year: { gte: now.getUTCFullYear() - 1 } },
      select: { id: true, employeeId: true, status: true, year: true, periodType: true, period: true, items: { select: { actual: true, target: true, weight: true, formula: true } } },
    }),
    db.task.count({ where: { assignee: scope, status: { in: [...OPEN_TASK] } } }),
    db.task.count({ where: { assignee: scope, status: { in: [...OPEN_TASK] }, dueDate: { lt: now } } }),
    db.reviewCycle.findFirst({ where: { status: "OPEN" }, orderBy: { createdAt: "desc" }, include: { reviews: { where: inScope, select: { status: true, grade: true } } } }),
    db.task.findMany({ where: { assignee: scope, OR: [{ createdAt: { gte: since } }, { completedAt: { gte: since } }] }, select: { createdAt: true, completedAt: true, status: true } }),
  ]);
  const byId = new Map(employees.map((e) => [e.id, e]));
  const active = plans.filter((p) => byId.has(p.employeeId));

  // KPI quý hiện tại, tạm tính theo công thức dùng chung (chỉ chỉ số đã cập nhật) — mỗi người 1 điểm
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  const qy = now.getUTCFullYear();
  const perPerson = employees
    .map((e) => ({ e, k: provisionalKpi(active.filter((p) => p.employeeId === e.id && inQuarter(p, qy, q)).flatMap((p) => p.items)) }))
    .filter((x) => x.k.total > 0);
  const scored = perPerson.filter((x) => x.k.score !== null);
  const kpiAvg = scored.length ? scored.reduce((s, x) => s + x.k.score!, 0) / scored.length : null;
  const below = scored.filter((x) => x.k.score! < KPI_OK).length;
  const updated = perPerson.reduce((s, x) => s + x.k.updated, 0);
  const totalItems = perPerson.reduce((s, x) => s + x.k.total, 0);

  const kpiRows = company
    ? Object.values(
        scored.reduce<Record<string, { label: string; sum: number; n: number; u: number; t: number; href: string }>>((acc, { e, k }) => {
          const key = e.departmentId ?? "none";
          acc[key] ??= { label: e.department?.name ?? "Chưa có phòng ban", sum: 0, n: 0, u: 0, t: 0, href: e.departmentId ? `/employees?dept=${e.departmentId}` : "/employees" };
          acc[key].sum += k.score!;
          acc[key].n++;
          acc[key].u += k.updated;
          acc[key].t += k.total;
          return acc;
        }, {}),
      ).map((d) => ({ label: d.label, value: Math.round((d.sum / d.n) * 1000) / 10, href: d.href, hint: `trung bình ${d.n} người · ${d.u}/${d.t} chỉ số đã cập nhật` }))
    : scored.map(({ e, k }) => ({ label: e.fullName, value: Math.round(k.score! * 1000) / 10, href: `/employees/${e.id}?tab=performance`, hint: `${k.updated}/${k.total} chỉ số đã cập nhật` }));
  kpiRows.sort((a, b) => b.value - a.value);

  // Xu hướng KPI 12 tháng (theo tháng kết thúc kỳ), tạm tính theo công thức dùng chung
  const curKey = now.getUTCFullYear() * 12 + now.getUTCMonth() + 1;
  const months = Array.from({ length: 12 }, (_, i) => curKey - 11 + i);
  const trend = months.map((k) => provisionalKpi(active.filter((p) => periodKey(p) === k).flatMap((p) => p.items)).score);

  // Phiếu KPI năm nay theo bước ký
  // "Đã khóa" suy ra từ bảng tổng hợp đã xác nhận (không lưu database)
  const KPI_STEPS = ["DRAFT", "SUBMITTED", "MANAGER_APPROVED", "LOCKED"] as const;
  const thisYear = active.filter((p) => p.year === now.getUTCFullYear());
  const locked = await lockedPlanIds(thisYear);
  const stepOf = (p: (typeof thisYear)[number]) => (locked.has(p.id) ? "LOCKED" : p.status);
  const kpiPipeline: Segment[] = KPI_STEPS.map((s, i) => ({
    key: s,
    label: s === "LOCKED" ? "Đã khóa" : kpiStatusLabel[s],
    value: thisYear.filter((p) => stepOf(p) === s).length,
    color: [C.seq[0], C.seq[2], C.seq[3], C.seq[4]][i],
    href: `/kpi/plans?status=${s}`,
  }));

  // Nhiệm vụ theo tuần
  const weeks = Array.from({ length: WEEKS }, (_, i) => since.getTime() + i * 7 * DAY);
  const inWeek = (d: Date | null, w: number) => !!d && d.getTime() >= w && d.getTime() < w + 7 * DAY;
  const weekLabel = (w: number) => {
    const d = new Date(w);
    return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  };

  const reviewTotal = cycle?.reviews.length ?? 0;
  const reviewDone = cycle?.reviews.filter((r) => r.status === "COMPLETED").length ?? 0;
  const TYPES: EmployeeType[] = ["OFFICIAL", "PROBATION", "INTERN", "COLLABORATOR"];
  const official = employees.filter((e) => e.employeeType === "OFFICIAL").length;

  return (
    <>
      {/* 4 chỉ số quan trọng nhất */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={Users} label={company ? "Nhân sự đang làm" : "Nhân viên trong nhóm"} value={String(employees.length)} sub={`${official} chính thức`} href="/employees" />
        <StatCard
          icon={Target}
          label={`KPI quý ${q} tạm tính`}
          value={kpiAvg === null ? "—" : pct1(kpiAvg)}
          sub={kpiAvg === null ? "Chưa có số liệu trong quý" : `${kpiGrade(kpiAvg)?.label} · ${updated}/${totalItems} chỉ số · ${below} người dưới 80%`}
          tone={kpiAvg === null ? "gray" : kpiAvg >= KPI_OK ? "blue" : "amber"}
          href="/kpi/plans"
        />
        <StatCard
          icon={ClipboardCheck}
          label="Tiến độ đánh giá"
          value={reviewTotal ? `${Math.round((reviewDone / reviewTotal) * 100)}%` : "—"}
          sub={reviewTotal ? `${reviewDone}/${reviewTotal} phiếu hoàn tất` : "Chưa có kỳ đang mở"}
          href={cycle && company ? `/reviews/cycles/${cycle.id}` : "/reviews"}
        />
        {(
          <StatCard
            icon={ListTodo}
            label="Nhiệm vụ quá hạn"
            value={String(lateTasks)}
            sub={`trên tổng ${openTasks} nhiệm vụ đang mở`}
            tone={lateTasks > 0 ? "red" : "green"}
            href="/tasks?view=all&show=overdue"
          />
        )}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-5 lg:col-span-2">
          <Card title="Xu hướng KPI 12 tháng" actions={<span className="text-xs text-slate-500">{company ? "Trung bình toàn công ty" : "Trung bình nhóm"}</span>}>
            <LineChart
              labels={months.map(monthLabel)}
              series={[{ key: "kpi", label: "KPI trung bình (tạm tính)", color: C.s1, values: trend }]}
              scale={100}
              max={100}
              unit="%"
              bands={[
                { value: KPI_GOOD * 100, label: "Hoàn thành tốt (90%)" },
                { value: KPI_OK * 100, label: "Hoàn thành (80%)" },
              ]}
              emptyText="Không có dữ liệu KPI trong 12 tháng gần nhất"
            />
          </Card>
          <Card title={company ? "KPI theo phòng ban" : "KPI nhân viên trong nhóm"} actions={<span className="text-xs text-slate-500">Quý {q}/{qy}, tạm tính</span>}>
            <HBarChart rows={kpiRows} unit="%" max={100} target={{ value: KPI_OK * 100, label: "Mốc “Hoàn thành” 80%" }} emptyText="Chưa có số liệu KPI trong quý" />
          </Card>
          {(
            <Card title={`Nhiệm vụ ${WEEKS} tuần gần đây`} actions={<Link href="/tasks?view=all" className="text-xs">Xem chi tiết</Link>}>
              <LineChart
                labels={weeks.map(weekLabel)}
                series={[
                  { key: "created", label: "Được giao", color: C.s1, values: weeks.map((w) => recentTasks.filter((t) => inWeek(t.createdAt, w)).length) },
                  { key: "done", label: "Hoàn thành", color: C.s2, values: weeks.map((w) => recentTasks.filter((t) => t.status === "DONE" && inWeek(t.completedAt, w)).length) },
                ]}
                emptyText={`Không có dữ liệu nhiệm vụ trong ${WEEKS} tuần gần nhất`}
              />
            </Card>
          )}
        </div>
        <div className="flex min-w-0 flex-col gap-5">
          <Card title={`Phiếu KPI năm ${now.getUTCFullYear()}`} actions={<Link href="/kpi/plans" className="text-xs">Xem chi tiết</Link>}>
            <Donut segments={kpiPipeline} centerLabel="phiếu KPI" emptyText="Chưa có phiếu KPI trong năm" />
          </Card>

          <Card title={cycle ? cycle.name : "Kỳ đánh giá"} actions={cycle && company && <Link href={`/reviews/cycles/${cycle.id}`} className="text-xs">Xem chi tiết</Link>}>
            {cycle && reviewTotal > 0 ? (
              <>
                <div className="flex items-center gap-4">
                  <ProgressRing done={reviewDone} total={reviewTotal} label="Phiếu đã hoàn tất" />
                  <div className="text-sm">
                    <div className="font-medium text-slate-800">Tiến độ hoàn tất</div>
                    <div className="text-xs text-slate-500">
                      {reviewDone}/{reviewTotal} phiếu đã hoàn tất phê duyệt
                    </div>
                  </div>
                </div>
                <div className="mb-2 mt-5 text-xs font-medium text-slate-500">Phân bố xếp hạng</div>
                <ColumnChart
                  height={110}
                  cols={Object.keys(GRADE_INFO).map((g, i) => ({ label: `Hạng ${g}`, sub: GRADE_INFO[g].range, value: cycle.reviews.filter((r) => r.grade === g).length, color: C.seq[4 - i] }))}
                  unit=" người"
                  emptyText="Chưa có kết quả xếp hạng"
                />
              </>
            ) : (
              <p className="py-8 text-center text-sm text-slate-500">Không có kỳ đánh giá đang mở.</p>
            )}
          </Card>

          <Card title="Cơ cấu nhân sự">
            <Donut
              centerLabel="nhân sự"
              segments={TYPES.map((t, i) => ({ key: t, label: employeeTypeLabel[t], value: employees.filter((e) => e.employeeType === t).length, color: [C.s1, C.s2, C.s3, C.s4][i], href: `/employees?type=${t}` }))}
            />
          </Card>

        </div>
      </div>
    </>
  );
}

// ───────────────────────── Nhân viên: số liệu của bản thân ─────────────────────────

async function Personal({ employeeId }: { employeeId: string | null }) {
  if (!employeeId) {
    return (
      <Card>
        <p className="py-8 text-center text-sm text-slate-500">Tài khoản chưa được liên kết với hồ sơ nhân viên.</p>
      </Card>
    );
  }
  const now = today();
  const year = now.getUTCFullYear();
  const [myPlans, taskGroups, lateTasks] = await Promise.all([
    db.kpiPlan.findMany({ where: { employeeId }, select: { periodType: true, period: true, year: true, items: { select: { actual: true, target: true, weight: true, formula: true } } } }),
    db.task.groupBy({ by: ["status"], where: { assigneeId: employeeId, status: { in: [...OPEN_TASK] } }, _count: true }),
    db.task.count({ where: { assigneeId: employeeId, status: { in: [...OPEN_TASK] }, dueDate: { lt: now } } }),
  ]);
  // Mỗi phiếu tính % tạm tính theo công thức dùng chung; chỉ lấy phiếu đã có số liệu
  const recent = myPlans
    .map((p) => ({ ...p, k: provisionalKpi(p.items) }))
    .filter((p) => p.k.score !== null)
    .sort((a, b) => periodKey(a) - periodKey(b))
    .slice(-12);
  const last = recent.at(-1);
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  const quarterK = provisionalKpi(myPlans.filter((p) => inQuarter(p, year, q)).flatMap((p) => p.items));
  const taskCount = (s: string) => taskGroups.find((g) => g.status === s)?._count ?? 0;
  const openTasks = taskGroups.reduce((s, g) => s + g._count, 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={Target}
          label={`KPI quý ${q} tạm tính`}
          value={quarterK.score === null ? "—" : pct1(quarterK.score)}
          sub={quarterK.total ? `${quarterK.updated}/${quarterK.total} chỉ số đã cập nhật` : "Chưa có phiếu trong quý"}
          tone={quarterK.score === null ? "gray" : quarterK.score >= KPI_OK ? "blue" : "amber"}
          href="/kpi"
        />
        <StatCard
          icon={Target}
          label="KPI kỳ gần nhất"
          value={last ? pct1(last.k.score!) : "—"}
          sub={last ? `${periodLabel(last.periodType, last.period, last.year)} · ${last.k.updated}/${last.k.total} chỉ số` : "Chưa có dữ liệu"}
          tone={!last ? "gray" : last.k.score! >= KPI_OK ? "blue" : "amber"}
          href="/kpi"
        />
        {<StatCard icon={ListTodo} label="Nhiệm vụ đang mở" value={String(openTasks)} sub={lateTasks ? `${lateTasks} quá hạn` : "Không có nhiệm vụ quá hạn"} tone={lateTasks ? "red" : "green"} href="/tasks" />}
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-3">
        <Card title="Kết quả KPI theo kỳ" className="lg:col-span-2" actions={<Link href="/kpi" className="text-xs">Xem chi tiết</Link>}>
          <LineChart
            labels={recent.map(shortPeriod)}
            series={[{ key: "kpi", label: "KPI cá nhân (tạm tính)", color: C.s1, values: recent.map((p) => p.k.score) }]}
            scale={100}
            max={100}
            unit="%"
            bands={[
              { value: KPI_GOOD * 100, label: "Hoàn thành tốt (90%)" },
              { value: KPI_OK * 100, label: "Hoàn thành (80%)" },
            ]}
            emptyText="Chưa có kỳ KPI hoàn tất"
          />
        </Card>
        <Card title="KPI kỳ gần nhất">
          <div className="py-2">
            <Gauge value={last?.k.score ?? null} target={KPI_OK} label={last ? `${periodLabel(last.periodType, last.period, last.year)} · ${last.k.updated}/${last.k.total} chỉ số` : ""} />
          </div>
        </Card>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-2">
        {(
          <Card title="Nhiệm vụ cá nhân" actions={<Link href="/tasks" className="text-xs">Xem chi tiết</Link>}>
            <Donut
              centerLabel="đang mở"
              emptyText="Không có nhiệm vụ đang mở"
              segments={[
                { key: "TODO", label: taskStatusLabel.TODO, value: taskCount("TODO"), color: C.seq[0] },
                { key: "IN_PROGRESS", label: taskStatusLabel.IN_PROGRESS, value: taskCount("IN_PROGRESS"), color: C.seq[2] },
                { key: "REVIEW", label: taskStatusLabel.REVIEW, value: taskCount("REVIEW"), color: C.seq[4] },
              ]}
            />
          </Card>
        )}
      </div>
    </>
  );
}

// ───────────────────────── Ô chỉ số ─────────────────────────

type Tone = "blue" | "green" | "amber" | "red" | "gray";
const TONE: Record<Tone, { icon: string; value: string }> = {
  blue: { icon: "bg-brand-50 text-brand-600", value: "text-slate-900" },
  green: { icon: "bg-emerald-50 text-emerald-600", value: "text-slate-900" },
  amber: { icon: "bg-amber-50 text-amber-600", value: "text-amber-700" },
  red: { icon: "bg-red-50 text-red-600", value: "text-red-600" },
  gray: { icon: "bg-slate-100 text-slate-500", value: "text-slate-400" },
};

function StatCard({ icon: Icon, label, value, sub, tone = "blue", href }: { icon: React.ElementType; label: string; value: string; sub?: string; tone?: Tone; href: string }) {
  const t = TONE[tone];
  return (
    <Link href={href} className="card flex items-start gap-3 p-4 no-underline transition hover:border-slate-300 hover:shadow-sm hover:no-underline">
      <span className={`hidden h-10 w-10 shrink-0 items-center justify-center rounded-xl sm:flex ${t.icon}`}>
        <Icon size={20} />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-slate-500" title={label}>
          {label}
        </span>
        <span className={`mt-0.5 block text-2xl font-semibold tabular-nums ${t.value}`}>{value}</span>
        {sub && (
          <span className="mt-0.5 block truncate text-xs text-slate-500" title={sub}>
            {sub}
          </span>
        )}
      </span>
    </Link>
  );
}
