// TaskActivity — "Nhật ký trạng thái": giao việc → bắt đầu → báo cáo → trả lại (kèm lý do) → xác nhận / hủy, theo thứ tự thời gian.
// Không có chức năng trao đổi: bình luận cũ trong TaskComment (nếu có) không hiển thị.
import { Ban, CheckCircle2, CornerUpLeft, Play, Send, UserPlus, type LucideIcon } from "lucide-react";
import { fmtWhen, type EventKind, type TaskEvent } from "@/lib/task-view";

type SystemKind = Exclude<EventKind, "comment">;
const SYSTEM: Record<SystemKind, { icon: LucideIcon; dot: string; title: string; quote?: string; prefix?: string }> = {
  assign: { icon: UserPlus, dot: "bg-slate-100 text-slate-600", title: "Giao việc" },
  start: { icon: Play, dot: "bg-brand-50 text-brand-600", title: "Bắt đầu thực hiện" },
  submit: { icon: Send, dot: "bg-amber-50 text-amber-600", title: "Báo cáo hoàn thành", quote: "border-amber-200 bg-amber-50/40 text-slate-700" },
  return: { icon: CornerUpLeft, dot: "bg-red-50 text-red-600", title: "Trả lại để làm tiếp", quote: "border-red-200 bg-red-50/50 text-red-900", prefix: "Lý do: " },
  approve: { icon: CheckCircle2, dot: "bg-emerald-50 text-emerald-600", title: "Xác nhận đạt", quote: "border-emerald-200 bg-emerald-50/50 text-emerald-900", prefix: "Nhận xét: " },
  cancel: { icon: Ban, dot: "bg-slate-100 text-slate-500", title: "Hủy nhiệm vụ", quote: "border-slate-200 bg-slate-50 text-slate-700", prefix: "Lý do: " },
};

export function TaskActivity({ events }: { events: TaskEvent[] }) {
  const log = events.filter((e): e is TaskEvent & { kind: SystemKind } => e.kind !== "comment");
  return (
    <section className="card">
      <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3">
        <h2>Nhật ký trạng thái</h2>
        <span className="text-xs text-slate-500">{log.length} mốc</span>
      </div>
      <ol className="p-5">
        {log.map((e, i) => {
          const s = SYSTEM[e.kind];
          const Icon = s.icon;
          const last = i === log.length - 1;
          return (
            <li key={e.id} className="relative flex gap-3">
              {/* Đường nối giữa các mốc */}
              {!last && <span className="absolute bottom-0 left-[13px] top-8 w-px bg-slate-200" aria-hidden />}
              <span className={`relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${s.dot}`}>
                <Icon size={14} aria-hidden />
              </span>
              <div className={`min-w-0 flex-1 pt-0.5 ${last ? "" : "pb-5"}`}>
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <span className={`text-sm font-medium ${last ? "text-slate-900" : "text-slate-700"}`}>{s.title}</span>
                  <time className="text-xs tabular-nums text-slate-400">{fmtWhen(e.at)}</time>
                </div>
                <div className="text-xs text-slate-500">
                  {e.kind === "assign" ? (
                    <>
                      {e.by} giao cho <span className="font-medium text-slate-700">{e.text}</span>
                    </>
                  ) : (
                    e.by
                  )}
                </div>
                {e.text && s.quote && (
                  <p className={`mt-2 whitespace-pre-line rounded-lg border px-3 py-2 text-sm ${s.quote}`}>
                    {s.prefix && <span className="font-medium">{s.prefix}</span>}
                    {e.text}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
