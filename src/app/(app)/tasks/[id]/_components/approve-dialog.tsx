"use client";
// "Xác nhận đạt" — theo cách xác nhận đang có: nhận xét không bắt buộc, KHÔNG chấm điểm.
// TODO(backend): nhiệm vụ chưa có cột điểm; khi có thì thêm ô chấm điểm vào đây và hiện điểm ở "Kết quả đã báo cáo".
import { CheckCircle2 } from "lucide-react";
import { Modal, SubmitButton } from "@/components/modal";

export function ApproveDialog({ taskTitle, assignee, resultNote, action, onClose }: { taskTitle: string; assignee: string; resultNote: string | null; action: (fd: FormData) => void | Promise<void>; onClose: () => void }) {
  return (
    <Modal
      title="Xác nhận đạt"
      subtitle={taskTitle}
      onClose={onClose}
      action={action}
      footer={
        <>
          <button type="button" onClick={onClose} className="btn">
            Hủy
          </button>
          <SubmitButton name="intent" value="approve">
            <CheckCircle2 size={15} aria-hidden /> Xác nhận đạt
          </SubmitButton>
        </>
      }
    >
      {resultNote && (
        <div className="mb-4">
          <div className="label">Kết quả {assignee} đã báo cáo</div>
          <p className="max-h-40 overflow-y-auto whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{resultNote}</p>
        </div>
      )}
      <label className="block">
        <span className="label">Nhận xét (không bắt buộc)</span>
        <textarea name="note" rows={3} className="input" placeholder="Ghi nhận, góp ý cho lần sau" />
      </label>
      <p className="mt-3 text-xs text-slate-500">Sau khi xác nhận, nhiệm vụ chuyển sang Hoàn thành và không sửa được nữa.</p>
    </Modal>
  );
}
