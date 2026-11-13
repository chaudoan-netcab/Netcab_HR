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
import { ThemeToggle } from "@/components/theme-toggle";
import { RestoreHidden } from "./_components/restore-hidden";
import { HIDDEN_COOKIE } from "./_components/dismiss-key";

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
          {/* Con mắt: chỉ hiện khi có banner trang Tổng quan đã bấm ✕ */}
          {!!jar.get(HIDDEN_COOKIE)?.value && <RestoreHidden />}
          <ThemeToggle />
          <TodoInbox todos={todos} />
          <div className="hidden h-6 w-px bg-border sm:block" aria-hidden />
          <Link href={profileHref} className="flex items-center gap-2.5 rounded-[4px] px-1.5 py-1 no-underline hover:bg-muted hover:no-underline" title="Hồ sơ cá nhân">
            <Avatar name={name} size={32} />
            <span className="hidden text-left leading-tight md:block">
              <span className="block max-w-40 truncate text-[13px] font-medium text-foreground">{name}</span>
              <span className="block text-xs text-muted-foreground">{roleName(user)}</span>
            </span>
          </Link>
          <form action={logout}>
            <button className="flex size-9 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground" title="Đăng xuất" aria-label="Đăng xuất">
              <LogOut className="size-4.5" />
            </button>
          </form>
        </>
      }
    >
      {children}
    </AppShell>
  );
}
