import Link from "next/link";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LogOut } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TodoInbox } from "@/components/todo-inbox";
import { Avatar } from "@/components/ui";
import { destroySession, requireUser } from "@/lib/server/auth";
import { capsOf, roleName } from "@/lib/server/access";
import { getTodos } from "@/lib/server/todos";
import { SIDEBAR_COOKIE } from "@/lib/nav";

async function logout() {
  "use server";
  await destroySession();
  redirect("/login");
}

/**
 * Khung app: sidebar và thanh trên cùng ĐỨNG YÊN, chỉ vùng nội dung (main) cuộn.
 * Thanh trên: thu gọn menu · tên mục · việc cần làm · tài khoản.
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const [todos, jar] = await Promise.all([getTodos(user), cookies()]);
  const caps = capsOf(user);
  const name = user.employee?.fullName ?? user.email;
  // Admin không có hồ sơ nhân viên nghiệp vụ → về trang Quản trị hệ thống
  const profileHref = caps.admin || !user.employeeId ? "/admin" : `/employees/${user.employeeId}`;

  return (
    <AppShell
      caps={caps}
      initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      topbarRight={
        <>
          <TodoInbox todos={todos} />
          <div className="hidden h-6 w-px bg-slate-200 sm:block" aria-hidden />
          <Link href={profileHref} className="flex items-center gap-2.5 rounded-lg px-1.5 py-1 no-underline hover:bg-slate-100 hover:no-underline" title="Hồ sơ cá nhân">
            <Avatar name={name} size={32} />
            <span className="hidden text-left leading-tight md:block">
              <span className="block max-w-40 truncate text-sm font-medium text-slate-800">{name}</span>
              <span className="block text-[11px] text-slate-500">{roleName(user)}</span>
            </span>
          </Link>
          <form action={logout}>
            <button className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-500 hover:bg-red-50 hover:text-red-600" title="Đăng xuất" aria-label="Đăng xuất">
              <LogOut size={17} />
            </button>
          </form>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
