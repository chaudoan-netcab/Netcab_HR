"use server";

import { revalidatePath } from "next/cache";
import type { ContractRecommendation, Prisma, ReviewStatus } from "@prisma/client";
import { db } from "@/lib/server/db";
import { isHRM, requireEmployeeUser, requireHRM } from "@/lib/server/access";
import { addMonths, parseDate } from "@/lib/dates";
import { done, num, opt, str } from "@/lib/form";
import { computeReview, criteriaOf, maxScoreOf } from "@/lib/review-templates";

// ───────── Kỳ đánh giá ─────────

export async function createCycle(fd: FormData) {
  await requireHRM();
  const back = "/reviews/cycles";
  const name = str(fd, "name");
  const periodStart = parseDate(fd.get("periodStart"));
  const periodEnd = parseDate(fd.get("periodEnd"));
  if (!name || !periodStart || !periodEnd) done(back, { err: "Nhập tên kỳ và thời kỳ đánh giá" });

  // "Đánh giá dành cho tất cả nhân viên đã ký HĐLĐ với công ty từ 1 tháng trở lên"
  const includeAll = fd.get("includeAll") === "on";
  const employees = await db.employee.findMany({
    where: {
      status: "ACTIVE",
      // Người không có quản lý trực tiếp (HRM — cấp cao nhất) không có ai đánh giá → không tạo phiếu
      managerId: { not: null },
      ...(includeAll ? {} : { employeeType: { in: ["OFFICIAL", "PROBATION"] }, joinDate: { lte: addMonths(periodEnd!, -1) } }),
    },
    include: { department: { include: { parent: true } } },
  });
  const cycle = await db.reviewCycle.create({
    data: { name, purpose: str(fd, "purpose") || "Đánh giá thành tích cuối năm", periodStart: periodStart!, periodEnd: periodEnd!, dueDate: parseDate(fd.get("dueDate")) },
  });
  await db.review.createMany({
    data: employees.map((e) => {
      // HOD = trưởng phòng ban; nếu chính họ là trưởng phòng thì lấy trưởng phòng cấp trên, rồi tới quản lý trực tiếp
      let hodId = e.department?.headId ?? null;
      if (hodId === e.id) hodId = e.department?.parent?.headId ?? e.managerId;
      return {
        cycleId: cycle.id,
        employeeId: e.id,
        template: e.jobLevel,
        maxScore: maxScoreOf(e.jobLevel),
        reviewerId: e.managerId,
        hodId,
      };
    }),
  });
  revalidatePath(back);
  done(`/reviews/cycles/${cycle.id}`, { ok: `Đã tạo kỳ đánh giá với ${employees.length} phiếu` });
}

export async function setCycleStatus(id: string, fd: FormData) {
  await requireHRM();
  await db.reviewCycle.update({ where: { id }, data: { status: str(fd, "status") === "CLOSED" ? "CLOSED" : "OPEN" } });
  done(`/reviews/cycles/${id}`, { ok: "Đã cập nhật trạng thái kỳ" });
}

export async function setCycleWeight(id: string, fd: FormData) {
  await requireHRM();
  const w = Math.max(0, Math.min(100, Math.round(num(fd, "kpiWeight") ?? 50)));
  await db.reviewCycle.update({ where: { id }, data: { kpiWeight: w } });
  done(`/reviews/cycles/${id}`, { ok: `Đã lưu: KPI ${w}% + Năng lực ${100 - w}%` });
}

export async function saveRemark(reviewId: string, fd: FormData) {
  await requireHRM();
  const r = await db.review.update({ where: { id: reviewId }, data: { remarks: opt(fd, "remarks") } });
  done(`/reviews/cycles/${r.cycleId}${str(fd, "qs")}`, { ok: "Đã lưu ghi chú" });
}

// ───────── Phiếu đánh giá ─────────

const ORDER: ReviewStatus[] = ["SELF_REVIEW", "MANAGER_REVIEW", "EMPLOYEE_ACK", "HOD_APPROVAL", "COMPLETED"];

