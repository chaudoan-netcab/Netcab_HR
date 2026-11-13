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
    <nav className="flex flex-col gap-4 py-4" aria-label="Menu chính">
      {groups.map((g, gi) => {
        const items = g.items;
        return (
          <div key={gi}>
            {g.title && (collapsed ? <div className="mx-4 mb-2 h-px bg-border" aria-hidden /> : <div className="pb-1.5 pl-[27px] pr-3 text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">{g.title}</div>)}
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
                      className={`mx-2 flex items-center rounded-[4px] py-2 text-[13px] no-underline hover:no-underline ${collapsed ? "justify-center px-0" : "gap-3 pl-[19px] pr-3"} ${
                        active ? "bg-primary/10 font-medium text-primary-text" : "text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                      }`}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden />
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
  return <span className="truncate text-[14px] font-medium text-foreground">{hit?.[1] ?? "Netcab HR"}</span>;
}
