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
      <div className="flex min-h-[40px] items-center px-5 pt-4 max-md:px-3">
        <h2 className="section-title">Thông tin</h2>
      </div>
      <div className="flex flex-col gap-4 p-5 text-[13px] max-md:p-3">
        <PersonRow label="Người thực hiện" p={assignee} />
        <PersonRow label="Người giao" p={giver} />
        <dl className="grid grid-cols-2 gap-x-4 gap-y-4 border-t border-border pt-4">
          <Item label="Ngày giao">{fmtDate(assignedAt)}</Item>
          <Item label="Hạn hoàn thành">{dueDate ? fmtDate(dueDate) : <Muted>Không có hạn</Muted>}</Item>
          {completedAt && <Item label="Ngày xác nhận đạt">{fmtDate(completedAt)}</Item>}
          <Item label="KPI liên quan">{kpi ?? <Muted>Chưa gắn</Muted>}</Item>
        </dl>
        <div className="border-t border-border pt-4">
          <div className="text-xs text-muted-foreground">Người phối hợp</div>
          {collaborators.length ? (
            <ul className="mt-1.5 flex flex-col gap-1.5">
              {collaborators.map((c) => (
                <li key={c} className="flex items-center gap-2 text-foreground">
                  <Avatar name={c} size={22} /> {c}
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
  return <span className="font-normal text-muted-foreground">{children}</span>;
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-1 font-medium tabular-nums text-foreground">{children}</dd>
    </div>
  );
}

/** Mỗi người 1 dòng (đủ chỗ cho tên + chức danh dài, không cắt chữ) */
function PersonRow({ label, p }: { label: string; p: Person }) {
  return (
    <div>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1.5 flex items-center gap-2.5">
        <Avatar name={p.name} size={32} />
        <div className="min-w-0 leading-tight">
          <div className="font-medium text-foreground">{p.name}</div>
          {p.sub && <div className="mt-0.5 text-xs text-muted-foreground">{p.sub}</div>}
        </div>
      </div>
    </div>
  );
}
