"use client";
// Form lọc tự áp dụng: đổi giá trị ô chọn là lọc ngay và cập nhật URL (không cần nút "Lọc")
import { usePathname, useRouter } from "next/navigation";
import { useTransition, type FormEvent, type ReactNode } from "react";

export function AutoFilterForm({ children, className = "" }: { children: ReactNode; className?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const apply = (form: HTMLFormElement) => {
    const params = new URLSearchParams();
    for (const [k, v] of new FormData(form)) if (typeof v === "string" && v) params.set(k, v);
    start(() => router.replace(`${pathname}${params.size ? `?${params}` : ""}`, { scroll: false }));
  };
  return (
    <form
      role="search"
      aria-label="Lọc bảng theo dõi"
      aria-busy={pending}
      onChange={(e: FormEvent<HTMLFormElement>) => apply(e.currentTarget)}
      onSubmit={(e) => {
        e.preventDefault();
        apply(e.currentTarget);
      }}
      className={`${className} ${pending ? "opacity-70" : ""}`}
    >
      {children}
    </form>
  );
}
