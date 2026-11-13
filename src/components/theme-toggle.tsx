"use client";
// Nút đổi sáng/tối trên thanh trên cùng (NETCAB): Sun ↔ Moon, lưu localStorage "netcab-theme-mode".
// Script trong <head> (app/layout.tsx) đã đặt class .dark trước khi vẽ trang; nút chỉ đọc lại và đổi.
import { useLayoutEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

declare global {
  interface Window {
    netcabSetTheme?: (mode: "light" | "dark" | "auto") => void;
    netcabApplyTheme?: () => void;
  }
}

export function ThemeToggle() {
  const [dark, setDark] = useState(false);
  // Chế độ dev (Strict Mode) dựng lại <html> và xóa class do script đặt → áp lại trước khi vẽ. Bản chạy thật: không đổi gì.
  useLayoutEffect(() => {
    window.netcabApplyTheme?.();
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  const label = dark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối";
  return (
    <button
      type="button"
      onClick={() => {
        const next = !dark;
        window.netcabSetTheme?.(next ? "dark" : "light");
        setDark(next);
      }}
      className="flex size-9 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground"
      title={label}
      aria-label={label}
    >
      {dark ? <Sun className="size-4.5" aria-hidden /> : <Moon className="size-4.5" aria-hidden />}
    </button>
  );
}
