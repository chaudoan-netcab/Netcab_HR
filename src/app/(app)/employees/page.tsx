import Link from "next/link";
import { Plus, Search } from "lucide-react";
import type { EmployeeStatus, EmployeeType, Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { canListEmployees, isHRM, requireCapability, viewScope } from "@/lib/server/access";
import { fmtDate } from "@/lib/dates";
import { employeeStatusLabel, employeeStatusTone, employeeTypeLabel } from "@/lib/labels";
import { Avatar, Badge, Card, EmptyState, Flash, PageHeader, StatusChips } from "@/components/ui";

type SP = { q?: string; dept?: string; type?: string; status?: string; ok?: string; err?: string };

export default async function EmployeesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireCapability(canListEmployees);
  const sp = await searchParams;
  const status = (sp.status ?? "working") as EmployeeStatus | "working" | "all";

  const base: Prisma.EmployeeWhereInput = {
    AND: [
      viewScope(user),
      sp.q ? { OR: [{ fullName: { contains: sp.q, mode: "insensitive" } }, { code: { contains: sp.q, mode: "insensitive" } }, { position: { contains: sp.q, mode: "insensitive" } }] } : {},
      sp.dept ? { OR: [{ departmentId: sp.dept }, { department: { parentId: sp.dept } }] } : {},
    ],
  };
  const where: Prisma.EmployeeWhereInput = {
    AND: [
      base,
      sp.type ? { employeeType: sp.type as EmployeeType } : {},
      status === "working" ? { status: { not: "RESIGNED" } } : status === "all" ? {} : { status },
    ],
  };
  const [employees, departments, counts] = await Promise.all([
    db.employee.findMany({ where, include: { department: true, manager: { select: { fullName: true } } }, orderBy: [{ department: { name: "asc" } }, { fullName: "asc" }] }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.employee.groupBy({ by: ["employeeType"], where: { AND: [base, { status: { not: "RESIGNED" } }] }, _count: true }),
  ]);

  const qs = (patch: Partial<SP>) => {
    const p = new URLSearchParams();
    const merged = { q: sp.q, dept: sp.dept, type: sp.type, status: sp.status, ...patch };
    for (const [k, v] of Object.entries(merged)) if (v) p.set(k, v);
    return `/employees?${p.toString()}`;
  };
  const total = counts.reduce((s, c) => s + c._count, 0);

  return (
    <div>
      <PageHeader
        title="Nhân viên"
        description={isHRM(user) ? "Hồ sơ toàn bộ nhân sự công ty" : "Nhân viên thuộc phạm vi quản lý"}
        actions={
          isHRM(user) && (
            <Link href="/employees/new" className="btn btn-primary">
              <Plus size={16} /> Thêm nhân viên
            </Link>
          )
        }
      />
      <Flash ok={sp.ok} err={sp.err} />

      <StatusChips
        active={sp.type ?? "all"}
        items={[
          { key: "all", label: "Tất cả", count: total, href: qs({ type: undefined }) },
          ...(["OFFICIAL", "PROBATION", "INTERN", "COLLABORATOR"] as EmployeeType[]).map((t) => ({
            key: t,
            label: employeeTypeLabel[t],
            count: counts.find((c) => c.employeeType === t)?._count ?? 0,
            href: qs({ type: t }),
          })),
        ]}
      />

      <form className="no-print mb-4 flex flex-wrap gap-2">
        {sp.type && <input type="hidden" name="type" value={sp.type} />}
        <div className="relative w-full md:w-auto md:min-w-60 md:flex-1">
          <Search size={15} className="pointer-events-none absolute left-3 top-2.5 text-muted-foreground" aria-hidden />
          <input name="q" defaultValue={sp.q} placeholder="Tìm theo tên, mã NV, chức danh…" aria-label="Tìm nhân viên" className="input pl-9" />
        </div>
        <select name="dept" defaultValue={sp.dept ?? ""} aria-label="Phòng ban" className="input min-w-0 flex-1 md:w-auto md:flex-none">
          <option value="">Tất cả phòng ban</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
        <select name="status" defaultValue={status} aria-label="Trạng thái" className="input min-w-0 flex-1 md:w-auto md:flex-none">
          <option value="working">Đang làm + tạm nghỉ</option>
          <option value="ACTIVE">Đang làm việc</option>
          <option value="ON_LEAVE">Tạm nghỉ</option>
          <option value="RESIGNED">Đã nghỉ việc</option>
          <option value="all">Tất cả</option>
        </select>
        <button className="btn">Lọc</button>
      </form>

      <Card pad={false} className={employees.length ? "max-md:border-0 max-md:bg-transparent" : ""}>
        {employees.length === 0 ? (
          <EmptyState title="Không tìm thấy nhân viên nào" hint="Điều chỉnh bộ lọc hoặc thêm nhân viên mới." />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nhân viên</th>
                    <th>Phòng ban / Chức danh</th>
                    <th>Loại</th>
                    <th>Trạng thái</th>
                    <th className="hidden xl:table-cell">Ngày vào</th>
                    <th className="hidden xl:table-cell">Quản lý trực tiếp</th>
                  </tr>
                </thead>
                <tbody>
                  {employees.map((e) => {
                    return (
                      <tr key={e.id}>
                        <td>
                          <Link href={`/employees/${e.id}`} className="flex items-center gap-2.5 no-underline hover:no-underline">
                            <Avatar name={e.fullName} size={32} />
                            <span>
                              <span className="block font-medium text-foreground">{e.fullName}</span>
                              <span className="block text-xs text-muted-foreground">{e.code}</span>
                            </span>
                          </Link>
                        </td>
                        <td>
                          <div>{e.department?.name ?? "—"}</div>
                          <div className="text-xs text-muted-foreground">{e.position}</div>
                        </td>
                        <td className="whitespace-nowrap text-foreground">{employeeTypeLabel[e.employeeType]}</td>
                        <td>
                          <Badge tone={employeeStatusTone[e.status]}>{employeeStatusLabel[e.status]}</Badge>
                        </td>
                        <td className="hidden whitespace-nowrap tabular-nums xl:table-cell">{fmtDate(e.joinDate)}</td>
                        <td className="hidden xl:table-cell">{e.manager?.fullName ?? "—"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <ul className="space-y-3 md:hidden">
              {employees.map((e) => (
                <li key={e.id}>
                  <article className="rounded-[6px] border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{e.code}</span>
                      <Badge tone={employeeStatusTone[e.status]}>{employeeStatusLabel[e.status]}</Badge>
                    </div>
                    <Link href={`/employees/${e.id}`} className="mt-0.5 block text-[14px] font-medium text-foreground">
                      {e.fullName}
                    </Link>
                    <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">
                      <div><dt className="inline text-muted-foreground">Phòng ban:</dt> <dd className="inline">{e.department?.name ?? "—"}</dd></div>
                      {e.position && <div><dt className="inline text-muted-foreground">Chức danh:</dt> <dd className="inline">{e.position}</dd></div>}
                      <div><dt className="inline text-muted-foreground">Loại:</dt> <dd className="inline">{employeeTypeLabel[e.employeeType]}</dd></div>
                      <div><dt className="inline text-muted-foreground">Ngày vào:</dt> <dd className="inline tabular-nums">{fmtDate(e.joinDate)}</dd></div>
                      <div><dt className="inline text-muted-foreground">Quản lý:</dt> <dd className="inline">{e.manager?.fullName ?? "—"}</dd></div>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
    </div>
  );
}
