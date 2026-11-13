"use client";
// Biểu đồ tương tác cho trang Tổng quan — SVG/HTML thuần, không cần thư viện.
// Quy tắc (theo skill dataviz + ui-ux-pro-max):
// - Màu lấy từ token --chart-* (NETCAB): chuỗi chính --chart-1, so sánh --chart-5; nền thanh/lưới pha từ --foreground. Chữ luôn dùng màu chữ
// - Nét mảnh: đường 2px, thanh ≤ 24px, đầu thanh bo 4px, khe 2px màu nền giữa các phần
// - Rê chuột / Tab bàn phím để xem tooltip; mọi số liệu đều có nhãn hoặc bảng số liệu nên không phụ thuộc tooltip
import Link from "next/link";
import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";

export type Segment = { key: string; label: string; value: number; color: string; href?: string };

/** Nền thanh / lưới / trục: pha từ màu chữ nên tự đúng ở cả sáng và tối */
const TRACK = "color-mix(in srgb, var(--foreground) 10%, transparent)";
const GRID = "color-mix(in srgb, var(--foreground) 7%, transparent)";
const AXIS = "color-mix(in srgb, var(--foreground) 22%, transparent)";
const TARGET = "var(--muted-foreground)";

const fmt = (v: number, unit: string, digits = 1) => `${Number(v.toFixed(digits)).toLocaleString("vi-VN")}${unit}`;

// ───────── Tooltip dùng chung ─────────

type Tip = { x: number; y: number; value: string; label: string; color?: string } | null;

function Tooltip({ tip }: { tip: Tip }) {
  if (!tip) return null;
  return (
    <div
      role="tooltip"
      className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-[4px] border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
      style={{ left: tip.x, top: tip.y - 8 }}
    >
      <div className="flex items-center gap-1.5">
        {tip.color && <span className="h-0.5 w-3 rounded-full" style={{ background: tip.color }} />}
        <span className="font-medium tabular-nums text-foreground">{tip.value}</span>
      </div>
      <div className="text-muted-foreground">{tip.label}</div>
    </div>
  );
}

/** Theo dõi kích thước thật của khung để vẽ SVG đúng tỉ lệ (không méo nét chữ) */
function useBox<T extends HTMLElement>(fallback = 480) {
  const ref = useRef<T>(null);
  const [box, setBox] = useState({ w: fallback, h: 0 });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setBox({ w: Math.max(160, Math.round(e.contentRect.width)), h: Math.round(e.contentRect.height) }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, box.w, box.h] as const;
}

function Empty({ children }: { children: ReactNode }) {
  return <div className="flex h-full min-h-28 items-center justify-center py-6 text-center text-[13px] text-muted-foreground">{children}</div>;
}

