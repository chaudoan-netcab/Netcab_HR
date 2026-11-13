"use client";
// Cửa sổ soạn nhắc: chọn mẫu → nội dung tự điền theo dữ liệu dòng đã chọn → xem trước, sửa → Gửi (giả lập).
// Dùng chung cho 2 chế độ:
// - nhắc nhân viên (Quản lý; HRM ở "Phòng tôi"): mỗi người 1 tin
// - nhắc Trưởng phòng (HRM ở "Toàn công ty"): người nhận là Trưởng phòng, nhiều phòng cùng Trưởng phòng gộp 1 tin
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { Send, X } from "lucide-react";
import {
  buildDeptReminders,
  buildReminders,
  DEPT_REMINDER_TYPES,
  PERSON_REMINDER_TYPES,
  REMINDER_LABEL,
  type DeptReminderType,
  type DeptRow,
  type PersonReminderType,
  type ReminderMessage,
  type ReminderType,
  type TrackRow,
} from "@/lib/tracking";
import { sendReminder } from "@/lib/server/reminders";

type Target = { kind: "person"; rows: TrackRow[] } | { kind: "dept"; rows: DeptRow[] };

export function ReminderDialog({
  target,
  quarterLabel,
  sender,
  onClose,
  onSent,
}: {
  target: Target;
  quarterLabel: string;
  sender: string;
  onClose: () => void;
  onSent: (message: string) => void;
}) {
  const dept = target.kind === "dept";
  const types: ReminderType[] = dept ? DEPT_REMINDER_TYPES : PERSON_REMINDER_TYPES;
  const [type, setType] = useState<ReminderType>(() =>
    target.kind === "dept"
      ? target.rows.some((r) => r.summary !== "SENT")
        ? "DEPT_SUMMARY"
        : "DEPT_PUSH"
      : target.rows.some((r) => r.overdue > 0)
        ? "OVERDUE"
        : "KPI_MONTH",
  );
  const built = useMemo(
    () =>
      target.kind === "dept"
        ? buildDeptReminders(type as DeptReminderType, target.rows, { quarterLabel, sender })
        : buildReminders(type as PersonReminderType, target.rows, { quarterLabel, sender }),
    [type, target, quarterLabel, sender],
  );
  const [messages, setMessages] = useState<ReminderMessage[]>(built.messages);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const box = useRef<HTMLDivElement>(null);

  // Đổi mẫu → tạo lại nội dung từ dữ liệu của các dòng được chọn
  useEffect(() => {
    setMessages(built.messages);
    setError(null);
  }, [built]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("select")?.focus();
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const send = () =>
    start(async () => {
      const res = await sendReminder({ type, messages: messages.map((m) => ({ recipientId: m.recipientId, body: m.body })) });
      if (res.ok) {
        onSent(res.message);
        onClose();
      } else setError(res.error);
    });

  const n = target.rows.length;
  const subject = dept ? (n === 1 ? target.rows[0].name : `${n} phòng đã chọn`) : n === 1 ? target.rows[0].name : `${n} người đã chọn`;
  const skippedUnit = dept ? "phòng" : "người";

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/10 p-4 backdrop-blur-xs sm:items-center dark:bg-black/50" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="reminder-title" className="flex max-h-[90dvh] w-full max-w-2xl flex-col overflow-hidden rounded-[6px] border border-transparent bg-card shadow-xl dark:border-border dark:bg-popover">
        <div className="flex items-start justify-between gap-3 border-b border-border p-5 max-md:p-4">
          <div>
            <h2 id="reminder-title" className="text-[17px] font-semibold leading-snug">{dept ? "Nhắc Trưởng phòng" : "Soạn nhắc việc"}</h2>
            <p className="mt-0.5 text-[13px] text-muted-foreground">
              {subject} · Kênh: Microsoft Teams
            </p>
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Đóng">
            <X className="size-4.5" aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto p-5 max-md:p-4">
          <label>
            <span className="label">Mẫu nhắc</span>
            <select value={type} onChange={(e) => setType(e.target.value as ReminderType)} className="input">
              {types.map((t, i) => (
                <option key={t} value={t}>
                  {i + 1}. {REMINDER_LABEL[t].replace(" (gửi Trưởng phòng)", "")}
                </option>
              ))}
            </select>
          </label>

          {dept && messages.length > 0 && (
            <p className="rounded-[4px] bg-muted px-3 py-2 text-xs text-muted-foreground">
              Gửi cho {messages.length} Trưởng phòng. Các phòng cùng một Trưởng phòng được gộp vào một tin.
            </p>
          )}

          {built.skipped.length > 0 && (
            <div className="rounded-[4px] bg-muted px-3 py-2 text-xs text-foreground">
              <div className="font-medium text-status-warning-text">
                Không tạo tin cho {built.skipped.length} {skippedUnit}:
              </div>
              <ul className="mt-1 list-disc pl-4">
                {built.skipped.map((s) => (
                  <li key={s.name}>
                    {s.name}: {s.reason}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {messages.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-muted-foreground">Không có tin nhắc nào phù hợp với mẫu này. Chọn mẫu khác.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-medium text-muted-foreground">Xem trước và chỉnh sửa ({messages.length} tin)</div>
              {messages.map((m, i) => (
                <div key={m.recipientId} className="overflow-hidden rounded-[4px] border border-input dark:border-border">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-border bg-muted px-3 py-2 text-xs">
                    <span>
                      Gửi tới <b className="font-medium text-foreground">{m.recipientName}</b>
                      {dept && " (Trưởng phòng)"}
                    </span>
                    {dept && <span className="text-muted-foreground">Về: {m.about.join(", ")}</span>}
                  </div>
                  <textarea
                    aria-label={`Nội dung gửi ${m.recipientName}`}
                    value={m.body}
                    onChange={(e) => setMessages((all) => all.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                    rows={Math.min(14, Math.max(6, m.body.split("\n").length + 1))}
                    className="block w-full resize-y border-0 bg-card px-3 py-2 text-base leading-relaxed text-foreground focus:outline-none focus:ring-1 focus:ring-inset focus:ring-primary md:text-sm dark:bg-popover"
                  />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-status-danger-text">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-border p-4 max-md:[&>button]:flex-1">
          <button type="button" onClick={onClose} className="btn">
            Hủy
          </button>
          <button type="button" onClick={send} disabled={pending || messages.length === 0} className="btn btn-primary">
            <Send size={15} /> {pending ? "Đang gửi…" : `Gửi${messages.length > 1 ? ` (${messages.length})` : ""}`}
          </button>
        </div>
      </div>
    </div>
  );
}
