// TaskInfo — cột phải: thẻ "Thông tin", dính khi cuộn trên màn hình rộng (≥ 900px).
// Người giao có thêm 2 nút "Sửa nhiệm vụ" / "Hủy nhiệm vụ" ở cuối thẻ (slot `manage`).
import type { ReactNode } from "react";
import { fmtDate } from "@/lib/dates";
import { Avatar } from "@/components/ui";

type Person = { name: string; sub?: string | null };

export function TaskInfo({
  giver,
  assignee,
  assignedAt,
  dueDate,
  completedAt,
  collaborators,
  kpi,
  manage,
}: {
  giver: Person;
  assignee: Person;
  assignedAt: Date;
  dueDate: Date | null;
  completedAt: Date | null;
  collaborators: string[];
  /** TODO(backend): nhiệm vụ chưa có liên kết KPI → luôn null ("Chưa gắn") */
  kpi: string | null;
  manage?: ReactNode;
}) {
  return (
    <section className="card min-[900px]:sticky min-[900px]:top-4">
      <div className="border-b border-slate-100 px-5 py-3">
        <h2>Thông tin</h2>
      </div>
      <div className="flex flex-col gap-4 p-5 text-sm">
        <PersonRow label="Người thực hiện" p={assignee} />
        <PersonRow label="Người giao" p={giver} />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-slate-100 pt-4">
          <Item label="Ngày giao">{fmtDate(assignedAt)}</Item>
          <Item label="Hạn hoàn thành">{dueDate ? fmtDate(dueDate) : <Muted>Không có hạn</Muted>}</Item>
          {completedAt && <Item label="Ngày xác nhận đạt">{fmtDate(completedAt)}</Item>}
          <Item label="KPI liên quan">{kpi ?? <Muted>Chưa gắn</Muted>}</Item>
        </dl>
        <div className="border-t border-slate-100 pt-4">
          <div className="text-xs text-slate-500">Người phối hợp</div>
          {collaborators.length ? (
            <ul className="mt-1.5 flex flex-wrap gap-1.5">
              {collaborators.map((c) => (
                <li key={c} className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-0.5 pl-0.5 pr-2.5 text-xs font-medium text-slate-700">
                  <Avatar name={c} size={20} /> {c}
                </li>
              ))}
            </ul>
          ) : (
            <div className="mt-1">
              <Muted>Không có</Muted>
            </div>
          )}
        </div>
      </div>
      {manage}
    </section>
  );
}

function Muted({ children }: { children: ReactNode }) {
  return <span className="font-normal text-slate-400">{children}</span>;
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums text-slate-800">{children}</dd>
    </div>
  );
}

/** Mỗi người 1 dòng (đủ chỗ cho tên + chức danh dài, không cắt chữ) */
function PersonRow({ label, p }: { label: string; p: Person }) {
  return (
    <div>
      <div className="text-xs text-slate-500">{label}</div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <Avatar name={p.name} size={32} />
        <div className="min-w-0 leading-tight">
          <div className="font-medium text-slate-800">{p.name}</div>
          {p.sub && <div className="mt-0.5 text-xs text-slate-500">{p.sub}</div>}
        </div>
      </div>
    </div>
  );
}
