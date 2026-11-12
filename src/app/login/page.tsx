import Image from "next/image";
import { redirect } from "next/navigation";
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
    <main className="grid min-h-dvh lg:grid-cols-2">
      <div className="hidden flex-col items-center justify-center gap-6 bg-brand-600 p-10 lg:flex">
        <Image src="/netcab-logo-white.png" alt="Netcab" width={212} height={120} priority />
        <p className="max-w-xs text-center text-sm text-brand-100">Hệ thống quản lý nhân sự, KPI và đánh giá thành tích</p>
      </div>
      <div className="flex items-center justify-center bg-white p-6">
      <div className="w-full max-w-sm">
        <div className="mb-7">
          <Image src="/netcab-logo.png" alt="Netcab" width={134} height={30} className="mb-6 lg:hidden" priority />
          <h1 className="text-2xl">Đăng nhập</h1>
          <p className="mt-1 text-sm text-slate-500">Dùng email công ty và mật khẩu được cấp.</p>
        </div>
        {err && (
          <div className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Email hoặc mật khẩu không đúng.</div>
        )}
        <form action={login} className="flex flex-col gap-4">
          <label>
            <span className="label">Email</span>
            <input name="email" type="email" required autoFocus className="input" placeholder="ten@netcab.vn" />
          </label>
          <label>
            <span className="label">Mật khẩu</span>
            <input name="password" type="password" required className="input" />
          </label>
          <button className="btn btn-primary mt-1 py-2.5">Đăng nhập</button>
        </form>
        <p className="mt-6 text-xs text-slate-400">Quên mật khẩu, vui lòng liên hệ phòng HR & Admin.</p>
      </div>
      </div>
    </main>
  );
}
