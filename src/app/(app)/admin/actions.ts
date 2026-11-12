"use server";
// Phân quyền (Admin): tạo tài khoản, gán / bỏ role HR (hiển thị "HRM"), Admin, Quản lý, Nhân viên; khóa tài khoản.
// TODO(backend): khi đồng bộ Microsoft Entra, tài khoản được tạo tự động; trang này chỉ còn gán role HR / Admin.
import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { db } from "@/lib/server/db";
import { bool, done, opt, str } from "@/lib/form";
import { ROLE_VALUES, isAdminRole, requireAdmin } from "@/lib/server/access";

const BACK = "/admin?tab=roles";

export async function createUser(fd: FormData) {
  await requireAdmin();
  const email = str(fd, "email").toLowerCase();
  const password = str(fd, "password");
  const role = str(fd, "role") as Role;
  if (!email || password.length < 8) done(BACK, { err: "Email bắt buộc, mật khẩu ít nhất 8 ký tự" });
  if (!ROLE_VALUES.includes(role)) done(BACK, { err: "Vai trò không hợp lệ" });
  if (await db.user.findUnique({ where: { email } })) done(BACK, { err: "Email đã có tài khoản" });
  const employeeId = opt(fd, "employeeId");
  if (employeeId && (await db.user.findUnique({ where: { employeeId } }))) done(BACK, { err: "Nhân viên này đã có tài khoản" });
  await db.user.create({ data: { email, role, employeeId, passwordHash: await bcrypt.hash(password, 10) } });
  done(BACK, { ok: `Đã tạo tài khoản ${email}` });
}

export async function updateUser(id: string, fd: FormData) {
  const me = await requireAdmin();
  const target = await db.user.findUnique({ where: { id } });
  if (!target) done(BACK, { err: "Không tìm thấy" });
  const role = str(fd, "role") as Role;
  if (!ROLE_VALUES.includes(role)) done(BACK, { err: "Vai trò không hợp lệ" });
  if (id === me.id && (!isAdminRole(role) || !bool(fd, "active"))) done(BACK, { err: "Không thể tự hạ quyền hoặc khóa chính mình" });
  const password = str(fd, "password");
  if (password && password.length < 8) done(BACK, { err: "Mật khẩu ít nhất 8 ký tự" });
  await db.user.update({
    where: { id },
    data: { role, active: bool(fd, "active"), ...(password ? { passwordHash: await bcrypt.hash(password, 10) } : {}) },
  });
  done(BACK, { ok: "Đã lưu tài khoản" });
}

