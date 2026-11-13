// Đầu trang: đường dẫn · tiêu đề · hàng nhãn (trạng thái, ưu tiên, hạn) · 1 nút hành động chính bên phải.
// Trạng thái / ưu tiên / hạn là chữ nhỏ có màu, ngăn bằng dấu "·" (không nền, không icon trang trí).
import Link from "next/link";
import { Fragment, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
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
  // Ưu tiên thường / thấp và hạn chưa gấp: chữ xám, chỉ tô màu khi cần chú ý
  const chips: { key: string; tone: Tone; label: string }[] = [
    { key: "status", tone: status.tone, label: status.label },
    { key: "priority", tone: priority.tone, label: priority.label },
    { key: "due", tone: due.tone, label: due.label },
  ];
  return (
    <header className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <nav aria-label="Đường dẫn" className="mb-1 flex items-center gap-1 text-xs text-muted-foreground">
          <Link href="/tasks" className="text-muted-foreground no-underline hover:text-foreground">
            Nhiệm vụ
          </Link>
          <ChevronRight size={12} aria-hidden />
        </nav>
        <h1 className="text-balance sm:text-[20px]">{title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          {chips.map((c, i) => (
            <Fragment key={c.key}>
              {i > 0 && (
                <span className="text-xs text-muted-foreground" aria-hidden>
                  ·
                </span>
              )}
              {c.tone === "gray" && c.key !== "status" ? <span className="text-xs text-muted-foreground tabular-nums">{c.label}</span> : <Badge tone={c.tone}>{c.label}</Badge>}
            </Fragment>
          ))}
        </div>
      </div>
      {action && <div className="no-print flex shrink-0 flex-wrap items-center gap-2 sm:pt-5">{action}</div>}
    </header>
  );
}
