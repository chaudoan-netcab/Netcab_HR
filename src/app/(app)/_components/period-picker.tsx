"use client";
// Chọn Năm + Quý cho biểu đồ "Xu hướng KPI" (trang Tổng quan). Lưu trên URL (?ky=2026&kq=3) để server vẽ đúng kỳ,
// giữ nguyên các tham số khác (vd ?view=mine của HRM). kq = 0 → cả năm (12 tháng).
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { ChevronDown } from "lucide-react";

/** Ô chọn nhỏ theo kiểu .input (bo 4px, viền --input, điện thoại chữ 16px) */
const PILL = "input h-8 w-auto cursor-pointer appearance-none pl-3 pr-8 md:text-xs";

function Pill({ label, value, options, onChange, disabled }: { label: string; value: number; options: { value: number; label: string }[]; onChange: (v: number) => void; disabled: boolean }) {
  return (
    <span className="relative inline-flex">
      <select aria-label={label} value={value} disabled={disabled} onChange={(e) => onChange(Number(e.target.value))} className={PILL}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden />
    </span>
  );
}

export function KpiPeriodPicker({ years, year, quarter, keep }: { years: number[]; year: number; quarter: number; keep: Record<string, string | undefined> }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const go = (y: number, q: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(keep)) if (v) p.set(k, v);
    p.set("ky", String(y));
    if (q) p.set("kq", String(q));
    start(() => router.replace(`/?${p.toString()}`, { scroll: false }));
  };
  return (
    <div className={`flex items-center gap-1.5 ${pending ? "opacity-70" : ""}`}>
      <Pill label="Năm" value={year} disabled={pending} options={years.map((y) => ({ value: y, label: `Năm ${y}` }))} onChange={(y) => go(y, quarter)} />
      <Pill
        label="Quý"
        value={quarter}
        disabled={pending}
        options={[{ value: 0, label: "Cả năm" }, ...[1, 2, 3, 4].map((q) => ({ value: q, label: `Quý ${q}` }))]}
        onChange={(q) => go(year, q)}
      />
    </div>
  );
}
