// Khối giao diện dùng chung: nhật ký gửi, công tắc Phòng tôi / Toàn công ty, chọn quý, ghi chú dữ liệu tạm
import { fmtDateTime } from "@/lib/dates";
import type { LogEntry } from "@/lib/server/demo-store";

export function FlowLog({ log }: { log: LogEntry[] }) {
  if (log.length === 0) return <p className="text-sm text-slate-400">Chưa có thao tác nào.</p>;
  return (
    <ol className="flex flex-col gap-2 text-sm">
      {[...log].reverse().map((l, i) => (
        <li key={i} className="border-l-2 border-slate-200 pl-3">
          <div className="font-medium text-slate-800">{l.action}</div>
          <div className="text-xs text-slate-500">
            {l.by} · {fmtDateTime(new Date(l.at))}
          </div>
          {l.note && <div className="mt-0.5 text-xs text-slate-600">“{l.note}”</div>}
        </li>
      ))}
    </ol>
  );
}

/** Form Duyệt / Trả lại — trả lại bắt buộc có lý do (kiểm tra ở server) */
export function ViewToggle({ company, hrefMine, hrefCompany }: { company: boolean; hrefMine: string; hrefCompany: string }) {
  const item = (active: boolean, href: string, label: string) => (
    <a href={href} aria-current={active ? "true" : undefined} className={`rounded-md px-3 py-1.5 text-sm no-underline hover:no-underline ${active ? "bg-white font-semibold text-brand-700 shadow-sm" : "text-slate-600 hover:text-slate-900"}`}>
      {label}
    </a>
  );
  return (
    <nav aria-label="Phạm vi dữ liệu" className="inline-flex rounded-lg bg-slate-100 p-1">
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
  return <p className="mt-3 text-xs text-slate-400">{children}</p>;
}
