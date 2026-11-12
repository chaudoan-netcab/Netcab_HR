"use server";

import { revalidatePath } from "next/cache";
import type { EmployeeStatus, EmployeeType, JobLevel, Prisma } from "@prisma/client";
import { db } from "@/lib/server/db";
import { requireHRM } from "@/lib/server/access";
import { parseDate } from "@/lib/dates";
import { done, opt, str } from "@/lib/form";

function employeeData(fd: FormData) {
  return {
    code: str(fd, "code"),
    fullName: str(fd, "fullName"),
    phone: opt(fd, "phone"),
    workEmail: opt(fd, "workEmail"),
    departmentId: opt(fd, "departmentId"),
    position: opt(fd, "position"),
    jobLevel: str(fd, "jobLevel") as JobLevel,
    employeeType: str(fd, "employeeType") as EmployeeType,
    status: str(fd, "status") as EmployeeStatus,
    managerId: opt(fd, "managerId"),
    joinDate: parseDate(fd.get("joinDate")),
    officialDate: parseDate(fd.get("officialDate")),
    leaveDate: parseDate(fd.get("leaveDate")),
    workLocation: opt(fd, "workLocation"),
  } satisfies Prisma.EmployeeUncheckedCreateInput;
}

function validate(d: ReturnType<typeof employeeData>): string | null {
  if (!d.code || !d.fullName) return "Vui lòng nhập Mã nhân viên và Họ tên";
  return null;
}

export async function createEmployee(fd: FormData) {
  await requireHRM();
  const d = employeeData(fd);
  const err = validate(d);
  if (err) done("/employees/new", { err });
  if (await db.employee.findUnique({ where: { code: d.code } })) done("/employees/new", { err: `Mã nhân viên ${d.code} đã tồn tại` });
  const e = await db.employee.create({ data: d });
  revalidatePath("/employees");
  done(`/employees/${e.id}`, { ok: "Đã tạo hồ sơ nhân viên. Tài khoản đăng nhập được tạo tại Cài đặt › Tài khoản." });
}

export async function updateEmployee(id: string, fd: FormData) {
  await requireHRM();
  const d = employeeData(fd);
  const err = validate(d);
  if (err) done(`/employees/${id}/edit`, { err });
  const dup = await db.employee.findFirst({ where: { code: d.code, id: { not: id } } });
  if (dup) done(`/employees/${id}/edit`, { err: `Mã nhân viên ${d.code} đã được dùng cho ${dup.fullName}` });
  if (d.managerId === id) done(`/employees/${id}/edit`, { err: "Nhân viên không thể là quản lý của chính mình" });
  const present = Object.fromEntries(Object.entries(d).filter(([k]) => fd.has(k)));
  await db.employee.update({ where: { id }, data: present });
  revalidatePath(`/employees/${id}`);
  done(`/employees/${id}`, { ok: "Đã lưu thay đổi" });
}
