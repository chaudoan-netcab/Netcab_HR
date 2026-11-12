# Netcab HR & KPI

Web app nội bộ để **giao và theo dõi KPI, giao việc, đánh giá cuối năm** cho Netcab.
Next.js 16 + PostgreSQL 16 + Prisma 6.

> Giai đoạn demo: dữ liệu mẫu chỉ có **phòng Hành chính – Nhân sự (HCNS)**. Các phòng khác sẽ thêm sau.
> Tên người và email trong dữ liệu mẫu đều là giả; số liệu lấy theo cấu trúc file Excel thật của công ty.

Chi tiết kỹ thuật (bảng dữ liệu, phân quyền, công thức): [docs/thiet-ke-he-thong.md](docs/thiet-ke-he-thong.md).

## Luồng chính

**KPI (theo quý)** — không có bước HRM duyệt:

1. **Trưởng phòng** tự soạn *Bộ KPI của phòng* (KPI › Bộ KPI của phòng).
2. Trưởng phòng **giao KPI**: một người, nhiều người hoặc cả phòng cùng bộ chỉ số, hoặc bỏ bớt / thêm chỉ số riêng cho từng người. Phiếu đến thẳng nhân viên.
3. **Nhân viên** cập nhật tiến độ trên phiếu bất cứ lúc nào trong quý (“Lưu tiến độ”), được nhắc trong *Việc cần làm*; cuối quý “Gửi báo cáo cuối kỳ”.
4. **Quản lý trực tiếp** xác nhận kết quả (hoặc trả lại để nhân viên sửa).
5. Trưởng phòng **gửi bản cuối cho HR**. HR chỉ nhận, không duyệt; gửi xong các phiếu trong quý được khóa (HRM mở lại được khi cần sửa).

**KPI năm** = trung bình điểm các quý đã được xác nhận trong năm.

**Đánh giá cuối năm** (HRM): phiếu BM1-003, 2 bảng riêng — *Nhân viên – Chuyên viên* và *Giám sát – Trưởng nhóm trở lên*.
Điểm tổng hợp = KPI năm × a% + Năng lực × (100 − a)%, a mặc định 50.

**HRM theo dõi trưởng phòng** (menu *Theo dõi trưởng phòng*): KPI của từng trưởng phòng, tiến độ xác nhận phiếu của nhân viên, bộ KPI đang dùng, phòng nào đã / chưa gửi bản cuối, nút *Nhắc gửi*.

**Nhiệm vụ**: giao việc → người làm báo cáo hoàn thành → người giao xác nhận hoặc trả lại (có nhật ký trạng thái).

## Vai trò

| Vai trò | Làm được gì |
|---|---|
| Nhân viên | Nhiệm vụ của mình, cập nhật KPI, tự đánh giá cuối năm |
| Quản lý (trưởng phòng) | + Giao việc, soạn bộ KPI, giao KPI, xác nhận kết quả KPI, gửi bản cuối cho HR, chấm đánh giá |
| HRM | + Xem toàn công ty, theo dõi trưởng phòng, mở kỳ đánh giá cuối năm, import chấm công, cấu hình. HRM là cấp cao nhất (người có chức danh CEO dùng quyền HRM) |
| Admin | Chỉ quản trị tài khoản |

## Chạy trên máy

