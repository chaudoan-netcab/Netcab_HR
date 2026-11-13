"use client"; // Error boundary phải là Client Component

import Link from "next/link";
import { useEffect } from "react";

/** Lỗi chung trong khung app — kiểu trang trống NETCAB, vẫn giữ thanh bên / thanh trên */
export default function AppError({ error, retry }: { error: unknown; retry: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  const digest = error instanceof Error && "digest" in error ? String((error as Error & { digest?: string }).digest ?? "") : "";
  return (
    <div className="card flex flex-col items-center gap-1.5 px-6 py-16 text-center">
      <div className="text-[13px] font-medium text-foreground">Có lỗi khi tải trang này</div>
      <div className="max-w-md text-[13px] text-muted-foreground">
        Thử tải lại. Nếu vẫn lỗi, báo cho quản trị hệ thống{digest ? ` kèm mã lỗi ${digest}` : ""}.
      </div>
      <div className="mt-3 flex gap-2">
        <Link href="/" className="btn">
          Về trang chủ
        </Link>
        <button type="button" onClick={() => retry()} className="btn btn-primary">
          Tải lại
        </button>
      </div>
    </div>
  );
}
