"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/server/db";
import { bool, done, num, opt, str } from "@/lib/form";
import { requireHRM } from "@/lib/server/access";

const back = (tab: string) => `/settings?tab=${tab}`;

// ───────── Phòng ban ─────────
export async function saveDepartment(id: string | null, fd: FormData) {
  await requireHRM();
  const data = { code: str(fd, "code").toUpperCase(), name: str(fd, "name"), parentId: opt(fd, "parentId"), headId: opt(fd, "headId") };
  if (!data.code || !data.name) done(back("departments"), { err: "Nhập mã và tên phòng ban" });
  if (id && data.parentId === id) done(back("departments"), { err: "Phòng ban không thể trực thuộc chính nó" });
  const dup = await db.department.findFirst({ where: { code: data.code, ...(id ? { id: { not: id } } : {}) } });
  if (dup) done(back("departments"), { err: `Mã ${data.code} đã tồn tại` });
  if (id) await db.department.update({ where: { id }, data });
  else await db.department.create({ data });
  revalidatePath("/settings");
  done(back("departments"), { ok: "Đã lưu phòng ban" });
}

// ───────── Danh mục giấy tờ ─────────
