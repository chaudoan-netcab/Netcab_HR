import { notFound, redirect } from "next/navigation";
import { Info } from "lucide-react";
import { isHRM, requireTracker } from "@/lib/server/access";
import { currentQuarter, loadDeptTracking } from "@/lib/server/tracking";
import { fmtPct } from "@/lib/tracking";
import { summaryStatusLabel } from "@/lib/labels";
import { PageHeader } from "@/components/ui";
import { TrackingBoard } from "../../_components/tracking-board";

/**
 * Chi tiết 1 phòng (HRM, chế độ "Toàn công ty") — CHỈ ĐỌC.
 * Danh sách nhân viên của phòng với các cột như bảng nhân viên, không có ô chọn và nút nhắc:
 * ở chế độ Toàn công ty, HRM nhắc nhân viên qua Trưởng phòng.
 */
export default async function UnitTrackingPage({ params, searchParams }: { params: Promise<{ unitId: string }>; searchParams: Promise<{ yq?: string }> }) {
  const user = await requireTracker();
  if (!isHRM(user)) redirect("/follow-ups");
  const { unitId } = await params;
  const sp = await searchParams;
  const cur = currentQuarter();
  const [yy, qq] = (sp.yq ?? "").split("-");
  const year = Number(yy) || cur.year;
  const quarter = Math.min(4, Math.max(1, Number(qq) || cur.quarter));

  const { rows, people, unitOfPerson } = await loadDeptTracking(user, year, quarter);
  const dept = rows.find((r) => r.id === unitId);
  if (!dept) notFound();
  const members = people.filter((p) => unitOfPerson(p) === unitId);
  const yq = `${year}-${quarter}`;

  return (
    <div>
      <PageHeader
        back={{ href: `/follow-ups?yq=${yq}`, label: "Theo dõi & nhắc việc" }}
        title={dept.name}
        description={[
          `Trưởng phòng: ${dept.headName ?? "chưa có"}`,
          dept.deptNames.length > 1 ? `gồm ${dept.deptNames.join(", ")}` : null,
          `Quý ${quarter}/${year}`,
          `KPI tạm tính phòng ${dept.kpi.score === null ? "—" : fmtPct(dept.kpi.score)}`,
          `Bản cuối: ${summaryStatusLabel[dept.summary].toLowerCase()}`,
        ]
          .filter(Boolean)
          .join(" · ")}
      />
      <p className="card mb-4 flex items-center gap-2 px-4 py-2.5 text-[13px] text-muted-foreground">
        <Info size={15} className="shrink-0" aria-hidden /> Nhắc nhân viên qua Trưởng phòng.
      </p>
      <TrackingBoard
        rows={members}
        admin={dept.deptNames.length > 1}
        readOnly
        quarterLabel={`Quý ${quarter}/${year}`}
        sender=""
        query={`?yq=${yq}&unit=${unitId}`}
        emptyKind={members.length ? null : "none"}
        clearHref={`/follow-ups/units/${unitId}?yq=${yq}`}
      />
    </div>
  );
}
