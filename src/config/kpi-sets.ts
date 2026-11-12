// Gắn các mẫu KPI hiện có vào phòng ban (theo mã phòng) để hiện ở "Bộ KPI của phòng".
// TODO(backend): thêm cột departmentId vào KpiTemplate rồi bỏ file này.
// Bộ KPI không có bước duyệt. Bộ tạo mới trên giao diện được gắn phòng trong bộ nhớ server.
export const KPI_SET_DEPARTMENTS: Record<string, string> = {
  "BẢNG KPI — NHÂN VIÊN NHÂN SỰ TỔNG HỢP": "HCNS",
  "BẢNG KPI — TRƯỞNG PHÒNG HÀNH CHÍNH - NHÂN SỰ": "HCNS",
  "BẢNG KPI — NHÂN VIÊN KHO": "HCNS",
  // Bộ KPI dùng chung cho trưởng các phòng: HRM quản lý
  "BẢNG KPI — TRƯỞNG PHÒNG": "HCNS",
  "BẢNG KPI — PHÒNG KẾ TOÁN": "KTOAN",
  "BẢNG KPI — PHÒNG MARKETING": "MKT",
  "BẢNG KPI — PHÒNG SALES": "SALES",
  "BẢNG KPI — PHÒNG PROJECT": "PRJ",
  "BẢNG KPI — PHÒNG IT": "IT",
  "BẢNG KPI — PHÒNG KỸ THUẬT": "KT",
};