/** Bảng số liệu ẩn dưới biểu đồ — đường thay thế cho người không xem được màu / tooltip */
function DataTable({ rows, head }: { rows: [string, string][]; head: [string, string] }) {
  return (
    <details className="no-print mt-3 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none hover:text-foreground">Xem bảng số liệu</summary>
      <table className="mt-2 w-full">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="py-1 font-medium">{head[0]}</th>
            <th className="py-1 text-right font-medium">{head[1]}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([a, b]) => (
            <tr key={a}>
              <td className="py-1 text-muted-foreground">{a}</td>
              <td className="py-1 text-right tabular-nums text-foreground">{b}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

// ───────── Donut: phần trong tổng thể (≤ 5 phần) ─────────

export function Donut({
  segments,
  centerValue,
  centerLabel,
  size = 124,
  unit = "",
  emptyText = "Chưa có dữ liệu",
}: {
  segments: Segment[];
  centerValue?: ReactNode;
  centerLabel?: string;
  size?: number;
  unit?: string;
  emptyText?: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const [active, setActive] = useState<string | null>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  const box = useRef<HTMLDivElement>(null);
  if (total === 0) return <Empty>{emptyText}</Empty>;

  const stroke = 16;
  const r = (size - stroke) / 2 - 2;
  const C = 2 * Math.PI * r;
  const shown = segments.filter((s) => s.value > 0);
  const gap = shown.length > 1 ? 2 : 0; // khe 2px màu nền giữa các phần
  let acc = 0;

  const show = (s: Segment, e: { clientX: number; clientY: number } | null) => {
    const b = box.current?.getBoundingClientRect();
    setActive(s.key);
    setTip({
      x: e && b ? e.clientX - b.left : size / 2,
      y: e && b ? e.clientY - b.top : size / 2 - 10,
      value: `${fmt(s.value, unit, 0)} · ${Math.round((s.value / total) * 100)}%`,
      label: s.label,
      color: s.color,
    });
  };
  const hide = () => {
    setTip(null);
    setActive(null);
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4">
      <div ref={box} className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${centerLabel ?? "Biểu đồ"}: ${segments.map((s) => `${s.label} ${s.value}`).join(", ")}`}>
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
            {shown.map((s) => {
              const len = (s.value / total) * C;
              const el = (
                <circle
                  key={s.key}
                  cx={size / 2}
                  cy={size / 2}
                  r={r}
                  fill="none"
                  stroke={s.color}
                  strokeWidth={active === s.key ? stroke + 4 : stroke}
                  strokeDasharray={`${Math.max(0.5, len - gap)} ${C}`}
                  strokeDashoffset={-acc}
                  className="viz-anim cursor-pointer outline-none"
                  tabIndex={0}
                  aria-label={`${s.label}: ${s.value}`}
                  onPointerMove={(e) => show(s, e)}
                  onPointerLeave={hide}
                  onFocus={() => show(s, null)}
                  onBlur={hide}
                />
              );
              acc += len;
              return el;
            })}
          </g>
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <div className="text-[22px] font-medium leading-none tabular-nums text-foreground">{centerValue ?? total}</div>
          {centerLabel && <div className="mt-1 max-w-[70%] text-[11px] leading-tight text-muted-foreground">{centerLabel}</div>}
        </div>
        <Tooltip tip={tip} />
      </div>
      <Legend segments={segments} total={total} unit={unit} active={active} />
    </div>
  );
}

/** Chú giải: ô màu + tên + số + %, có thể bấm để đi tới danh sách */
function Legend({ segments, total, unit, active }: { segments: Segment[]; total: number; unit: string; active?: string | null }) {
  return (
    <ul className="flex w-full flex-col gap-1 text-[13px]">
      {segments.map((s) => {
        const inner = (
          <>
            <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="min-w-0 flex-1 truncate whitespace-nowrap text-foreground" title={s.label}>
              {s.label}
            </span>
            <span className="whitespace-nowrap font-medium tabular-nums text-foreground">{fmt(s.value, unit, 0)}</span>
            <span className="w-8 shrink-0 text-right text-xs tabular-nums text-muted-foreground">{total ? Math.round((s.value / total) * 100) : 0}%</span>
          </>
        );
        const cls = `flex items-center gap-2 rounded-[4px] px-1.5 py-0.5 ${active === s.key ? "bg-muted" : ""}`;
        return (
          <li key={s.key}>
            {s.href ? (
              <Link href={s.href} className={`${cls} no-underline hover:bg-muted/60 hover:no-underline`}>
                {inner}
              </Link>
            ) : (
              <div className={cls}>{inner}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

// ───────── Thanh phân đoạn: 1 tổng chia thành các bước (quy trình KPI, mức gấp…) ─────────

export function SegmentedBar({ segments, unit = "", legend = true, height = 12 }: { segments: Segment[]; unit?: string; legend?: boolean; height?: number }) {
  const [tip, setTip] = useState<Tip>(null);
  const box = useRef<HTMLDivElement>(null);
  const total = segments.reduce((s, x) => s + x.value, 0);
  if (total === 0) return <Empty>Chưa có dữ liệu</Empty>;
  const shown = segments.filter((s) => s.value > 0);
  return (
    <div>
      <div ref={box} className="relative flex w-full gap-[2px]" style={{ height }} role="img" aria-label={segments.map((s) => `${s.label}: ${s.value}`).join(", ")}>
        {shown.map((s, i) => (
          <div
            key={s.key}
            tabIndex={0}
            className={`viz-anim h-full cursor-pointer outline-none hover:brightness-110 focus-visible:ring-2 focus-visible:ring-ring ${i === 0 ? "rounded-l" : ""} ${i === shown.length - 1 ? "rounded-r" : ""}`}
            style={{ flexGrow: s.value, flexBasis: 0, minWidth: 6, background: s.color }}
            onPointerMove={(e) => {
              const b = box.current!.getBoundingClientRect();
              setTip({ x: e.clientX - b.left, y: 0, value: `${fmt(s.value, unit, 0)} · ${Math.round((s.value / total) * 100)}%`, label: s.label, color: s.color });
            }}
            onFocus={(e) => {
              const b = box.current!.getBoundingClientRect();
              const r = e.currentTarget.getBoundingClientRect();
              setTip({ x: r.left - b.left + r.width / 2, y: 0, value: `${fmt(s.value, unit, 0)} · ${Math.round((s.value / total) * 100)}%`, label: s.label, color: s.color });
            }}
            onPointerLeave={() => setTip(null)}
            onBlur={() => setTip(null)}
          />
        ))}
        <Tooltip tip={tip} />
      </div>
      {legend && (
        <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs">
          {segments.map((s) => {
            const inner = (
              <>
                <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} />
                <span className="text-muted-foreground">{s.label}</span>
                <span className="font-medium tabular-nums text-foreground">{fmt(s.value, unit, 0)}</span>
              </>
            );
            return (
              <li key={s.key}>
                {s.href ? (
                  <Link href={s.href} className="flex items-center gap-1.5 no-underline hover:underline">
                    {inner}
                  </Link>
                ) : (
                  <span className="flex items-center gap-1.5">{inner}</span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ───────── Cột ngang: so sánh nhóm (sắp giảm dần), có vạch mục tiêu ─────────

export function HBarChart({
  rows,
  max: fixedMax,
  unit = "",
  target,
  color = "var(--chart-1)",
  emptyText = "Chưa có dữ liệu",
  digits = 1,
}: {
  rows: { label: string; value: number; href?: string; hint?: string }[];
  max?: number;
  unit?: string;
  target?: { value: number; label: string };
  color?: string;
  emptyText?: string;
  digits?: number;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const box = useRef<HTMLDivElement>(null);
  if (rows.length === 0) return <Empty>{emptyText}</Empty>;
  const max = fixedMax ?? Math.max(1, ...rows.map((r) => r.value));
  const pos = (v: number) => `${Math.min(100, (v / max) * 100)}%`;

  const show = (r: (typeof rows)[number], x: number) =>
    setTip({ x, y: 0, value: fmt(r.value, unit, digits), label: r.hint ? `${r.label} · ${r.hint}` : r.label, color });

  return (
    <div ref={box} className="relative">
      <ul className="flex flex-col gap-1">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[minmax(0,min(9.5rem,40%))_1fr_3.5rem] items-center gap-3 text-[13px]">
            {r.href ? (
              <Link href={r.href} className="truncate text-foreground" title={r.label}>
                {r.label}
              </Link>
            ) : (
              <span className="truncate text-foreground" title={r.label}>
                {r.label}
              </span>
            )}
            <div
              className="group relative h-6 cursor-default outline-none"
              tabIndex={0}
              aria-label={`${r.label}: ${fmt(r.value, unit, digits)}`}
              onPointerMove={(e) => show(r, e.clientX - box.current!.getBoundingClientRect().left)}
              onPointerLeave={() => setTip(null)}
              onFocus={(e) => {
                const b = box.current!.getBoundingClientRect();
                const t = e.currentTarget.getBoundingClientRect();
                show(r, t.left - b.left + ((t.width * Math.min(100, (r.value / max) * 100)) / 100));
              }}
              onBlur={() => setTip(null)}
            >
              <div className="absolute inset-x-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-foreground/10" />
              <div
                className="viz-anim absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full group-hover:brightness-110 group-focus-visible:ring-2 group-focus-visible:ring-ring"
                style={{ width: pos(r.value), minWidth: r.value > 0 ? 4 : 0, background: color }}
              />
              {/* Vạch mục tiêu: vùng rê chuột rộng 12px, chỉ hiện tên mốc khi rê vào (không ghi chú cố định) */}
              {target && (
                <div
                  className="absolute inset-y-0 z-10 flex w-3 -translate-x-1/2 cursor-help justify-center"
                  style={{ left: pos(target.value) }}
                  aria-label={target.label}
                  onPointerMove={(e) => {
                    e.stopPropagation();
                    setTip({ x: e.clientX - box.current!.getBoundingClientRect().left, y: 0, value: fmt(target.value, unit, 0), label: target.label });
                  }}
                  onPointerLeave={() => setTip(null)}
                >
                  <span className="h-full w-0.5 rounded-full bg-foreground/70" />
                </div>
              )}
            </div>
            <span className="text-right tabular-nums text-foreground">{fmt(r.value, unit, digits)}</span>
          </li>
        ))}
      </ul>
      <Tooltip tip={tip} />
    </div>
  );
}

// ───────── Cột đứng theo nhóm có thứ tự (phân bố hạng A–E) ─────────

export function ColumnChart({
  cols,
  height = 150,
  unit = "",
  emptyText = "Chưa có dữ liệu",
}: {
  cols: { label: string; sub?: string; value: number; color: string }[];
  height?: number;
  unit?: string;
  emptyText?: string;
}) {
  const [tip, setTip] = useState<Tip>(null);
  const [hover, setHover] = useState<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const max = Math.max(1, ...cols.map((c) => c.value));
  const total = cols.reduce((s, c) => s + c.value, 0);
  if (total === 0) return <Empty>{emptyText}</Empty>;
  // Một chuỗi, một màu (--chart-1); cột đang chọn (mặc định cột cao nhất) chỉ in đậm số và nhãn
  const top = cols.findIndex((c) => c.value === max);
  const active = hover ?? top;
  const tipOf = (c: (typeof cols)[number]) => ({ value: `${c.value}${unit} · ${Math.round((c.value / total) * 100)}%`, label: [c.label, c.sub].filter(Boolean).join(" · "), color: "var(--chart-1)" });
  return (
    <div ref={box} className="relative">
      <div className="flex items-end gap-2" style={{ height }}>
        {cols.map((c, i) => (
          <div
            key={c.label}
            tabIndex={0}
            aria-label={`${c.label}: ${c.value}${unit}`}
            className="flex h-full flex-1 cursor-default flex-col items-center justify-end gap-1 outline-none"
            onPointerMove={(e) => {
              setHover(i);
              setTip({ x: e.clientX - box.current!.getBoundingClientRect().left, y: 0, ...tipOf(c) });
            }}
            onFocus={(e) => {
              const b = box.current!.getBoundingClientRect();
              const t = e.currentTarget.getBoundingClientRect();
              setHover(i);
              setTip({ x: t.left - b.left + t.width / 2, y: 0, ...tipOf(c) });
            }}
            onPointerLeave={() => {
              setHover(null);
              setTip(null);
            }}
            onBlur={() => {
              setHover(null);
              setTip(null);
            }}
          >
            <span className={`text-xs tabular-nums ${i === active ? "font-medium text-foreground" : "text-muted-foreground"}`}>{c.value}</span>
            <div
              className="viz-anim w-full max-w-6 rounded-t-[2px]"
              style={{ height: c.value > 0 ? `${(c.value / max) * 80}%` : 6, background: c.value === 0 ? TRACK : "var(--chart-1)" }}
            />
          </div>
        ))}
      </div>
      {/* Chỉ ghi tên cột; khoảng điểm (sub) nằm trong tooltip khi rê chuột */}
      <div className="mt-2 flex gap-2">
        {cols.map((c, i) => (
          <div key={c.label} className={`flex-1 truncate text-center text-xs ${i === active ? "font-medium text-foreground" : "text-muted-foreground"}`}>
            {c.label}
          </div>
        ))}
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

// ───────── Đường xu hướng theo thời gian (1–2 chuỗi), crosshair + tooltip ─────────

export type LineSeries = { key: string; label: string; color: string; values: (number | null)[] };

export function LineChart({
  labels,
  series,
  height = 190,
  max: fixedMax,
  unit = "",
  scale = 1,
  bands,
  emptyText = "Chưa có dữ liệu",
  fill = false,
}: {
  labels: string[];
  series: LineSeries[];
  /** fill = false: chiều cao cố định; fill = true: chiều cao tối thiểu, biểu đồ giãn theo khung chứa */
  fill?: boolean;
  height?: number;
  /** Giá trị trên cùng của trục (theo đơn vị đã nhân scale). Bỏ trống = tự tính */
  max?: number;
  unit?: string;
  /** Nhân giá trị trước khi hiển thị, VD 100 để đổi 0–1 thành % */
  scale?: number;
  /** Đường mốc ngang, VD mốc 80% "Hoàn thành" */
  bands?: { value: number; label: string }[];
  emptyText?: string;
}) {
  const [wrap, width, boxH] = useBox<HTMLDivElement>();
  const [idx, setIdx] = useState<number | null>(null);
  const minH = height;
  height = fill ? Math.max(minH, boxH) : height;
  const id = useId();
  const hasData = series.some((s) => s.values.some((v) => v !== null));
  if (!hasData) return <Empty>{emptyText}</Empty>;

  const vals = series.flatMap((s) => s.values.filter((v): v is number => v !== null).map((v) => v * scale));
  const rawMax = fixedMax ?? Math.max(...vals, ...(bands ?? []).map((b) => b.value), 1);
  const step = niceStep(rawMax / 4);
  const top = fixedMax ?? Math.ceil(rawMax / step) * step;
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);

  const pad = { l: 34, r: 14, t: 12, b: 26 };
  const w = width - pad.l - pad.r;
  const h = height - pad.t - pad.b;
  const x = (i: number) => pad.l + (labels.length === 1 ? w / 2 : (i / (labels.length - 1)) * w);
  const y = (v: number) => pad.t + h - (v / top) * h;
  const everyN = Math.ceil(labels.length / Math.max(2, Math.floor(w / 44)));

  const path = (vs: (number | null)[]) => {
    let d = "";
    let pen = false;
    vs.forEach((v, i) => {
      if (v === null) {
        pen = false;
        return;
      }
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v * scale).toFixed(1)} `;
      pen = true;
    });
    return d.trim();
  };
  const area = (vs: (number | null)[]) => {
    const pts = vs.map((v, i) => (v === null ? null : ([x(i), y(v * scale)] as const))).filter(Boolean) as (readonly [number, number])[];
    if (pts.length < 2) return "";
    return `M${pts[0][0]},${y(0)} ` + pts.map(([a, b]) => `L${a.toFixed(1)},${b.toFixed(1)}`).join(" ") + ` L${pts[pts.length - 1][0]},${y(0)} Z`;
  };

  const onMove = (e: PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - r.left - pad.l;
    setIdx(Math.max(0, Math.min(labels.length - 1, Math.round((px / w) * (labels.length - 1)))));
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setIdx((i) => Math.min(labels.length - 1, (i ?? -1) + 1));
    else if (e.key === "ArrowLeft") setIdx((i) => Math.max(0, (i ?? labels.length) - 1));
    else return;
    e.preventDefault();
  };

  const tipX = idx === null ? 0 : x(idx);
  return (
    <div className={fill ? "flex flex-col" : ""}>
      {series.length > 1 && (
        <ul className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
          {series.map((s) => (
            <li key={s.key} className="flex items-center gap-1.5">
              <span className="h-0.5 w-4 rounded-full" style={{ background: s.color, height: 2 }} />
              {s.label}
            </li>
          ))}
        </ul>
      )}
      {/* fill: khung tự giãn (flex-1), SVG nằm tuyệt đối bên trong nên không tự đẩy khung cao lên */}
      <div ref={wrap} className={fill ? "relative flex-1" : "relative"} style={fill ? { minHeight: minH } : undefined}>
        <svg
          width={width}
          height={height}
          className={`block outline-none focus-visible:ring-2 focus-visible:ring-ring ${fill ? "absolute left-0 top-0" : ""}`}
          tabIndex={0}
          role="img"
          aria-label={`${series.map((s) => s.label).join(", ")} theo thời gian. Dùng phím mũi tên trái/phải để xem từng mốc.`}
          onPointerMove={onMove}
          onPointerLeave={() => setIdx(null)}
          onFocus={() => setIdx((i) => i ?? labels.length - 1)}
          onBlur={() => setIdx(null)}
          onKeyDown={onKey}
        >
          <defs>
            {series.map((s) => (
              <linearGradient key={s.key} id={`${id}-${s.key}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor={s.color} stopOpacity={0.16} />
                <stop offset="1" stopColor={s.color} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.l} x2={width - pad.r} y1={y(t)} y2={y(t)} stroke={t === 0 ? AXIS : GRID} strokeWidth={1} />
              <text x={pad.l - 6} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted-foreground text-[10px] tabular-nums">
                {t}
                {unit}
              </text>
            </g>
          ))}
          {/* Mốc ngang: nét đứt khác kiểu cho từng mốc, tên mốc nằm ở chú giải bên dưới (không đè lên dữ liệu) */}
          {bands?.map((b, i) => (
            <line key={b.label} x1={pad.l} x2={width - pad.r} y1={y(b.value)} y2={y(b.value)} stroke={TARGET} strokeWidth={1} strokeDasharray={i === 0 ? "4 3" : "1.5 3"} opacity={0.7} />
          ))}
          {labels.map((l, i) =>
            i % everyN === 0 || i === labels.length - 1 ? (
              <text key={l + i} x={x(i)} y={height - 8} textAnchor="middle" className="fill-muted-foreground text-[10px]">
                {l}
              </text>
            ) : null,
          )}
          {series.map((s) => (
            <g key={s.key}>
              {series.length === 1 && <path d={area(s.values)} fill={`url(#${id}-${s.key})`} />}
              <path d={path(s.values)} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" className="viz-anim" />
              {/* Chấm ở điểm cuối có dữ liệu + điểm lẻ (không nối được thành đường) */}
              {s.values.map((v, i) => {
                if (v === null) return null;
                const lone = (s.values[i - 1] ?? null) === null && (s.values[i + 1] ?? null) === null;
                const last = s.values.slice(i + 1).every((n) => n === null);
                if (!lone && !last) return null;
                return <circle key={i} cx={x(i)} cy={y(v * scale)} r={4} fill={s.color} stroke="var(--card)" strokeWidth={2} />;
              })}
            </g>
          ))}
          {idx !== null && (
            <g pointerEvents="none">
              <line x1={tipX} x2={tipX} y1={pad.t} y2={pad.t + h} stroke={AXIS} strokeWidth={1} />
              {series.map((s) =>
                s.values[idx] === null ? null : <circle key={s.key} cx={tipX} cy={y(s.values[idx]! * scale)} r={4.5} fill={s.color} stroke="var(--card)" strokeWidth={2} />,
              )}
            </g>
          )}
        </svg>
        {idx !== null && (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-0 z-20 whitespace-nowrap rounded-[4px] border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md"
            style={{ left: Math.min(Math.max(tipX, 70), width - 70), transform: "translate(-50%, -4px)" }}
          >
            <div className="mb-0.5 text-muted-foreground">{labels[idx]}</div>
            {series.map((s) => (
              <div key={s.key} className="flex items-center gap-1.5">
                <span className="w-3 rounded-full" style={{ background: s.color, height: 2 }} />
                <span className="font-medium tabular-nums text-foreground">{s.values[idx] === null ? "—" : fmt(s.values[idx]! * scale, unit)}</span>
                {series.length > 1 && <span className="text-muted-foreground">{s.label}</span>}
              </div>
            ))}
          </div>
        )}
      </div>
      {bands && bands.length > 0 && (
        <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
          {bands.map((b, i) => (
            <li key={b.label} className="flex items-center gap-1.5">
              <svg width="16" height="4" aria-hidden>
                <line x1="0" x2="16" y1="2" y2="2" stroke={TARGET} strokeWidth={1} strokeDasharray={i === 0 ? "4 3" : "1.5 3"} />
              </svg>
              {b.label}
            </li>
          ))}
        </ul>
      )}
      <DataTable
        head={["Mốc", series.map((s) => s.label).join(" / ")]}
        rows={labels.map((l, i) => [l, series.map((s) => (s.values[i] === null ? "—" : fmt(s.values[i]! * scale, unit))).join(" / ")])}
      />
    </div>
  );
}

function niceStep(raw: number) {
  if (raw <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}

// ───────── Cột theo thời gian: một chuỗi --chart-1, nhãn kỳ đang chọn in đậm, tooltip khi rê chuột / Tab ─────────

/** label: nhãn ngắn dưới cột (VD "T9") · title: tên đầy đủ trong tooltip (VD "Tháng 9/2026") */
export type SoftBar = { label: string; title?: string; value: number | null; rows?: { label: string; value: string }[] };

export function SoftBarChart({
  bars,
  height = 170,
  max: fixedMax,
  unit = "",
  target,
  emptyText = "Chưa có dữ liệu",
}: {
  bars: SoftBar[];
  height?: number;
  /** Giá trị trên cùng của trục; bỏ trống = tự tính */
  max?: number;
  unit?: string;
  /** Vạch mốc nét đứt, VD 80% — chỉ ghi số mốc ở mép trái như vạch chia trục */
  target?: { value: number; label: string };
  emptyText?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const last = bars.findLastIndex((b) => b.value !== null);
  if (last < 0) return <Empty>{emptyText}</Empty>;
  // Cột tô đậm: cột đang rê chuột, mặc định là kỳ mới nhất. Tooltip CHỈ hiện khi rê chuột / Tab tới.
  // bars[hover] có thể không còn (vd đổi từ 12 tháng sang 3 tháng của quý khi chuột đang ở cột cuối) → về cột mới nhất
  const active = hover !== null && bars[hover] && bars[hover].value !== null ? hover : last;
  const top = fixedMax ?? Math.max(...bars.map((b) => b.value ?? 0), target?.value ?? 0) * 1.1;
  const pct = (v: number) => Math.max(3, Math.min(100, (v / top) * 100));
  const half = bars.length / 2;

  // Vùng cột giãn theo chiều cao thẻ (tối thiểu `height`); cột vẽ bằng % nên tự co giãn
  return (
    <div className="flex gap-2">
      {/* Cột trái: số mốc, thẳng hàng với vạch nét đứt */}
      {target && (
        <div className="flex w-7 shrink-0 flex-col" aria-hidden>
          <div className="relative flex-1">
            <span className="absolute right-0 translate-y-1/2 text-[10px] tabular-nums leading-none text-muted-foreground" style={{ bottom: `${pct(target.value)}%` }}>
              {fmt(target.value, unit, 0)}
            </span>
          </div>
          <div className="mt-2 h-4" />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="relative flex-1" style={{ minHeight: height }} role="group" aria-label={target ? `Vạch nét đứt: ${target.label}` : undefined}>
          {target && <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-muted-foreground/50" style={{ bottom: `${pct(target.value)}%` }} />}
          <div className="absolute inset-0 flex items-end gap-1.5 sm:gap-3">
            {bars.map((b, i) => {
              const h = b.value === null ? 6 : pct(b.value);
              // Tooltip đặt cạnh cột (không đè lên chính cột đang xem): nửa trái → bên phải cột, nửa phải → bên trái cột
              // cột cao: mép trên tooltip ngang đỉnh cột; cột thấp: mép dưới tooltip ngang chân cột (không tràn xuống nhãn)
              const side = `${i < half ? "left-full ml-2" : "right-full mr-2"} ${h > 50 ? "top-0" : "bottom-0"}`;
              return (
                <div
                  key={b.label + i}
                  tabIndex={b.value === null ? -1 : 0}
                  aria-label={`${b.title ?? b.label}: ${b.value === null ? "chưa có dữ liệu" : fmt(b.value, unit)}`}
                  className="relative flex h-full min-w-0 flex-1 cursor-default items-end justify-center outline-none"
                  onPointerEnter={() => setHover(i)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(i)}
                  onBlur={() => setHover(null)}
                >
                  <div
                    className={`viz-anim relative w-full max-w-6 rounded-t-[2px] ${b.value === null ? "bg-foreground/10" : "bg-chart-1"}`}
                    style={{ height: `${h}%` }}
                  >
                    {hover === i && b.value !== null && (
                      <div role="tooltip" className={`pointer-events-none absolute z-20 whitespace-nowrap rounded-[4px] border border-border bg-popover px-2.5 py-1.5 text-xs text-popover-foreground shadow-md ${side}`}>
                        <div className="mb-0.5 text-muted-foreground">{b.title ?? b.label}</div>
                        {(b.rows ?? [{ label: "Giá trị", value: fmt(b.value, unit) }]).map((r) => (
                          <div key={r.label} className="flex items-center gap-2">
                            <span className="text-muted-foreground">{r.label}</span>
                            <span className="ml-auto pl-3 font-medium tabular-nums text-foreground">{r.value}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-2 flex h-4 gap-1.5 sm:gap-3">
          {bars.map((b, i) => (
            <div key={b.label + i} className={`min-w-0 flex-1 whitespace-nowrap text-center text-[11px] leading-4 ${i === active ? "font-medium text-foreground" : "text-muted-foreground"} ${i % 2 && i !== bars.length - 1 ? "max-sm:invisible" : ""}`}>
              {b.label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ───────── Đồng hồ (gauge): 1 chỉ số so với mục tiêu ─────────

export function Gauge({ value, target, label, sub }: { value: number | null; target: number; label: string; sub?: ReactNode }) {
  const size = 180;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const half = Math.PI * r;
  const v = value === null ? 0 : Math.max(0, Math.min(1, value));
  // Màu thanh theo mức: đạt mục tiêu → xanh thương hiệu, gần đạt → vàng cảnh báo, thấp → đỏ
  const color = value === null ? TRACK : v >= target ? "var(--chart-1)" : v >= target - 0.2 ? "var(--status-warning)" : "var(--status-danger)";
  const ang = Math.PI * (1 - target);
  const tx = cx + Math.cos(ang) * r;
  const ty = cy - Math.sin(ang) * r;
  const arc = `M${stroke / 2},${cy} A${r},${r} 0 0 1 ${size - stroke / 2},${cy}`;
  return (
    <div className="flex flex-col items-center">
      <svg width={size} height={size / 2 + 12} viewBox={`0 0 ${size} ${size / 2 + 12}`} role="img" aria-label={`${label}: ${value === null ? "chưa có" : Math.round(v * 100) + "%"}, mục tiêu ${Math.round(target * 100)}%`}>
        <path d={arc} fill="none" stroke={TRACK} strokeWidth={stroke} strokeLinecap="round" />
        {value !== null && v > 0 && <path d={arc} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${v * half} ${half}`} className="viz-anim" />}
        {value !== null && <line x1={tx - Math.cos(ang) * 11} y1={ty + Math.sin(ang) * 11} x2={tx + Math.cos(ang) * 11} y2={ty - Math.sin(ang) * 11} stroke="var(--foreground)" strokeWidth={2.5} strokeLinecap="round" />}
      </svg>
      <div className="-mt-6 text-center">
        <div className={value === null ? "text-[13px] text-muted-foreground" : "text-[24px] font-medium leading-none tabular-nums text-foreground"}>{value === null ? "Chưa có dữ liệu" : `${Number((v * 100).toFixed(1))}%`}</div>
        <div className="mt-1.5 text-xs text-muted-foreground">{label}</div>
      </div>
      {sub && <div className="mt-2">{sub}</div>}
    </div>
  );
}

// ───────── Vòng tiến độ nhỏ ─────────

export function ProgressRing({ done, total, label, size = 96 }: { done: number; total: number; label: string; size?: number }) {
  // Cùng độ dày với donut; một màu chuỗi chính (--chart-1)
  const stroke = size >= 120 ? 16 : 10;
  const r = (size - stroke) / 2 - (size >= 120 ? 2 : 0);
  const C = 2 * Math.PI * r;
  const f = total ? done / total : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} role="img" aria-label={`${label}: ${done}/${total}`}>
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={TRACK} strokeWidth={stroke} />
          {f > 0 && <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--chart-1)" strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${f * C} ${C}`} className="viz-anim" />}
        </g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={`font-medium leading-none tabular-nums text-foreground ${size >= 120 ? "text-[22px]" : "text-lg"}`}>{Math.round(f * 100)}%</div>
        <div className="mt-0.5 text-[11px] tabular-nums text-muted-foreground">
          {done}/{total}
        </div>
      </div>
    </div>
  );
}
