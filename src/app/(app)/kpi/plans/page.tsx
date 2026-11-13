import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { kpiTabs } from "@/lib/nav";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { capsOf, isHRM, isManager, requireCapability, teamScope, viewTeamScope } from "@/lib/server/access";
import { loadKpiSets, lockedPlanIds, unitsHeadedBy } from "@/lib/server/department-flow";
import { loadYearKpi } from "@/lib/server/kpi-year";
import { today } from "@/lib/dates";
import { kpiGradeTone, periodLabel, pct } from "@/lib/kpi";
import { kpiStatusLabel, kpiStatusView } from "@/lib/labels";
import { Badge, Card, EmptyState, Flash, PageHeader, StatusChips, Tabs } from "@/components/ui";
import { AssignKpiDialog } from "../_components/kpi-dialogs";
import { YearKpiCells, YearKpiHead, YearKpiMobile } from "../_components/year-kpi";
import { FLAT_ON_MOBILE, GradeText, MobileCard, MobileField, MobileList, STICKY_COL, TABLE_MD } from "../_components/mobile-card";
import { createPlan } from "../actions";

type SP = { view?: string; status?: string; employee?: string; year?: string; ok?: string; err?: string };

export default async function KpiPlansPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireCapability((u) => isManager(u) || isHRM(u));
  const canAssign = isManager(user);
  const sp = await searchParams;
  const now = today();
  const thisYear = now.getUTCFullYear();
  const currentQuarter = Math.floor(now.getUTCMonth() / 3) + 1;
  const year = Number(sp.year) || thisYear;
  const yearView = sp.view === "year";
  // Xem: HRM toàn công ty, Quản lý trong managerScope. Giao KPI: chỉ Quản lý, chỉ trong managerScope.
  const scope = viewTeamScope(user, isHRM(user));
  const base: Prisma.KpiPlanWhereInput = { year, employee: scope, ...(sp.employee ? { employeeId: sp.employee } : {}) };
  const [all, employees, { sets, units, unitOfDept }] = await Promise.all([
    db.kpiPlan.findMany({
      where: base,
      include: { employee: { include: { department: true } } },
      orderBy: [{ periodType: "asc" }, { period: "desc" }, { employee: { fullName: "asc" } }],
    }),
    canAssign ? db.employee.findMany({ where: { AND: [teamScope(user), { status: "ACTIVE" }] }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, code: true } }) : [],
    loadKpiSets(),
  ]);
  // Trạng thái hiển thị: "Đã khóa" suy ra từ bảng tổng hợp đã xác nhận (không lưu database)
  const locked = await lockedPlanIds(all);
  const keyOf = (p: (typeof all)[number]) => (locked.has(p.id) ? "LOCKED" : p.status);
  const plans = sp.status ? all.filter((p) => keyOf(p) === sp.status) : all;
  // Giao KPI bằng bộ KPI của phòng mình (bộ KPI không có bước duyệt, soạn xong là dùng được)
  const myUnits = new Set([...unitsHeadedBy(units, user).map((u) => u.id), ...(user.employee?.departmentId ? [unitOfDept(user.employee.departmentId)] : [])]);
  const approved = sets.filter((x) => x.template.active && x.rec.unitId && myUnits.has(x.rec.unitId)).map((x) => x.template);
  const tplItems = canAssign
    ? await db.kpiTemplateItem.findMany({ where: { templateId: { in: approved.map((t) => t.id) } }, orderBy: { sortOrder: "asc" } })
    : [];
  const templates = approved.map((t) => ({
    id: t.id,
    name: t.name,
    items: tplItems.filter((i) => i.templateId === t.id).map(({ section, name, measurement, unit, target, weight, formula, note }) => ({ section, name, measurement, unit, target, weight, formula, note })),
  }));
  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ view: sp.view, employee: sp.employee, year: sp.year, status: sp.status, ...patch })) if (v) p.set(k, String(v));
    return `/kpi/plans?${p}`;
  };

  return (
    <div>
      <PageHeader
        title="Phiếu KPI nhân viên"
        description={`Giao KPI theo quý, theo dõi tiến độ và KPI năm của từng người · Năm ${year}`}
        actions={
          canAssign ? (
            <AssignKpiDialog action={createPlan} employees={employees} templates={templates} defaults={{ employeeId: sp.employee, year: thisYear, quarter: currentQuarter }} />
          ) : undefined
        }
      />
      <Tabs tabs={kpiTabs(capsOf(user))} active="plans" />
      <Flash ok={sp.ok} err={sp.err} />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex rounded-[4px] bg-card p-0.5 text-[13px] dark:border dark:border-border" role="tablist" aria-label="Cách xem">
          {[
            { key: "", label: "Theo phiếu" },
            { key: "year", label: "Tổng hợp năm" },
          ].map((v) => (
            <Link
              key={v.key}
              href={qs({ view: v.key || undefined, status: undefined })}
              role="tab"
              aria-selected={(sp.view ?? "") === v.key}
              className={`whitespace-nowrap rounded-[4px] px-3 py-1.5 font-medium no-underline hover:no-underline ${(sp.view ?? "") === v.key ? "bg-primary/10 text-primary-text" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
            >
              {v.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-1 text-sm">
          <Link href={qs({ year: String(year - 1) })} className="btn btn-sm" aria-label="Năm trước">
            <ChevronLeft size={15} />
          </Link>
          <span className="w-20 text-center font-medium tabular-nums text-foreground">Năm {year}</span>
          <Link href={qs({ year: String(year + 1) })} className="btn btn-sm" aria-label="Năm sau">
            <ChevronRight size={15} />
          </Link>
        </div>
      </div>

      {yearView ? (
        <YearTable scope={scope} year={year} currentQuarter={year === thisYear ? currentQuarter : year < thisYear ? 4 : 0} canAssign={canAssign} />
      ) : (
        <>
          {sp.employee && (
            <div className="mb-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Đang xem phiếu của</span>
              <span className="font-medium">{all[0]?.employee.fullName ?? "nhân viên đã chọn"}</span>
              <Link href={qs({ employee: undefined })} className="btn btn-sm">Bỏ lọc</Link>
            </div>
          )}
          <StatusChips
            active={sp.status ?? "all"}
            items={[
              { key: "all", label: "Tất cả", count: all.length, href: qs({ status: undefined }) },
              ...(["DRAFT", "SUBMITTED", "MANAGER_APPROVED", "LOCKED"] as const).map((s) => ({
                key: s,
                label: s === "LOCKED" ? "Đã khóa" : s === "DRAFT" ? "Đang cập nhật" : kpiStatusLabel[s],
                count: all.filter((p) => keyOf(p) === s).length,
                href: qs({ status: s }),
              })),
            ]}
          />
          <Card pad={false} className={plans.length ? FLAT_ON_MOBILE : ""}>
            {plans.length === 0 ? (
              <EmptyState title="Chưa có phiếu KPI nào" hint={canAssign ? "Bấm “Giao KPI” để tạo phiếu cho nhân viên." : undefined} />
            ) : (
              <>
                <div className={`overflow-x-auto ${TABLE_MD}`}>
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Nhân viên</th>
                        <th>Kỳ</th>
                        <th className="text-right">Kết quả</th>
                        <th>Xếp loại</th>
                        <th>Trạng thái</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((p) => {
                        const st = kpiStatusView(p.status, locked.has(p.id));
                        return (
                          <tr key={p.id}>
                            <td>
                              <Link href={`/kpi/${p.id}`} className="font-medium">{p.employee.fullName}</Link>
                              <div className="text-xs text-muted-foreground">{p.title.replace("BẢNG KPI — ", "")}</div>
                            </td>
                            <td className="whitespace-nowrap">{periodLabel(p.periodType, p.period, p.year)}</td>
                            <td className="whitespace-nowrap text-right tabular-nums">{pct(p.score)}</td>
                            <td>{p.grade && p.status !== "DRAFT" && <GradeText tone={kpiGradeTone(p.grade)}>{p.grade}</GradeText>}</td>
                            <td><Badge tone={st.tone}>{st.label}</Badge></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <MobileList>
                  {plans.map((p) => {
                    const st = kpiStatusView(p.status, locked.has(p.id));
                    return (
                      <MobileCard
                        key={p.id}
                        meta={periodLabel(p.periodType, p.period, p.year)}
                        status={<Badge tone={st.tone}>{st.label}</Badge>}
                        title={p.employee.fullName}
                        href={`/kpi/${p.id}`}
                      >
                        <MobileField label="Bảng KPI">{p.title.replace("BẢNG KPI — ", "")}</MobileField>
                        <MobileField label="Kết quả"><span className="tabular-nums">{pct(p.score)}</span></MobileField>
                        {p.grade && p.status !== "DRAFT" && (
                          <MobileField label="Xếp loại"><GradeText tone={kpiGradeTone(p.grade)}>{p.grade}</GradeText></MobileField>
                        )}
                      </MobileCard>
                    );
                  })}
                </MobileList>
              </>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

/** KPI năm = tổng hợp các quý, chia nhóm Quản lý / Nhân viên */
async function YearTable({ scope, year, currentQuarter, canAssign }: { scope: Prisma.EmployeeWhereInput; year: number; currentQuarter: number; canAssign: boolean }) {
  const people = await db.employee.findMany({
    where: { AND: [scope, { status: "ACTIVE" }] },
    include: { department: true },
    orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }],
  });
  const kpi = await loadYearKpi(people.map((p) => p.id), year);
  const groups = [
    { key: "SUPERVISOR", label: "Quản lý", hint: "Giám sát – Trưởng nhóm trở lên" },
    { key: "STAFF", label: "Nhân viên", hint: "Nhân viên – Chuyên viên" },
  ].map((g) => ({ ...g, rows: people.filter((p) => p.jobLevel === g.key) }));

  if (!people.length) return <Card><EmptyState title="Chưa có nhân viên trong phạm vi xem" /></Card>;
  return (
    <div className="flex flex-col gap-5">
      {groups
        .filter((g) => g.rows.length)
        .map((g) => (
          <Card key={g.key} pad={false} className={FLAT_ON_MOBILE} title={`${g.label} (${g.rows.length})`} actions={<span className="text-xs text-muted-foreground">{g.hint}</span>}>
            <div className={`overflow-x-auto ${TABLE_MD}`}>
              <table className="table min-w-[760px]">
                <thead>
                  <tr>
                    <th className={STICKY_COL}>Họ tên</th>
                    <YearKpiHead year={year} />
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((p) => (
                    <tr key={p.id}>
                      <td className={STICKY_COL}>
                        <Link href={`/kpi/plans?employee=${p.id}&year=${year}`} className="font-medium">{p.fullName}</Link>
                        <div className="text-xs text-muted-foreground">{[p.position, p.department?.name].filter(Boolean).join(" · ")}</div>
                      </td>
                      <YearKpiCells y={kpi.get(p.id)!} currentQuarter={currentQuarter} />
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <MobileList>
              {g.rows.map((p) => (
                <MobileCard key={p.id} meta={[p.position, p.department?.name].filter(Boolean).join(" · ")} title={p.fullName} href={`/kpi/plans?employee=${p.id}&year=${year}`}>
                  <YearKpiMobile y={kpi.get(p.id)!} year={year} currentQuarter={currentQuarter} />
                </MobileCard>
              ))}
            </MobileList>
          </Card>
        ))}
      <p className="text-xs text-muted-foreground">
        KPI năm = trung bình điểm các quý đã được quản lý xác nhận trong năm {year}. Quý đang cập nhật hoặc chờ xác nhận chưa được tính.
        {canAssign && " Bấm vào tên để xem các phiếu của người đó."}
      </p>
    </div>
  );
}
