"use client";
// Tooltip nhỏ: hiện khi rê chuột hoặc focus bàn phím. Dùng position: fixed nên không bị cắt bởi khung cuộn của bảng.
import { useId, useRef, useState, type ReactNode } from "react";

export function Tip({ content, children, className = "" }: { content: ReactNode; children: ReactNode; className?: string }) {
  const id = useId();
  const ref = useRef<HTMLSpanElement>(null);
  const [pos, setPos] = useState<{ x: number; y: number; below: boolean } | null>(null);
  const show = () => {
    const r = ref.current?.getBoundingClientRect();
    if (!r) return;
    const below = r.top < 120; // sát mép trên thì hiện bên dưới
    setPos({ x: Math.min(Math.max(r.left + r.width / 2, 140), window.innerWidth - 140), y: below ? r.bottom + 6 : r.top - 6, below });
  };
  const hide = () => setPos(null);
  return (
    <span
      ref={ref}
      tabIndex={0}
      aria-describedby={pos ? id : undefined}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      onKeyDown={(e) => e.key === "Escape" && hide()}
      className={`cursor-help rounded outline-none focus-visible:ring-2 focus-visible:ring-brand-500 ${className}`}
    >
      {children}
      {pos && (
        <span
          id={id}
          role="tooltip"
          style={{ left: pos.x, top: pos.y, transform: `translate(-50%, ${pos.below ? "0" : "-100%"})` }}
          className="pointer-events-none fixed z-50 block w-max max-w-64 whitespace-normal rounded-lg bg-slate-900 px-3 py-2 text-left text-xs font-normal leading-relaxed text-white shadow-lg"
        >
          {content}
        </span>
      )}
    </span>
  );
}
