"use client";
// Các ô nhập dùng chung cho "Giao việc" và "Sửa nhiệm vụ".
// Gửi đúng các trường mà tasks/actions.ts đang đọc: title, assigneeId, collaboratorIds, dueDate (yyyy-mm-dd), priority, description.
import { useMemo, useState } from "react";
import { Check, Search, X } from "lucide-react";
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

// Ô đang chọn: nền màu chính nhạt (lựa chọn, không phải trạng thái)
const PRIORITIES: { key: TaskPriority; label: string }[] = [
  { key: "LOW", label: "Thấp" },
  { key: "NORMAL", label: "Bình thường" },
  { key: "HIGH", label: "Cao" },
];
const CHIP = "inline-flex h-7 items-center rounded-[4px] px-2.5 text-xs font-medium transition-colors";
const CHIP_ON = "bg-primary/10 text-primary-text";
const CHIP_OFF = "bg-muted text-muted-foreground hover:text-foreground dark:bg-foreground/10";

export function TitleField({ defaultValue }: { defaultValue?: string }) {
  return (
    <label className="block">
      <span className="label">
        Tên nhiệm vụ <span className="text-status-danger-text">*</span>
      </span>
      <input name="title" required defaultValue={defaultValue} className="input" placeholder="VD: Lập báo cáo tồn kho tháng 11" />
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
            aria-pressed={due === q.v}
            className={`${CHIP} ${due === q.v ? CHIP_ON : CHIP_OFF}`}
          >
            {q.label}
          </button>
        ))}
        {due && (
          <button type="button" onClick={() => setDue("")} className="inline-flex h-7 items-center rounded-[4px] px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground">
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
            className={`flex h-8.5 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-[4px] border px-2 text-[13px] font-medium transition-colors has-[:focus-visible]:ring-1 has-[:focus-visible]:ring-primary ${
              p === o.key ? "border-primary bg-primary/10 text-primary-text" : "border-input bg-card text-muted-foreground hover:bg-muted hover:text-foreground dark:border-border"
            }`}
          >
            <input type="radio" name="priority" value={o.key} checked={p === o.key} onChange={() => setP(o.key)} className="sr-only" />
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
          Người thực hiện <span className="text-status-danger-text">*</span>
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
            Người phối hợp <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
          </span>
          {chosen.length > 0 && <span className="font-normal text-muted-foreground">Đã chọn {chosen.length}</span>}
        </div>
        {chosen.length > 0 && (
          <ul className="mb-2 flex flex-wrap gap-1.5">
            {chosen.map((id) => (
              <li key={id}>
                <input type="hidden" name="collaboratorIds" value={id} />
                <button type="button" onClick={() => toggle(id)} className="inline-flex h-7 items-center gap-1 rounded-[4px] bg-muted pl-2.5 pr-1.5 text-xs font-medium text-foreground hover:bg-foreground/10 dark:bg-foreground/10 dark:hover:bg-foreground/15" aria-label={`Bỏ ${byId.get(id)?.fullName}`}>
                  {byId.get(id)?.fullName} <X size={12} className="text-muted-foreground" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        )}
        <div className="rounded-[4px] border border-input bg-card dark:border-border">
          <div className="relative border-b border-border">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm người phối hợp" aria-label="Tìm người phối hợp" className="h-8.5 w-full rounded-t-[4px] bg-transparent pl-8 pr-3 text-base text-foreground outline-none placeholder:text-muted-foreground md:text-[13px]" />
          </div>
          <ul className="max-h-40 overflow-y-auto p-1">
            {others.length === 0 && <li className="px-2 py-2 text-xs text-muted-foreground">Không có người phù hợp</li>}
            {others.map((p) => {
              const on = picked.includes(p.id);
              return (
                <li key={p.id}>
                  <button type="button" onClick={() => toggle(p.id)} className={`flex w-full items-center gap-2.5 rounded-[4px] px-2 py-1.5 text-left text-[13px] ${on ? "bg-primary/10" : "hover:bg-muted"}`} aria-pressed={on}>
                    <span className={`flex size-4 shrink-0 items-center justify-center rounded-[3px] border ${on ? "border-primary bg-primary text-primary-foreground" : "border-foreground/30"}`}>{on && <Check size={11} aria-hidden />}</span>
                    <span>
                      <span className="text-foreground">{p.fullName}</span>
                      {(p.position || p.department) && <span className="ml-1.5 text-xs text-muted-foreground">{p.position ?? p.department}</span>}
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
