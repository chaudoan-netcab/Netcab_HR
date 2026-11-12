import { notFound } from "next/navigation";
import { db } from "@/lib/server/db";
import { Flash, PageHeader } from "@/components/ui";
import { EmployeeForm } from "@/app/(app)/employees/_components/employee-form";
import { updateEmployee } from "../../actions";
import { requireHRM } from "@/lib/server/access";

export default async function EditEmployeePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ err?: string }> }) {
  await requireHRM();
  const { id } = await params;
  const { err } = await searchParams;
  const [employee, departments, people] = await Promise.all([
    db.employee.findUnique({ where: { id } }),
    db.department.findMany({ orderBy: { name: "asc" } }),
    db.employee.findMany({ where: { status: { not: "RESIGNED" } }, select: { id: true, fullName: true, code: true }, orderBy: { fullName: "asc" } }),
  ]);
  if (!employee) notFound();
  return (
    <div>
      <PageHeader title={`Sửa hồ sơ: ${employee.fullName}`} back={{ href: `/employees/${id}`, label: employee.fullName }} />
      <Flash err={err} />
      <EmployeeForm action={updateEmployee.bind(null, id)} employee={employee} departments={departments} people={people} submitLabel="Lưu thay đổi" />
    </div>
  );
}
