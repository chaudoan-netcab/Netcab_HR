// Cấu hình Import chấm công FastWork.

/**
 * Tháng bắt đầu áp dụng import chấm công ("YYYY-MM"). "Tháng chưa import" chỉ tính từ tháng này đến tháng trước.
 * Mặc định "2027-01". Muốn demo sớm hơn: đặt ATTENDANCE_START_MONTH=2026-06 trong file .env rồi khởi động lại server.
 */
export const ATTENDANCE_START_MONTH = /^\d{4}-(0[1-9]|1[0-2])$/.test(process.env.ATTENDANCE_START_MONTH ?? "") ? process.env.ATTENDANCE_START_MONTH! : "2027-01";

/**
 * Các cột bắt buộc trong file "Báo cáo chấm công" xuất từ FastWork (theo file thật tháng 10/2026).
 * Dòng 2: "Thời gian xuất file: dd/mm/yyyy hh:mm" · dòng 3–4: tiêu đề 2 tầng · từ dòng 5: mỗi nhân viên 1 dòng.
 * File KHÔNG có cột Email → khớp nhân viên theo Họ tên + Phòng ban.
 */
export const ATTENDANCE_REQUIRED_COLUMNS = ["Nhân viên", "Chức danh", "Phòng ban", "Công tổng (Số giờ, Số công)", "Đi muộn", "Về sớm", "Vắng mặt", "Nghỉ không lý do", "Nghỉ (P, KL, TS…)"];
