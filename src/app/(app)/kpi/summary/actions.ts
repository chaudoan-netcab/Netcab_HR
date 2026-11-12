"use server";
// Bản cuối KPI quý của phòng: trưởng phòng gửi cho HR. HR chỉ nhận, không duyệt / trả lại.
// Trạng thái lưu tạm trong bộ nhớ server (demo-store.ts), KHÔNG ghi database.
// Đã gửi → mọi phiếu KPI trong quý của phòng HIỂN THỊ "Đã khóa" (không cập nhật cột status).
import { revalidatePath } from "next/cache";
import { done } from "@/lib/form";
import { requireHRM, requireManager } from "@/lib/server/access";
import { getSummary, loadSummary, loadUnits, parseYq } from "@/lib/server/department-flow";
import { demo, nowIso, summaryKey } from "@/lib/server/demo-store";

const detail = (unitId: string, yq: string) => `/kpi/summary/${unitId}?yq=${yq}`;

export async function sendSummary(unitId: string, yq: string) {
  const user = await requireManager();
  const { year, quarter, value } = parseYq(yq);
  const back = detail(unitId, value);
  const unit = (await loadUnits()).byId.get(unitId);
  if (!unit || unit.headId !== user.employeeId) done(back, { err: "Chỉ trưởng phòng được gửi bản cuối của phòng mình" });
  const cur = getSummary(unitId, year, quarter);
  // Gửi lần đầu, hoặc gửi lại sau khi HRM mở lại phiếu ("Cần gửi lại")
  if (cur && cur.status !== "REOPENED") done(back, { err: "Bản cuối quý này đã được gửi" });
  const s = await loadSummary(unit!, year, quarter);
  if (s.blocking.length)
    done(back, { err: `Chưa gửi được: còn ${s.blocking.length} phiếu KPI chưa được xác nhận (${s.blocking.map((b) => `${b.name} – ${b.label}`).join("; ")}).` });

  const by = user.employee?.fullName ?? user.email;
  const key = summaryKey(unitId, year, quarter);
  demo.summaries.set(key, {
    unitId,
    year,
    quarter,
    status: "SENT",
    senderEmployeeId: user.employeeId!,
    senderName: by,
    sentAt: nowIso(),
    log: [...(cur?.log ?? []), { at: nowIso(), by, action: `${cur ? "Gửi lại" : "Gửi"} bản cuối cho HR · khóa phiếu KPI trong quý` }],
  });
  s.planIds.forEach((id) => demo.reopenedPlans.delete(id));
  demo.headReminders.delete(key);
  revalidatePath("/kpi/summary");
  done(back, { ok: "Đã gửi bản cuối cho HR. Các phiếu KPI trong quý của phòng đã khóa." });
}

/** HR nhắc trưởng phòng gửi bản cuối quý (hiện ở "Việc cần làm" của trưởng phòng) */
export async function remindHead(unitId: string, yq: string) {
  const user = await requireHRM();
  const { year, quarter, value, label } = parseYq(yq);
  const back = `/heads?yq=${value}`;
  const unit = (await loadUnits()).byId.get(unitId);
  if (!unit?.headId) done(back, { err: "Phòng chưa có trưởng phòng" });
  if (unit!.headId === user.employeeId) done(back, { err: "Đây là phòng của bạn" });
  if (getSummary(unitId, year, quarter)?.status === "SENT") done(back, { err: "Phòng đã gửi bản cuối" });
  demo.headReminders.set(summaryKey(unitId, year, quarter), { at: nowIso(), by: user.employee?.fullName ?? user.email });
  revalidatePath("/heads");
  done(back, { ok: `Đã nhắc ${unit!.headName} gửi bản cuối KPI ${label}` });
}
