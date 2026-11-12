// Hàm nhỏ đọc dữ liệu từ <form> và quay lại trang kèm thông báo
import { redirect } from "next/navigation";

export function str(fd: FormData, key: string): string {
  return String(fd.get(key) ?? "").trim();
}

/** Chuỗi rỗng → null (để lưu vào cột không bắt buộc) */
export function opt(fd: FormData, key: string): string | null {
  const v = str(fd, key);
  return v === "" ? null : v;
}

export function num(fd: FormData, key: string): number | null {
  const v = str(fd, key).replace(",", ".");
  if (v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export function bool(fd: FormData, key: string): boolean {
  const v = fd.get(key);
  return v === "on" || v === "true" || v === "1";
}

/** Chuyển trang kèm thông báo xanh (ok) hoặc đỏ (err) */
export function done(path: string, msg: { ok?: string; err?: string }): never {
  const u = new URL(path, "http://x");
  if (msg.ok) u.searchParams.set("ok", msg.ok);
  if (msg.err) u.searchParams.set("err", msg.err);
  redirect(u.pathname + u.search);
}
