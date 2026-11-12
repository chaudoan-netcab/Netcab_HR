"use server";

import { revalidatePath } from "next/cache";
import type { KpiFormula, KpiPeriodType, KpiStatus } from "@prisma/client";
import { db } from "@/lib/server/db";
import { canManageEmployee, isHRM, requireEmployeeUser, requireManager } from "@/lib/server/access";
import { canEditKpiSet, kpiSetOf, loadUnits, planLock, unitsHeadedBy } from "@/lib/server/department-flow";
import { demo, nowIso } from "@/lib/server/demo-store";
import { parseDate } from "@/lib/dates";
import { done, num, opt, str } from "@/lib/form";
import { fromInput, kpiGrade, periodLabel, planScore, totalWeight } from "@/lib/kpi";

// ───────── Phiếu KPI ─────────

/**
 * Trưởng phòng giao KPI: 1 người, nhiều người hoặc cả phòng (cùng bộ chỉ số), hoặc chỉnh chỉ số riêng cho từng người.
 * Không qua HRM duyệt — phiếu đến thẳng nhân viên để cập nhật tiến độ.
 */
export async function createPlan(fd: FormData) {
  const user = await requireManager();
  const employeeIds = [...new Set(fd.getAll("employeeId").map(String).filter(Boolean))];
  const templateId = str(fd, "templateId");
  const periodType = str(fd, "periodType") as KpiPeriodType;
  const year = num(fd, "year") ?? new Date().getFullYear();
  const period = num(fd, "period") ?? 1;
  const back = "/kpi/plans";
  if (!employeeIds.length || !templateId) done(back, { err: "Chọn nhân viên và bộ KPI" });
  for (const id of employeeIds) if (!(await canManageEmployee(user, id))) done(back, { err: "Có nhân viên không thuộc phạm vi quản lý" });
  if (periodType !== "MONTH" && periodType !== "QUARTER") done(back, { err: "Chọn loại kỳ (tháng / quý)" });
  if (!Number.isInteger(period) || period < 1 || period > (periodType === "MONTH" ? 12 : 4)) done(back, { err: "Kỳ không hợp lệ" });
  const tpl = await db.kpiTemplate.findUnique({ where: { id: templateId }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!tpl || tpl.items.length === 0) done(back, { err: "Bộ KPI chưa có chỉ số nào" });
  // Chỉ số riêng: bỏ bớt / thêm chỉ số, sửa chỉ tiêu, tỉ trọng ngay khi giao
  const custom = fd.has("items") ? parsePlanItems(fd) : null;
  if (custom && "err" in custom) done(back, { err: custom.err });
  const chosen = custom && "items" in custom ? custom.items : tpl!.items;
  const existing = await db.kpiPlan.findMany({ where: { employeeId: { in: employeeIds }, periodType, year, period }, include: { employee: { select: { fullName: true } } } });
  const skip = new Set(existing.map((p) => p.employeeId));
  const todo = employeeIds.filter((id) => !skip.has(id));
  if (!todo.length) done(employeeIds.length === 1 ? `/kpi/${existing[0].id}` : back, { err: "Nhân viên đã có phiếu KPI cho kỳ này" });
  const created = await db.$transaction(
    todo.map((employeeId) =>
      db.kpiPlan.create({
        data: {
          employeeId,
          templateId,
          title: tpl!.name,
          subtitle: tpl!.subtitle,
          periodType,
          year,
          period,
          createdById: user.id,
          // Sao chép chỉ số → sau này sửa bộ KPI không làm thay đổi phiếu đã giao
          items: { create: chosen.map(({ section, name, measurement, unit, target, weight, formula, note }, i) => ({ section, name, measurement, unit, target, weight, formula, note, sortOrder: i })) },
        },
      }),
    ),
  );
  revalidatePath("/kpi/plans");
  const skipped = existing.length ? ` Bỏ qua ${existing.length} người đã có phiếu kỳ này (${existing.map((p) => p.employee.fullName).join(", ")}).` : "";
  if (created.length === 1 && employeeIds.length === 1) done(`/kpi/${created[0].id}`, { ok: "Đã giao KPI. Nhân viên cập nhật tiến độ trên phiếu này." });
  done(back, { ok: `Đã giao KPI cho ${created.length} người.${skipped}` });
}

const FORMULAS: KpiFormula[] = ["HIGHER_BETTER", "LOWER_BETTER", "ZERO_TOLERANCE", "VIOLATION_STEPS"];
type PlanItemInput = { id?: string; section: string; name: string; measurement: string | null; unit: string; target: number; weight: number; formula: KpiFormula; note: string | null };

/** Đọc danh sách chỉ số (JSON trong ô ẩn "items") do quản lý chọn / sửa */
function parsePlanItems(fd: FormData): { items: PlanItemInput[] } | { err: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(str(fd, "items") || "[]");
  } catch {
    return { err: "Danh sách chỉ số không hợp lệ" };
  }
  if (!Array.isArray(raw) || raw.length === 0) return { err: "Phiếu phải có ít nhất 1 chỉ số" };
  const items: PlanItemInput[] = [];
  for (const r of raw as Record<string, unknown>[]) {
    const name = String(r.name ?? "").trim();
    const unit = String(r.unit ?? "").trim();
    const target = Number(r.target);
    const weight = Number(r.weight);
    const formula = String(r.formula) as KpiFormula;
    if (!name) return { err: "Có chỉ số chưa nhập tên" };
    if (!unit) return { err: `Chỉ số “${name}” chưa có đơn vị` };
    if (!Number.isFinite(target) || target < 0) return { err: `Chỉ tiêu của “${name}” không hợp lệ` };
    if (!Number.isFinite(weight) || weight <= 0 || weight > 1) return { err: `Tỉ trọng của “${name}” phải lớn hơn 0%` };
    if (!FORMULAS.includes(formula)) return { err: `Cách tính của “${name}” không hợp lệ` };
    items.push({
      id: typeof r.id === "string" && r.id ? r.id : undefined,
      section: String(r.section ?? "").trim() || "CHỈ SỐ RIÊNG",
      name,
      measurement: String(r.measurement ?? "").trim() || null,
      unit,
      target,
      weight,
      formula,
      note: String(r.note ?? "").trim() || null,
    });
  }
  if (Math.abs(totalWeight(items) - 1) > 0.0001) return { err: `Tổng tỉ trọng phải bằng 100% (đang là ${Math.round(totalWeight(items) * 1000) / 10}%)` };
  return { items };
}

