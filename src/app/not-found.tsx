import Link from "next/link";

/** Không tìm thấy (404) — kiểu trang trống NETCAB: một dòng chuyện gì, một dòng việc cần làm, một nút */
export default function NotFound() {
  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-6">
      <div className="max-w-sm text-center">
        <div className="text-[11px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Lỗi 404</div>
        <h1 className="mt-2">Không tìm thấy trang</h1>
        <p className="mt-1 text-[13px] text-muted-foreground">Đường dẫn có thể đã đổi hoặc trang đã bị xóa. Kiểm tra lại đường dẫn, hoặc về trang chủ.</p>
        <Link href="/" className="btn btn-primary mt-5">
          Về trang chủ
        </Link>
      </div>
    </main>
  );
}
