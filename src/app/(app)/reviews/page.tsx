import Link from "next/link";
import { reviewTabs } from "@/lib/nav";
import { db } from "@/lib/server/db";
import { fmtDate } from "@/lib/dates";
import { reviewStatusLabel, reviewStatusTone } from "@/lib/labels";
import { GRADE_INFO } from "@/lib/review-templates";
import { Badge, Card, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { capsOf, requireEmployeeUser } from "@/lib/server/access";

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
            <table className="table">
              <tbody>
                {mine.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <Link href={`/reviews/${r.id}`} className="font-medium">{r.cycle.name}</Link>
                      <div className="text-xs text-slate-500">Hạn {fmtDate(r.cycle.dueDate)}</div>
                    </td>
                    <td>{r.status === "COMPLETED" && r.grade && <Badge tone={GRADE_INFO[r.grade].tone}>Hạng {r.grade} · {r.rate}%</Badge>}</td>
                    <td className="text-right">
                      <Badge tone={reviewStatusTone[r.status]}>{reviewStatusLabel[r.status]}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
        <Card title="Tôi đánh giá / duyệt" pad={false}>
          {toReview.length === 0 ? (
            <EmptyState title="Không có phiếu chờ đánh giá" />
          ) : (
            <table className="table">
              <tbody>
                {toReview.map((r) => (
                  <tr key={r.id} className={waiting(r) ? "bg-amber-50/40" : ""}>
                    <td>
                      <Link href={`/reviews/${r.id}`} className="font-medium">{r.employee.fullName}</Link>
                      <div className="text-xs text-slate-500">{r.cycle.name} · {r.employee.department?.name}</div>
                    </td>
                    <td>{r.grade && <Badge tone={GRADE_INFO[r.grade].tone}>Hạng {r.grade}</Badge>}</td>
                    <td className="text-right">
                      {waiting(r) ? <Badge tone="amber">Chờ xử lý</Badge> : <Badge tone={reviewStatusTone[r.status]}>{reviewStatusLabel[r.status]}</Badge>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Card>
      </div>
    </div>
  );
}
