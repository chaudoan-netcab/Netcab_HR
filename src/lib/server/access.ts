// Phân quyền theo NĂNG LỰC. Đây là nơi DUY NHẤT so sánh role trực tiếp; mọi trang / action dùng các hàm dưới đây.
//
// 4 role trong database: ADMIN, HR, MANAGER, EMPLOYEE. Năng lực suy ra từ role + dữ liệu tổ chức:
// - isAdmin:        role ADMIN — team kỹ thuật, KHÔNG phải nhân viên nghiệp vụ (chỉ dùng trang Quản trị hệ thống)
// - isHRM:          role HR — chỉ dành cho HRM (Trưởng phòng HCNS). Giao diện luôn gọi là "HRM".
// - isManager:      role MANAGER, hoặc đang là trưởng ít nhất 1 phòng ban
// - isEmployeeUser: mọi role trừ ADMIN
// Một người có nhiều năng lực thì cộng dồn quyền (vd HRM làm trưởng phòng HCNS → vừa Quản lý vừa HRM).
import "server-only";
import type { Prisma, Role } from "@prisma/client";
import { redirect } from "next/navigation";
import type { Caps } from "../nav";
import { requireUser, type CurrentUser } from "./auth";
import { db } from "./db";

export const isAdmin = (u: CurrentUser) => u.role === "ADMIN";
export const isHRM = (u: CurrentUser) => u.role === "HR";
export const isEmployeeUser = (u: CurrentUser) => !isAdmin(u);
/**
 * TODO(backend): khi đồng bộ tài khoản từ Microsoft Entra, tự gán role MANAGER cho người có ít nhất 1 người báo cáo.
 */
export const isManager = (u: CurrentUser) => isEmployeeUser(u) && (u.role === "MANAGER" || (u.employee?._count.headOf ?? 0) > 0);

/** Trang Theo dõi & nhắc việc: Quản lý và HRM */
export const canTrack = (u: CurrentUser) => isManager(u) || isHRM(u);
/** Xem trang Nhân viên: Quản lý (trong phạm vi) và HRM (toàn công ty) */
export const canListEmployees = (u: CurrentUser) => isManager(u) || isHRM(u);

/**
 * HRM xem dữ liệu ở chế độ "Toàn công ty" (mặc định) hay "Phòng tôi" (?view=mine — giống hệt một Quản lý).
 * Người không phải HRM luôn là false.
 */
export const companyView = (u: CurrentUser, view?: string | null) => isHRM(u) && view !== "mine";

/** Năng lực gửi xuống giao diện (sidebar, tab) */
export function capsOf(u: CurrentUser): Caps {
  return { employee: isEmployeeUser(u), manager: isManager(u), hrm: isHRM(u), admin: isAdmin(u), tracker: canTrack(u) };
}

// ───────── Role trong dữ liệu (trang Phân quyền của Admin) ─────────

/** Role được gán qua trang Phân quyền — so sánh giá trị role nằm ở đây, không rải ra các trang */
export const ROLE_VALUES: Role[] = ["EMPLOYEE", "MANAGER", "HR", "ADMIN"];
export const isAdminRole = (r: Role) => r === "ADMIN";

// ───────── Phạm vi dữ liệu ─────────

/** Tài khoản Admin không bao giờ xuất hiện trong danh sách nhân viên, danh sách giao việc / KPI và số liệu thống kê */
const NOT_ADMIN: Prisma.EmployeeWhereInput = { OR: [{ user: { is: null } }, { user: { is: { role: { not: "ADMIN" } } } }] };

/** Toàn công ty (đã loại tài khoản Admin) */
export function companyScope(): Prisma.EmployeeWhereInput {
  return NOT_ADMIN;
}

/**
 * Phạm vi Quản lý (dùng chung toàn app, kể cả trang Theo dõi & nhắc việc):
 * bản thân + nhân viên báo cáo trực tiếp + toàn bộ nhân viên các phòng mình làm trưởng (kể cả phòng con).
 * Người không phải Quản lý: chỉ bản thân.
 */