**Cần cài:** [Node.js](https://nodejs.org) 20+ và PostgreSQL 16 (cài trực tiếp hoặc Docker Desktop).

```bash
npm install
cp .env.example .env        # Windows: copy .env.example .env
npm run setup               # bật PostgreSQL (Docker) + tạo bảng + nạp dữ liệu mẫu (XÓA dữ liệu cũ)
npm run dev                 # http://localhost:3000
```

Cổng 5432 đã bị chiếm: thêm `DB_PORT=5433` vào `.env` và sửa cổng trong `DATABASE_URL`.

Tài khoản mẫu (mật khẩu chung `Netcab@123`):

| Email | Vai trò |
|---|---|
| nhung.le@netcab.vn | Trưởng phòng HCNS, kiêm HRM (cấp cao nhất) |
| trang.pham@netcab.vn | Nhân viên — HR tổng hợp |
| hung.nguyen@netcab.vn | Nhân viên — quản lý kho |
| admin@netcab.vn | Quản trị hệ thống |

## Lệnh hay dùng

| Lệnh | Làm gì |
|---|---|
| `npm run dev` | Chạy chế độ phát triển |
| `npm run typecheck` | Kiểm tra lỗi TypeScript |
| `npm run db:seed` | Nạp lại dữ liệu mẫu (**xóa dữ liệu cũ**) — khởi động lại `npm run dev` sau khi chạy |
| `npm run db:studio` | Xem / sửa dữ liệu trực tiếp |
| `npm run db:migrate -- --name ten_thay_doi` | Sau khi sửa `prisma/schema.prisma` |
| `npm run build` rồi `npm start` | Chạy bản production |

Chạy production qua http trong mạng nội bộ: thêm `INSECURE_COOKIE=1` vào `.env` và đổi `SESSION_SECRET` thành chuỗi ngẫu nhiên dài.

## Cấu trúc thư mục

```
prisma/
  schema.prisma          bảng dữ liệu
  migrations/            lệnh SQL tạo bảng
  seed.ts                dữ liệu mẫu phòng HCNS
src/
  app/
    login/               đăng nhập
    (app)/               các trang cần đăng nhập — mỗi mục: page.tsx, actions.ts (lưu dữ liệu), _components/
      page.tsx           Tổng quan
      tasks/             Nhiệm vụ
      kpi/               KPI cá nhân · plans/ phiếu KPI nhân viên · sets/ bộ KPI của phòng · summary/ bản cuối gửi HR
      reviews/           Đánh giá cuối năm (BM1-003) · cycles/ kỳ đánh giá + bảng tổng hợp
      follow-ups/        Theo dõi & nhắc việc
      heads/             HRM: theo dõi trưởng phòng
      employees/         Nhân viên
      attendance/        Import chấm công (FastWork)
      settings/          Cấu hình nghiệp vụ (phòng ban, thang điểm)
      admin/             Quản trị tài khoản
  components/            giao diện dùng chung (khung app, menu, hộp thoại, biểu đồ, ô nhập ngày…)
  config/                ngưỡng theo dõi, cấu hình chấm công, bộ KPI theo phòng
  lib/                   logic dùng được ở cả server và trình duyệt (công thức KPI, mẫu BM1-003, nhãn, ngày tháng)
    server/              chỉ chạy trên server: database, đăng nhập, phân quyền, luồng phòng ban, việc cần làm
docs/
  thiet-ke-he-thong.md   thiết kế chi tiết
```

Muốn đổi **công thức KPI** → `src/lib/kpi.ts`; **tiêu chí / xếp hạng đánh giá** → `src/lib/review-templates.ts`; **ai được xem gì** → `src/lib/server/access.ts`.

## Đang làm ở giao diện, chưa lưu database

Các phần sau lưu tạm trong bộ nhớ server (`src/lib/server/demo-store.ts`), **mất khi khởi động lại server** — đã đánh dấu `TODO(backend)` trong code:

- Trạng thái gửi bản cuối của phòng, lời nhắc trưởng phòng / nhân viên, lần cập nhật tiến độ KPI gần nhất.
- Phòng của bộ KPI tạo mới, phiếu được HRM mở lại.
- Lịch sử import chấm công (chưa đọc file thật; tháng 10/2026 dùng số liệu mẫu theo file FastWork).

## Gặp lỗi?

| Lỗi | Cách xử lý |
|---|---|
| `Can't reach database server` | PostgreSQL chưa chạy, hoặc `DATABASE_URL` sai user / mật khẩu / cổng |
| `npm run db:deploy` báo lỗi | Thử `npx prisma db push` |
| Đăng nhập xong bị đá về trang login (production) | Thêm `INSECURE_COOKIE=1` vào `.env` khi chạy qua http |
| Sửa schema xong code báo đỏ | Chạy `npx prisma generate` |
