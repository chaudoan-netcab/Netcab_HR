// "Kết quả đã báo cáo" — chỉ hiện khi đã có báo cáo.
// TODO(backend): danh sách file minh chứng (chưa lưu file) và điểm xác nhận (nhiệm vụ chưa có cột điểm).
import { BadgeCheck, Paperclip } from "lucide-react";
import { fmtWhen } from "@/lib/task-view";
import { Badge } from "@/components/ui";

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
    <section className={`card ${returned ? "border-slate-200 bg-slate-50/50" : ""}`}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
        <h2>{returned ? "Kết quả báo cáo lần trước" : "Kết quả đã báo cáo"}</h2>
        {returned ? <Badge tone="red">Bị trả lại</Badge> : reportedAt && <span className="text-xs text-slate-500">Báo cáo lúc {fmtWhen(reportedAt)}</span>}
      </div>
      <div className="card-pad flex flex-col gap-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-slate-800">{note}</p>
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-xs font-medium text-slate-500">
            <Paperclip size={13} aria-hidden /> File minh chứng
          </div>
          <p className="text-sm text-slate-400">Chưa có file đính kèm</p>
        </div>
        {returned && reportedAt && <p className="text-xs text-slate-500">Báo cáo lúc {fmtWhen(reportedAt)}</p>}
        {approved && (
          <div className="flex items-start gap-2.5 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800 ring-1 ring-emerald-200">
            <BadgeCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <div>
                Đã xác nhận đạt bởi <b className="font-semibold">{approved.by}</b>
                {approved.at && <span className="text-emerald-700"> · {fmtWhen(approved.at)}</span>}
              </div>
              {approved.note && <p className="mt-1 whitespace-pre-line text-emerald-900">“{approved.note}”</p>}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
