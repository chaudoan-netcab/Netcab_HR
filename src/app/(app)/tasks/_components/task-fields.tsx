"use client";
// Các ô nhập dùng chung cho "Giao việc" và "Sửa nhiệm vụ".
// Gửi đúng các trường mà tasks/actions.ts đang đọc: title, assigneeId, collaboratorIds, dueDate (yyyy-mm-dd), priority, description.
import { useMemo, useState } from "react";
import { Check, Flag, Search, X } from "lucide-react";
import type { TaskPriority } from "@prisma/client";
import { DateInput } from "@/components/date-input";

export type PersonOption = { id: string; fullName: string; position: string | null; department: string | null };

const addDaysIso = (iso: string, n: number) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const endOfMonthIso = (iso: string) => {
  const d = new Date(`${iso}T00:00:00.000Z`);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
};

const PRIORITIES: { key: TaskPriority; label: string; on: string }[] = [
  { key: "LOW", label: "Thấp", on: "border-slate-400 bg-slate-100 text-slate-800" },
  { key: "NORMAL", label: "Bình thường", on: "border-brand-500 bg-brand-50 text-brand-700" },
  { key: "HIGH", label: "Cao", on: "border-red-400 bg-red-50 text-red-700" },
];

export function TitleField({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="block">
      <span className="label">
        Tên nhiệm vụ <span className="text-red-600">*</span>
      </span>
      <input name="title" required defaultValue={defaultValue} className="input text-base" placeholder="VD: Lập báo cáo tồn kho tháng 11" />
    </label>
  );
}

export function DescriptionField({ defaultValue }: { defaultValue?: string | null }) {
  return (
    <label className="block">
      <span className="label">Yêu cầu và kết quả mong muốn</span>
      <textarea name="description" rows={4} defaultValue={defaultValue ?? ""} className="input" placeholder="Nội dung công việc, kết quả cần đạt, nơi nộp kết quả" />
    </label>
  );
}

/** Hạn: ô dd/mm/yyyy + nút chọn nhanh */
export function DueField({ today, defaultValue = "" }: { today: string; defaultValue?: string }) {
  const [due, setDue] = useState(defaultValue);
  const quick = [
    { label: "Hôm nay", v: today },
    { label: "3 ngày", v: addDaysIso(today, 3) },
    { label: "1 tuần", v: addDaysIso(today, 7) },
    { label: "2 tuần", v: addDaysIso(today, 14) },
    { label: "Cuối tháng", v: endOfMonthIso(today) },
  ];
  return (
    <div>
      <span className="label">Hạn hoàn thành</span>
      <DateInput name="dueDate" value={due} onChange={setDue} aria-label="Hạn hoàn thành" />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {quick.map((q) => (
          <button
            key={q.label}
            type="button"
            onClick={() => setDue(q.v)}
            className={`rounded-full border px-2.5 py-1 text-xs font-medium transition ${due === q.v ? "border-brand-500 bg-brand-50 text-brand-700" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"}`}
          >
            {q.label}
          </button>
        ))}
        {due && (
          <button type="button" onClick={() => setDue("")} className="rounded-full px-2 py-1 text-xs text-slate-400 hover:text-slate-700">
            Bỏ hạn
          </button>
        )}
      </div>
    </div>
  );
}

/** Mức ưu tiên: 3 nút chọn (radio) */
export function PriorityField({ defaultValue = "NORMAL" }: { defaultValue?: TaskPriority }) {
  const [p, setP] = useState<TaskPriority>(defaultValue);
  return (
    <fieldset>
      <legend className="label">Mức ưu tiên</legend>
      <div className="grid grid-cols-3 gap-1.5">
        {PRIORITIES.map((o) => (
          <label
            key={o.key}
            className={`flex cursor-pointer items-center justify-center gap-1 rounded-lg border px-2 py-2 text-sm font-medium transition has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand-200 ${
              p === o.key ? o.on : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            <input type="radio" name="priority" value={o.key} checked={p === o.key} onChange={() => setP(o.key)} className="sr-only" />
            {o.key === "HIGH" && <Flag size={13} aria-hidden />}
            {o.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** Người thực hiện + người phối hợp (chỉ khi giao việc mới) */
export function PeopleFields({ people, defaultAssignee = "" }: { people: PersonOption[]; defaultAssignee?: string }) {
  const [assignee, setAssignee] = useState(defaultAssignee);
  const [picked, setPicked] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const others = people.filter((p) => p.id !== assignee && (!q || p.fullName.toLowerCase().includes(q.toLowerCase())));
  const chosen = picked.filter((id) => id !== assignee);
  const toggle = (id: string) => setPicked((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  return (
    <>
      <label className="block">
        <span className="label">
          Người thực hiện <span className="text-red-600">*</span>
        </span>
        <select name="assigneeId" required value={assignee} onChange={(e) => setAssignee(e.target.value)} className="input">
          <option value="">Chọn người thực hiện</option>
          {people.map((p) => (
            <option key={p.id} value={p.id}>
              {p.fullName}
              {p.position ? ` · ${p.position}` : p.department ? ` · ${p.department}` : ""}
            </option>
          ))}
        </select>
      </label>

      <div>
        <div className="label flex items-center justify-between">
          <span>
            Người phối hợp <span className="font-normal text-slate-400">(không bắt buộc)</span>
          </span>
          {chosen.length > 0 && <span className="font-normal text-slate-500">Đã chọn {chosen.length}</span>}
        </div>
        {chosen.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {chosen.map((id) => (
              <li key={id}>
                <input type="hidden" name="collaboratorIds" value={id} />
                <button type="button" onClick={() => toggle(id)} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-2.5 pr-1.5 text-xs font-medium text-brand-700 ring-1 ring-brand-100 hover:bg-brand-100" aria-label={`Bỏ ${byId.get(id)?.fullName}`}>
                  {byId.get(id)?.fullName} <X size={12} aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-lg border border-slate-200">
          <div className="relative border-b border-slate-100">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm người phối hợp" aria-label="Tìm người phối hợp" className="w-full rounded-t-lg py-2 pl-8 pr-3 text-sm outline-none" />
          </div>
          <ul className="max-h-40 overflow-y-auto p-1">
            {others.length === 0 && <li className="px-2 py-2 text-xs text-slate-400">Không có người phù hợp</li>}
            {others.map((p) => {
              const on = picked.includes(p.id);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => toggle(p.id)} className={`flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm ${on ? "bg-brand-50" : "hover:bg-slate-50"}`} aria-pressed={on}>
                    <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${on ? "border-brand-600 bg-brand-600 text-white" : "border-slate-300"}`}>{on && <Check size={11} aria-hidden />}</span>
                    <span>
                      <span className="text-slate-800">{p.fullName}</span>
                      {(p.position || p.department) && <span className="ml-1.5 text-xs text-slate-500">{p.position ?? p.department}</span>}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </>
  );
}
