"use client";
// Khung app: sidebar (thu gọn được) + thanh trên cùng. Chỉ vùng nội dung cuộn.
// Trạng thái thu gọn lưu trong cookie "sidebar" để server render đúng ngay từ đầu (không bị nháy khi tải trang).
import Image from "next/image";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Menu, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { SIDEBAR_COOKIE, type Caps } from "@/lib/nav";
import { Sidebar, TopbarTitle } from "./sidebar";


export function AppShell({
  caps,
  initialCollapsed,
  topbarRight,
  children,
}: {
  caps: Caps;
  initialCollapsed: boolean;
  topbarRight: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      <aside
        className={`no-print hidden shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex ${collapsed ? "w-[68px]" : "w-60"}`}
      >
        <Link
          href={caps.admin ? "/admin" : "/"}
          className={`flex h-16 shrink-0 items-center border-b border-slate-200 no-underline hover:no-underline ${collapsed ? "justify-center" : "px-5"}`}
          aria-label="Về trang Tổng quan"
        >
          {collapsed ? (
            <Image src="/netcab-mark.png" alt="Netcab" width={32} height={32} priority />
          ) : (
            <>
              <Image src="/netcab-logo.png" alt="Netcab" width={116} height={26} priority />
              <span className="ml-2 rounded bg-brand-50 px-1.5 py-0.5 text-[11px] font-semibold text-brand-600">HR</span>
            </>
          )}
        </Link>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Sidebar caps={caps} collapsed={collapsed} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print flex h-16 shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 md:px-6">
          {/* Menu cho màn hình nhỏ */}
          <details className="relative md:hidden">
            <summary className="btn btn-sm list-none" aria-label="Mở menu">
              <Menu size={16} />
            </summary>
            <div className="absolute left-0 top-10 z-30 max-h-[80dvh] w-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
              <Sidebar caps={caps} />
            </div>
          </details>
          {/* Nút thu gọn trên máy tính */}
          <button
            type="button"
            onClick={toggle}
            className="hidden h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-800 md:flex"
            aria-label={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
            title={collapsed ? "Mở rộng menu" : "Thu gọn menu"}
          >
            {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
          </button>
          <div className="hidden h-6 w-px bg-slate-200 md:block" aria-hidden />
          <TopbarTitle />
          <div className="ml-auto flex items-center gap-1.5 sm:gap-3">{topbarRight}</div>
        </header>

        <main className="app-main min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-4 py-6 md:px-8">{children}</div>
        </main>
      </div>
    </div>
  );
}
