"use client";
// Hộp thoại "Giao KPI" (trang Phiếu KPI nhân viên) và "Sửa chỉ số" (trang phiếu KPI)
import { useState } from "react";
import { ListChecks, Plus } from "lucide-react";
import { Modal, SubmitButton } from "@/components/modal";
import { PlanItemsEditor, usePlanItems, type SourceItem } from "./plan-items-editor";

type Template = { id: string; name: string; items: SourceItem[] };
type Person = { id: string; fullName: string; code: string };

export function AssignKpiDialog({
  action,
  employees,
  templates,
  defaults,
}: {
  action: (fd: FormData) => Promise<void>;
  employees: Person[];
  templates: Template[];
  defaults: { employeeId?: string; year: number; quarter: number };
}) {
  const [open, setOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id ?? "");
  const [periodType, setPeriodType] = useState<"QUARTER" | "MONTH">("QUARTER");
  const [picked, setPicked] = useState<string[]>(defaults.employeeId ? [defaults.employeeId] : []);
  const all = picked.length === employees.length && employees.length > 0;
  const toggle = (id: string) => setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const state = usePlanItems(templates[0]?.items ?? []);
  const pick = (id: string) => {
    setTemplateId(id);
    state.reset(templates.find((t) => t.id === id)?.items ?? []);
  };
  const close = () => {
    setOpen(false);
    pick(templates[0]?.id ?? "");
    setPicked(defaults.employeeId ? [defaults.employeeId] : []);
  };

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary" disabled={!templates.length} title={templates.length ? undefined : "Phòng chưa có bộ KPI"}>
        <Plus size={16} /> Giao KPI
      </button>
      {open && (
        <Modal
          title="Giao KPI cho nhân viên"
          subtitle="Giao cùng một bộ chỉ số cho cả phòng, hoặc chỉnh chỉ số riêng cho từng người. Phiếu đến thẳng nhân viên, không cần HRM duyệt."
          size="xl"
          onClose={close}
          action={action}
          footer={
            <>
              <button type="button" onClick={close} className="btn">Hủy</button>
              <SubmitButton disabled={!state.valid || picked.length === 0}>{picked.length > 1 ? `Giao KPI cho ${picked.length} người` : "Giao KPI"}</SubmitButton>
            </>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <fieldset>
              <div className="mb-1 flex items-center justify-between gap-2">
                <legend className="label mb-0">Giao cho</legend>
                <button type="button" onClick={() => setPicked(all ? [] : employees.map((e) => e.id))} className="text-xs font-medium text-brand-600 hover:underline">
                  {all ? "Bỏ chọn tất cả" : "Chọn cả phòng"}
                </button>
              </div>
              <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                {employees.map((e) => (
                  <label key={e.id} className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50">
                    <input type="checkbox" name="employeeId" value={e.id} checked={picked.includes(e.id)} onChange={() => toggle(e.id)} className="h-4 w-4 accent-brand-600" />
                    <span className="min-w-0 flex-1">{e.fullName}</span>
                    <span className="text-xs text-slate-400">{e.code}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-slate-500">{picked.length > 1 ? `${picked.length} người nhận cùng bộ chỉ số bên dưới` : "Chọn nhiều người để giao cùng một bộ chỉ số"}</p>
            </fieldset>
            <label>
              <span className="label">Bộ KPI gốc của phòng</span>
              <select name="templateId" value={templateId} onChange={(e) => pick(e.target.value)} required className="input">
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>{t.name.replace("BẢNG KPI — ", "")} ({t.items.length} chỉ số)</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-3 gap-2 sm:col-span-2 sm:max-w-md">
              <label>
                <span className="label">Theo</span>
                <select name="periodType" value={periodType} onChange={(e) => setPeriodType(e.target.value as "QUARTER" | "MONTH")} className="input">
                  <option value="QUARTER">Quý</option>
                  <option value="MONTH">Tháng</option>
                </select>
              </label>
              <label>
                <span className="label">{periodType === "QUARTER" ? "Quý" : "Tháng"}</span>
                <select key={periodType} name="period" defaultValue={periodType === "QUARTER" ? defaults.quarter : defaults.quarter * 3 - 2} className="input">
                  {Array.from({ length: periodType === "QUARTER" ? 4 : 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>{i + 1}</option>
                  ))}
                </select>
              </label>
              <label>
                <span className="label">Năm</span>
                <input name="year" type="number" defaultValue={defaults.year} className="input" />
              </label>
            </div>
          </div>

          <div className="mt-5 mb-2 flex flex-wrap items-baseline justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-800">{picked.length > 1 ? "Chỉ số đánh giá (áp dụng cho tất cả người đã chọn)" : "Chỉ số đánh giá của người này"}</h3>
            <span className="text-xs text-slate-500">Bỏ chọn chỉ số không áp dụng · sửa chỉ tiêu, tỉ trọng nếu cần</span>
          </div>
          <PlanItemsEditor state={state} />
          <p className="mt-2 text-xs text-slate-500">Chỉ số được sao chép vào phiếu. Sửa bộ KPI của phòng sau này không làm thay đổi phiếu đã giao.</p>
        </Modal>
      )}
    </>
  );
}

export function EditPlanItemsDialog({ action, items, employeeName }: { action: (fd: FormData) => Promise<void>; items: SourceItem[]; employeeName: string }) {
  const [open, setOpen] = useState(false);
  const state = usePlanItems(items);
  const close = () => {
    setOpen(false);
    state.reset(items);
  };
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn">
        <ListChecks size={16} /> Sửa chỉ số
      </button>
      {open && (
        <Modal
          title="Sửa chỉ số của phiếu"
          subtitle={`${employeeName} · Chỉ số giữ lại vẫn giữ số liệu đã cập nhật.`}
          size="xl"
          onClose={close}
          action={action}
          footer={
            <>
              <button type="button" onClick={close} className="btn">Hủy</button>
              <SubmitButton disabled={!state.valid}>Lưu chỉ số</SubmitButton>
            </>
          }
        >
          <PlanItemsEditor state={state} />
        </Modal>
      )}
    </>
  );
}
