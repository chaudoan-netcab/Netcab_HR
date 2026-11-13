"use client";
// "Báo cáo hoàn thành" / "Báo cáo lại": kết quả thực hiện (bắt buộc) + file minh chứng.
// TODO(backend): chưa có nơi lưu file minh chứng (bảng TaskAttachment + kho file). Hiện chỉ gửi phần nội dung;
//                danh sách file chỉ nằm trên giao diện và KHÔNG được gửi lên server (ô chọn file không có name).
import { useRef, useState } from "react";
import { FileText, Paperclip, UploadCloud, X } from "lucide-react";
import { Modal, SubmitButton } from "@/components/modal";

const MAX_FILES = 10;
const fmtSize = (b: number) => (b >= 1_048_576 ? `${(b / 1_048_576).toFixed(1).replace(".", ",")} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

export function ReportDialog({
  title,
  taskTitle,
  action,
  defaultNote,
  returnReason,
  onClose,
}: {
  title: string;
  taskTitle: string;
  action: (fd: FormData) => void | Promise<void>;
  defaultNote?: string | null;
  returnReason?: string | null;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [drag, setDrag] = useState(false);
  const picker = useRef<HTMLInputElement>(null);

  const add = (list: FileList | null) => {
    if (!list) return;
    setFiles((cur) => {
      const seen = new Set(cur.map((f) => `${f.name}:${f.size}`));
      return [...cur, ...[...list].filter((f) => !seen.has(`${f.name}:${f.size}`))].slice(0, MAX_FILES);
    });
  };

  return (
    <Modal
      title={title}
      subtitle={taskTitle}
      onClose={onClose}
      action={action}
      size="lg"
      footer={
        <>
          <button type="button" onClick={onClose} className="btn">
            Hủy
          </button>
          <SubmitButton name="intent" value="submit">
            Gửi báo cáo
          </SubmitButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {returnReason && (
          <p className="whitespace-pre-line text-[13px] text-foreground">
            <span className="font-medium text-status-danger-text">Lý do trả lại:</span> {returnReason}
          </p>
        )}
        <label className="block">
          <span className="label">
            Kết quả thực hiện <span className="text-status-danger-text">*</span>
          </span>
          <textarea
            name="note"
            required
            defaultValue={defaultNote ?? ""}
            rows={5}
            className="input min-h-32"
            placeholder="Đã làm được gì, kết quả đạt được, đường dẫn tài liệu kết quả (nếu có)"
          />
        </label>

        <div>
          <span className="label">File minh chứng</span>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              add(e.dataTransfer.files);
            }}
            onClick={() => picker.current?.click()}
            onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), picker.current?.click())}
            role="button"
            tabIndex={0}
            className={`flex cursor-pointer flex-col items-center gap-1 rounded-[4px] border border-dashed px-4 py-5 text-center transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary ${
              drag ? "border-primary bg-primary/5" : "border-input bg-muted/50 hover:border-primary/60 dark:border-foreground/20 dark:bg-card"
            }`}
          >
            <UploadCloud size={20} className={drag ? "text-primary-text" : "text-muted-foreground"} aria-hidden />
            <div className="text-[13px] text-foreground">
              Kéo thả file vào đây hoặc <span className="font-medium text-primary-text">chọn file</span>
            </div>
            <div className="text-xs text-muted-foreground">Tối đa {MAX_FILES} file · ảnh, PDF, Word, Excel</div>
          </div>
          {/* Không có name → không gửi file lên server (xem TODO đầu file) */}
          <input ref={picker} type="file" multiple className="hidden" onChange={(e) => (add(e.target.files), (e.target.value = ""))} />

          {files.length > 0 && (
            <ul className="mt-2 flex flex-col divide-y divide-border rounded-[4px] border border-border">
              {files.map((f, i) => (
                <li key={`${f.name}:${f.size}`} className="flex items-center gap-2.5 px-3 py-2 text-[13px]">
                  <FileText size={16} className="shrink-0 text-muted-foreground" aria-hidden />
                  <span className="min-w-0 flex-1 break-all text-foreground">
                    {f.name}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">{fmtSize(f.size)}</span>
                  <button
                    type="button"
                    onClick={() => setFiles((cur) => cur.filter((_, j) => j !== i))}
                    className="flex size-7 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-destructive/10 hover:text-status-danger-text"
                    aria-label={`Bỏ file ${f.name}`}
                  >
                    <X size={15} />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {files.length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-xs text-status-warning-text">
              <Paperclip size={13} className="mt-0.5 shrink-0" aria-hidden />
              Bản thử nghiệm: hệ thống chưa lưu file đính kèm, chỉ gửi phần nội dung. Vui lòng ghi đường dẫn tài liệu vào ô kết quả.
            </p>
          )}
        </div>
      </div>
    </Modal>
  );
}
