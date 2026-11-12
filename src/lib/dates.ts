// Ngày (không có giờ) được lưu ở 00:00 UTC. Mọi hàm ở đây dùng UTC để không bị lệch múi giờ.

const DAY = 86_400_000;

export function parseDate(value: FormDataEntryValue | string | null | undefined): Date | null {
  if (!value || typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Hôm nay theo giờ Việt Nam, trả về 00:00 UTC của ngày đó */
export function today(): Date {
  const vn = new Date(Date.now() + 7 * 3_600_000);
  return new Date(Date.UTC(vn.getUTCFullYear(), vn.getUTCMonth(), vn.getUTCDate()));
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * DAY);
}

export function addMonths(d: Date, n: number): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, d.getUTCDate()));
}

/** Số ngày từ a đến b (b - a) */
export function diffDays(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / DAY);
}

/** Số ngày làm việc (thứ 2 – thứ 6) từ a đến b, tính cả 2 đầu */
export function workingDays(a: Date, b: Date): number {
  let n = 0;
  for (let d = a; d <= b; d = addDays(d, 1)) {
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}

export function toInputDate(d: Date | null | undefined): string {
  return d ? d.toISOString().slice(0, 10) : "";
}

export function fmtDate(d: Date | null | undefined): string {
  if (!d) return "—";
  const dd = String(d.getUTCDate()).padStart(2, "0");
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}/${d.getUTCFullYear()}`;
}

export function fmtDateTime(d: Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Thâm niên dạng "2 năm 3 tháng" */
export function tenure(from: Date | null | undefined, to: Date = today()): string {
  if (!from) return "—";
  let months = (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + (to.getUTCMonth() - from.getUTCMonth());
  if (to.getUTCDate() < from.getUTCDate()) months--;
  if (months < 0) return "Chưa vào làm";
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return m === 0 ? "Dưới 1 tháng" : `${m} tháng`;
  return m === 0 ? `${y} năm` : `${y} năm ${m} tháng`;
}
