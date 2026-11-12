// Kho lưu tạm TRONG BỘ NHỚ SERVER cho các chức năng giai đoạn chỉ làm UI:
// bản cuối KPI quý của phòng (trưởng phòng gửi HR), phòng của bộ KPI, import chấm công, phiếu KPI được HRM mở lại,
// tiến độ / lời nhắc KPI.
// KHÔNG ghi gì vào database. Dữ liệu mất khi khởi động lại server.
// TODO(backend): thay toàn bộ file này bằng bảng trong database (DepartmentSummary, KpiTemplate.departmentId/status,
//                AttendanceImport, cờ mở lại trên KpiPlan).
import "server-only";

export type LogEntry = { at: string; by: string; action: string; note?: string | null };

/**
 * Bản cuối KPI quý của phòng: trưởng phòng gửi HR (HR chỉ nhận, không duyệt).
 * SENT = đã gửi; REOPENED = "Cần gửi lại" (HRM mở lại ít nhất 1 phiếu của quý).
 * Đã gửi → các phiếu KPI trong quý của phòng khóa (trừ phiếu HRM mở lại).
 */
export type SummaryStatus = "SENT" | "REOPENED";
export type SummaryRecord = {
  unitId: string;
  year: number;
  quarter: number;
  status: SummaryStatus;
  senderEmployeeId: string;
  senderName: string;
  sentAt: string;
  log: LogEntry[];
};

/** Bộ KPI thuộc phòng nào (bộ KPI không có bước duyệt: trưởng phòng soạn là dùng được) */
export type KpiSetRecord = { templateId: string; unitId: string | null };

export type AttendanceImport = {
  id: string;
  month: string; // YYYY-MM
  fileName: string;
  importedBy: string;
  importedAt: string;
  reason: string | null; // bắt buộc khi import lại tháng đã khóa
  rows: number;
  sample?: boolean;
};

type Store = {
  summaries: Map<string, SummaryRecord>;
  kpiSets: Map<string, KpiSetRecord>;
  /** Phiếu KPI đã khóa (do bảng tổng hợp được xác nhận) mà HRM mở lại */
  reopenedPlans: Set<string>;
  attendance: AttendanceImport[];
  /** Đã nạp SUMMARY_SAMPLES (cần ID phòng thật nên nạp lần đầu loadUnits() chạy) */
  summariesHydrated: boolean;
  /** Lần cập nhật tiến độ KPI gần nhất theo phiếu. TODO(backend): cột KpiPlan.progressUpdatedAt / progressUpdatedBy */
  kpiProgress: Map<string, { at: string; by: string }>;
  /** Quản lý nhắc nhân viên cập nhật tiến độ KPI. TODO(backend): bảng thông báo (Notification) */
  kpiReminders: Map<string, { at: string; by: string }>;
  /** HR nhắc trưởng phòng gửi bản cuối KPI quý — khóa summaryKey(unitId, year, quarter) */
  headReminders: Map<string, { at: string; by: string }>;
};

// TODO(backend): lịch sử import mẫu — thay bằng bảng AttendanceImport
const ATTENDANCE_SAMPLES: AttendanceImport[] = [
  { id: "s1", month: "2026-07", fileName: "Netcab 07 2026 Bang cong.xlsx", importedBy: "Lê Thị Hồng Nhung", importedAt: "2026-08-03T02:15:00.000Z", reason: null, rows: 4, sample: true },
  { id: "s2", month: "2026-08", fileName: "Netcab 08 2026 Bang cong.xlsx", importedBy: "Lê Thị Hồng Nhung", importedAt: "2026-09-02T03:40:00.000Z", reason: null, rows: 4, sample: true },
  {
    id: "s3",
    month: "2026-08",
    fileName: "Netcab 08 2026 Bang cong (xuat lai).xlsx",
    importedBy: "Lê Thị Hồng Nhung",
    importedAt: "2026-09-05T08:05:00.000Z",
    reason: "Bổ sung 1 ngày công tác của nhân viên quản lý kho bị thiếu ở file đầu",
    rows: 4,
    sample: true,
  },
  { id: "s4", month: "2026-09", fileName: "Netcab 09 2026 Bang cong.xlsx", importedBy: "Lê Thị Hồng Nhung", importedAt: "2026-10-02T01:50:00.000Z", reason: null, rows: 4, sample: true },
];