export function managerScope(u: CurrentUser): Prisma.EmployeeWhereInput {
  const me = u.employeeId ?? "__none__";
  if (!isManager(u)) return { AND: [NOT_ADMIN, { id: me }] };
  return {
    AND: [
      NOT_ADMIN,
      {
        OR: [
          { id: me },
          { managerId: me },
          { department: { headId: me } },
          { department: { parent: { headId: me } } },
        ],
      },
    ],
  };
}

/** Nhân viên dưới quyền (managerScope, không gồm bản thân) */
export function teamScope(u: CurrentUser): Prisma.EmployeeWhereInput {
  const me = u.employeeId ?? "__none__";
  return { AND: [managerScope(u), { id: { not: me } }] };
}

/** Phạm vi XEM: HRM toàn công ty, còn lại managerScope */
export function viewScope(u: CurrentUser): Prisma.EmployeeWhereInput {
  return isHRM(u) ? companyScope() : managerScope(u);
}

/** Phạm vi xem không gồm bản thân; company = HRM đang ở chế độ "Toàn công ty" */
export function viewTeamScope(u: CurrentUser, company: boolean): Prisma.EmployeeWhereInput {
  const me = u.employeeId ?? "__none__";
  return company ? { AND: [companyScope(), { id: { not: me } }] } : teamScope(u);
}

export async function canViewEmployee(u: CurrentUser, employeeId: string) {
  if (isAdmin(u)) return false;
  if (u.employeeId === employeeId) return true;
  const n = await db.employee.count({ where: { AND: [{ id: employeeId }, viewScope(u)] } });
  return n > 0;
}

/** Quản lý được thao tác trên nhân viên (giao việc, giao KPI, duyệt…) — chỉ trong managerScope, không gồm bản thân */
export async function canManageEmployee(u: CurrentUser, employeeId: string) {
  if (!isManager(u) || u.employeeId === employeeId) return false;
  const n = await db.employee.count({ where: { AND: [{ id: employeeId }, teamScope(u)] } });
  return n > 0;
}

// ───────── Chặn route ─────────

const NO_ACCESS = "Tài khoản không có quyền truy cập trang này";

/** Route nghiệp vụ: Admin bị chuyển về Quản trị hệ thống */
export async function requireEmployeeUser(): Promise<CurrentUser> {
  const u = await requireUser();
  if (isAdmin(u)) redirect("/admin?err=" + encodeURIComponent("Tài khoản Quản trị hệ thống không dùng các chức năng nghiệp vụ"));
  return u;
}

/** Route nghiệp vụ cần thêm 1 năng lực (Quản lý, HRM…) */
export async function requireCapability(check: (u: CurrentUser) => boolean): Promise<CurrentUser> {
  const u = await requireEmployeeUser();
  if (!check(u)) redirect("/?err=" + encodeURIComponent(NO_ACCESS));
  return u;
}

export const requireManager = () => requireCapability(isManager);
export const requireHRM = () => requireCapability(isHRM);
/** Đặt ở đầu mọi trang / action của Theo dõi & nhắc việc */
export const requireTracker = () => requireCapability(canTrack);

/** Trang Quản trị hệ thống */
export async function requireAdmin(): Promise<CurrentUser> {
  const u = await requireUser();
  if (!isAdmin(u)) redirect("/?err=" + encodeURIComponent(NO_ACCESS));
  return u;
}

/** Tên vai trò hiển thị trên thanh trên cùng (role HR luôn hiện là "HRM") */
export function roleName(u: CurrentUser) {
  if (isAdmin(u)) return "Quản trị hệ thống";
  if (isHRM(u)) return "HRM";
  if (isManager(u)) return "Quản lý";
  return "Nhân viên";
}

/** Trang đầu tiên sau khi đăng nhập: Admin vào thẳng Quản trị hệ thống */
export const homePath = (u: { role: Role }) => (u.role === "ADMIN" ? "/admin" : "/");
