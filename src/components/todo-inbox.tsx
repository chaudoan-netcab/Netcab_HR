"use client";
// Nút "Việc cần làm" trên thanh trên cùng: số việc đang chờ + danh sách bật ra khi bấm
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, ClipboardCheck, FileSpreadsheet, Inbox, ListTodo, TableProperties, Target } from "lucide-react";
import type { Todo, TodoKind } from "@/lib/server/todos";

const ICON: Record<TodoKind, React.ElementType> = { task: ListTodo, review: ClipboardCheck, kpi: Target, summary: TableProperties, attendance: FileSpreadsheet };

function dueText(d: number | null, due: string | null) {
  if (d === null || !due) return null;
  if (d < 0) return { text: `Quá hạn ${-d} ngày`, cls: "font-medium text-red-600" };
  if (d === 0) return { text: "Hôm nay", cls: "font-medium text-amber-600" };
  if (d === 1) return { text: "Ngày mai", cls: "font-medium text-amber-600" };
  const [y, m, day] = due.slice(0, 10).split("-");
  return { text: `${day}/${m}/${y}`, cls: d <= 3 ? "font-medium text-amber-600" : "text-slate-500" };
}

export function TodoInbox({ todos }: { todos: Todo[] }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const overdue = todos.filter((t) => (t.daysLeft ?? 0) < 0).length;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const groups = [
    { label: "Quá hạn", dot: "bg-red-500", items: todos.filter((t) => t.daysLeft !== null && t.daysLeft < 0) },
    { label: "Đến hạn trong 7 ngày", dot: "bg-amber-500", items: todos.filter((t) => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 7) },
    { label: "Khác", dot: "bg-slate-300", items: todos.filter((t) => t.daysLeft === null || t.daysLeft > 7) },
  ].filter((g) => g.items.length > 0);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Việc cần xử lý: ${todos.length} việc${overdue ? `, ${overdue} quá hạn` : ""}`}
        className={`relative flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm font-medium transition ${open ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"}`}
      >
        <Inbox size={18} />
        <span className="hidden xl:inline">Việc cần xử lý</span>
        {todos.length > 0 && (
          <span className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 text-white ${overdue ? "bg-red-600" : "bg-brand-600"}`}>{todos.length}</span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Việc cần xử lý" className="absolute right-0 top-11 z-40 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
            <span className="text-sm font-semibold text-brand-900">Việc cần xử lý</span>
            {overdue > 0 && <span className="text-xs font-medium text-red-600">{overdue} quá hạn</span>}
          </div>
          {todos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <CheckCircle2 size={26} className="text-emerald-500" />
              <div className="text-sm text-slate-600">Không có việc cần xử lý</div>
            </div>
          ) : (
            <div className="max-h-[70dvh] overflow-y-auto pb-2">
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${g.dot}`} />
                    {g.label}
                    <span className="font-normal text-slate-400">{g.items.length}</span>
                  </div>
                  <ul>
                    {g.items.map((t, i) => {
                      const Icon = ICON[t.kind];
                      const d = dueText(t.daysLeft, t.due);
                      return (
                        <li key={t.href + i}>
                          <Link href={t.href} onClick={() => setOpen(false)} className="group flex items-center gap-3 px-4 py-2 text-slate-700 no-underline hover:bg-slate-50 hover:no-underline">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500 group-hover:bg-brand-50 group-hover:text-brand-600">
                              <Icon size={16} />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-medium text-slate-800">{t.title}</span>
                              <span className="block truncate text-xs text-slate-500">{t.meta}</span>
                            </span>
                            {d && <span className={`shrink-0 text-xs tabular-nums ${d.cls}`}>{d.text}</span>}
                            <ChevronRight size={15} className="shrink-0 text-slate-300" />
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
