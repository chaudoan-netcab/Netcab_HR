"use client";
// Banner trang Tổng quan có nút ✕: bấm là ẩn ngay + ghi mã banner vào cookie để server không vẽ lại lần sau.
// Mã banner (hid) do server tính từ NỘI DUNG banner → nội dung đổi (thêm việc mới, số liệu mới) thì banner hiện lại.
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { X } from "lucide-react";
import { HIDDEN_COOKIE, HIDDEN_MAX } from "./dismiss-key";

export function Dismissible({ hid, label, children }: { hid: string; label: string; children: ReactNode }) {
  const router = useRouter();
  const [hidden, setHidden] = useState(false);
  if (hidden) return null;
  return (
    <div className="group/banner relative">
      {children}
      <button
        type="button"
        onClick={() => {
          setHidden(true);
          const cur = document.cookie.match(new RegExp(`(?:^|; )${HIDDEN_COOKIE}=([^;]*)`))?.[1] ?? "";
          const list = [...cur.split(".").filter((x) => x && x !== hid), hid].slice(-HIDDEN_MAX);
          document.cookie = `${HIDDEN_COOKIE}=${list.join(".")}; path=/; max-age=31536000; samesite=lax`;
          router.refresh(); // để nút "Hiện lại thông báo đã ẩn" xuất hiện ngay
        }}
        className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-[4px] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        title="Ẩn thông báo này"
        aria-label={`Ẩn thông báo: ${label}`}
      >
        <X size={15} aria-hidden />
      </button>
    </div>
  );
}
