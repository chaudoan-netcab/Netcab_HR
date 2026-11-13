"use client";
// Nút "Việc cần làm" trên thanh trên cùng: số việc đang chờ + danh sách bật ra khi bấm
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, ChevronRight, ClipboardCheck, FileSpreadsheet, Inbox, ListTodo, TableProperties, Target } from "lucide-react";
import type { Todo, TodoKind } from "@/lib/server/todos";

const ICON: Record<TodoKind, React.ElementType> = { task: ListTodo, review: ClipboardCheck, kpi: Target, summary: TableProperties, attendance: FileSpreadsheet };

function dueText(d: number | null, due: string | null) {
  if (d === null || !due) return null;
  if (d < 0) return { text: `Quá hạn ${-d} ngày`, cls: "font-medium text-status-danger-text" };
  if (d === 0) return { text: "Hôm nay", cls: "font-medium text-status-warning-text" };
  if (d === 1) return { text: "Ngày mai", cls: "font-medium text-status-warning-text" };
  const [y, m, day] = due.slice(0, 10).split("-");
  return { text: `${day}/${m}/${y}`, cls: d <= 3 ? "font-medium text-status-warning-text" : "text-muted-foreground" };
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
    { label: "Quá hạn", dot: "bg-status-danger", items: todos.filter((t) => t.daysLeft !== null && t.daysLeft < 0) },
    { label: "Đến hạn trong 7 ngày", dot: "bg-status-warning", items: todos.filter((t) => t.daysLeft !== null && t.daysLeft >= 0 && t.daysLeft <= 7) },
    { label: "Khác", dot: "bg-status-neutral", items: todos.filter((t) => t.daysLeft === null || t.daysLeft > 7) },
  ].filter((g) => g.items.length > 0);

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Việc cần xử lý: ${todos.length} việc${overdue ? `, ${overdue} quá hạn` : ""}`}
        className={`relative flex h-9 items-center gap-2 rounded-[4px] px-2.5 text-[13px] font-medium transition-colors ${open ? "bg-muted text-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"}`}
      >
        <Inbox className="size-4.5" />
        <span className="hidden xl:inline">Việc cần xử lý</span>
        {todos.length > 0 && (
          <span className={`min-w-5 rounded-full px-1.5 text-center text-[11px] font-semibold leading-5 ${overdue ? "bg-status-danger text-status-foreground" : "bg-primary text-primary-foreground"}`}>{todos.length}</span>
        )}
      </button>

      {open && (
        <div role="dialog" aria-label="Việc cần xử lý" className="absolute right-0 top-11 z-50 w-[min(26rem,calc(100vw-2rem))] overflow-hidden rounded-[6px] border border-border bg-popover shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <span className="section-title">Việc cần xử lý</span>
            {overdue > 0 && <span className="text-xs font-medium text-status-danger-text">{overdue} quá hạn</span>}
          </div>
          {todos.length === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <CheckCircle2 size={22} className="text-status-success-text" aria-hidden />
              <div className="text-[13px] text-muted-foreground">Không có việc cần xử lý</div>
            </div>
          ) : (
            <div className="max-h-[70dvh] overflow-y-auto pb-2">
              {groups.map((g) => (
                <div key={g.label}>
                  <div className="flex items-center gap-2 px-4 pb-1 pt-3 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    <span className={`size-1.5 rounded-full ${g.dot}`} />
                    {g.label}
                    <span className="font-normal">{g.items.length}</span>
                  </div>
                  <ul className="divide-y divide-border">
                    {g.items.map((t, i) => {
                      const Icon = ICON[t.kind];
                      const d = dueText(t.daysLeft, t.due);
                      return (
                        <li key={t.href + i}>
                          <Link href={t.href} onClick={() => setOpen(false)} className="group flex items-center gap-3 px-4 py-2.5 text-foreground no-underline hover:bg-muted hover:no-underline">
                            <Icon className="size-4 shrink-0 text-muted-foreground group-hover:text-foreground" aria-hidden />
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-[13px] font-medium text-foreground">{t.title}</span>
                              <span className="block truncate text-xs text-muted-foreground">{t.meta}</span>
                            </span>
                            {d && <span className={`shrink-0 text-xs tabular-nums ${d.cls}`}>{d.text}</span>}
                            <ChevronRight size={15} className="shrink-0 text-muted-foreground" aria-hidden />
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
