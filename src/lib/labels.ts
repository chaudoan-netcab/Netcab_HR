// Nhãn tiếng Việt cho các giá trị trong database + màu hiển thị
import type {
  ContractRecommendation,
  EmployeeStatus,
  EmployeeType,
  JobLevel,
  KpiFormula,
  KpiStatus,
  TaskStatus,
  ReviewStatus,
  Role,
} from "@prisma/client";

export type Tone = "gray" | "blue" | "green" | "amber" | "red" | "violet";

export const toneClass: Record<Tone, string> = {
  gray: "bg-slate-100 text-slate-700",
  blue: "bg-brand-50 text-brand-700",
  green: "bg-emerald-50 text-emerald-700",
  amber: "bg-amber-50 text-amber-700",
  red: "bg-red-50 text-red-700",
  violet: "bg-violet-50 text-violet-700",
};

export const roleLabel: Record<Role, string> = {
  ADMIN: "Quản trị hệ thống",
  HR: "HRM",
  MANAGER: "Quản lý",
  EMPLOYEE: "Nhân viên",
};

export const employeeTypeLabel: Record<EmployeeType, string> = {
  INTERN: "Thực tập sinh",
  PROBATION: "Thử việc",
  OFFICIAL: "Chính thức",
  COLLABORATOR: "Cộng tác viên",
};
export const employeeTypeTone: Record<EmployeeType, Tone> = {
  INTERN: "violet",
  PROBATION: "amber",
  OFFICIAL: "blue",
  COLLABORATOR: "gray",
};

export const employeeStatusLabel: Record<EmployeeStatus, string> = {
  ACTIVE: "Đang làm việc",
  ON_LEAVE: "Tạm nghỉ",
  RESIGNED: "Đã nghỉ việc",
};
export const employeeStatusTone: Record<EmployeeStatus, Tone> = {
  ACTIVE: "green",
  ON_LEAVE: "amber",
  RESIGNED: "gray",
};

export const jobLevelLabel: Record<JobLevel, string> = {
  STAFF: "Nhân viên – Chuyên viên",
  SUPERVISOR: "Giám sát – Trưởng nhóm trở lên",
};

/** Loại đơn tính theo giờ thay vì theo ngày */
export const kpiFormulaLabel: Record<KpiFormula, string> = {
  HIGHER_BETTER: "Càng cao càng tốt",
  LOWER_BETTER: "Càng thấp càng tốt",
  ZERO_TOLERANCE: "Chỉ tiêu 0 vụ (mỗi vụ −50%)",
  VIOLATION_STEPS: "Theo số lần vi phạm (2→70%, 3→50%, ≥4→0%)",
};

export const kpiStatusLabel: Record<KpiStatus, string> = {
  DRAFT: "Nhân viên đang cập nhật",
  SUBMITTED: "Đã báo cáo, chờ quản lý xác nhận",
  MANAGER_APPROVED: "Quản lý đã xác nhận",
  COMPLETED: "Đã khóa",
};
export const kpiStatusTone: Record<KpiStatus, Tone> = {
  DRAFT: "gray",
  SUBMITTED: "amber",
  MANAGER_APPROVED: "blue",
  COMPLETED: "green",
};

export const reviewStatusLabel: Record<ReviewStatus, string> = {
  SELF_REVIEW: "Nhân viên tự đánh giá",
  MANAGER_REVIEW: "Quản lý đánh giá",
  EMPLOYEE_ACK: "Nhân viên xác nhận",
  HOD_APPROVAL: "Trưởng bộ phận duyệt",
  COMPLETED: "Đã khóa",
};
export const reviewStatusTone: Record<ReviewStatus, Tone> = {
  SELF_REVIEW: "gray",
  MANAGER_REVIEW: "amber",
  EMPLOYEE_ACK: "violet",
  HOD_APPROVAL: "blue",
  COMPLETED: "green",
};

export const contractRecLabel: Record<ContractRecommendation, string> = {
  KEEP: "Giữ lại",
  TERMINATE: "Chấm dứt HĐ",
  OTHER: "Đề nghị khác",
};


export const taskStatusLabel: Record<TaskStatus, string> = {
  TODO: "Chưa bắt đầu",
  IN_PROGRESS: "Đang làm",
  REVIEW: "Chờ xác nhận",
  DONE: "Hoàn thành",
  CANCELLED: "Đã hủy",
};
export const taskStatusTone: Record<TaskStatus, Tone> = {
  TODO: "gray",
  IN_PROGRESS: "blue",
  REVIEW: "amber",
  DONE: "green",
  CANCELLED: "gray",
};
/** Trạng thái phiếu KPI để hiển thị: "Đã khóa" suy ra khi bảng tổng hợp của phòng được xác nhận (không lưu trong database) */
export function kpiStatusView(s: KpiStatus, locked: boolean): { label: string; tone: Tone } {
  return locked ? { label: "Đã khóa", tone: "green" } : { label: kpiStatusLabel[s], tone: kpiStatusTone[s] };
}

/** Bản cuối KPI quý của phòng (trưởng phòng gửi HR, HR không duyệt) — lưu tạm trong bộ nhớ server */
export const summaryStatusLabel = { NONE: "Chưa gửi", SENT: "Đã gửi HR", REOPENED: "Cần gửi lại" } as const;
export const summaryStatusTone: Record<keyof typeof summaryStatusLabel, Tone> = { NONE: "gray", SENT: "green", REOPENED: "violet" };