export async function saveReview(reviewId: string, fd: FormData) {
  const user = await requireEmployeeUser();
  const intent = str(fd, "intent"); // save | next | back | reopen
  const back = `/reviews/${reviewId}`;
  const r = await db.review.findUnique({ where: { id: reviewId }, include: { scores: true, cycle: true } });
  if (!r) done("/reviews", { err: "Không tìm thấy phiếu" });
  const review = r!;
  if (review.cycle.status === "CLOSED") done(back, { err: "Kỳ đánh giá đã đóng" });

  const me = user.employeeId;
  const hr = isHRM(user);
  const notSelf = me !== review.employeeId; // Không tự chấm/duyệt phiếu của chính mình
  const actor: Record<ReviewStatus, boolean> = {
    SELF_REVIEW: me === review.employeeId || hr,
    MANAGER_REVIEW: (me === review.reviewerId || hr) && notSelf,
    EMPLOYEE_ACK: me === review.employeeId || hr,
    HOD_APPROVAL: (me === review.hodId || hr) && notSelf,
    COMPLETED: hr && notSelf,
  };
  if (!actor[review.status]) done(back, { err: "Phiếu không ở bước xử lý của tài khoản này" });

  const keys = criteriaOf(review.template).map((c) => c.key);
  const scoreOf = (prefix: string, k: string) => {
    const v = num(fd, `${prefix}_${k}`);
    return v === null ? null : Math.max(0, Math.min(10, Math.round(v)));
  };
  const tx: Prisma.PrismaPromise<unknown>[] = [];
  const data: Prisma.ReviewUncheckedUpdateInput = {};
  let err: string | null = null; // Lỗi khi gửi bước tiếp → vẫn lưu nháp, chỉ không chuyển bước

  if (review.status === "SELF_REVIEW") {
    for (const k of keys)
      tx.push(db.reviewScore.upsert({ where: { reviewId_criterionKey: { reviewId, criterionKey: k } }, create: { reviewId, criterionKey: k, selfScore: scoreOf("self", k) }, update: { selfScore: scoreOf("self", k) } }));
    data.contributions = opt(fd, "contributions");
    if (intent === "next") {
      if (keys.some((k) => scoreOf("self", k) === null)) err = "Vui lòng tự chấm đủ tất cả tiêu chí trước khi gửi";
      else data.selfSubmittedAt = new Date();
    }
  }

  if (review.status === "MANAGER_REVIEW") {
    const scores = keys.map((k) => scoreOf("mgr", k));
    for (const [i, k] of keys.entries())
      tx.push(db.reviewScore.upsert({ where: { reviewId_criterionKey: { reviewId, criterionKey: k } }, create: { reviewId, criterionKey: k, managerScore: scores[i] }, update: { managerScore: scores[i] } }));
    const bonus = [0, 1, 3, 5].includes(num(fd, "bonus") ?? 0) ? (num(fd, "bonus") ?? 0) : 0;
    const res = computeReview(review.template, scores, bonus);
    Object.assign(data, {
      bonus,
      contributions: opt(fd, "contributions"),
      shortcomings: opt(fd, "shortcomings"),
      contractRecommendation: (opt(fd, "contractRecommendation") as ContractRecommendation | null) ?? null,
      contractNote: opt(fd, "contractNote"),
      devPlan: fd.get("devPlan") === "yes" ? true : fd.get("devPlan") === "no" ? false : null,
      devPlanReason: opt(fd, "devPlanReason"),
      totalScore: res.total,
      rate: res.rate,
      grade: scores.every((s) => s !== null) ? res.grade : null,
    });
    if (intent === "next") {
      if (scores.some((s) => s === null)) err = "Vui lòng chấm đủ tất cả tiêu chí";
      else if (bonus > 0 && !opt(fd, "contributions")) err = "Phải ghi rõ đóng góp/cải tiến tại Phần B khi có điểm cộng";
      else if (!data.contractRecommendation) err = "Chọn đề nghị Giữ lại / Chấm dứt HĐ / Đề nghị khác";
      else data.managerSubmittedAt = new Date();
    }
  }

  if (review.status === "EMPLOYEE_ACK") {
    data.employeeComment = opt(fd, "employeeComment");
    if (intent === "next") data.employeeAckAt = new Date();
  }

  if (review.status === "HOD_APPROVAL") {
    data.hodComment = opt(fd, "hodComment");
    if (intent === "next") data.hodApprovedAt = new Date();
  }

  const idx = ORDER.indexOf(review.status);
  if (intent === "next" && !err && idx < ORDER.length - 1) data.status = ORDER[idx + 1];
  if (intent === "back") {
    if (review.status === "MANAGER_REVIEW") data.status = "SELF_REVIEW";
    else if (review.status === "HOD_APPROVAL") data.status = "MANAGER_REVIEW";
    else done(back, { err: "Không thể trả lại phiếu ở bước hiện tại" });
  }
  if (intent === "reopen") {
    if (!hr || review.status !== "COMPLETED") done(back, { err: "Chỉ HRM được phép mở lại phiếu" });
    data.status = "MANAGER_REVIEW";
    data.hodApprovedAt = null;
    data.employeeAckAt = null;
  }

  await db.$transaction([...tx, db.review.update({ where: { id: reviewId }, data })]);
  revalidatePath(back);
  if (err) done(back, { err: `${err}. Phiếu đã được lưu nháp.` });
  const msg: Record<string, string> = { save: "Đã lưu nháp", next: "Đã gửi sang bước tiếp theo", back: "Đã trả lại", reopen: "Đã mở lại phiếu" };
  done(intent === "next" && review.status !== "HOD_APPROVAL" && !hr ? "/reviews" : back, { ok: msg[intent] ?? "Đã lưu" });
}
