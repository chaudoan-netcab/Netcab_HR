"use client";
// Nút hành động chính ở đầu trang, đổi theo vai trò + trạng thái. Quyền vẫn do server kiểm tra (moveTask).
import { useState } from "react";
import { CheckCircle2, CornerUpLeft, Hourglass, Play, Send } from "lucide-react";
import { SubmitButton } from "@/components/modal";
import { ApproveDialog } from "./approve-dialog";
import { ReportDialog } from "./report-dialog";
import { ReturnDialog } from "./return-dialog";

export type ActionMode = "start" | "report" | "rereport" | "waiting" | "review" | "none";

export function TaskActions({
  mode,
  move,
  taskTitle,
  giver,
  assignee,
  resultNote,
  returnReason,
}: {
  mode: ActionMode;
  move: (fd: FormData) => void | Promise<void>;
  taskTitle: string;
  giver: string;
  assignee: string;
  resultNote: string | null;
  returnReason: string | null;
}) {
  const [open, setOpen] = useState<"report" | "return" | "approve" | null>(null);
  const close = () => setOpen(null);

  if (mode === "none") return null;
  if (mode === "waiting")
    return (
      <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800 ring-1 ring-amber-200">
        <Hourglass size={15} className="shrink-0" aria-hidden />
        <span>
          Đang chờ <b className="font-semibold">{giver}</b> xác nhận
        </span>
      </p>
    );

  return (
    <>
      {mode === "start" && (
        <form action={move}>
          <SubmitButton name="intent" value="start">
            <Play size={15} aria-hidden /> Bắt đầu làm
          </SubmitButton>
        </form>
      )}
      {(mode === "report" || mode === "rereport") && (
        <button type="button" onClick={() => setOpen("report")} className="btn btn-primary">
          <Send size={15} aria-hidden /> {mode === "rereport" ? "Báo cáo lại" : "Báo cáo hoàn thành"}
        </button>
      )}
      {mode === "review" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen("return")} className="btn">
            <CornerUpLeft size={15} aria-hidden /> Trả lại
          </button>
          <button type="button" onClick={() => setOpen("approve")} className="btn btn-primary">
            <CheckCircle2 size={15} aria-hidden /> Xác nhận đạt
          </button>
        </div>
      )}

      {open === "report" && (
        <ReportDialog
          title={mode === "rereport" ? "Báo cáo lại" : "Báo cáo hoàn thành"}
          taskTitle={taskTitle}
          action={move}
          defaultNote={mode === "rereport" ? resultNote : null}
          returnReason={mode === "rereport" ? returnReason : null}
          onClose={close}
        />
      )}
      {open === "return" && <ReturnDialog taskTitle={taskTitle} assignee={assignee} action={move} onClose={close} />}
      {open === "approve" && <ApproveDialog taskTitle={taskTitle} assignee={assignee} resultNote={resultNote} action={move} onClose={close} />}
    </>
  );
}
