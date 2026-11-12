import { db } from "@/lib/server/db";
import { Flash, PageHeader } from "@/components/ui";
import { EmployeeForm } from "@/app/(app)/employees/_components/employee-form";
import { createEmployee } from "../actions";
import { requireHRM } from "@/lib/server/access";

export default async function NewEmployeePage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  await requireHRM();
  const { err } = await searchParams;
  const [departments, people] = await Promise.all([
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { status: { not: "RESIGNED" } }, select: { id: true, fullName: true, code: true }, orderBy: { fullName: "asc" } }),
  ]);
  return (
    <div>
      <PageHeader title="Thêm nhân viên" back={{ href: "/employees", label: "Nhân viên" }} description="Các ô có dấu * là bắt buộc." />
      <Flash err={err} />
      <EmployeeForm action={createEmployee} departments={departments} people={people} submitLabel="Tạo hồ sơ" />
    </div>
  );
}
