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
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 sm:items-center" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={box} role="dialog" aria-modal="true" aria-labelledby="reminder-title" className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-3.5">
          <div>
            <h2 id="reminder-title">{dept ? "Nhắc Trưởng phòng" : "Soạn nhắc việc"}</h2>
            <p className="text-xs text-slate-500">
              {subject} · Kênh: Microsoft Teams
            </p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100" aria-label="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col gap-4 overflow-y-auto px-5 py-4">
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
            <p className="rounded-lg bg-brand-50 px-3 py-2 text-xs text-brand-700">
              Gửi cho {messages.length} Trưởng phòng. Các phòng cùng một Trưởng phòng được gộp vào một tin.
            </p>
          )}

          {built.skipped.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <div className="font-medium">
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
            <p className="py-6 text-center text-sm text-slate-500">Không có tin nhắc nào phù hợp với mẫu này. Chọn mẫu khác.</p>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="text-xs font-medium text-slate-500">Xem trước và chỉnh sửa ({messages.length} tin)</div>
              {messages.map((m, i) => (
                <div key={m.recipientId} className="rounded-lg border border-slate-200">
                  <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 bg-slate-50 px-3 py-2 text-xs">
                    <span>
                      Gửi tới <b className="text-slate-800">{m.recipientName}</b>
                      {dept && " (Trưởng phòng)"}
                    </span>
                    {dept && <span className="text-slate-500">Về: {m.about.join(", ")}</span>}
                  </div>
                  <textarea
                    aria-label={`Nội dung gửi ${m.recipientName}`}
                    value={m.body}
                    onChange={(e) => setMessages((all) => all.map((x, j) => (j === i ? { ...x, body: e.target.value } : x)))}
                    rows={Math.min(14, Math.max(6, m.body.split("\n").length + 1))}
                    className="block w-full resize-y rounded-b-lg border-0 px-3 py-2 text-sm leading-relaxed text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-100"
                  />
                </div>
              ))}
            </div>
          )}
          {error && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-slate-200 px-5 py-3">
          <button type="button" onClick={onClose} className="btn btn-ghost">
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
