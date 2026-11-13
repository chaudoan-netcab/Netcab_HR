import type { Department, Employee } from "@prisma/client";
import { toInputDate } from "@/lib/dates";
import { employeeStatusLabel, employeeTypeLabel, jobLevelLabel } from "@/lib/labels";
import type { ReactNode } from "react";
import { Card } from "@/components/ui";
import { DateInput } from "@/components/date-input";

type Props = {
  action: (fd: FormData) => Promise<void>;
  employee?: Employee | null;
  departments: Department[];
  people: Pick<Employee, "id" | "fullName" | "code">[];
  submitLabel: string;
};

/** Ô có nhãn trên (như Field ở ui.tsx), dấu * của trường bắt buộc tô màu đỏ */
function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const required = label.endsWith(" *");
  return (
    <label className="block min-w-0">
      <span className="label">
        {required ? label.slice(0, -2) : label}
        {required && <span className="text-status-danger-text"> *</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted-foreground">{hint}</span>}
    </label>
  );
}

export function EmployeeForm({ action, employee: e, departments, people, submitLabel }: Props) {
  const T = (name: keyof Employee, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <Field label={label}>
      <input name={name} defaultValue={(e?.[name] as string | number | null) ?? ""} className="input" {...props} />
    </Field>
  );
  const DT = (name: keyof Employee, label: string, required = false) => (
    <Field label={label}>
      <DateInput name={name} defaultValue={toInputDate(e?.[name] as Date | null)} required={required} />
    </Field>
  );
  const others = people.filter((p) => p.id !== e?.id);
  return (
    <form action={action} className="flex flex-col gap-4 sm:gap-5">
      <Card title="Thông tin nhân viên">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {T("code", "Mã nhân viên (MSNV) *", { required: true, placeholder: "VD: NC013" })}
          {T("fullName", "Họ và tên *", { required: true })}
          {T("workEmail", "Email công ty", { type: "email" })}
          {T("phone", "Số điện thoại")}
        </div>
      </Card>

      <Card title="Công việc">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field label="Loại nhân sự *">
            <select name="employeeType" defaultValue={e?.employeeType ?? "PROBATION"} className="input">
              {Object.entries(employeeTypeLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Trạng thái">
            <select name="status" defaultValue={e?.status ?? "ACTIVE"} className="input">
              {Object.entries(employeeStatusLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Phòng ban">
            <select name="departmentId" defaultValue={e?.departmentId ?? ""} className="input">
              <option value="">—</option>
              {departments.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
          </Field>
          {T("position", "Chức danh")}
          <Field label="Cấp bậc" hint="Quyết định mẫu phiếu đánh giá cuối năm">
            <select name="jobLevel" defaultValue={e?.jobLevel ?? "STAFF"} className="input">
              {Object.entries(jobLevelLabel).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Quản lý trực tiếp">
            <select name="managerId" defaultValue={e?.managerId ?? ""} className="input">
              <option value="">—</option>
              {others.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName} ({p.code})
                </option>
              ))}
            </select>
          </Field>
          {T("workLocation", "Nơi làm việc")}
          {DT("joinDate", "Ngày vào làm")}
          {DT("officialDate", "Ngày lên chính thức")}
          {DT("leaveDate", "Ngày nghỉ việc")}
        </div>
      </Card>

      <div className="action-bar">
        <button className="btn btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
