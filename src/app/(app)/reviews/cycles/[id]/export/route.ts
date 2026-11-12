import { getCurrentUser } from "@/lib/server/auth";
import { isHRM } from "@/lib/server/access";
import { contractRecLabel, reviewStatusLabel } from "@/lib/labels";
import { cycleSummary } from "@/lib/server/review-summary";

// Xuất bảng tổng hợp đánh giá ra CSV (mở được bằng Excel, giữ dấu tiếng Việt nhờ BOM)
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !isHRM(user)) return new Response("Không có quyền", { status: 403 });
  const { id } = await params;
  const data = await cycleSummary(id, new URL(req.url).searchParams.get("dept"));
  if (!data) return new Response("Không tìm thấy", { status: 404 });
  const w = data.cycle.kpiWeight;
  const pctOf = (v: number | null | undefined) => (v === null || v === undefined ? "" : Math.round(v * 1000) / 10);
  const header = ["STT", "MSNV", "Họ tên", "Bộ phận", "Chức vụ", "Nhóm đánh giá", "Người đánh giá", "Quý 1 (%)", "Quý 2 (%)", "Quý 3 (%)", "Quý 4 (%)", `KPI năm ${data.year} (%)`, "Số quý đã xác nhận", "Điểm năng lực", "Điểm tối đa", "Điểm cộng Phần B", "Năng lực (%)", "Hạng năng lực", `Tổng hợp (%) [KPI ${w}% + Năng lực ${100 - w}%]`, "Xếp hạng tổng hợp", "Đề nghị hợp đồng", "Trạng thái", "Đề xuất lương / thưởng / khen thưởng"];
  const rows = data.rows.map(({ employee: e, review: r, group, year: y, final, noReview }, i) => [
    i + 1,
    e.code,
    e.fullName,
    e.department?.name ?? "",
    e.position ?? "",
    group === "SUPERVISOR" ? "Quản lý" : "Nhân viên",
    r?.reviewer?.fullName ?? "",
    // Quý chưa duyệt để trống (chưa tính vào KPI năm)
    ...y.quarters.map((q) => (q?.approved ? pctOf(q.score) : "")),
    pctOf(y.avg),
    y.approvedCount,
    r?.totalScore ?? "",
    r?.maxScore ?? "",
    r?.bonus ?? "",
    // Giống bảng trên web: phiếu chưa chấm xong thì chưa có tỷ lệ năng lực
    r?.grade && r.rate !== null ? r.rate : "",
    r?.grade ?? "",
    final?.score ?? "",
    final?.grade ?? "",
    r?.contractRecommendation ? contractRecLabel[r.contractRecommendation] : "",
    r ? reviewStatusLabel[r.status] : (noReview ?? ""),
    r?.remarks ?? "",
  ]);
  // Chặn "CSV injection": ô chữ bắt đầu bằng = + - @ sẽ bị Excel hiểu là công thức → thêm dấu ' phía trước
  const esc = (v: unknown) => {
    let s = String(v);
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return `"${s.replace(/"/g, '""')}"`;
  };
  const csv = String.fromCharCode(0xfeff) + [header, ...rows].map((row) => row.map(esc).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(`${data.cycle.name}.csv`)}`,
    },
  });
}
