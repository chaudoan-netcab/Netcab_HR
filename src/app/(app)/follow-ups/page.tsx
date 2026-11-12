import { db } from "@/lib/server/db";
import { companyView, isHRM, requireTracker, teamScope } from "@/lib/server/access";
import { ViewToggle } from "@/components/flow-ui";
import { currentQuarter, loadDeptTracking, loadTracking } from "@/lib/server/tracking";
import { AutoFilterForm } from "./_components/auto-filter";
import { REMINDER_SAMPLES } from "@/lib/reminder-samples";
import { isDeptReminder, REMINDER_LABEL, REMINDER_STATUS_LABEL, REMINDER_STATUS_TONE } from "@/lib/tracking";
import { fmtDateTime } from "@/lib/dates";
import { Badge, Card, EmptyState, Flash, PageHeader, Tabs } from "@/components/ui";
import { TrackingBoard } from "./_components/tracking-board";
import { DeptBoard } from "./_components/dept-board";

type SP = { view?: string; tab?: string; yq?: string; status?: string; ok?: string; err?: string };
type User = Awaited<ReturnType<typeof requireTracker>>;

/** Bộ lọc trạng thái — bảng theo nhân viên (Quản lý; HRM "Phòng tôi") */
const PERSON_FILTERS: Record<string, string> = {
  "": "Tất cả",
  attention: "Chỉ người cần chú ý",
  kpi: "Chưa cập nhật KPI",
  overdue: "Có việc quá hạn",
};
/** Bộ lọc trạng thái — bảng theo phòng ban (HRM "Toàn công ty") */
const DEPT_FILTERS: Record<string, string> = {
  "": "Tất cả",
  attention: "Phòng cần chú ý",
  nosummary: "Chưa gửi bản cuối",
  kpi: "Có người chưa cập nhật KPI",
};

/**
 * Theo dõi & nhắc việc — Quản lý và HRM (nhân viên bị chuyển về Tổng quan, Admin về Quản trị hệ thống).
 * - Quản lý, HRM "Phòng tôi": bảng theo nhân viên, nhắc trực tiếp nhân viên.
 * - HRM "Toàn công ty": bảng theo phòng ban, nhắc Trưởng phòng (không nhắc trực tiếp nhân viên).
 */
export default async function TrackingPage({ searchParams }: { searchParams: Promise<SP> }) {
  const user = await requireTracker();
  const sp = await searchParams;
  const company = companyView(user, sp.view);
  // ?tab=plans (tab "Kế hoạch cải tiến" đã bỏ) và mọi giá trị khác → Bảng theo dõi
  const tab = sp.tab === "history" ? "history" : "board";
  const v = isHRM(user) && !company ? "view=mine" : "";
  const withView = (href: string) => (v ? href + (href.includes("?") ? "&" : "?") + v : href);

  return (
    <div>
      <PageHeader
        title="Theo dõi & nhắc việc"
        description={company ? "Toàn công ty · theo phòng ban" : "Nhân viên thuộc phạm vi quản lý"}
        actions={isHRM(user) && <ViewToggle company={company} hrefMine={`/follow-ups?view=mine${tab === "board" ? "" : `&tab=${tab}`}`} hrefCompany={`/follow-ups${tab === "board" ? "" : `?tab=${tab}`}`} />}
      />
      <Tabs
        active={tab}
        tabs={[
          { key: "board", label: "Bảng theo dõi", href: withView("/follow-ups") },
          { key: "history", label: "Lịch sử nhắc", href: withView("/follow-ups?tab=history") },
        ]}
      />
      <Flash ok={sp.ok} err={sp.err} />
      {tab === "board" && (company ? <DeptSection user={user} sp={sp} /> : <PersonSection user={user} sp={sp} />)}
      {tab === "history" && <History user={user} company={company} />}
    </div>
  );
}

/** Quý đang xem (?yq=YYYY-Q) + danh sách quý để chọn: 4 quý năm nay + 4 quý năm trước */
function pickQuarter(yq?: string) {
  const cur = currentQuarter();
  const [yy, qq] = (yq ?? "").split("-");
  const year = Number(yy) || cur.year;
  const quarter = Math.min(4, Math.max(1, Number(qq) || cur.quarter));
  const quarters = [cur.year, cur.year - 1].flatMap((y) => [4, 3, 2, 1].filter((q) => y < cur.year || q <= cur.quarter).map((q) => ({ y, q })));
  return { cur, year, quarter, quarters, label: `Quý ${quarter}/${year}` };
}

