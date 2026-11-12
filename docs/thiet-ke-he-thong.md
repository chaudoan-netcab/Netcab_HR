# Thiết kế hệ thống — Netcab HR & KPI

> Đọc file này để hiểu app chia thành những phần nào, dữ liệu lưu ở đâu, quy trình chạy thế nào và công thức tính điểm lấy từ đâu.
> Cách chạy, tài khoản mẫu và cây thư mục: xem [README](../README.md).

## 1. Công nghệ

| Thành phần | Dùng gì | Giải thích ngắn |
|---|---|---|
| Giao diện + xử lý | **Next.js 16** (App Router, Server Actions) | 1 dự án chứa cả frontend lẫn backend. "Server Action" = hàm chạy trên server, gọi thẳng từ `<form>` |
| Ngôn ngữ | TypeScript | |
| Database | **PostgreSQL 16** | |
| ORM | **Prisma 6** (+ driver adapter `pg`) | Đọc/ghi database bằng TypeScript thay vì viết SQL tay |
| Giao diện | Tailwind CSS 4 + icon lucide-react | |
| Đăng nhập | Cookie chứa JWT (`jose`), mật khẩu mã hóa `bcrypt` | |

## 2. Nguyên tắc tổ chức code

- Mỗi mục là 1 thư mục trong `src/app/(app)/<mục>/`: `page.tsx` (trang), `actions.ts` (lưu dữ liệu, chạy trên server), `_components/` (component riêng của mục).
- `src/lib/` là logic thuần dùng được ở cả server và trình duyệt: `kpi.ts` (công thức KPI, thang xếp loại), `review-templates.ts` (mẫu BM1-003), `labels.ts` (nhãn tiếng Việt), `dates.ts`, `task-view.ts`.
- `src/lib/server/` chỉ chạy trên server: `db.ts`, `auth.ts`, `access.ts` (**phân quyền**), `department-flow.ts` (bộ KPI theo phòng, bản cuối quý, khóa phiếu), `kpi-year.ts` (KPI năm), `review-summary.ts` (bảng tổng hợp cuối năm), `tasks.ts` (quy tắc giao việc), `todos.ts` (mục "Việc cần làm"), `tracking.ts` (trang Theo dõi), `demo-store.ts` (dữ liệu tạm trong bộ nhớ).
- `src/config/`: các con số / ánh xạ HR có thể đổi mà không cần hiểu code (ngưỡng "cần chú ý", tháng bắt đầu import chấm công, bộ KPI thuộc phòng nào).

## 3. Các bảng dữ liệu đang dùng

| Bảng | Lưu gì |
|---|---|
| `User` | Tài khoản đăng nhập, vai trò (ADMIN / HR / MANAGER / EMPLOYEE), gắn với 1 nhân viên |
| `Department` | Phòng ban, phòng cha, trưởng phòng (HOD) |
| `Employee` | Hồ sơ nhân viên: mã, họ tên, liên hệ công ty, phòng ban, chức danh, cấp bậc (quyết định mẫu đánh giá), quản lý trực tiếp, ngày vào làm |
| `KpiTemplate` + `KpiTemplateItem` | Bộ KPI của phòng (KRA, chỉ số, chỉ tiêu, tỉ trọng, cách tính) |
| `KpiPlan` + `KpiPlanItem` | Phiếu KPI của 1 nhân viên cho 1 quý (hoặc tháng). Chỉ số được **sao chép** từ bộ KPI rồi có thể chỉnh riêng cho người đó |
| `ReviewCycle` | Kỳ đánh giá cuối năm + tỉ lệ KPI / năng lực |
| `Review` + `ReviewScore` | Phiếu BM1-003 của từng nhân viên và điểm từng tiêu chí |
| `Task` + `TaskComment` | Nhiệm vụ; `TaskComment` dùng làm nhật ký trạng thái (bắt đầu, báo cáo, trả lại, xác nhận, hủy) |

Các bảng của chức năng đã bỏ (`DocumentType`, `EmployeeDocument`, `Contract`, `LeaveRequest`, `Checklist*`, `FollowUp*`) và các cột thông tin cá nhân chi tiết của `Employee` **vẫn còn trong database** để không phải chạy migration. TODO(backend): xóa khi dọn schema.

## 4. Phân quyền

| Vai trò | Được làm gì |
|---|---|
| **Admin** | Chỉ quản trị tài khoản |
| **HRM** (role HR) | Xem toàn công ty; theo dõi trưởng phòng; mở lại phiếu KPI đã khóa; mở kỳ đánh giá cuối năm; import chấm công; cấu hình. HRM là cấp cao nhất — không có cấp trên, nên phiếu KPI của HRM gửi là chốt luôn và không có phiếu đánh giá năng lực. Người có chức danh CEO dùng quyền HRM |
| **Quản lý** | Nhân viên báo cáo trực tiếp + nhân viên các phòng mình làm trưởng: giao việc, soạn bộ KPI, giao KPI, xác nhận kết quả KPI, gửi bản cuối cho HR, chấm đánh giá |
| **Nhân viên** | Dữ liệu của mình: nhiệm vụ, cập nhật KPI, tự đánh giá |

## 5. Quy trình

**Bộ KPI của phòng:** trưởng phòng tự soạn, **không cần HRM duyệt** — soạn xong là dùng được. HRM xem được bộ KPI của mọi phòng.

**Phiếu KPI quý:**
`Trưởng phòng giao (1 người / nhiều người / cả phòng, có thể chỉnh chỉ số riêng) → Nhân viên cập nhật tiến độ bất cứ lúc nào → Cuối quý gửi báo cáo → Quản lý trực tiếp xác nhận (hoặc trả lại)`.
Nhân viên được nhắc trong "Việc cần làm" (hạn = cuối quý); quản lý có nút "Nhắc cập nhật".

