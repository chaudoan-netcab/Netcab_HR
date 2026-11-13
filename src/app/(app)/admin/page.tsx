import { db } from "@/lib/server/db";
import { requireAdmin } from "@/lib/server/access";
import { fmtDateTime } from "@/lib/dates";
import { roleLabel } from "@/lib/labels";
import { Card, EmptyState, Field, Flash, PageHeader, Tabs } from "@/components/ui";
import { createUser, updateUser } from "./actions";

/**
 * Quản trị hệ thống — chỉ Admin (team kỹ thuật).
 * Admin KHÔNG dùng chức năng nghiệp vụ và không xem nội dung KPI, phiếu đánh giá, điểm, xếp loại.
 */
const TABS = [
  { key: "roles", label: "Phân quyền", href: "/admin?tab=roles" },
  { key: "entra", label: "Đồng bộ Entra", href: "/admin?tab=entra" },
  { key: "teams", label: "Kênh thông báo Teams", href: "/admin?tab=teams" },
  { key: "logs", label: "Nhật ký hệ thống", href: "/admin?tab=logs" },
];

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const tab = TABS.some((t) => t.key === sp.tab) ? sp.tab! : "roles";
  return (
    <div>
      <PageHeader title="Quản trị hệ thống" description="Cấu hình kỹ thuật: phân quyền, đồng bộ tài khoản, kênh thông báo, nhật ký." />
      <Flash ok={sp.ok} err={sp.err} />
      <Tabs tabs={TABS} active={tab} />
      {tab === "roles" && <Roles meId={me.id} />}
      {tab === "entra" && (
        <Placeholder title="Đồng bộ Microsoft Entra" hint="Đồng bộ tài khoản, phòng ban và quản lý trực tiếp từ Microsoft Entra ID; tự gán role Quản lý cho người có ít nhất 1 người báo cáo." todo="TODO(backend): kết nối Microsoft Graph, lịch đồng bộ, báo cáo thay đổi." />
      )}
      {tab === "teams" && (
        <Placeholder title="Kênh thông báo Teams" hint="Webhook (Workflows) dùng để gửi nhắc việc và thông báo luồng duyệt qua Microsoft Teams." todo="TODO(backend): lưu URL webhook, gửi tin thử, theo dõi lỗi gửi." />
      )}
      {tab === "logs" && (
        <Placeholder title="Nhật ký hệ thống" hint="Nhật ký đăng nhập, thay đổi phân quyền, đồng bộ và lỗi gửi thông báo." todo="TODO(backend): ghi và tra cứu nhật ký hệ thống." />
      )}
    </div>
  );
}

function Placeholder({ title, hint, todo }: { title: string; hint: string; todo: string }) {
  return (
    <Card>
      <EmptyState title={`${title} — chưa kích hoạt`} hint={hint} />
      <p className="pb-2 text-center text-xs text-muted-foreground">{todo}</p>
    </Card>
  );
}

async function Roles({ meId }: { meId: string }) {
  const [users, people] = await Promise.all([
    db.user.findMany({ include: { employee: { select: { fullName: true, code: true } } }, orderBy: [{ role: "asc" }, { email: "asc" }] }),
    db.employee.findMany({ where: { status: { not: "RESIGNED" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, code: true } }),
  ]);
  const linked = new Set(users.map((u) => u.employeeId));
  const roles = Object.entries(roleLabel);
  return (
    <div className="grid gap-5 xl:grid-cols-3">
      <Card title="Tài khoản" className="xl:col-span-2" pad={false}>
        <ul className="divide-y divide-border">
          {users.map((u) => (
            <li key={u.id} className="px-5 py-3 max-md:px-3">
              <form action={updateUser.bind(null, u.id)} className="grid items-center gap-2 md:grid-cols-[minmax(0,1fr)_10rem_9rem_auto_auto]">
                <div className="min-w-0 max-md:mb-1">
                  <div className="font-medium text-foreground">{u.employee ? `${u.employee.fullName} (${u.employee.code})` : "(không gắn nhân viên)"}</div>
                  <div className="text-xs text-muted-foreground">{u.email} · đăng nhập gần nhất {u.lastLoginAt ? fmtDateTime(u.lastLoginAt) : "chưa"}</div>
                </div>
                <select name="role" defaultValue={u.role} className="input" aria-label={`Vai trò của ${u.email}`} disabled={u.id === meId}>
                  {roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input name="password" type="password" placeholder="Mật khẩu mới" className="input" aria-label="Mật khẩu mới" />
                <label className="flex items-center gap-1.5 whitespace-nowrap text-[13px]"><input type="checkbox" name="active" defaultChecked={u.active} disabled={u.id === meId} className="h-4 w-4 accent-primary disabled:cursor-not-allowed" /> Hoạt động</label>
                {u.id === meId && (
                  <>
                    <input type="hidden" name="role" value={u.role} />
                    <input type="hidden" name="active" value="on" />
                  </>
                )}
                <button className="btn btn-sm justify-self-start">Lưu</button>
              </form>
            </li>
          ))}
        </ul>
      </Card>
      <Card title="Tạo tài khoản">
        <form action={createUser} className="flex flex-col gap-3">
          <Field label="Nhân viên">
            <select name="employeeId" className="input">
              <option value="">— Không gắn —</option>
              {people.filter((p) => !linked.has(p.id)).map((p) => <option key={p.id} value={p.id}>{p.fullName} ({p.code})</option>)}
            </select>
          </Field>
          <Field label="Email đăng nhập"><input name="email" type="email" required className="input" /></Field>
          <Field label="Mật khẩu ban đầu" hint="Ít nhất 8 ký tự"><input name="password" type="text" required minLength={8} className="input" /></Field>
          <Field label="Vai trò">
            <select name="role" defaultValue="EMPLOYEE" className="input">{roles.map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          </Field>
          <button className="btn btn-primary self-start">Tạo</button>
          <div className="rounded-[4px] bg-muted p-3 text-xs leading-relaxed text-muted-foreground">
            <b className="font-medium text-foreground">Vai trò:</b> Nhân viên – việc, KPI, đánh giá của mình · Quản lý – thêm giao việc, giao KPI và xác nhận kết quả trong phạm vi (người làm trưởng phòng tự có quyền Quản lý) · HRM – Trưởng phòng HCNS, xem toàn công ty, xác nhận bảng tổng hợp, duyệt bộ KPI, import chấm công · Quản trị hệ thống – chỉ cấu hình kỹ thuật, không dùng chức năng nghiệp vụ.
          </div>
        </form>
      </Card>
    </div>
  );
}
