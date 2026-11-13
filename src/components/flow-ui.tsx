// Khối giao diện dùng chung: nhật ký gửi, công tắc Phòng tôi / Toàn công ty, chọn quý, ghi chú dữ liệu tạm
import { fmtDateTime } from "@/lib/dates";
import type { LogEntry } from "@/lib/server/demo-store";

export function FlowLog({ log }: { log: LogEntry[] }) {
  if (log.length === 0) return <p className="text-sm text-muted-foreground">Chưa có thao tác nào.</p>;
  return (
    <ol className="ml-1 flex flex-col gap-3 border-l border-border pl-4 text-sm">
      {[...log].reverse().map((l, i) => (
        <li key={i} className="relative">
          <span className="absolute -left-[21px] top-1.5 size-2 rounded-full bg-status-neutral" aria-hidden />
          <div className="text-foreground">{l.action}</div>
          <div className="text-xs text-muted-foreground">
            {l.by} · {fmtDateTime(new Date(l.at))}
          </div>
          {l.note && <div className="mt-0.5 text-xs italic text-muted-foreground">“{l.note}”</div>}
        </li>
      ))}
    </ol>
  );
}

/** Công tắc phạm vi dữ liệu: Phòng tôi / Toàn công ty */
export function ViewToggle({ company, hrefMine, hrefCompany }: { company: boolean; hrefMine: string; hrefCompany: string }) {
  const item = (active: boolean, href: string, label: string) => (
    <a
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex h-7 items-center whitespace-nowrap rounded-[4px] px-3 text-[13px] no-underline hover:no-underline ${active ? "bg-card font-medium text-primary-text" : "text-muted-foreground hover:text-foreground"}`}
    >
      {label}
    </a>
  );
  return (
    <nav aria-label="Phạm vi dữ liệu" className="inline-flex rounded-[4px] bg-muted p-0.5 dark:border dark:border-border">
      {item(!company, hrefMine, "Phòng tôi")}
      {item(company, hrefCompany, "Toàn công ty")}
    </nav>
  );
}

/** Chọn quý (form GET, tham số ?yq=YYYY-Q) */
export function QuarterPicker({ value, options, extra }: { value: string; options: { value: string; label: string }[]; extra?: Record<string, string | undefined> }) {
  const opts = options.some((o) => o.value === value) ? options : [{ value, label: `Quý ${value.split("-")[1]}/${value.split("-")[0]}` }, ...options];
  return (
    <form method="get" className="flex items-center gap-2">
      {Object.entries(extra ?? {}).map(([k, v]) => (v ? <input key={k} type="hidden" name={k} value={v} /> : null))}
      <label className="sr-only" htmlFor="yq">Quý</label>
      <select id="yq" name="yq" defaultValue={value} className="input w-36">
        {opts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
      <button className="btn">Xem</button>
    </form>
  );
}

/** Ghi chú "lưu tạm" cho các chức năng giai đoạn chỉ làm UI */
export function DemoNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 text-xs text-muted-foreground">{children}</p>;
}
