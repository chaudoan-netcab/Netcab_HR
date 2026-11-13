// Khối giao diện riêng cho trang Tổng quan, theo ngôn ngữ thiết kế NETCAB: khối phẳng (.card), tiêu đề khối 13px uppercase,
// KPI dạng StatTile, trạng thái là chữ nhỏ có màu, không vòng tròn icon, không bóng.
// Chỉ dùng ở src/app/(app)/page.tsx.
import Link from "next/link";
import type { ElementType, ReactNode } from "react";
import { BellRing, CircleCheckBig } from "lucide-react";
import { cookies } from "next/headers";
import { Avatar, StatTile } from "@/components/ui";
import { Dismissible } from "./dismissible";
import { HIDDEN_COOKIE, bannerKey } from "./dismiss-key";
import { toneClass, type Tone } from "@/lib/labels";

/** Khung khối chung: nền trắng trên nền trang, không viền/bóng ở chế độ sáng, bo 4px */
export const DASH_CARD = "card";

const DATE_PARTS = new Intl.DateTimeFormat("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", weekday: "long", day: "numeric", month: "numeric", year: "numeric" });
/** Viết hoa chữ đầu mỗi từ: "thứ năm" → "Thứ Năm", "chủ nhật" → "Chủ Nhật" */
const title = (s: string) => s.replace(/(^|\s)(\p{L})/gu, (_, sp: string, c: string) => sp + c.toUpperCase());
/** "Thứ Năm, ngày 22 tháng 10 năm 2026" (giờ Việt Nam) */
function longDate(d: Date) {
  const p = Object.fromEntries(DATE_PARTS.formatToParts(d).map((x) => [x.type, x.value]));
  return `${title(p.weekday)}, ngày ${Number(p.day)} tháng ${Number(p.month)} năm ${p.year}`;
}

// ───────── Lời chào (đầu trang) ─────────

export function Greeting({ name, right }: { name: string; right?: ReactNode }) {
  const first = name.trim().split(/\s+/).at(-1) ?? name;
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-center gap-3">
        <Avatar name={name} size={40} />
        <div className="min-w-0">
          <h1 className="truncate text-[18px] font-medium leading-tight text-foreground">Xin chào, {first}</h1>
          <div className="mt-0.5 text-xs text-muted-foreground">{longDate(new Date())}</div>
        </div>
      </div>
      {right}
    </div>
  );
}

// ───────── Banner thông báo ─────────

/** Chữ nhấn trong banner (tên người, số việc…): đậm hơn, không tô màu */
export function Hl({ children }: { children: ReactNode }) {
  return <span className="font-medium text-foreground">{children}</span>;
}

/**
 * Banner thông báo, có nút ✕ để ẩn. `sig` = tóm tắt NỘI DUNG banner (số việc, tên người, kỳ…):
 * đã ẩn thì không hiện lại cho tới khi nội dung đổi (sig khác → mã khác).
 * Màu chỉ ở icon nhỏ đầu dòng: xanh = ổn, vàng = cần chú ý.
 */
export async function AlertBanner({ ok = false, title, sig, children, href, cta = "Xem chi tiết" }: { ok?: boolean; title: string; sig: string; children: ReactNode; href?: string; cta?: string }) {
  const hid = bannerKey(`${title}|${sig}`);
  const hidden = (await cookies()).get(HIDDEN_COOKIE)?.value.split(".") ?? [];
  if (hidden.includes(hid)) return null;
  const Icon = ok ? CircleCheckBig : BellRing;
  return (
    <Dismissible hid={hid} label={title}>
      <div role={ok ? "status" : "alert"} className="card flex flex-col gap-3 py-3.5 pl-5 pr-12 max-md:pl-3 sm:flex-row sm:items-center sm:gap-4">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <Icon className={`mt-0.5 size-4 shrink-0 ${ok ? "text-status-success-text" : "text-status-warning-text"}`} aria-hidden />
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-foreground">{title}</div>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{children}</p>
          </div>
        </div>
        {href && (
          <Link href={href} className="btn shrink-0 self-start max-sm:ml-7 sm:self-auto">
            {cta}
          </Link>
        )}
      </div>
    </Dismissible>
  );
}

