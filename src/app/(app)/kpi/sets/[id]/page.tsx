import { notFound } from "next/navigation";
import { Trash2 } from "lucide-react";
import type { KpiTemplateItem } from "@prisma/client";
import { db } from "@/lib/server/db";
import { pct, toDisplay, totalWeight } from "@/lib/kpi";
import { kpiFormulaLabel } from "@/lib/labels";
import { Badge, Card, Field, Flash, PageHeader } from "@/components/ui";
import { deleteTemplateItem, saveTemplateItem, updateTemplate } from "../../actions";
import { requireEmployeeUser } from "@/lib/server/access";
import { canEditKpiSet, canViewKpiSet, kpiSetOf, loadUnits } from "@/lib/server/department-flow";

/** Bộ KPI của phòng: trưởng phòng sửa trực tiếp (không có bước duyệt); HRM chỉ xem */

export default async function KpiTemplatePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireEmployeeUser();
  const { id } = await params;
  const sp = await searchParams;
  const t = await db.kpiTemplate.findUnique({ where: { id }, include: { items: { orderBy: { sortOrder: "asc" } } } });
  if (!t) notFound();
  const { units, byId } = await loadUnits();
  const rec = kpiSetOf(t, units);
  const unit = byId.get(rec.unitId ?? "");
  if (!canViewKpiSet(user, unit)) notFound();
  const editable = canEditKpiSet(user, rec, unit);
  const w = totalWeight(t.items);
  const sections = [...new Set(t.items.map((i) => i.section))];

  return (
    <div>
      <PageHeader
        back={{ href: "/kpi/sets", label: "Bộ KPI của phòng" }}
        title={t.name}
        description={`${unit?.name ?? "Chưa gắn phòng"}${t.subtitle ? " · " + t.subtitle : ""}`}
        actions={
          <>
            {!editable && <Badge>Chỉ xem</Badge>}
            <Badge tone={Math.abs(w - 1) < 0.0001 ? "green" : "red"}>Tổng tỉ trọng {pct(w, 0)}</Badge>
          </>
        }
      />
      <Flash ok={sp.ok} err={sp.err} />

      {editable && <Card title="Thông tin bộ KPI" className="mb-5">
        <form action={updateTemplate.bind(null, t.id)} className="grid items-end gap-3 sm:grid-cols-[2fr_1fr_auto_auto]">
          <Field label="Tên mẫu"><input name="name" defaultValue={t.name} className="input" /></Field>
          <Field label="Mô tả"><input name="subtitle" defaultValue={t.subtitle ?? ""} className="input" /></Field>
          <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="active" defaultChecked={t.active} /> Đang dùng</label>
          <button className="btn">Lưu</button>
        </form>
      </Card>}

      <div className="flex flex-col gap-4">
        {sections.map((sec) => (
          <Card key={sec} title={sec} pad={false}>
            <ul className="divide-y divide-slate-100">
              {t.items.filter((i) => i.section === sec).map((i) => (
                <li key={i.id} className="px-5 py-3">
                  <details>
                    <summary className="flex cursor-pointer list-none items-start gap-3">
                      <div className="flex-1">
                        <div className="font-medium text-slate-800">{i.name}</div>
                        <div className="text-xs text-slate-500">{i.measurement}</div>
                      </div>
                      <div className="text-right text-xs text-slate-600">
                        <div>Chỉ tiêu <b>{i.unit.trim() === "%" ? pct(i.target, 0) : `${i.target} ${i.unit}`}</b> · Tỉ trọng <b>{pct(i.weight, 0)}</b></div>
                        <div className="text-slate-400">{kpiFormulaLabel[i.formula]}</div>
                      </div>
                    </summary>
                    {i.note && <p className="mt-2 text-xs text-slate-500">Ghi chú: {i.note}</p>}
                    {editable && (
                      <>
                        <ItemForm action={saveTemplateItem.bind(null, t.id, i.id)} item={i} sections={sections} />
                        <form action={deleteTemplateItem.bind(null, t.id, i.id)} className="mt-1">
                          <button className="btn btn-ghost btn-sm text-red-600"><Trash2 size={12} /> Xóa chỉ số</button>
                        </form>
                      </>
                    )}
                  </details>
                </li>
              ))}
            </ul>
          </Card>
        ))}
        {editable && (
          <Card title="Thêm chỉ số mới">
            <ItemForm action={saveTemplateItem.bind(null, t.id, null)} sections={sections} nextOrder={t.items.length} />
          </Card>
        )}
      </div>
    </div>
  );
}

function ItemForm({ action, item, sections, nextOrder = 0 }: { action: (fd: FormData) => Promise<void>; item?: KpiTemplateItem; sections: string[]; nextOrder?: number }) {
  const listId = `sections-${item?.id ?? "new"}`;
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-lg bg-slate-50 p-3 sm:grid-cols-6">
      <Field label="Nhóm KRA" className="sm:col-span-3">
        <input name="section" list={listId} defaultValue={item?.section ?? sections[sections.length - 1] ?? ""} required className="input" />
        <datalist id={listId}>{sections.map((s) => <option key={s} value={s} />)}</datalist>
      </Field>
      <Field label="Tên chỉ số KPI" className="sm:col-span-3"><input name="name" defaultValue={item?.name} required className="input" /></Field>
      <Field label="Công thức / Cách đo lường" className="sm:col-span-6"><textarea name="measurement" defaultValue={item?.measurement ?? ""} className="input min-h-14" /></Field>
      <Field label="Đơn vị"><input name="unit" defaultValue={item?.unit ?? "%"} className="input" /></Field>
      <Field label="Chỉ tiêu" hint="Đơn vị % nhập 0–100"><input name="target" defaultValue={item ? toDisplay(item.unit, item.target) : "100"} className="input" /></Field>
      <Field label="Tỉ trọng (%)"><input name="weight" type="number" step="0.5" defaultValue={item ? Math.round(item.weight * 1000) / 10 : 10} className="input" /></Field>
      <Field label="Cách tính" className="sm:col-span-2">
        <select name="formula" defaultValue={item?.formula ?? "HIGHER_BETTER"} className="input">
          {Object.entries(kpiFormulaLabel).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </Field>
      <Field label="Thứ tự"><input name="sortOrder" type="number" defaultValue={item?.sortOrder ?? nextOrder} className="input" /></Field>
      <Field label="Ghi chú (nguồn dữ liệu…)" className="sm:col-span-5"><input name="note" defaultValue={item?.note ?? ""} className="input" /></Field>
      <div className="flex items-end"><button className="btn btn-primary w-full">{item ? "Lưu" : "Thêm"}</button></div>
    </form>
  );
}