**Bản cuối quý của phòng:** khi mọi phiếu trong quý đã được xác nhận, trưởng phòng **gửi bản cuối cho HR**. HR chỉ nhận, không duyệt / trả lại. Gửi xong các phiếu trong quý hiển thị "Đã khóa". HRM mở lại 1 phiếu → bản cuối chuyển "Cần gửi lại" → trưởng phòng xác nhận lại rồi gửi lại. HRM có nút "Nhắc gửi" ở trang *Theo dõi trưởng phòng*.

**KPI năm:** trung bình điểm các phiếu quý đã được xác nhận trong năm (`src/lib/server/kpi-year.ts`).

**Đánh giá cuối năm BM1-003:** `Nhân viên tự đánh giá → Người đánh giá chấm → Nhân viên xem & ghi ý kiến → HOD duyệt → Hoàn tất`. 2 mẫu theo cấp bậc: Nhân viên – Chuyên viên (20 tiêu chí) và Giám sát trở lên (24 tiêu chí).
Bảng tổng hợp: `Tổng hợp = KPI năm × a% + Năng lực × (100 − a)%`, a mặc định 50, đổi ở trang kỳ đánh giá; tách tab *Đánh giá nhân viên* / *Đánh giá quản lý*; xuất CSV.

**Giao việc:** `Người giao tạo nhiệm vụ → Người làm bắt đầu → Báo cáo hoàn thành → Người giao xác nhận hoặc trả lại (bắt buộc lý do)`.

**Import chấm công:** HRM import file FastWork từng tháng; file xuất trước cuối tháng bị chặn. (Đang làm giao diện, chưa đọc file thật.)

## 6. Công thức — lấy đúng từ file Excel

### KPI (`src/lib/kpi.ts`, file "20261027 Netcab KPI HR và kho.xlsx")

| Kiểu | Công thức Excel | Ví dụ |
|---|---|---|
| Càng cao càng tốt | `=H*MIN(1,F/E)` | Độ chính xác tồn kho |
| Càng thấp càng tốt | `=IF(F="",0,IF(F=0,H,H*MIN(1,E/F)))` | Tỷ lệ nghỉ việc, chi phí tuyển dụng |
| Chỉ tiêu 0 vụ | `=IF(F=0,H,MAX(0,H-F*(H*0.5)))` | Vi phạm pháp luật lao động |
| Theo số lần vi phạm | `=H*IF(F<=1,1,IF(F=2,0.7,IF(F=3,0.5,0)))` | Thất thoát vật tư, vi phạm nội quy |

(E = chỉ tiêu, F = mức độ thực hiện, H = tỉ trọng.) Tổng = cộng cột "% hoàn thành".
**Xếp loại:** ≥90% Hoàn thành tốt · 80–<90% Hoàn thành · 60–<80% Cần cải thiện · 50–<60% Trung bình · <50% Không hoàn thành.

### Đánh giá BM1-003 (`src/lib/review-templates.ts`, file "Bảng đánh giá cuối năm - NC.xlsx")

- Mỗi tiêu chí 0–10 điểm. Nhân viên–Chuyên viên: 20 tiêu chí (tối đa 200). Giám sát trở lên: 24 tiêu chí (tối đa 240).
- Tỷ lệ đạt được = Tổng điểm ÷ Điểm tối đa × 100 **+ điểm Phần B (1/3/5)**.
- Xếp hạng theo ô `K31`: A > 90% · B > 80–90% · C > 70–80% · D 50–70% · E < 50%.
- Bảng tổng hợp theo phòng ban (sheet "result list"): trang **Kỳ đánh giá → chi tiết**, có đếm số người và % từng hạng, xuất CSV mở bằng Excel.

## 7. ⚠ Những điểm cần HR xác nhận

1. **Tỷ trọng (50%, 15%, 10%…) trong mẫu BM1-003 chưa được dùng trong công thức Excel.** Công thức `=SUM(D9:H30)/200` cộng thẳng điểm. App đang làm **giống công thức Excel**; muốn tính theo tỷ trọng thì sửa `computeReview` trong `src/lib/review-templates.ts`.
2. **Điểm cộng Phần B**: ghi chú nói "cộng thẳng vào Tỷ lệ đạt được" nhưng công thức Excel không cộng. App **có cộng** (theo ghi chú).
3. **Ranh giới hạng B**: chữ ghi "81% ≤ B ≤ 90%", công thức ghi "> 80%". App theo công thức.
4. **Tỷ lệ KPI / năng lực** trong điểm tổng hợp cuối năm đang để 50/50.
5. **Bảng đánh giá cuối năm** của nhân viên và quản lý (chỉ số perform + chuyên cần): chờ HRM gửi cấu trúc. Chuyên cần (file FastWork) chưa được tính vào điểm.
6. **Có cần thêm bảng đánh giá quý** (nhân viên tự đánh giá → trưởng phòng) ngoài phiếu KPI hay không; khi trưởng phòng sửa kết quả có cần ghi lý do và báo nhân viên không — chưa quyết.

## 8. Hướng phát triển tiếp

- Lưu vào database các phần đang ở bộ nhớ tạm (`demo-store.ts`); đọc file chấm công thật.
- Gửi thông báo qua email / Teams (nhắc cập nhật KPI, nhắc gửi bản cuối, nhiệm vụ quá hạn).
- Thêm dữ liệu các phòng ban khác.
- Đăng nhập SSO — đã tách riêng `src/lib/server/auth.ts` để thay dễ.
