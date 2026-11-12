// Quy tắc Giao việc — theo phân quyền tài khoản
import "server-only";
import type { Prisma, Task } from "@prisma/client";
import type { CurrentUser } from "./auth";
import { isHRM, isManager, teamScope } from "./access";
import { db } from "./db";

/**
 * Được giao việc cho ai:
 * - Quản lý (kể cả HRM đang làm trưởng phòng): nhân viên trong managerScope
 * - Nhân viên: không giao việc (chỉ nhận và phối hợp)
 */
export function assignableScope(u: CurrentUser): Prisma.EmployeeWhereInput | null {
  if (isManager(u)) return { AND: [teamScope(u), { status: "ACTIVE" }] };
  return null;
}

/** Nhiệm vụ mà user được xem: mình làm, mình giao, mình phối hợp; quản lý thấy việc của nhóm; HRM xem toàn công ty */
export function visibleTasks(u: CurrentUser): Prisma.TaskWhereInput {
  if (isHRM(u)) return {};
  const me = u.employeeId ?? "__none__";
  return {
    OR: [
      { assigneeId: me },
      { createdById: u.id },
      { collaborators: { some: { id: me } } },
      ...(isManager(u) ? [{ assignee: teamScope(u) }] : []),
    ],
  };
}

export async function canViewTask(u: CurrentUser, taskId: string) {
  return (await db.task.count({ where: { AND: [{ id: taskId }, visibleTasks(u)] } })) > 0;
}

/** Vai trò của user với 1 nhiệm vụ */
export function taskRoles(u: CurrentUser, t: Pick<Task, "assigneeId" | "createdById">) {
  const isAssignee = !!u.employeeId && u.employeeId === t.assigneeId;
  // Chỉ người giao xác nhận kết quả (Quản lý trong managerScope); HRM chỉ xem, không xác nhận thay
  const isReviewer = t.createdById === u.id && !isAssignee;
  return { isAssignee, isReviewer };
}

export const OPEN_TASK = ["TODO", "IN_PROGRESS", "REVIEW"] as const;
