import Image from "next/image";
import { redirect } from "next/navigation";
import { CircleAlert } from "lucide-react";
import "@/styles/brandmark-intro.css";
import bcrypt from "bcryptjs";
import { db } from "@/lib/server/db";
import { createSession, getCurrentUser } from "@/lib/server/auth";
import { homePath } from "@/lib/server/access";

// TODO(backend): trước khi chạy chính thức, tắt đăng nhập bằng mật khẩu (chỉ đăng nhập Microsoft Entra) và xóa ATTENDANCE_START_MONTH demo trong .env.
async function login(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
    redirect("/login?err=1");
  }
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  await createSession(user.id);
  redirect(homePath(user));
}

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ err?: string }> }) {
  const me = await getCurrentUser();
  if (me) redirect(homePath(me));
  const { err } = await searchParams;
  return (
    // Bố cục NETCAB (theo Netcab SSO): form trái, cột thương hiệu phải (≥ 1024px); điện thoại chỉ còn form, nằm gần trên
    <main className="grid min-h-dvh bg-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
      <div className="flex justify-center px-6 pb-10 pt-[10vh] sm:px-12 lg:items-center lg:py-7">
        <div className="w-full max-w-[360px]">
          <div className="mb-8">
            <Image src="/logo/netcab-hrm-xanh@4x.png" alt="NETCAB HRM" width={158} height={32} priority className="logo-light h-8 w-auto" />
            <Image src="/logo/netcab-hrm-trang@4x.png" alt="NETCAB HRM" width={158} height={32} priority className="logo-dark h-8 w-auto" />
          </div>
          <h1 className="section-title">Đăng nhập</h1>
          <p className="mt-1 text-[13px] text-muted-foreground">Dùng email công ty và mật khẩu được cấp.</p>
          {err && (
            <div role="alert" className="mt-4 flex items-start gap-2 text-[13px] text-status-danger-text">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden />
              Email hoặc mật khẩu không đúng.
            </div>
          )}
          <form action={login} className="mt-6 flex flex-col gap-4">
            <label>
              <span className="label">Email</span>
              <input name="email" type="email" required autoFocus className="input" placeholder="ten@netcab.vn" aria-invalid={err ? true : undefined} />
            </label>
            <label>
              <span className="label">Mật khẩu</span>
              <input name="password" type="password" required className="input" aria-invalid={err ? true : undefined} />
            </label>
            <button className="btn btn-primary mt-2 w-full">Đăng nhập</button>
          </form>
          <p className="mt-6 text-xs text-muted-foreground">Quên mật khẩu, vui lòng liên hệ phòng HR & Admin.</p>
        </div>
      </div>

      {/* Cột thương hiệu: logo có slogan + hiệu ứng mở đầu (assets từ skill NETCAB), tên sản phẩm ở dưới */}
      <div className="login-brand hidden flex-col lg:flex">
        <div className="nc-mark-wrap">
          <div className="nc-brandmark" role="img" aria-label="NETCAB">
            <svg className="nc-mark" viewBox="0 2998 2897 2337" focusable="false" aria-hidden>
              <line className="nc-mark-bar nc-mark-tl" x1="89" y1="3971" x2="981" y2="3087" />
              <line className="nc-mark-bar nc-mark-tr" x1="1916" y1="3087" x2="2808" y2="3971" />
              <line className="nc-mark-bar nc-mark-bl" x1="89" y1="4362" x2="981" y2="5246" />
              <line className="nc-mark-bar nc-mark-br" x1="1916" y1="5246" x2="2808" y2="4362" />
              <rect className="nc-mark-square" x="1086" y="3804" width="725" height="725" />
            </svg>
            <span className="nc-bm-word">
              <img className="nc-bm-light" src="/logo/logo-blue-wordmark.png" alt="" />
              <img className="nc-bm-dark" src="/logo/logo-white-wordmark.png" alt="" />
            </span>
            <span className="nc-bm-tag nc-bm-tag-1">
              <img className="nc-bm-light" src="/logo/logo-blue-tagline-1.png" alt="" />
              <img className="nc-bm-dark" src="/logo/logo-white-tagline-1.png" alt="" />
            </span>
            <span className="nc-bm-tag nc-bm-tag-2">
              <img className="nc-bm-light" src="/logo/logo-blue-tagline-2.png" alt="" />
              <img className="nc-bm-dark" src="/logo/logo-white-tagline-2.png" alt="" />
            </span>
          </div>
        </div>
        <div className="px-10 pb-10 text-center">
          <div className="text-[15px] font-semibold uppercase tracking-[0.06em] text-foreground">NETCAB HRM</div>
          <p className="mt-1 text-[13px] text-muted-foreground">Hệ thống quản lý nhân sự, KPI và đánh giá thành tích</p>
        </div>
      </div>
    </main>
  );
}
