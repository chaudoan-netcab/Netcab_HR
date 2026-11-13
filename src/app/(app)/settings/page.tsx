import { db } from "@/lib/server/db";
import { KPI_GRADES } from "@/lib/kpi";
import { GRADE_INFO, REVIEW_TEMPLATES } from "@/lib/review-templates";
import { TRACKING_THRESHOLDS } from "@/config/tracking";
import { Card, Field, Flash, PageHeader, Tabs } from "@/components/ui";
import type { Tone } from "@/lib/labels";
import { saveDepartment } from "./actions";
import { requireHRM } from "@/lib/server/access";

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ tab?: string; ok?: string; err?: string }> }) {
  await requireHRM();
  const sp = await searchParams;
  const tab = sp.tab ?? "departments";
  const people = await db.employee.findMany({ where: { status: { not: "RESIGNED" } }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, code: true } });

  return (
    <div>
      <PageHeader title="Cấu hình nghiệp vụ" description="Thiết lập nghiệp vụ dùng chung toàn công ty. Phân quyền và cấu hình kỹ thuật do Quản trị hệ thống phụ trách." />
      <Flash ok={sp.ok} err={sp.err} />
      <Tabs
        active={tab}
        tabs={[
          { key: "departments", label: "Quản lý → Phòng ban", href: "/settings?tab=departments" },
          { key: "grades", label: "Thang xếp loại", href: "/settings?tab=grades" },
          { key: "thresholds", label: "Ngưỡng “Cần chú ý”", href: "/settings?tab=thresholds" },
          { key: "competency", label: "Khung năng lực", href: "/settings?tab=competency" },
        ]}
      />

      {tab === "departments" && <Departments people={people} />}
      {tab === "grades" && <Grades />}
      {tab === "thresholds" && <Thresholds />}
      {tab === "competency" && <Competency />}
    </div>
  );
}

type People = { id: string; fullName: string; code: string }[];

/** Xếp loại là phân loại: chữ thường; chỉ tô màu khi báo cần chú ý (vàng/đỏ) */
const gradeText = (tone: Tone) => (tone === "red" ? "text-status-danger-text" : tone === "amber" ? "text-status-warning-text" : "text-foreground");

async function Departments({ people }: { people: People }) {
  const depts = await db.department.findMany({ include: { _count: { select: { employees: true } } }, orderBy: { name: "asc" } });
  const form = (d?: (typeof depts)[number]) => (
    <form action={saveDepartment.bind(null, d?.id ?? null)} className="grid gap-3 sm:grid-cols-2 sm:items-end lg:grid-cols-[6rem_1fr_1fr_1fr_auto] lg:gap-2">
      <Field label="Mã"><input name="code" defaultValue={d?.code} required className="input" /></Field>
      <Field label="Tên phòng ban"><input name="name" defaultValue={d?.name} required className="input" /></Field>
      <Field label="Trực thuộc">
        <select name="parentId" defaultValue={d?.parentId ?? ""} className="input">
          <option value="">—</option>
          {depts.filter((x) => x.id !== d?.id).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
        </select>
      </Field>
      <Field label="Trưởng phòng (Quản lý)">
        <select name="headId" defaultValue={d?.headId ?? ""} className="input">
          <option value="">—</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
        </select>
      </Field>
      <button className={d ? "btn sm:justify-self-start" : "btn btn-primary sm:justify-self-start"}>{d ? "Lưu" : "Thêm"}</button>
    </form>
  );
  return (
    <div className="flex flex-col gap-5">
      <Card title="Phòng ban hiện có">
        <div className="flex flex-col divide-y divide-border">
          {depts.map((d) => (
            <div key={d.id} className="py-4 first:pt-0 last:pb-0">
              {form(d)}
              <div className="mt-1.5 text-xs text-muted-foreground">{d._count.employees} nhân viên</div>
            </div>
          ))}
        </div>
      </Card>
      <Card title="Thêm phòng ban">{form()}</Card>
    </div>
  );
}

function ReadOnlyNote() {
  return <p className="mt-3 text-xs text-muted-foreground">Giá trị đang cố định trong cấu hình hệ thống. Cần thay đổi, liên hệ team kỹ thuật (chức năng sửa trực tiếp sẽ bổ sung sau).</p>;
}

function Grades() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="Xếp loại KPI" pad={false}>
        <table className="table">
          <thead><tr><th>Xếp loại</th><th className="text-right">% hoàn thành từ</th></tr></thead>
          <tbody>{KPI_GRADES.map((g) => <tr key={g.label}><td className={gradeText(g.tone)}>{g.label}</td><td className="text-right tabular-nums">{Math.round(g.min * 100)}%</td></tr>)}</tbody>
        </table>
      </Card>
      <Card title="Xếp loại đánh giá cuối năm" pad={false}>
        <table className="table">
          <thead><tr><th>Hạng</th><th>Tỷ lệ điểm</th></tr></thead>
          <tbody>{Object.entries(GRADE_INFO).map(([k, g]) => <tr key={k}><td className={`font-medium ${gradeText(g.tone)}`}>{k}</td><td>{g.range}</td></tr>)}</tbody>
        </table>
      </Card>
      <div className="lg:col-span-2"><ReadOnlyNote /></div>
    </div>
  );
}

function Thresholds() {
  const T = TRACKING_THRESHOLDS;
  return (
    <Card title="Ngưỡng đánh dấu “Cần chú ý” trên trang Theo dõi & nhắc việc">
      <p className="mb-3 text-[13px] text-muted-foreground">Một người được đánh dấu khi thỏa ít nhất một điều kiện trong quý đang xem:</p>
      <ul className="flex list-disc flex-col gap-1 pl-5 text-sm">
        <li>KPI quý tạm tính dưới <b className="font-medium tabular-nums">{Math.round(T.kpiBelow * 100)}%</b></li>
        <li>Từ <b className="font-medium tabular-nums">{T.overdueAtLeast}</b> việc quá hạn trở lên</li>
        <li>Bị trả lại từ <b className="font-medium tabular-nums">{T.returnedAtLeast}</b> lần trở lên trong quý</li>
      </ul>
      <ReadOnlyNote />
    </Card>
  );
}

function Competency() {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      {Object.values(REVIEW_TEMPLATES).map((t) => (
        <Card key={t.code} title={t.title}>
          <ol className="flex flex-col gap-3 text-sm">
            {t.sections.map((sec) => (
              <li key={sec.title}>
                <div className="font-medium text-foreground">{sec.title}</div>
                <ul className="mt-1 flex list-disc flex-col gap-0.5 pl-5 text-muted-foreground">{sec.criteria.map((c) => <li key={c.key}>{c.text}</li>)}</ul>
              </li>
            ))}
          </ol>
        </Card>
      ))}
      <div className="lg:col-span-2"><ReadOnlyNote /></div>
    </div>
  );
}
