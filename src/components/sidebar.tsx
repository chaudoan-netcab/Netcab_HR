"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheck, FileSpreadsheet, Home, ListChecks, ListTodo, Settings, SlidersHorizontal, Target, UserCheck, Users } from "lucide-react";
import type { Caps } from "@/lib/nav";

/** need: năng lực cần có để thấy mục (Caps tính ở server bằng capsOf() trong access.ts) */
type Item = { href: string; label: string; icon: React.ElementType; need: (c: Caps) => boolean };

const employee = (c: Caps) => c.employee;
const hrm = (c: Caps) => c.hrm;

// Menu theo năng lực, cộng dồn: Nhân viên → + Quản lý → + HRM. Admin chỉ có Quản trị hệ thống.
// Phần "của tôi" và phần "quản lý" của cùng 1 mục nằm ở các tab trong trang.
const GROUPS: { title?: string; items: Item[] }[] = [
  {
    items: [
      { href: "/", label: "Tổng quan", icon: Home, need: employee },
      { href: "/tasks", label: "Nhiệm vụ", icon: ListTodo, need: employee },
      { href: "/kpi", label: "KPI", icon: Target, need: employee },
      { href: "/reviews", label: "Đánh giá", icon: ClipboardCheck, need: employee },
    ],
  },
  {
    title: "Quản lý",
    items: [
      { href: "/follow-ups", label: "Theo dõi & nhắc việc", icon: ListChecks, need: (c) => c.tracker },
      { href: "/employees", label: "Nhân viên", icon: Users, need: (c) => c.manager || c.hrm },
    ],
  },
  {
    title: "Toàn công ty",
    items: [
      { href: "/heads", label: "Theo dõi trưởng phòng", icon: UserCheck, need: hrm },
      { href: "/attendance", label: "Import chấm công", icon: FileSpreadsheet, need: hrm },
      { href: "/settings", label: "Cấu hình nghiệp vụ", icon: SlidersHorizontal, need: hrm },
    ],
  },
  {
    items: [{ href: "/admin", label: "Quản trị hệ thống", icon: Settings, need: (c) => c.admin }],
  },
];

export const SECTION_TITLES: [string, string][] = [
  ...GROUPS.flatMap((g) => g.items.map((i) => [i.href, i.label] as [string, string])),
];

const matches = (href: string, pathname: string) => (href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(href + "/"));

export function Sidebar({ caps, collapsed = false }: { caps: Caps; collapsed?: boolean }) {
  const pathname = usePathname();
  const groups = GROUPS.map((g) => ({ ...g, items: g.items.filter((i) => i.need(caps)) })).filter((g) => g.items.length > 0);
  // Mục đang mở = mục khớp dài nhất (vd /kpi/sets không làm sáng /kpi)
  const activeHref = groups.flatMap((g) => g.items.map((i) => i.href)).filter((h) => matches(h, pathname)).sort((a, b) => b.length - a.length)[0];
  return (
    <nav className={`flex flex-col gap-4 py-4 ${collapsed ? "px-2.5" : "px-3"}`} aria-label="Menu chính">
      {groups.map((g, gi) => {
        const items = g.items;
        return (
          <div key={gi}>
            {g.title && (collapsed ? <div className="mx-2 mb-2 h-px bg-slate-200" aria-hidden /> : <div className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-400">{g.title}</div>)}
            <ul className="flex flex-col gap-0.5">
              {items.map((i) => {
                const active = i.href === activeHref;
                const Icon = i.icon;
                return (
                  <li key={i.href}>
                    <Link
                      href={i.href}
                      aria-current={active ? "page" : undefined}
                      title={collapsed ? i.label : undefined}
                      aria-label={collapsed ? i.label : undefined}
                      className={`flex items-center rounded-lg py-2.5 text-sm no-underline hover:no-underline ${collapsed ? "justify-center px-0" : "gap-3 px-3"} ${
                        active ? "bg-brand-50 font-semibold text-brand-600" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                      }`}
                    >
                      <Icon size={18} strokeWidth={active ? 2.2 : 1.8} className="shrink-0" />
                      {!collapsed && <span className="truncate">{i.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );
}

/** Tên mục đang mở, hiện trên thanh header (vẫn thấy khi cuộn trang) */
export function TopbarTitle() {
  const pathname = usePathname();
  const hit = SECTION_TITLES.filter(([href]) => matches(href, pathname)).sort((a, b) => b[0].length - a[0].length)[0];
  return <span className="truncate text-sm font-semibold text-brand-900">{hit?.[1] ?? "Netcab HR"}</span>;
}