/** Quản lý sửa chỉ số của phiếu đang ở bước nhân viên cập nhật (giữ số liệu đã nhập của chỉ số được giữ lại) */
export async function updatePlanItems(planId: string, fd: FormData) {
  const user = await requireEmployeeUser();
  const back = `/kpi/${planId}`;
  const plan = await db.kpiPlan.findUnique({ where: { id: planId }, include: { items: true } });
  if (!plan) done("/kpi/plans", { err: "Không tìm thấy phiếu KPI" });
  if (user.employeeId === plan!.employeeId || !(await canManageEmployee(user, plan!.employeeId))) done(back, { err: "Chỉ quản lý trực tiếp được sửa chỉ số" });
  if (plan!.status !== "DRAFT" || (await planLock(plan!)).locked) done(back, { err: "Chỉ sửa được chỉ số khi phiếu đang ở bước nhân viên cập nhật" });
  const parsed = parsePlanItems(fd);
  if ("err" in parsed) done(back, { err: parsed.err });
  const items = (parsed as { items: PlanItemInput[] }).items;
  const old = new Map(plan!.items.map((i) => [i.id, i]));
  const keep = new Set(items.filter((i) => i.id && old.has(i.id)).map((i) => i.id!));
  const merged = items.map((i) => ({ ...i, actual: i.id && old.has(i.id) ? old.get(i.id)!.actual : null }));
  const score = planScore(merged);
  await db.$transaction([
    db.kpiPlanItem.deleteMany({ where: { planId, id: { notIn: [...keep] } } }),
    ...merged.map(({ id, actual, ...data }, i) =>
      id && keep.has(id)
        ? db.kpiPlanItem.update({ where: { id }, data: { ...data, sortOrder: i } })
        : db.kpiPlanItem.create({ data: { ...data, actual, sortOrder: i, planId } }),
    ),
    db.kpiPlan.update({ where: { id: planId }, data: { score, grade: kpiGrade(score)?.label ?? null } }),
  ]);
  revalidatePath(back);
  done(back, { ok: `Đã cập nhật chỉ số của phiếu (${items.length} chỉ số)` });
}

