// Cấu hình trang "Theo dõi & nhắc việc".
// Một người được đánh dấu "Cần chú ý" khi thỏa ÍT NHẤT MỘT điều kiện dưới đây (trong quý đang xem).
export const TRACKING_THRESHOLDS = {
  /** % KPI quý tạm tính dưới mức này (0–1). 0.65 = 65% */
  kpiBelow: 0.65,
  /** Số việc quá hạn từ mức này trở lên */
  overdueAtLeast: 2,
  /** Số lần bị trả lại trong quý từ mức này trở lên */
  returnedAtLeast: 2,
};

// Bảng theo phòng ban (HRM, chế độ "Toàn công ty"). Một phòng "Cần chú ý" khi thỏa ÍT NHẤT MỘT điều kiện:
// - KPI tạm tính phòng dưới deptKpiBelow
// - tỷ lệ người "Cần chú ý" trong phòng từ deptAttentionRatio trở lên
// - đã hết quý mà phòng chưa gửi bản cuối KPI
export const DEPT_TRACKING_THRESHOLDS = {
  /** KPI tạm tính phòng (trung bình các nhân viên) dưới mức này (0–1). 0.65 = 65% */
  deptKpiBelow: 0.65,
  /** Tỷ lệ người "Cần chú ý" từ mức này trở lên (0–1). 0.3 = 30% */
  deptAttentionRatio: 0.3,
};
