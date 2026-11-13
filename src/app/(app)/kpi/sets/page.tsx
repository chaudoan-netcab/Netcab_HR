import Link from "next/link";
import { kpiTabs } from "@/lib/nav";
import { capsOf, isHRM, isManager, requireCapability } from "@/lib/server/access";
import { loadKpiSets, unitsHeadedBy } from "@/lib/server/department-flow";
import { pct } from "@/lib/kpi";
import { db } from "@/lib/server/db";
import { Badge, Card, EmptyState, Field, Flash, PageHeader, Tabs } from "@/components/ui";
import { createTemplate } from "../actions";

/**
 * Bộ KPI của phòng — trưởng phòng tự soạn, không cần HRM duyệt: soạn xong là dùng được để giao KPI
 * (giao cùng bộ cho cả phòng, hoặc chỉnh chỉ số riêng cho từng người khi giao).
 * HRM xem bộ KPI của mọi phòng (chỉ xem).
 */
export default async function KpiSetsPage({ searchParams }: { searchParams: Promise<{ ok?: string; err?: string }> }) {
  const user = await requireCapability((u) => isManager(u) || isHRM(u));
  const sp = await searchParams;
  const { units, sets } = await loadKpiSets();
  const mine = unitsHeadedBy(units, user);
  const shown = isHRM(user) ? units : mine;
  const weights = new Map((await db.kpiTemplateItem.groupBy({ by: ["templateId"], _sum: { weight: true } })).map((g) => [g.templateId, g._sum.weight ?? 0]));

  return (
    <div>
      <PageHeader
        title="Bộ KPI của phòng"
        description="Trưởng phòng tự soạn bộ chỉ số KPI cho phòng mình. Không cần duyệt: soạn xong là dùng được để giao KPI cho nhân viên."
      />
      <Tabs tabs={kpiTabs(capsOf(user))} active="sets" />
      <Flash ok={sp.ok} err={sp.err} />

      {shown.length === 0 ? (
        <Card>
          <EmptyState title="Bạn chưa làm trưởng phòng ban nào" hint="Bộ KPI được soạn theo phòng. HRM cập nhật trưởng phòng tại Cấu hình nghiệp vụ › Phòng ban." />
        </Card>
      ) : (
        <div className={`grid gap-5 ${mine.length ? "lg:grid-cols-3" : ""}`}>
          <div className={`flex flex-col gap-5 ${mine.length ? "lg:col-span-2" : ""}`}>
            {shown.map((u) => {
              const list = sets.filter((x) => x.rec.unitId === u.id);
              const own = mine.some((m) => m.id === u.id);
              return (
                <Card
                  key={u.id}
                  title={u.name}
                  pad={false}
                  actions={<span className="text-xs text-muted-foreground">Trưởng phòng: {u.headName ?? "chưa có"}{own && " (bạn)"}</span>}
                >
                  {list.length === 0 ? (
                    <EmptyState title="Phòng chưa có bộ KPI" hint={own ? "Tạo bộ KPI mới ở khung bên cạnh." : undefined} />
                  ) : (
                    <ul className="divide-y divide-border">
                      {list.map(({ template }) => {
                        const w = weights.get(template.id) ?? 0;
                        return (
                          <li key={template.id} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 max-md:px-3">
                            <div className="min-w-0">
                              <Link href={`/kpi/sets/${template.id}`} className="font-medium">{template.name}</Link>
                              <div className="text-xs text-muted-foreground tabular-nums">
                                {template._count.items} chỉ số · tổng tỉ trọng {pct(w, 0)} · đã giao {template._count.plans} phiếu
                              </div>
                            </div>
                            <div className="flex gap-2">
                              {!template.active && <Badge>Ngưng dùng</Badge>}
                              {Math.abs(w - 1) > 0.0001 && <Badge tone="amber">Tỉ trọng chưa đủ 100%</Badge>}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </Card>
              );
            })}
          </div>
          {mine.length > 0 && (
            <Card title="Tạo bộ KPI mới">
              <form action={createTemplate} className="flex flex-col gap-3">
                <Field label="Phòng">
                  <select name="unitId" className="input" required>
                    {mine.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                  </select>
                </Field>
                <Field label="Tên bộ KPI">
                  <input name="name" required className="input" placeholder="BẢNG KPI — NHÂN VIÊN KỸ THUẬT" />
                </Field>
                <Field label="Mô tả ngắn">
                  <input name="subtitle" className="input" placeholder="(Phòng Kỹ thuật)" />
                </Field>
                <Field label="Sao chép chỉ số từ bộ có sẵn (không bắt buộc)">
                  <select name="copyFrom" className="input">
                    <option value="">— Bộ trống —</option>
                    {sets.map(({ template }) => (
                      <option key={template.id} value={template.id}>{template.name}</option>
                    ))}
                  </select>
                </Field>
                <button className="btn btn-primary">Tạo bộ KPI</button>
              </form>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
