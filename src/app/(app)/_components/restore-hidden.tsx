"use client";
// Nút con mắt trên thanh trên cùng (cạnh nút sáng/tối): chỉ hiện khi có banner trang Tổng quan đã bấm ✕.
// Bấm: xóa cookie banner đã ẩn rồi lấy lại trang → mọi banner đã ẩn hiện lại.
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { Eye } from "lucide-react";
import { HIDDEN_COOKIE } from "./dismiss-key";

export function RestoreHidden() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        document.cookie = `${HIDDEN_COOKIE}=; path=/; max-age=0; samesite=lax`;
        start(() => router.refresh());
      }}
      className="flex size-9 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-60"
      title="Hiện lại thông báo đã ẩn"
      aria-label="Hiện lại thông báo đã ẩn"
    >
      <Eye className="size-4.5" aria-hidden />
    </button>
  );
}
