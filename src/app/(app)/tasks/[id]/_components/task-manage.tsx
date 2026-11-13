"use client";
// Người giao: "Sửa nhiệm vụ" và "Hủy nhiệm vụ" (có hộp thoại xác nhận). Dùng nguyên updateTask / moveTask(intent=cancel).
import { useState } from "react";
import type { TaskPriority } from "@prisma/client";
import { Ban, Pencil } from "lucide-react";
import { Modal, SubmitButton } from "@/components/modal";
import { DescriptionField, DueField, PriorityField, TitleField } from "../../_components/task-fields";

type Action = (fd: FormData) => void | Promise<void>;

export function TaskManage({
  task,
  today,
  update,
  move,
}: {
  task: { title: string; description: string | null; dueDate: string; priority: TaskPriority };
  today: string;
  update: Action;
  move: Action;
}) {
  const [open, setOpen] = useState<"edit" | "cancel" | null>(null);
  const close = () => setOpen(null);
  // Đóng hộp thoại khi gửi; server chuyển trang kèm thông báo
  const run = (act: Action) => async (fd: FormData) => {
    await act(fd);
    close();
  };

  return (
    <>
      <div className="no-print grid grid-cols-2 gap-2 border-t border-border px-5 py-3 max-md:px-3">
        <button type="button" onClick={() => setOpen("edit")} className="btn">
          <Pencil size={14} aria-hidden /> Sửa nhiệm vụ
        </button>
        <button type="button" onClick={() => setOpen("cancel")} className="btn btn-danger">
          <Ban size={14} aria-hidden /> Hủy nhiệm vụ
        </button>
      </div>

      {open === "edit" && (
        <Modal
          title="Sửa nhiệm vụ"
          onClose={close}
          action={run(update)}
          size="lg"
          footer={
            <>
              <button type="button" onClick={close} className="btn">
                Đóng
              </button>
              <SubmitButton>Lưu thay đổi</SubmitButton>
            </>
          }
        >
          <div className="flex flex-col gap-4">
            <TitleField defaultValue={task.title} />
            <div className="grid gap-4 sm:grid-cols-2">
              <DueField today={today} defaultValue={task.dueDate} />
              <PriorityField defaultValue={task.priority} />
            </div>
            <DescriptionField defaultValue={task.description} />
          </div>
        </Modal>
      )}

      {open === "cancel" && (
        <Modal
          title="Hủy nhiệm vụ?"
          subtitle={task.title}
          onClose={close}
          action={run(move)}
          footer={
            <>
              <button type="button" onClick={close} className="btn">
                Không hủy
              </button>
              <SubmitButton name="intent" value="cancel" className="btn btn-danger">
                Hủy nhiệm vụ
              </SubmitButton>
            </>
          }
        >
          <p className="mb-4 text-[13px] text-muted-foreground">Nhiệm vụ sẽ chuyển sang <b className="font-medium text-foreground">Đã hủy</b> và không thao tác tiếp được. Người thực hiện vẫn xem được nhật ký.</p>
          <label className="block">
            <span className="label">Lý do hủy (không bắt buộc)</span>
            <textarea name="note" rows={3} className="input" placeholder="VD: Không còn cần thiết, đã gộp vào nhiệm vụ khác" />
          </label>
        </Modal>
      )}
    </>
  );
}
