"use client";
// Khung app NETCAB: thanh bên 239px (thu gọn 70px) + thanh trên 70px. Chỉ vùng nội dung cuộn.
// Trạng thái thu gọn lưu trong cookie "sidebar" để server render đúng ngay từ đầu (không bị nháy khi tải trang).
// Điện thoại (< 768px): thanh bên ẩn, nút menu ở đầu thanh trên mở thanh bên trượt từ trái + lớp phủ.
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { SIDEBAR_COOKIE, type Caps } from "@/lib/nav";
import { Sidebar, TopbarTitle } from "./sidebar";

/** Logo ghép NETCAB HRM, cao 28px (xanh ở sáng, trắng ở tối) */
function Lockup() {
  return (
    <>
      <Image src="/logo/netcab-hrm-xanh@4x.png" alt="" width={138} height={28} priority className="logo-light h-7 w-auto" />
      <Image src="/logo/netcab-hrm-trang@4x.png" alt="" width={138} height={28} priority className="logo-dark h-7 w-auto" />
    </>
  );
}

const iconBtn = "flex items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground";

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
  const [mobileOpen, setMobileOpen] = useState(false);
  const home = caps.admin ? "/admin" : "/";

  // Chuyển trang thì đóng thanh bên trượt trên điện thoại
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setMobileOpen(false);
  }

  // Thanh bên trượt đang mở: Esc để đóng, khóa cuộn trang phía sau
  useEffect(() => {
    if (!mobileOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setMobileOpen(false);
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    document.cookie = `${SIDEBAR_COOKIE}=${next ? "collapsed" : "open"}; path=/; max-age=31536000; samesite=lax`;
  };

  return (
    <div className="app-shell flex h-dvh overflow-hidden">
      {/* Thanh bên trên máy tính */}
      <aside
        className={`no-print z-40 hidden shrink-0 flex-col border-r border-border bg-sidebar transition-[width] duration-200 ease-out motion-reduce:transition-none md:flex ${collapsed ? "w-[70px]" : "w-[239px]"}`}
      >
        <div className={`flex h-[70px] shrink-0 items-center border-b border-border ${collapsed ? "justify-center" : "gap-2 pl-5 pr-3"}`}>
          {collapsed ? (
            // Thu gọn: chỉ còn biểu trưng; rê chuột vào thì thành nút mở rộng
            <button type="button" onClick={toggle} className="group relative flex size-10 items-center justify-center rounded-[4px] hover:bg-muted" aria-label="Mở rộng menu" title="Mở rộng menu">
              <span className="group-hover:invisible group-focus-visible:invisible">
                <Image src="/logo/netcab-icon.png" alt="" width={32} height={32} priority className="logo-light size-8" />
                <Image src="/logo/netcab-icon-trang.png" alt="" width={32} height={32} priority className="logo-dark size-8" />
              </span>
              <PanelLeftOpen className="absolute size-4.5 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden />
            </button>
          ) : (
            <>
              <Link href={home} className="flex no-underline hover:no-underline" aria-label="NETCAB HRM – về trang Tổng quan">
                <Lockup />
              </Link>
              <button type="button" onClick={toggle} className={`${iconBtn} ml-auto size-8`} aria-label="Thu gọn menu" title="Thu gọn menu">
                <PanelLeftClose className="size-4" aria-hidden />
              </button>
            </>
          )}
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Sidebar caps={caps} collapsed={collapsed} />
        </div>
      </aside>

      {/* Thanh bên trượt từ trái trên điện thoại */}
      {mobileOpen && <div className="no-print fixed inset-0 z-50 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} aria-hidden />}
      <aside
        className={`no-print fixed inset-y-0 left-0 z-50 flex w-[239px] flex-col border-r border-border bg-sidebar transition-transform duration-200 ease-out motion-reduce:transition-none md:hidden ${mobileOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Menu"
        aria-hidden={!mobileOpen}
        inert={!mobileOpen}
      >
        <div className="flex h-[70px] shrink-0 items-center gap-2 border-b border-border pl-5 pr-3">
          <Link href={home} className="flex no-underline hover:no-underline" aria-label="NETCAB HRM – về trang Tổng quan">
            <Lockup />
          </Link>
          <button type="button" onClick={() => setMobileOpen(false)} className={`${iconBtn} ml-auto size-9`} aria-label="Đóng menu">
            <X className="size-4.5" aria-hidden />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <Sidebar caps={caps} />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="no-print z-30 flex h-[70px] shrink-0 items-center gap-2 border-b border-border bg-card px-4 sm:gap-3 sm:px-6">
          {/* Nút mở menu: chỉ trên điện thoại */}
          <button type="button" onClick={() => setMobileOpen(true)} className={`${iconBtn} -ml-1.5 size-9 md:hidden`} aria-label="Mở menu" aria-expanded={mobileOpen}>
            <PanelLeftOpen className="size-4.5" aria-hidden />
          </button>
          <TopbarTitle />
          <div className="ml-auto flex items-center gap-1 sm:gap-2">{topbarRight}</div>
        </header>

        <main className="app-main min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-[1680px] p-4 sm:p-6 lg:p-7">{children}</div>
        </main>
      </div>
    </div>
  );
}
