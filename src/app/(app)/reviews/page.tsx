import Link from "next/link";
import { reviewTabs } from "@/lib/nav";
import { db } from "@/lib/server/db";
import { fmtDate } from "@/lib/dates";
import { reviewStatusLabel, reviewStatusTone } from "@/lib/labels";
import { GRADE_INFO } from "@/lib/review-templates";
import { Badge, Card, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { capsOf, requireEmployeeUser } from "@/lib/server/access";
import { GradeText } from "@/app/(app)/kpi/_components/mobile-card";

export default async function ReviewsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireEmployeeUser();
  const sp = await searchParams;
  const me = user.employeeId ?? "__none__";
  const [mine, toReview] = await Promise.all([
    db.review.findMany({ where: { employeeId: me }, include: { cycle: true }, orderBy: { createdAt: "desc" } }),
    db.review.findMany({
      where: { OR: [{ reviewerId: me }, { hodId: me }], employeeId: { not: me } },
      include: { cycle: true, employee: { include: { department: true } } },
      orderBy: [{ cycle: { createdAt: "desc" } }, { employee: { fullName: "asc" } }],
    }),
  ]);
  const waiting = (r: (typeof toReview)[number]) => (r.status === "MANAGER_REVIEW" && r.reviewerId === me) || (r.status === "HOD_APPROVAL" && r.hodId === me);

  // Danh sách xếp chồng (vạch mảnh giữa các dòng): mỗi dòng tên + dòng phụ bên trái, xếp loại / trạng thái bên phải.
  // Dùng được ở mọi khổ màn nên không cần bản thẻ riêng cho điện thoại.
  return (
    <div>
      <PageHeader
        title="Đánh giá thành tích"
        description="Quy trình phiếu BM1-003: nhân viên tự đánh giá, người đánh giá chấm điểm, nhân viên xác nhận, trưởng bộ phận phê duyệt."
      />
      <Tabs tabs={reviewTabs(capsOf(user))} active="mine" />
      <Flash ok={sp.ok} err={sp.err} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Card title="Phiếu cá nhân" pad={false}>
          {mine.length === 0 ? (
            <EmptyState title="Chưa có phiếu đánh giá" hint="Phiếu được tạo khi HRM mở kỳ đánh giá." />
          ) : (
            <ul className="divide-y divide-border pb-2">
              {mine.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3 max-md:px-3">
                  <div className="min-w-0">
                    <Link href={`/reviews/${r.id}`} className="font-medium">{r.cycle.name}</Link>
                    <div className="text-xs text-muted-foreground">Hạn {fmtDate(r.cycle.dueDate)}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right max-sm:basis-full max-sm:flex-row max-sm:items-center max-sm:justify-between">
                    <Badge tone={reviewStatusTone[r.status]}>{reviewStatusLabel[r.status]}</Badge>
                    {r.status === "COMPLETED" && r.grade && (
                      <span className="text-xs tabular-nums">
                        <GradeText tone={GRADE_INFO[r.grade].tone}>Hạng {r.grade}</GradeText> <span className="text-muted-foreground">· {r.rate}%</span>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card title="Tôi đánh giá / duyệt" pad={false}>
          {toReview.length === 0 ? (
            <EmptyState title="Không có phiếu chờ đánh giá" />
          ) : (
            <ul className="divide-y divide-border pb-2">
              {toReview.map((r) => (
                <li key={r.id} className="flex flex-wrap items-start justify-between gap-x-4 gap-y-1 px-5 py-3 max-md:px-3">
                  <div className="min-w-0">
                    <Link href={`/reviews/${r.id}`} className="font-medium">{r.employee.fullName}</Link>
                    <div className="text-xs text-muted-foreground">{r.cycle.name} · {r.employee.department?.name}</div>
                  </div>
                  <div className="flex flex-col items-end gap-0.5 text-right max-sm:basis-full max-sm:flex-row max-sm:items-center max-sm:justify-between">
                    {waiting(r) ? (
                      <span className="badge text-status-warning-text">
                        <span className="size-2 rounded-full bg-status-warning" aria-hidden />
                        Chờ xử lý
                      </span>
                    ) : (
                      <Badge tone={reviewStatusTone[r.status]}>{reviewStatusLabel[r.status]}</Badge>
                    )}
                    {r.grade && (
                      <span className="text-xs">
                        <GradeText tone={GRADE_INFO[r.grade].tone}>Hạng {r.grade}</GradeText>
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
