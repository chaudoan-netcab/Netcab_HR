// "Kết quả đã báo cáo" — chỉ hiện khi đã có báo cáo.
// TODO(backend): danh sách file minh chứng (chưa lưu file) và điểm xác nhận (nhiệm vụ chưa có cột điểm).
import { Paperclip } from "lucide-react";
import { fmtWhen } from "@/lib/task-view";
import { Badge, Card } from "@/components/ui";

export function TaskResult({
  note,
  reportedAt,
  returned,
  approved,
}: {
  note: string | null;
  reportedAt: Date | null;
  returned: boolean;
  approved: { by: string; at: Date | null; note: string | null } | null;
}) {
  if (!note) return null;
  return (
    <Card
      title={returned ? "Kết quả báo cáo lần trước" : "Kết quả đã báo cáo"}
      actions={returned ? <Badge tone="red">Bị trả lại</Badge> : reportedAt && <span className="text-xs text-muted-foreground tabular-nums">Báo cáo lúc {fmtWhen(reportedAt)}</span>}
    >
      <div className="flex flex-col gap-4">
        <p className={`whitespace-pre-line text-[13px] leading-relaxed ${returned ? "text-muted-foreground" : "text-foreground"}`}>{note}</p>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <Paperclip size={13} aria-hidden /> File minh chứng
          </div>
          <p className="text-[13px] text-muted-foreground">Chưa có file đính kèm</p>
        </div>
        {returned && reportedAt && <p className="text-xs text-muted-foreground tabular-nums">Báo cáo lúc {fmtWhen(reportedAt)}</p>}
        {approved && (
          <div className="border-t border-border pt-4 text-[13px]">
            <div className="flex items-center gap-2">
              <span className="size-2 shrink-0 rounded-full bg-status-success" aria-hidden />
              <span>
                <span className="font-medium text-status-success-text">Đã xác nhận đạt</span> bởi <b className="font-medium text-foreground">{approved.by}</b>
                {approved.at && <span className="text-xs text-muted-foreground tabular-nums"> · {fmtWhen(approved.at)}</span>}
              </span>
            </div>
            {approved.note && <p className="mt-1 whitespace-pre-line pl-4 text-foreground">“{approved.note}”</p>}
          </div>
        )}
      </div>
    </Card>
  );
}
