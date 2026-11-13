import Link from "next/link";
import type { ReactNode } from "react";
import { CircleAlert, CircleCheck } from "lucide-react";
import { toneClass, type Tone } from "@/lib/labels";

/** Trạng thái: chữ nhỏ có màu, không nền (NETCAB) */
export function Badge({ tone = "gray", children }: { tone?: Tone; children: ReactNode }) {
  return <span className={`badge ${toneClass[tone]}`}>{children}</span>;
}

export function PageHeader({
  title,
  description,
  actions,
  back,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  back?: { href: string; label: string };
}) {
  return (
    <div className="mb-5 flex flex-col gap-3 sm:mb-6 lg:flex-row lg:items-center lg:justify-between">
      <div className="min-w-0">
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-xs text-muted-foreground no-underline hover:text-foreground">
            ← {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

/** Khối: tiêu đề 13px uppercase, đệm px-5 pt-4 */
export function Card({
  title,
  actions,
  children,
  className = "",
  pad = true,
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex min-h-[40px] flex-wrap items-center justify-between gap-x-2 gap-y-1 px-5 pt-4 max-md:px-3">
          {title && <h2 className="section-title">{title}</h2>}
          {actions}
        </div>
      )}
      <div className={pad ? "card-pad" : title || actions ? "pt-2" : ""}>{children}</div>
    </section>
  );
}

/** Màn hình trống luôn kèm hướng dẫn bước tiếp theo */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-1.5 px-6 py-10 text-center">
      <div className="text-[13px] font-medium text-foreground">{title}</div>
      {hint && <div className="max-w-md text-[13px] text-muted-foreground">{hint}</div>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

/** Màu dòng phụ của KPI: chỉ tô khi báo trạng thái (xanh ổn, vàng rủi ro, đỏ trễ) */
const hintTone: Record<Tone, string> = {
  gray: "text-muted-foreground",
  blue: "text-muted-foreground",
  violet: "text-muted-foreground",
  green: "text-status-success-text",
  amber: "text-status-warning-text",
  red: "text-status-danger-text",
};

/** KPI: nhãn 11px uppercase xám → số 22px → dòng phụ */
export function StatTile({
  label,
  value,
  hint,
  tone = "gray",
  href,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  tone?: Tone;
  href?: string;
}) {
  const body = (
    <div className="card h-full px-5 py-4 max-md:px-3">
      <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{label}</div>
      <div className="mt-1.5 text-[22px] font-medium leading-tight tabular-nums text-foreground">{value}</div>
      {hint && <div className={`mt-1 text-xs ${hintTone[tone]}`}>{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-[4px] no-underline hover:no-underline hover:[&>div]:bg-muted/60">
      {body}
    </Link>
  ) : (
    body
  );
}

/** Báo kết quả sau khi gửi form: chữ màu trạng thái kèm icon, không nền màu */
export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  const Icon = err ? CircleAlert : CircleCheck;
  return (
    <div role={err ? "alert" : "status"} className={`card mb-4 flex items-start gap-2 px-4 py-2.5 text-[13px] ${err ? "text-status-danger-text" : "text-status-success-text"}`}>
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{err ?? ok}</span>
    </div>
  );
}

export function ProgressBar({ value, tone = "blue" }: { value: number; tone?: Tone }) {
  const color: Record<Tone, string> = {
    gray: "bg-status-neutral",
    blue: "bg-primary",
    green: "bg-status-success",
    amber: "bg-status-warning",
    red: "bg-status-danger",
    violet: "bg-chart-7",
  };
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-foreground/10">
      <div className={`h-full rounded-full ${color[tone]}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <div className="no-print mb-4 flex gap-1 overflow-x-auto border-b border-border">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`tab ${t.key === active ? "tab-active" : ""}`} aria-current={t.key === active ? "page" : undefined}>
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/);
  const initials = (parts.length > 1 ? parts[parts.length - 2][0] + parts[parts.length - 1][0] : parts[0][0]).toUpperCase();
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-medium text-primary-text"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {initials}
    </span>
  );
}

/** Ô nhập có nhãn */
export function Field({ label, children, hint, className = "" }: { label: string; children: ReactNode; hint?: string; className?: string }) {
  return (
    <label className={`block ${className}`}>
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

/** Đếm theo trạng thái, bấm để lọc */
export function StatusChips({ items, active }: { items: { key: string; label: string; count: number; href: string }[]; active?: string }) {
  return (
    <div className="no-print mb-3 flex flex-wrap gap-1.5">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          aria-current={active === i.key ? "true" : undefined}
          className={`inline-flex h-7 items-center rounded-[4px] px-2.5 text-xs font-medium no-underline hover:no-underline ${
            active === i.key ? "bg-primary/10 text-primary-text" : "bg-card text-muted-foreground hover:bg-muted hover:text-foreground dark:border dark:border-border"
          }`}
        >
          {i.label} <span className="ml-1.5 tabular-nums">{i.count}</span>
        </Link>
      ))}
    </div>
  );
}
