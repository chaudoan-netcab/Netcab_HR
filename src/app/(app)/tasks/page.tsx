import Link from "next/link";
import { ArrowRight, CalendarClock, ClipboardList, Flag, Plus, Search, Users, X } from "lucide-react";
import type { Prisma, TaskStatus } from "@prisma/client";
import { db } from "@/lib/server/db";
import { isHRM, isManager, requireEmployeeUser, teamScope } from "@/lib/server/access";
import { toInputDate, today } from "@/lib/dates";
import { OPEN_TASK, assignableScope, taskRoles } from "@/lib/server/tasks";
import { RETURN_PREFIX, SUBMIT_PREFIX, dueChip, isReturned, nextStep, viewStatusLabel, viewStatusTone, type ViewStatus } from "@/lib/task-view";
import { Avatar, Badge, Card, Flash, PageHeader, StatusChips, Tabs } from "@/components/ui";
import { createTask } from "./actions";
import { NewTaskDialog } from "./_components/new-task-dialog";

type SP = { view?: string; show?: string; new?: string; assignee?: string; q?: string; ok?: string; err?: string };

export default async function TasksPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireEmployeeUser();
  const sp = await searchParams;
  const me = user.employeeId ?? "__none__";
  const now = today();
  const scope = assignableScope(user); // null = không có quyền giao việc
  const canAssign = scope !== null;
  const q = sp.q?.trim() ?? "";

  // Các góc nhìn: việc tôi làm · việc tôi giao · việc tôi phối hợp · việc của nhóm (quản lý) / cả công ty (HRM)
  const views: Record<string, { label: string; where: Prisma.TaskWhereInput }> = {
    mine: { label: "Nhiệm vụ cá nhân", where: { assigneeId: me } },
    ...(canAssign ? { assigned: { label: "Tôi giao", where: { createdById: user.id } } } : {}),
    collab: { label: "Tôi phối hợp", where: { collaborators: { some: { id: me } } } },
    ...(isHRM(user) ? { all: { label: "Cả công ty", where: {} } } : isManager(user) ? { all: { label: "Nhiệm vụ của nhóm", where: { assignee: teamScope(user) } } } : {}),
  };
  const view = sp.view && views[sp.view] ? sp.view : user.employeeId ? "mine" : canAssign ? "assigned" : "mine";
  const show = sp.show ?? "open";
  const statusWhere: Record<string, Prisma.TaskWhereInput> = {
    open: { status: { in: [...OPEN_TASK] } },
    overdue: { status: { in: [...OPEN_TASK] }, dueDate: { lt: now } },
    review: { status: "REVIEW" },
    closed: { status: { in: ["DONE", "CANCELLED"] } },
  };
  const search: Prisma.TaskWhereInput = q ? { title: { contains: q, mode: "insensitive" } } : {};
  const base: Prisma.TaskWhereInput = { AND: [views[view].where, search] };

  const [tasks, counts, viewCounts, people] = await Promise.all([
    db.task.findMany({
      where: { AND: [base, statusWhere[show] ?? statusWhere.open] },
      include: {
        assignee: { include: { department: true } },
        createdBy: { include: { employee: true } },
        // Lần báo cáo / trả lại gần nhất → suy ra "Bị trả lại"
        comments: { where: { OR: [{ content: { startsWith: SUBMIT_PREFIX } }, { content: { startsWith: RETURN_PREFIX } }] }, orderBy: { createdAt: "desc" }, take: 1, select: { content: true } },
        _count: { select: { collaborators: true } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 200,
    }),
    Promise.all(Object.entries(statusWhere).map(async ([k, w]) => [k, await db.task.count({ where: { AND: [base, w] } })] as const)),
    Promise.all(Object.entries(views).map(async ([k, v]) => [k, await db.task.count({ where: { AND: [v.where, statusWhere.open] } })] as const)),
    canAssign && sp.new
      ? db.employee.findMany({ where: scope!, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, position: true, department: { select: { name: true } } } })
      : [],
  ]);
  const count = Object.fromEntries(counts);
  const openIn = Object.fromEntries(viewCounts);
  const showLabel: Record<string, string> = { open: "Đang mở", overdue: "Quá hạn", review: "Chờ xác nhận", closed: "Đã hoàn thành / hủy" };
  const qs = (extra: Record<string, string>) => `/tasks?${new URLSearchParams({ view, ...(q ? { q } : {}), ...extra })}`;

  // Cột người: ở "Nhiệm vụ cá nhân" là người giao, các góc nhìn khác là người thực hiện
  const personCol = view === "mine" ? "Người giao" : "Người thực hiện";
  const rows = tasks.map((t) => {
    const giver = t.createdBy?.employee?.fullName ?? t.createdBy?.email ?? "—";
    const returned = isReturned(t.status, t.comments[0]?.content);
    const status: ViewStatus = returned ? "RETURNED" : t.status;
    return {
      t,
      // Chỉ ghi "Giao bởi" khi người giao không phải mình và cột người chưa thể hiện
      giverNote: view !== "mine" && t.createdById !== user.id ? giver : null,
      person: view === "mine" ? { name: giver, sub: t.createdBy?.employee?.position ?? null } : { name: t.assignee.fullName, sub: t.assignee.department?.name ?? null },
      status,
      returned,
      due: dueChip(t, now),
      next: nextStep({ status: t.status, returned, ...taskRoles(user, t) }),
    };
  });
  const mineToDo = rows.filter((r) => r.next).length;

  return (
    <div>
      <PageHeader
        title="Nhiệm vụ"
        description="Giao việc, theo dõi tiến độ và xác nhận kết quả. Người thực hiện báo cáo hoàn thành, người giao xác nhận."
        actions={
          canAssign && (
            <Link href={qs({ show, new: "1" })} scroll={false} className="btn btn-primary">
              <Plus size={16} /> Giao việc
            </Link>
          )
        }
      />
      <Tabs
        active={view}
        tabs={Object.entries(views).map(([k, v]) => ({
          key: k,
          href: `/tasks?view=${k}`,
          label: (
            <>
              {v.label} {openIn[k] > 0 && <span className="ml-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] tabular-nums text-slate-600">{openIn[k]}</span>}
            </>
          ),
        }))}
      />
      {!sp.new && <Flash ok={sp.ok} err={sp.err} />}

      <div className="mb-3 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <StatusChips active={show} items={Object.keys(statusWhere).map((k) => ({ key: k, label: showLabel[k], count: count[k], href: qs({ show: k }) }))} />
        <form action="/tasks" className="no-print relative w-full md:w-72">
          <input type="hidden" name="view" value={view} />
          <input type="hidden" name="show" value={show} />
          <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" aria-hidden />
          <input name="q" defaultValue={q} placeholder="Tìm theo tên nhiệm vụ" aria-label="Tìm theo tên nhiệm vụ" className="input pl-9 pr-9" />
          {q && (
            <Link href={`/tasks?view=${view}&show=${show}`} className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700" aria-label="Xóa tìm kiếm">
              <X size={15} />
            </Link>
          )}
        </form>
      </div>

      {mineToDo > 0 && (
        <p className="mb-3 flex items-center gap-2 text-sm text-slate-600">
          <span className="h-4 w-1 rounded-full bg-brand-500" aria-hidden />
          <span>
            <b className="font-semibold text-brand-700">{mineToDo} việc</b> đang chờ bạn xử lý — được đánh dấu bằng vạch xanh bên trái.
          </span>
        </p>
      )}

      <Card pad={false}>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
              <ClipboardList size={22} aria-hidden />
            </span>
            <div className="mt-1 text-sm font-medium text-slate-700">
              {q ? `Không tìm thấy nhiệm vụ nào có “${q}”` : show === "open" ? "Không có nhiệm vụ nào đang mở" : "Không có nhiệm vụ nào trong mục này"}
            </div>
            <div className="max-w-md text-sm text-slate-500">
              {q ? "Thử từ khóa khác hoặc xem ở mục trạng thái khác." : view === "mine" ? "Chưa có nhiệm vụ được giao." : canAssign ? "Tạo nhiệm vụ mới bằng nút “Giao việc”." : ""}
            </div>
          </div>
        ) : (
          <>
            {/* Màn hình rộng: bảng, bấm vào bất kỳ đâu trên dòng để mở */}
            <div className="hidden overflow-x-auto md:block">
              <table className="table">
                <thead>
                  <tr>
                    <th>Nhiệm vụ</th>
                    <th className="w-56">{personCol}</th>
                    <th className="w-40">Hạn</th>
                    <th className="w-48">Tiến độ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ t, giverNote, person, status, returned, due, next }) => (
                    <tr key={t.id} className={`relative cursor-pointer ${next ? "[&>td:first-child]:shadow-[inset_3px_0_0_var(--color-brand-500)]" : ""}`}>
                      <td>
                        <Link href={`/tasks/${t.id}`} className="font-medium text-slate-900 after:absolute after:inset-0 hover:text-brand-600">
                          {t.title}
                        </Link>
                        <Meta high={t.priority === "HIGH"} giverNote={giverNote} collab={t._count.collaborators} />
                      </td>
                      <td>
                        <PersonCell {...person} />
                      </td>
                      <td>
                        <div className="tabular-nums text-slate-800">{due.date}</div>
                        {due.note && <div className={`text-xs font-medium ${dueText[due.tone]}`}>{cap(due.note)}</div>}
                      </td>
                      <td>
                        <Badge tone={viewStatusTone[status]}>{viewStatusLabel[status]}</Badge>
                        <MiniProgress status={t.status} returned={returned} />
                        {next && <NextStep text={next} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Điện thoại: thẻ */}
            <ul className="divide-y divide-slate-100 md:hidden">
              {rows.map(({ t, giverNote, person, status, returned, due, next }) => (
                <li key={t.id} className={next ? "shadow-[inset_3px_0_0_var(--color-brand-500)]" : ""}>
                  <Link href={`/tasks/${t.id}`} className="block px-4 py-3.5 text-slate-800 no-underline hover:bg-slate-50 hover:no-underline">
                    <div className="font-medium text-slate-900">{t.title}</div>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      <Badge tone={viewStatusTone[status]}>{viewStatusLabel[status]}</Badge>
                      <Badge tone={due.tone}>
                        <CalendarClock size={11} aria-hidden /> {due.label}
                      </Badge>
                    </div>
                    <MiniProgress status={t.status} returned={returned} />
                    <div className="mt-2 text-xs text-slate-500">
                      {personCol}: <span className="font-medium text-slate-700">{person.name}</span>
                      {person.sub && ` · ${person.sub}`}
                    </div>
                    <Meta high={t.priority === "HIGH"} giverNote={giverNote} collab={t._count.collaborators} />
                    {next && (
                      <div>
                        <NextStep text={next} />
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
      </Card>
      {rows.length === 200 && <p className="mt-2 text-xs text-slate-500">Đang hiện 200 nhiệm vụ đầu tiên. Dùng ô tìm kiếm hoặc chọn trạng thái để thu hẹp.</p>}

      {canAssign && sp.new && (
        <NewTaskDialog
          action={createTask}
          people={people.map((p) => ({ id: p.id, fullName: p.fullName, position: p.position, department: p.department?.name ?? null }))}
          today={toInputDate(now)}
          closeHref={qs({ show })}
          defaultAssignee={sp.assignee}
          error={sp.err}
        />
      )}
    </div>
  );
}

const dueText = { gray: "text-slate-500", amber: "text-amber-700", red: "text-red-600", blue: "text-brand-600", green: "text-emerald-700", violet: "text-violet-700" } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const STEP: Partial<Record<TaskStatus, number>> = { TODO: 0, IN_PROGRESS: 1, REVIEW: 2, DONE: 3 };

/** Thanh tiến độ 4 đoạn thu nhỏ (cùng quy ước với trang chi tiết) */
function MiniProgress({ status, returned }: { status: TaskStatus; returned: boolean }) {
  const idx = STEP[status];
  if (idx === undefined) return null;
  return (
    <div className="mt-2 flex w-28 gap-0.5" aria-hidden>
      {[0, 1, 2, 3].map((i) => (
        <span key={i} className={`h-1 flex-1 rounded-full ${returned && i === 2 ? "bg-red-400" : i <= idx ? (status === "DONE" ? "bg-emerald-500" : "bg-brand-500") : "bg-slate-200"}`} />
      ))}
    </div>
  );
}

function Meta({ high, giverNote, collab }: { high: boolean; giverNote: string | null; collab: number }) {
  if (!high && !giverNote && !collab) return null;
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-500">
      {high && (
        <span className="inline-flex items-center gap-1 font-medium text-red-600">
          <Flag size={11} aria-hidden /> Ưu tiên cao
        </span>
      )}
      {giverNote && <span>Giao bởi {giverNote}</span>}
      {collab > 0 && (
        <span className="inline-flex items-center gap-1">
          <Users size={11} aria-hidden /> {collab} người phối hợp
        </span>
      )}
    </div>
  );
}

function PersonCell({ name, sub }: { name: string; sub: string | null }) {
  return (
    <div className="flex items-start gap-2">
      <Avatar name={name} size={26} />
      <div className="leading-tight">
        <div className="text-slate-800">{name}</div>
        {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
      </div>
    </div>
  );
}

function NextStep({ text }: { text: string }) {
  return (
    <div className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-brand-50 px-2 py-0.5 text-xs font-semibold text-brand-700">
      <ArrowRight size={12} aria-hidden /> {text}
    </div>
  );
}