/** Quản lý nhắc nhân viên cập nhật tiến độ KPI — hiện ở "Việc cần làm" của nhân viên (lưu trong bộ nhớ server) */
export async function remindPlan(planId: string) {
  const user = await requireEmployeeUser();
  const back = `/kpi/${planId}`;
  const plan = await db.kpiPlan.findUnique({ where: { id: planId }, include: { employee: { select: { fullName: true } } } });
  if (!plan) done("/kpi/plans", { err: "Không tìm thấy phiếu KPI" });
  if (user.employeeId === plan!.employeeId || !(await canManageEmployee(user, plan!.employeeId))) done(back, { err: "Chỉ quản lý trực tiếp được nhắc" });
  if (plan!.status !== "DRAFT") done(back, { err: "Phiếu không còn ở bước nhân viên cập nhật" });
  demo.kpiReminders.set(planId, { at: nowIso(), by: user.employee?.fullName ?? user.email });
  revalidatePath(back);
  done(back, { ok: `Đã nhắc ${plan!.employee.fullName} cập nhật tiến độ KPI` });
}

type Intent = "save" | "submit" | "approve" | "return" | "reopen";

export async function savePlan(planId: string, fd: FormData) {
  const user = await requireEmployeeUser();
  const intent = str(fd, "intent") as Intent;
  const back = `/kpi/${planId}`;
  const plan = await db.kpiPlan.findUnique({ where: { id: planId }, include: { items: true } });
  if (!plan) done("/kpi", { err: "Không tìm thấy phiếu KPI" });

  const self = user.employeeId === plan!.employeeId;
  const manager = !self && (await canManageEmployee(user, plan!.employeeId));
  const s = plan!.status;
  // "Đã khóa" chỉ suy ra (bảng tổng hợp của phòng đã được xác nhận, hoặc phiếu COMPLETED cũ) — không lưu cột status
  const lock = await planLock(plan!);

  // HRM mở lại phiếu đã khóa của BẤT KỲ AI (ngoại lệ, kể cả ngoài managerScope)
  if (intent === "reopen") {
    if (!lock.locked || !isHRM(user)) done(back, { err: "Chỉ HRM được mở lại phiếu đã khóa" });
    const reason = opt(fd, "reopenReason");
    if (!reason) done(back, { err: "Nhập lý do mở lại phiếu" });
    if (lock.bySummary && lock.summary) {
      // Ghi trong bộ nhớ server, không ghi database. Bảng tổng hợp chuyển sang "Cần xác nhận lại":
      // trưởng phòng duyệt lại phiếu rồi gửi lại, người xác nhận xác nhận lại thì toàn bộ phiếu của bảng khóa lại.
      demo.reopenedPlans.add(planId);
      const emp = await db.employee.findUnique({ where: { id: plan!.employeeId }, select: { fullName: true } });
      lock.summary.status = "REOPENED";
      lock.summary.log.push({ at: nowIso(), by: user.employee?.fullName ?? user.email, action: `Mở lại phiếu: ${emp?.fullName ?? ""} – ${periodLabel(plan!.periodType, plan!.period, plan!.year)}`, note: reason });
      revalidatePath("/kpi/summary");
    }
    // Phiếu COMPLETED cũ (trước khi bỏ bước HRM xác nhận từng phiếu): đưa về "Quản lý đã duyệt" như trước đây
    if (lock.legacy) await db.kpiPlan.update({ where: { id: planId }, data: { status: "MANAGER_APPROVED", hrSignedAt: null } });
    revalidatePath(back);
    done(back, { ok: lock.bySummary ? "Đã mở lại phiếu. Bản cuối của phòng chuyển sang “Cần gửi lại”: quản lý xác nhận lại phiếu rồi gửi lại bản cuối cho HR." : "Đã mở lại phiếu. Quản lý có thể trả lại phiếu để nhân viên sửa." });
  }
  if (lock.locked) done(back, { err: "Phiếu đã khóa vì phòng đã gửi bản cuối cho HR. Liên hệ HRM nếu cần mở lại." });

  const canEdit = (self && s === "DRAFT") || (manager && (s === "DRAFT" || s === "SUBMITTED"));
  if (!canEdit && (intent === "save" || intent === "submit" || intent === "approve")) done(back, { err: "Không thể chỉnh sửa phiếu ở bước hiện tại" });

  // Chuyển bước: nhân viên gửi báo cáo cuối kỳ → quản lý trực tiếp xác nhận. Phiếu khóa khi trưởng phòng gửi bản cuối cho HR.
  const now = new Date();
  let next: KpiStatus = s;
  const stamp: Record<string, Date | null> = {};
  // Người không có quản lý trực tiếp (HRM — cấp cao nhất) gửi phiếu của mình → tự động duyệt
  const topLevel = self && !(await db.employee.findUnique({ where: { id: plan!.employeeId }, select: { managerId: true } }))?.managerId;
  if (intent === "submit") {
    if (!(s === "DRAFT" && (self || manager))) done(back, { err: "Không thể gửi báo cáo ở bước hiện tại" });
    next = topLevel ? "MANAGER_APPROVED" : "SUBMITTED";
    stamp.employeeSignedAt = now;
    if (topLevel) stamp.managerSignedAt = now;
  } else if (intent === "approve") {
    if (!(s === "SUBMITTED" && manager)) done(back, { err: "Chỉ quản lý trực tiếp được xác nhận kết quả" });
    next = "MANAGER_APPROVED";
    stamp.managerSignedAt = now;
  } else if (intent === "return") {
    // Quản lý trả lại phiếu đang chờ duyệt, hoặc phiếu đã duyệt nhưng chưa khóa (vd sau khi HRM mở lại)
    if (!(manager && (s === "SUBMITTED" || s === "MANAGER_APPROVED"))) done(back, { err: "Không thể trả lại phiếu ở bước hiện tại" });
    next = "DRAFT";
    Object.assign(stamp, { employeeSignedAt: null, managerSignedAt: null });
  } else if (intent !== "save") {
    done(back, { err: "Thao tác không hợp lệ" });
  }

  // Lưu "Mức độ thực hiện" và tính lại điểm
  const items = plan!.items.map((it) => {
    const key = `actual_${it.id}`;
    return canEdit && fd.has(key) ? { ...it, actual: fromInput(it.unit, fd.get(key)) } : it;
  });
  // Gửi duyệt: mọi chỉ số phải có số liệu (kiểu đếm vi phạm phải nhập 0 nếu không có vụ),
  // để điểm chính thức không tính ô trống là đạt. Thiếu → vẫn lưu số đã nhập, không chuyển bước.
  const missing = intent === "submit" ? items.filter((it) => it.actual === null).map((it) => it.name) : [];
  if (missing.length) {
    next = s;
    delete stamp.employeeSignedAt;
    delete stamp.managerSignedAt;
  }
  const score = planScore(items);
  await db.$transaction([
    ...(canEdit ? items.map((it) => db.kpiPlanItem.update({ where: { id: it.id }, data: { actual: it.actual } })) : []),
    db.kpiPlan.update({
      where: { id: planId },
      data: {
        status: next,
        score,
        grade: kpiGrade(score)?.label ?? null,
        managerComment: fd.has("managerComment") ? opt(fd, "managerComment") : undefined,
        evaluationDate: fd.has("evaluationDate") ? parseDate(fd.get("evaluationDate")) : undefined,
        ...stamp,
      },
    }),
  ]);
  // Ghi lại lần cập nhật tiến độ (bộ nhớ server). Nhân viên tự cập nhật → xóa lời nhắc của quản lý.
  if (canEdit && (intent === "save" || intent === "submit")) {
    demo.kpiProgress.set(planId, { at: nowIso(), by: user.employee?.fullName ?? user.email });
    if (self) demo.kpiReminders.delete(planId);
  }
  revalidatePath(back);
  if (missing.length) done(back, { err: `Chưa gửi được: còn ${missing.length} chỉ số chưa có số liệu (${missing.join("; ")}). Số liệu đã nhập đã được lưu.` });
  const msg: Record<Intent, string> = {
    save: "Đã lưu tiến độ",
    submit: topLevel ? "Đã chốt kết quả (không có quản lý trực tiếp)" : "Đã gửi báo cáo cuối kỳ cho quản lý",
    approve: "Đã xác nhận kết quả KPI",
    return: "Đã trả lại phiếu",
    reopen: "Đã mở lại phiếu",
  };
  done(back, { ok: msg[intent] });
}

