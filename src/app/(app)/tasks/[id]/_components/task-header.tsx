// Đầu trang: đường dẫn · tiêu đề · hàng nhãn (trạng thái, ưu tiên, hạn) · 1 nút hành động chính bên phải.
import Link from "next/link";
import type { ReactNode } from "react";
import { AlertTriangle, CalendarClock, ChevronRight, Flag } from "lucide-react";
import { Badge } from "@/components/ui";
import type { Tone } from "@/lib/labels";

export function TaskHeader({
  title,
  status,
  priority,
  due,
  action,
}: {
  title: string;
  status: { label: string; tone: Tone };
  priority: { label: string; tone: Tone; high: boolean };
  due: { label: string; tone: Tone; late: boolean };
  action?: ReactNode;
}) {
  return (
    <header className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <nav aria-label="Đường dẫn" className="mb-1 flex items-center gap-1 text-xs text-slate-500">
          <Link href="/tasks" className="text-slate-500 hover:text-brand-600">
            Nhiệm vụ
          </Link>
          <ChevronRight size={12} aria-hidden />
        </nav>
        <h1 className="text-xl leading-snug text-balance sm:text-2xl">{title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <Badge tone={status.tone}>{status.label}</Badge>
          <Badge tone={priority.tone}>
            {priority.high && <Flag size={11} aria-hidden />}
            {priority.label}
          </Badge>
          <Badge tone={due.tone}>
            {due.late ? <AlertTriangle size={11} aria-hidden /> : <CalendarClock size={11} aria-hidden />}
            {due.label}
          </Badge>
        </div>
      </div>
      {action && <div className="no-print flex shrink-0 flex-wrap items-center gap-2 sm:pt-5">{action}</div>}
    </header>
  );
}