// ───────── Ô chỉ số (KPI) ─────────

type StatTone = "blue" | "green" | "amber" | "red" | "gray";

/** KPI: nhãn 11px uppercase → số 22px → dòng phụ (chỉ dòng phụ có màu khi cần chú ý); bấm để xem trang chi tiết */
export function StatCard({ label, value, sub, tone = "blue", href }: { icon: ElementType; label: string; value: string; sub?: string; tone?: StatTone; href: string }) {
  return <StatTile label={label} value={value} hint={sub} tone={tone} href={href} />;
}

// ───────── Khối nội dung: tiêu đề 13px uppercase + mô tả + nút phụ ─────────

export function DashCard({
  title,
  subtitle,
  actions,
  children,
  className = "",
}: {
  icon?: ElementType;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`card flex min-w-0 flex-col ${className}`}>
      <header className="flex min-h-[40px] flex-wrap items-start justify-between gap-x-3 gap-y-2 px-5 pt-4 max-md:px-3">
        {/* basis-32: khi thiếu chỗ thì cụm nút xuống dòng, tiêu đề không bị bóp */}
        <div className="min-w-0 flex-1 basis-32">
          <h2 className="section-title truncate">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
        </div>
        {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
      </header>
      {/* Nội dung giãn theo chiều cao khối (người dùng kéo to/nhỏ); không bao giờ thấp hơn nội dung */}
      <div className="flex min-h-0 flex-1 flex-col p-5 max-md:p-3 [&>*]:flex-1">{children}</div>
    </section>
  );
}

/** Nút phụ nhỏ có chữ (vd "Xem chi tiết") */
export function PillLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn btn-sm">
      {children}
    </Link>
  );
}

/** Nút icon vuông (đi tới trang chi tiết) */
export function CircleLink({ href, icon: Icon, label }: { href: string; icon: ElementType; label: string }) {
  return (
    <Link
      href={href}
      title={label}
      aria-label={label}
      className="inline-flex size-8 items-center justify-center rounded-[4px] text-muted-foreground no-underline transition-colors hover:bg-muted hover:text-foreground hover:no-underline"
    >
      <Icon size={16} aria-hidden />
    </Link>
  );
}

// ───────── Danh sách nhiệm vụ đang chạy: mỗi dòng 1 việc — tên · người làm · hạn; bấm để mở ─────────

export type OngoingTask = {
  id: string;
  title: string;
  assignee: string;
  /** Nhãn hạn ngắn, không xuống dòng: "Trễ 7 ngày", "Hôm nay", "Hạn 14/11", "Không hạn" — cột rộng cố định cho thẳng hàng */
  due: { label: string; tone: Tone };
};

/** Hạn bình thường để chữ xám; chỉ sắp tới hạn (vàng) và trễ (đỏ) mới có màu */
const dueClass = (t: Tone) => (t === "red" || t === "amber" ? toneClass[t] : "text-muted-foreground");

export function OngoingTasks({ rows, emptyText }: { rows: OngoingTask[]; emptyText: string }) {
  if (rows.length === 0) return <p className="py-10 text-center text-[13px] text-muted-foreground">{emptyText}</p>;
  // [contain:size]: danh sách không tự kéo khối cao lên — khối cao bao nhiêu thì hiện bấy nhiêu dòng, còn lại cuộn
  return (
    <ul className="-mx-2 flex min-h-44 flex-col divide-y divide-border overflow-y-auto [contain:size]">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/tasks/${r.id}`} title={r.title} className="flex items-center gap-3 rounded-[4px] px-2 py-2.5 no-underline transition-colors hover:bg-muted/60 hover:no-underline">
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium text-foreground">{r.title}</span>
              <span className="block truncate text-xs text-muted-foreground">{r.assignee}</span>
            </span>
            <span className={`w-[5.25rem] shrink-0 whitespace-nowrap text-right text-xs font-medium tabular-nums ${dueClass(r.due.tone)}`}>{r.due.label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
