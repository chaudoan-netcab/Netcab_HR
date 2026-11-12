"use server";

import { revalidatePath } from "next/cache";
import type { TaskPriority } from "@prisma/client";
import { db } from "@/lib/server/db";
import { parseDate } from "@/lib/dates";
import { done, opt, str } from "@/lib/form";
import { assignableScope, canViewTask, taskRoles } from "@/lib/server/tasks";
import { requireEmployeeUser } from "@/lib/server/access";

export async function createTask(fd: FormData) {
  const user = await requireEmployeeUser();
  const scope = assignableScope(user);
  const back = "/tasks?new=1";
  if (!scope) done("/tasks", { err: "Tài khoản không có quyền giao việc" });
  const title = str(fd, "title");
  const assigneeId = str(fd, "assigneeId");
  if (!title || !assigneeId) done(back, { err: "Nhập tên nhiệm vụ và chọn người thực hiện" });
  const collaboratorIds = fd.getAll("collaboratorIds").map(String).filter((id) => id && id !== assigneeId);
  // Chỉ được chọn người nằm trong phạm vi mình được giao
  const allowed = await db.employee.findMany({ where: { AND: [scope!, { id: { in: [assigneeId, ...collaboratorIds] } }] }, select: { id: true } });
  const ok = new Set(allowed.map((e) => e.id));
  if (!ok.has(assigneeId)) done(back, { err: "Không có quyền giao việc cho nhân viên này" });
  const t = await db.task.create({
    data: {
      title,
      description: opt(fd, "description"),
      assigneeId,
      collaborators: { connect: collaboratorIds.filter((id) => ok.has(id)).map((id) => ({ id })) },
      createdById: user.id,
      dueDate: parseDate(fd.get("dueDate")),
      priority: (["LOW", "NORMAL", "HIGH"].includes(str(fd, "priority")) ? str(fd, "priority") : "NORMAL") as TaskPriority,
    },
  });
  revalidatePath("/tasks");
  done(`/tasks/${t.id}`, { ok: "Đã giao nhiệm vụ" });
}

/** Chuyển trạng thái: start | submit | approve | reject | cancel */
export async function moveTask(id: string, fd: FormData) {
  const user = await requireEmployeeUser();
  const back = `/tasks/${id}`;
  const t = await db.task.findUnique({ where: { id } });
  if (!t || !(await canViewTask(user, id))) done("/tasks", { err: "Không tìm thấy nhiệm vụ" });
  const task = t!;
  const { isAssignee, isReviewer } = taskRoles(user, task);
  const intent = str(fd, "intent");
  const note = opt(fd, "note");
  const now = new Date();
  const log = (content: string) => db.taskComment.create({ data: { taskId: id, authorId: user.id, content } });

  if (intent === "start" && isAssignee && task.status === "TODO") {
    await db.$transaction([db.task.update({ where: { id }, data: { status: "IN_PROGRESS" } }), log("Bắt đầu thực hiện")]);
    done(back, { ok: "Đã chuyển sang Đang làm" });
  }
  if (intent === "submit" && isAssignee && (task.status === "TODO" || task.status === "IN_PROGRESS")) {
    if (!note) done(back, { err: "Vui lòng nhập kết quả trước khi báo cáo hoàn thành" });
    await db.$transaction([db.task.update({ where: { id }, data: { status: "REVIEW", resultNote: note, submittedAt: now } }), log(`Báo cáo hoàn thành: ${note}`)]);
    done(back, { ok: "Đã báo cáo, chờ người giao xác nhận" });
  }
  if (intent === "approve" && isReviewer && task.status === "REVIEW") {
    await db.$transaction([db.task.update({ where: { id }, data: { status: "DONE", completedAt: now } }), log(note ? `Xác nhận hoàn thành: ${note}` : "Xác nhận hoàn thành")]);
    done(back, { ok: "Đã xác nhận hoàn thành" });
  }
  if (intent === "reject" && isReviewer && task.status === "REVIEW") {
    if (!note) done(back, { err: "Vui lòng nhập lý do trả lại" });
    await db.$transaction([db.task.update({ where: { id }, data: { status: "IN_PROGRESS", submittedAt: null } }), log(`Trả lại: ${note}`)]);
    done(back, { ok: "Đã trả lại nhiệm vụ" });
  }
  if (intent === "cancel" && isReviewer && task.status !== "DONE" && task.status !== "CANCELLED") {
    await db.$transaction([db.task.update({ where: { id }, data: { status: "CANCELLED" } }), log(note ? `Hủy nhiệm vụ: ${note}` : "Hủy nhiệm vụ")]);
    done(back, { ok: "Đã hủy nhiệm vụ" });
  }
  done(back, { err: "Không thực hiện được thao tác này ở bước hiện tại" });
}

export async function updateTask(id: string, fd: FormData) {
  const user = await requireEmployeeUser();
  const t = await db.task.findUnique({ where: { id } });
  if (!t || !taskRoles(user, t).isReviewer) done(`/tasks/${id}`, { err: "Chỉ người giao việc được phép chỉnh sửa" });
  await db.task.update({
    where: { id },
    data: {
      title: str(fd, "title") || t!.title,
      description: opt(fd, "description"),
      dueDate: parseDate(fd.get("dueDate")),
      priority: str(fd, "priority") as TaskPriority,
    },
  });
  done(`/tasks/${id}`, { ok: "Đã lưu thay đổi" });
}
