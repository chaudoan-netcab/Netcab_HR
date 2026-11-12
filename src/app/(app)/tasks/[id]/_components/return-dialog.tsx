"use client";
// "Trả lại": lý do bắt buộc. Gửi intent=reject + note như cũ (tasks/actions.ts → moveTask).
import { Modal, SubmitButton } from "@/components/modal";

export function ReturnDialog({ taskTitle, assignee, action, onClose }: { taskTitle: string; assignee: string; action: (fd: FormData) => void | Promise<void>; onClose: () => void }) {
  return (
    <Modal
      title="Trả lại nhiệm vụ"
      subtitle={taskTitle}
      onClose={onClose}
      action={action}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn">
            Hủy
          </button>
          <SubmitButton name="intent" value="reject" className="btn btn-danger">
            Trả lại
          </SubmitButton>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-600">
        Nhiệm vụ sẽ quay về <b>Đang làm</b>. {assignee} sẽ thấy lý do và báo cáo lại.
      </p>
      <label className="block">
        <span className="label">
          Lý do trả lại <span className="text-red-600">*</span>
        </span>
        <textarea name="note" required rows={4} className="input min-h-28" placeholder="Phần nào chưa đạt, cần bổ sung hoặc làm lại gì" />
      </label>
    </Modal>
  );
}