/** Một dòng bảng công FastWork (các cột tổng hợp, không gồm cột từng ngày) */
export type AttendanceFileRow = {
  title: string; // Chức danh trong file
  hours: number; // Công tổng — Số giờ
  days: number; // Công tổng — Số công
  lateCount: number;
  lateMinutes: number;
  earlyCount: number;
  earlyMinutes: number;
  absentCount: number; // Vắng mặt — Số lần
  unexcused: number; // Nghỉ không lý do — Số công
  leave: number; // Nghỉ phép (P) — Số công
};

/**
 * Bảng công FastWork THẬT tháng 10/2026 ("Netcab 10 2026 Bang cong.xlsx"): chỉ lấy 3 vị trí phòng HCNS,
 * gắn vào nhân sự tên giả theo MSNV (NC002 Trưởng phòng HCNS · NC003 HR tổng hợp · NC004 Nhân viên quản lý kho).
 * File gốc: 55 dòng nhân sự, xuất lúc 29/10/2026 10:59 (dòng 2), KHÔNG có cột Email.
 * TODO(backend): đọc trực tiếp file thay cho mẫu này.
 */
export const ATTENDANCE_FILE_SAMPLE = {
  month: "2026-10",
  fileName: "Netcab 10 2026 Bang cong.xlsx",
  exportedAt: "2026-10-29T03:59:00.000Z", // 10:59 giờ Việt Nam
  fileRows: 55,
  rows: {
    NC002: { title: "Trưởng Phòng HCNS", hours: 143.35, days: 17.9, lateCount: 20, lateMinutes: 565, earlyCount: 1, earlyMinutes: 194, absentCount: 0, unexcused: 0, leave: 0 },
    NC003: { title: "HR tổng hợp", hours: 153.17, days: 19.15, lateCount: 20, lateMinutes: 822, earlyCount: 1, earlyMinutes: 45, absentCount: 0, unexcused: 0, leave: 0.5 },
    NC004: { title: "Nhân viên quản lý kho", hours: 142.51, days: 17.83, lateCount: 11, lateMinutes: 570, earlyCount: 0, earlyMinutes: 0, absentCount: 0, unexcused: 0, leave: 0 },
  } as Record<string, AttendanceFileRow>,
};

/**
 * Bản cuối KPI quý 3/2026 mẫu (đã gửi HR), theo MÃ phòng (khớp prisma/seed.ts). Nạp vào store lần đầu loadUnits() chạy,
 * khi đã biết ID phòng. Giai đoạn demo chỉ có phòng HCNS.
 * TODO(backend): thay bằng bảng DepartmentSummary.
 */
export const SUMMARY_SAMPLES: { deptCode: string; year: number; quarter: number; sentAt: string }[] = [
  { deptCode: "HCNS", year: 2026, quarter: 3, sentAt: "2026-10-09T02:00:00.000Z" },
];

const g = globalThis as unknown as { __netcabDemoStore?: Store };
export const demo: Store = (g.__netcabDemoStore ??= {
  summaries: new Map(),
  kpiSets: new Map(),
  reopenedPlans: new Set(),
  attendance: [...ATTENDANCE_SAMPLES],
  summariesHydrated: false,
  kpiProgress: new Map(),
  kpiReminders: new Map(),
  headReminders: new Map(),
});
// Store tạo trước khi thêm trường mới (dev server chạy lâu) → bổ sung
demo.kpiProgress ??= new Map();
demo.kpiReminders ??= new Map();
demo.headReminders ??= new Map();

export const summaryKey = (unitId: string, year: number, quarter: number) => `${unitId}:${year}-${quarter}`;
export const nowIso = () => new Date().toISOString();
