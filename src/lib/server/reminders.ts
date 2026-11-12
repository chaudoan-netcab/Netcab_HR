"use server";
// Gửi nhắc việc. GIAI ĐOẠN NÀY CHỈ GIẢ LẬP: kiểm tra quyền rồi trả kết quả, KHÔNG gọi API ngoài, KHÔNG ghi DB.
// UI chỉ gọi hàm này, nên khi nối backend chỉ cần sửa trong file này.
import { isDeptReminder, type ReminderType } from "../tracking";
import { canTrack, isHRM, teamScope } from "./access";
import { loadUnits } from "./department-flow";
import { requireUser } from "./auth";
import { db } from "./db";

export type SendReminderInput = {
  type: ReminderType;
  messages: { recipientId: string; body: string }[];
};

export type SendReminderResult = { ok: true; accepted: number; message: string } | { ok: false; error: string };

export async function sendReminder(input: SendReminderInput): Promise<SendReminderResult> {
  const user = await requireUser();
  if (!canTrack(user)) return { ok: false, error: "Tài khoản không có quyền gửi nhắc việc" };
  if (input.messages.length === 0) return { ok: false, error: "Chưa có người nhận" };
  if (input.messages.some((m) => !m.body.trim())) return { ok: false, error: "Nội dung nhắc không được để trống" };

  const ids = [...new Set(input.messages.map((m) => m.recipientId))];
  if (isDeptReminder(input.type)) {
    // Mẫu nhắc phòng (HRM, chế độ "Toàn công ty"): người nhận phải là Trưởng phòng của một đơn vị. HRM không nhắc trực tiếp nhân viên ở chế độ này.
    if (!isHRM(user)) return { ok: false, error: "Chỉ HRM được nhắc Trưởng phòng" };
    const heads = new Set((await loadUnits()).units.map((u) => u.headId).filter(Boolean));
    if (!ids.every((id) => heads.has(id))) return { ok: false, error: "Người nhận không phải Trưởng phòng" };
  } else {
    // Mẫu nhắc nhân viên (Quản lý; HRM ở "Phòng tôi"): người nhận phải thuộc phạm vi quản lý (managerScope, trừ bản thân)
    const n = await db.employee.count({ where: { AND: [{ id: { in: ids } }, teamScope(user)] } });
    if (n !== ids.length) return { ok: false, error: "Có người nhận không thuộc phạm vi quản lý" };
  }

  // TODO(backend): gửi qua Teams (Workflows webhook) cho từng tin trong input.messages,
  // ghi lịch sử nhắc vào DB (người gửi, người nhận, loại, thời điểm, kênh "Teams", trạng thái "Đã gửi" / "Lỗi"),
  // rồi trả về số tin gửi thành công và danh sách lỗi.
  return { ok: true, accepted: input.messages.length, message: "Đã ghi nhận – tính năng gửi qua Teams sẽ được kích hoạt sau" };
}