function Filters({ q, status, filters, hidden, clear }: { q: ReturnType<typeof pickQuarter>; status: string; filters: Record<string, string>; hidden?: Record<string, string>; clear: string | null }) {
  return (
    <AutoFilterForm className="card mb-4 flex flex-wrap items-end gap-3 p-4">
      {Object.entries(hidden ?? {}).map(([k, val]) => <input key={k} type="hidden" name={k} value={val} />)}
      <label className="w-48">
        <span className="label">Quý</span>
        <select name="yq" defaultValue={`${q.year}-${q.quarter}`} className="input">
          {q.quarters.map(({ y, q: qq }) => (
            <option key={`${y}-${qq}`} value={`${y}-${qq}`}>
              Quý {qq}/{y}
              {y === q.cur.year && qq === q.cur.quarter ? " (hiện tại)" : ""}
            </option>
          ))}
        </select>
      </label>
      <label className="w-60">
        <span className="label">Trạng thái</span>
        <select name="status" defaultValue={status} className="input">
          {Object.entries(filters).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </select>
      </label>
      {clear && (
        <a href={clear} className="btn btn-ghost">
          Xóa bộ lọc
        </a>
      )}
    </AutoFilterForm>
  );
}

/** HRM "Toàn công ty": bảng theo phòng ban */
async function DeptSection({ user, sp }: { user: User; sp: SP }) {
  const q = pickQuarter(sp.yq);
  const status = sp.status && DEPT_FILTERS[sp.status] ? sp.status : "";
  const { rows: all } = await loadDeptTracking(user, q.year, q.quarter);
  const rows = all.filter((r) => (status === "attention" ? r.reasons.length > 0 : status === "nosummary" ? r.summary === "NONE" : status === "kpi" ? r.notUpdated > 0 : true));
  const query = `?yq=${q.year}-${q.quarter}`;
  return (
    <>
      <Filters q={q} status={status} filters={DEPT_FILTERS} clear={status ? `/follow-ups${query}` : null} />
      <DeptBoard
        rows={rows}
        quarterLabel={q.label}
        sender={user.employee?.fullName ?? "HRM"}
        query={query}
        emptyKind={rows.length > 0 ? null : all.length === 0 ? "none" : "filtered"}
        clearHref={`/follow-ups${query}`}
      />
    </>
  );
}

/** Quản lý, HRM "Phòng tôi": bảng theo nhân viên, nhắc trực tiếp */
async function PersonSection({ user, sp }: { user: User; sp: SP }) {
  const q = pickQuarter(sp.yq);
  const status = sp.status && PERSON_FILTERS[sp.status] ? sp.status : "";
  const all = await loadTracking(user, { year: q.year, quarter: q.quarter, company: false });
  const rows = all.filter((r) => (status === "attention" ? r.reasons.length > 0 : status === "kpi" ? r.kpi.total > 0 && r.kpi.updated < r.kpi.total : status === "overdue" ? r.overdue > 0 : true));
  const mine = isHRM(user);
  const query = `?yq=${q.year}-${q.quarter}${mine ? "&view=mine" : ""}`;
  return (
    <>
      <Filters q={q} status={status} filters={PERSON_FILTERS} hidden={mine ? { view: "mine" } : undefined} clear={status ? `/follow-ups${query}` : null} />
      <TrackingBoard
        rows={rows}
        admin={false}
        quarterLabel={q.label}
        sender={user.employee?.fullName ?? "Quản lý"}
        query={query}
        emptyKind={rows.length > 0 ? null : all.length === 0 ? "none" : "filtered"}
        clearHref={`/follow-ups${query}`}
      />
    </>
  );
}

async function History({ user, company }: { user: User; company: boolean }) {
  // HRM "Toàn công ty": các lần HRM nhắc Trưởng phòng.
  // Quản lý, HRM "Phòng tôi": tin nhắc nhân viên do mình gửi hoặc gửi tới nhân viên thuộc phạm vi quản lý.
  const myCodes = company ? null : new Set((await db.employee.findMany({ where: teamScope(user), select: { code: true } })).map((e) => e.code));
  const logs = REMINDER_SAMPLES.filter((r) => (company ? isDeptReminder(r.type) : !isDeptReminder(r.type) && (r.senderEmail === user.email || myCodes!.has(r.recipientCode)))).sort((a, b) => b.at.localeCompare(a.at));
  return (
    <Card pad={false} title={company ? "Lịch sử nhắc Trưởng phòng" : "Lịch sử nhắc"}>
      {logs.length === 0 ? (
        <EmptyState title="Chưa có lịch sử nhắc" />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Thời điểm</th>
                <th>Người gửi</th>
                <th>{company ? "Trưởng phòng nhận" : "Người nhận"}</th>
                <th>Loại nhắc</th>
                <th>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap tabular-nums">{fmtDateTime(new Date(r.at))}</td>
                  <td>{r.senderName}</td>
                  <td>{r.recipientName}</td>
                  <td>{REMINDER_LABEL[r.type].replace(" (gửi Trưởng phòng)", "")}</td>
                  <td>
                    <Badge tone={REMINDER_STATUS_TONE[r.status]}>{REMINDER_STATUS_LABEL[r.status]}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
