import Link from "next/link";
import type { ReactNode } from "react";
import { toneClass, type Tone } from "@/lib/labels";

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
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div>
        {back && (
          <Link href={back.href} className="mb-1 inline-block text-xs text-slate-500">
            ← {back.label}
          </Link>
        )}
        <h1>{title}</h1>
        {description && <p className="mt-1 text-sm text-slate-500">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

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
        <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-5 py-3">
          {title && <h2>{title}</h2>}
          {actions}
        </div>
      )}
      <div className={pad ? "card-pad" : ""}>{children}</div>
    </section>
  );
}

/** Màn hình trống luôn kèm hướng dẫn bước tiếp theo */
export function EmptyState({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="text-sm font-medium text-slate-700">{title}</div>
      {hint && <div className="max-w-md text-sm text-slate-500">{hint}</div>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}

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
  const accent: Record<Tone, string> = {
    gray: "border-l-slate-300",
    blue: "border-l-brand-500",
    green: "border-l-emerald-500",
    amber: "border-l-amber-500",
    red: "border-l-red-500",
    violet: "border-l-violet-500",
  };
  const body = (
    <div className={`card border-l-4 ${accent[tone]} px-4 py-3`}>
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  );
  return href ? (
    <Link href={href} className="block no-underline hover:no-underline hover:opacity-90">
      {body}
    </Link>
  ) : (
    body
  );
}

export function Flash({ ok, err }: { ok?: string; err?: string }) {
  if (!ok && !err) return null;
  return (
    <div
      className={`mb-4 rounded-lg border px-4 py-2.5 text-sm ${
        err ? "border-red-200 bg-red-50 text-red-700" : "border-emerald-200 bg-emerald-50 text-emerald-700"
      }`}
    >
      {err ?? ok}
    </div>
  );
}

export function ProgressBar({ value, tone = "blue" }: { value: number; tone?: Tone }) {
  const color: Record<Tone, string> = {
    gray: "bg-slate-400",
    blue: "bg-brand-500",
    green: "bg-emerald-500",
    amber: "bg-amber-500",
    red: "bg-red-500",
    violet: "bg-violet-500",
  };
  const v = Math.max(0, Math.min(1, value));
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
      <div className={`h-full rounded-full ${color[tone]}`} style={{ width: `${v * 100}%` }} />
    </div>
  );
}

export function Tabs({ tabs, active }: { tabs: { key: string; label: ReactNode; href: string }[]; active: string }) {
  return (
    <div className="no-print mb-4 flex flex-wrap gap-1 border-b border-slate-200">
      {tabs.map((t) => (
        <Link key={t.key} href={t.href} className={`tab ${t.key === active ? "tab-active" : ""}`}>
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
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-100 font-semibold text-brand-700"
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
      {hint && <span className="mt-1 block text-xs text-slate-400">{hint}</span>}
    </label>
  );
}

/** Đếm theo trạng thái dạng "chip" có thể bấm để lọc */
export function StatusChips({ items, active }: { items: { key: string; label: string; count: number; href: string }[]; active?: string }) {
  return (
    <div className="no-print mb-3 flex flex-wrap gap-2">
      {items.map((i) => (
        <Link
          key={i.key}
          href={i.href}
          className={`rounded-full border px-3 py-1 text-xs font-medium no-underline hover:no-underline ${
            active === i.key ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
          }`}
        >
          {i.label} <span className="ml-1 tabular-nums opacity-80">{i.count}</span>
        </Link>
      ))}
    </div>
  );
}
