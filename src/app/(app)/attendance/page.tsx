import { requireHRM } from "@/lib/server/access";
import { applicableMonths, monthLabel, monthState } from "@/lib/server/attendance";
import { demo } from "@/lib/server/demo-store";
import { ATTENDANCE_START_MONTH } from "@/config/attendance";
import { fmtDateTime } from "@/lib/dates";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui";
import { DemoNote } from "@/components/flow-ui";
import { ImportFlow } from "./_components/import-flow";

/**
 * Import chấm công FastWork — chỉ HRM.
 * Rà soát file và xử lý phản hồi diễn ra ngoài hệ thống; hệ thống chỉ nhận file cuối cùng do HRM tải lên.
 */
export default async function AttendancePage() {
  await requireHRM();
  const months = applicableMonths().map(monthState);
  const history = [...demo.attendance].sort((a, b) => b.importedAt.localeCompare(a.importedAt));
  const firstMissing = [...months].reverse().find((m) => m.status === "NONE");

  return (
    <div>
      <PageHeader title="Import chấm công" description={`Nhận file chấm công cuối cùng xuất từ FastWork theo tháng. Áp dụng từ ${monthLabel(ATTENDANCE_START_MONTH).toLowerCase()}.`} />

      <Card title="Import file" className="mb-5">
        <ImportFlow months={months.map((m) => ({ value: m.month, label: m.label, locked: m.status === "LOCKED" }))} defaultMonth={firstMissing?.month ?? months[0]?.month} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card title="Trạng thái theo tháng" pad={false} className="lg:col-span-2">
          {months.length === 0 ? (
            <EmptyState title="Chưa có tháng cần import" hint={`Bắt đầu áp dụng từ ${monthLabel(ATTENDANCE_START_MONTH).toLowerCase()}.`} />
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>Tháng</th>
                  <th>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {months.map((m) => (
                  <tr key={m.month}>
                    <td className="font-medium">{m.label}</td>
                    <td>
                      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                        <Badge tone={m.status === "LOCKED" ? "green" : "amber"}>{m.status === "LOCKED" ? "Đã import (khóa)" : "Chưa import"}</Badge>
                        {m.reimported && <span className="text-xs text-muted-foreground">Đã import lại</span>}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>

        <Card title="Lịch sử import" pad={false} className={`lg:col-span-3 ${history.length ? "max-md:border-0 max-md:bg-transparent max-md:[&>div:first-child]:px-0" : ""}`}>
          {history.length === 0 ? (
            <EmptyState title="Chưa có lần import nào" />
          ) : (
            <>
            <div className="hidden overflow-x-auto md:block">
            <table className="table">
              <thead>
                <tr>
                  <th>Thời điểm</th>
                  <th>Tháng</th>
                  <th>File · Người import</th>
                  <th className="hidden xl:table-cell">Lý do import lại</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id}>
                    <td className="whitespace-nowrap text-xs tabular-nums">{fmtDateTime(new Date(h.importedAt))}</td>
                    <td className="whitespace-nowrap">{monthLabel(h.month)}</td>
                    <td>
                      <div className="max-w-56 truncate text-sm" title={h.fileName}>{h.fileName}</div>
                      <div className="text-xs text-muted-foreground">{h.importedBy} · {h.rows} dòng</div>
                    </td>
                    <td className="hidden min-w-44 text-xs text-muted-foreground xl:table-cell">{h.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            <ul className="space-y-3 md:hidden">
              {history.map((h) => (
                <li key={h.id}>
                  <article className="rounded-[6px] border border-border bg-card p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs tabular-nums text-muted-foreground">{fmtDateTime(new Date(h.importedAt))}</span>
                      <span className="text-xs text-muted-foreground">{h.rows} dòng</span>
                    </div>
                    <div className="mt-0.5 text-[14px] font-medium text-foreground">{monthLabel(h.month)}</div>
                    <dl className="mt-2 flex flex-col gap-y-1 text-[13px]">
                      <div className="min-w-0"><dt className="inline text-muted-foreground">File:</dt> <dd className="inline break-all">{h.fileName}</dd></div>
                      <div><dt className="inline text-muted-foreground">Người import:</dt> <dd className="inline">{h.importedBy}</dd></div>
                      {h.reason && <div><dt className="inline text-muted-foreground">Lý do import lại:</dt> <dd className="inline">{h.reason}</dd></div>}
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
            </>
          )}
        </Card>
      </div>
      <DemoNote>Lịch sử import gồm dữ liệu mẫu và các lần import trong phiên, lưu tạm trong bộ nhớ server (giai đoạn chỉ làm UI), không ghi database.</DemoNote>
    </div>
  );
}
