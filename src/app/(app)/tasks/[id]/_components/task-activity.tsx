// TaskActivity — "Nhật ký trạng thái": giao việc → bắt đầu → báo cáo → trả lại (kèm lý do) → xác nhận / hủy, theo thứ tự thời gian.
// Dòng thời gian gọn: vạch trái + chấm 8px; trạng thái là chữ màu (không icon, không khung màu).
// Không có chức năng trao đổi: bình luận cũ trong TaskComment (nếu có) không hiển thị.
import { fmtWhen, type EventKind, type TaskEvent } from "@/lib/task-view";
import { Card } from "@/components/ui";

type SystemKind = Exclude<EventKind, "comment">;
const SYSTEM: Record<SystemKind, { dot: string; text: string; title: string; prefix?: string; quote?: boolean }> = {
  assign: { dot: "bg-status-neutral", text: "text-foreground", title: "Giao việc" },
  start: { dot: "bg-primary", text: "text-foreground", title: "Bắt đầu thực hiện" },
  submit: { dot: "bg-status-warning", text: "text-foreground", title: "Báo cáo hoàn thành", quote: true },
  return: { dot: "bg-status-danger", text: "text-status-danger-text", title: "Trả lại để làm tiếp", quote: true, prefix: "Lý do: " },
  approve: { dot: "bg-status-success", text: "text-status-success-text", title: "Xác nhận đạt", quote: true, prefix: "Nhận xét: " },
  cancel: { dot: "bg-status-neutral", text: "text-muted-foreground", title: "Hủy nhiệm vụ", quote: true, prefix: "Lý do: " },
};

export function TaskActivity({ events }: { events: TaskEvent[] }) {
  const log = events.filter((e): e is TaskEvent & { kind: SystemKind } => e.kind !== "comment");
  return (
    <Card title="Nhật ký trạng thái" actions={<span className="text-xs text-muted-foreground tabular-nums">{log.length} mốc</span>}>
      <ol className="ml-1 space-y-4 border-l border-border pl-5">
        {log.map((e) => {
          const s = SYSTEM[e.kind];
          return (
            <li key={e.id} className="relative">
              <span className={`absolute -left-[25px] top-[5px] size-2 rounded-full ${s.dot}`} aria-hidden />
              <div className={`text-[13px] font-medium ${s.text}`}>{s.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                {e.kind === "assign" ? (
                  <>
                    {e.by} giao cho <span className="text-foreground">{e.text}</span>
                  </>
                ) : (
                  e.by
                )}
                {" · "}
                <time className="tabular-nums">{fmtWhen(e.at)}</time>
              </div>
              {e.text && s.quote && (
                <p className="mt-1.5 whitespace-pre-line text-[13px] text-muted-foreground">
                  {s.prefix && <span className="font-medium text-foreground">{s.prefix}</span>}
                  {e.text}
                </p>
              )}
            </li>
          );
        })}
      </ol>
    </Card>
  );
}