export async function deletePlan(planId: string) {
  const user = await requireManager();
  const plan = await db.kpiPlan.findUnique({ where: { id: planId } });
  if (!plan) done("/kpi/plans", { err: "Không tìm thấy phiếu" });
  if (!(await canManageEmployee(user, plan!.employeeId)) || (await planLock(plan!)).locked) done(`/kpi/${planId}`, { err: "Không thể xóa phiếu này" });
  await db.kpiPlan.delete({ where: { id: planId } });
  revalidatePath("/kpi/plans");
  done("/kpi/plans", { ok: "Đã xóa phiếu KPI" });
}

// ───────── Bộ KPI của phòng (mẫu KPI) ─────────
// Trưởng phòng tự soạn bộ KPI cho phòng mình (dùng chung cả phòng, hoặc làm gốc rồi chỉnh riêng từng người khi giao).
// Không có bước duyệt: soạn xong là dùng được. Nội dung chỉ số lưu trong bảng KpiTemplate; phòng của bộ lưu trong bộ nhớ server.

async function requireSetEditor(templateId: string) {
  const user = await requireManager();
  const t = await db.kpiTemplate.findUnique({ where: { id: templateId } });
  if (!t) done("/kpi/sets", { err: "Không tìm thấy bộ KPI" });
  const { units, byId } = await loadUnits();
  const rec = kpiSetOf(t!, units);
  if (!canEditKpiSet(user, rec, byId.get(rec.unitId ?? ""))) done(`/kpi/sets/${templateId}`, { err: "Chỉ trưởng phòng được sửa bộ KPI của phòng mình" });
  return { user, rec };
}

