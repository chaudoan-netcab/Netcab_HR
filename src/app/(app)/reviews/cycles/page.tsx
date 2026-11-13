import Link from "next/link";
import { reviewTabs } from "@/lib/nav";
import { db } from "@/lib/server/db";
import { fmtDate, today } from "@/lib/dates";
import { Badge, Card, EmptyState, Field, Flash, PageHeader, ProgressBar, Tabs } from "@/components/ui";
import { createCycle } from "../actions";
import { capsOf, requireHRM } from "@/lib/server/access";
import { DateInput } from "@/components/date-input";

export default async function CyclesPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireHRM();
  const sp = await searchParams;
  const year = today().getUTCFullYear();
  const cycles = await db.reviewCycle.findMany({ include: { reviews: { select: { status: true } } }, orderBy: { createdAt: "desc" } });
  return (
    <div>
      <PageHeader title="Kỳ đánh giá thành tích" description="Khi mở kỳ đánh giá, hệ thống tạo phiếu BM1-003 cho từng nhân viên theo cấp bậc (Nhân viên/Chuyên viên hoặc Giám sát trở lên)." />
      <Tabs tabs={reviewTabs(capsOf(user))} active="cycles" />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-5 lg:grid-cols-3">
        <div className="flex flex-col gap-3 lg:col-span-2">
          {cycles.length === 0 && <Card><EmptyState title="Chưa có kỳ đánh giá" hint="Tạo kỳ mới tại mục bên phải." /></Card>}
          {cycles.map((c) => {
            const doneN = c.reviews.filter((r) => r.status === "COMPLETED").length;
            return (
              <Link key={c.id} href={`/reviews/cycles/${c.id}`} className="card block px-5 py-4 text-foreground no-underline transition-colors hover:bg-muted/60 hover:no-underline max-md:px-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 font-medium text-foreground">{c.name}</div>
                  <Badge tone={c.status === "OPEN" ? "green" : "gray"}>{c.status === "OPEN" ? "Đang mở" : "Đã đóng"}</Badge>
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {c.purpose} · {fmtDate(c.periodStart)} – {fmtDate(c.periodEnd)} · hạn {fmtDate(c.dueDate)}
                </div>
                <div className="mt-3 flex items-center gap-3">
                  <ProgressBar value={c.reviews.length ? doneN / c.reviews.length : 0} tone="green" />
                  <span className="whitespace-nowrap text-xs tabular-nums text-muted-foreground">{doneN}/{c.reviews.length} hoàn tất</span>
                </div>
              </Link>
            );
          })}
        </div>
        <Card title="Mở kỳ đánh giá mới">
          <form action={createCycle} className="flex flex-col gap-3">
            <Field label="Tên kỳ"><input name="name" required defaultValue={`Đánh giá cuối năm ${year}`} className="input" /></Field>
            <Field label="Mục đích đánh giá"><input name="purpose" defaultValue="Đánh giá thành tích cuối năm" className="input" /></Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Thời kỳ từ"><DateInput name="periodStart" required defaultValue={`${year}-01-01`} /></Field>
              <Field label="đến"><DateInput name="periodEnd" required defaultValue={`${year}-12-31`} /></Field>
            </div>
            <Field label="Hạn hoàn thành"><DateInput name="dueDate" /></Field>
            <label className="flex items-start gap-2 text-sm">
              <input type="checkbox" name="includeAll" className="mt-1" />
              <span>Gồm cả thực tập sinh, CTV và người vào làm dưới 1 tháng <span className="block text-xs text-muted-foreground">Mặc định theo quy định: chỉ nhân viên đã ký HĐLĐ từ 1 tháng trở lên.</span></span>
            </label>
            <button className="btn btn-primary">Tạo kỳ & sinh phiếu</button>
          </form>
        </Card>
      </div>
    </div>
  );
}