export async function createTemplate(fd: FormData) {
  const user = await requireManager();
  const name = str(fd, "name");
  const unitId = str(fd, "unitId");
  if (!name) done("/kpi/sets", { err: "Nhập tên bộ KPI" });
  const { units } = await loadUnits();
  if (!unitsHeadedBy(units, user).some((u) => u.id === unitId)) done("/kpi/sets", { err: "Chỉ tạo được bộ KPI cho phòng mình làm trưởng" });
  const copyFrom = opt(fd, "copyFrom");
  const src = copyFrom ? await db.kpiTemplate.findUnique({ where: { id: copyFrom }, include: { items: true } }) : null;
  const t = await db.kpiTemplate.create({
    data: {
      name,
      subtitle: opt(fd, "subtitle"),
      items: src ? { create: src.items.map(({ section, name, measurement, unit, target, weight, formula, note, sortOrder }) => ({ section, name, measurement, unit, target, weight, formula, note, sortOrder })) } : undefined,
    },
  });
  demo.kpiSets.set(t.id, { templateId: t.id, unitId });
  done(`/kpi/sets/${t.id}`, { ok: "Đã tạo bộ KPI. Thêm chỉ số là dùng được để giao KPI." });
}

export async function updateTemplate(id: string, fd: FormData) {
  await requireSetEditor(id);
  await db.kpiTemplate.update({ where: { id }, data: { name: str(fd, "name"), subtitle: opt(fd, "subtitle"), active: fd.get("active") === "on" } });
  done(`/kpi/sets/${id}`, { ok: "Đã lưu" });
}

function itemData(fd: FormData) {
  const unit = str(fd, "unit") || "%";
  const formula = str(fd, "formula") as KpiFormula;
  return {
    section: str(fd, "section"),
    name: str(fd, "name"),
    measurement: opt(fd, "measurement"),
    unit,
    target: fromInput(unit, fd.get("target")) ?? 0,
    weight: (num(fd, "weight") ?? 0) / 100,
    formula,
    note: opt(fd, "note"),
    sortOrder: num(fd, "sortOrder") ?? 0,
  };
}

export async function saveTemplateItem(templateId: string, itemId: string | null, fd: FormData) {
  await requireSetEditor(templateId);
  const d = itemData(fd);
  const back = `/kpi/sets/${templateId}`;
  if (!d.section || !d.name) done(back, { err: "Nhập nhóm KRA và tên chỉ số" });
  if (itemId) await db.kpiTemplateItem.update({ where: { id: itemId }, data: d });
  else await db.kpiTemplateItem.create({ data: { ...d, templateId } });
  done(back, { ok: itemId ? "Đã lưu chỉ số" : "Đã thêm chỉ số" });
}

export async function deleteTemplateItem(templateId: string, itemId: string) {
  await requireSetEditor(templateId);
  await db.kpiTemplateItem.delete({ where: { id: itemId } });
  done(`/kpi/sets/${templateId}`, { ok: "Đã xóa chỉ số" });
}
