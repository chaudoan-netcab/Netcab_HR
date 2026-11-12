/* Dữ liệu mẫu để chạy thử. Chạy: npm run db:seed (sẽ XÓA dữ liệu cũ!)
 * Giai đoạn demo: CHỈ phòng HCNS (3 người, số liệu từ 3 file thật của phòng). HRM (Trưởng phòng HCNS) là cấp cao nhất:
 * không có cấp trên, không có vai trò CEO riêng (người mang chức danh CEO, nếu tạo tài khoản, dùng quyền HRM).
 * Các phòng khác sẽ tạo sau. Tên người, email là GIẢ ĐỊNH. */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { PrismaClient, type KpiFormula, type ReviewStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { planScore, kpiGrade } from "../src/lib/kpi";
import { computeReview, criteriaOf } from "../src/lib/review-templates";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }) });
const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

// ───────── Mẫu KPI lấy từ file "20261027 Netcab KPI HR và kho.xlsx" ─────────
type TItem = [section: string, name: string, measurement: string, unit: string, target: number, weight: number, formula: KpiFormula, note?: string];
const KPI_TEMPLATES: { name: string; subtitle: string; items: TItem[] }[] = [
  {
    name: "BẢNG KPI — NHÂN VIÊN NHÂN SỰ TỔNG HỢP",
    subtitle: "(HR Generalist — Phòng HR & Admin)",
    items: [
      ["A. KRA 1 — HIỆU QUẢ CUNG ỨNG & HỘI NHẬP NHÂN SỰ", "Chất lượng nhân sự tuyển dụng", "Nhân sự mới đáp ứng yêu cầu công việc và vượt qua kỳ đánh giá thử việc.", "%", 1, 0.15, "HIGHER_BETTER", "Kỳ không phát sinh vị trí tuyển: ghi nhận 100%."],
      ["A. KRA 1 — HIỆU QUẢ CUNG ỨNG & HỘI NHẬP NHÂN SỰ", "Hiệu quả đào tạo hội nhập", "Nhân sự mới được đào tạo hướng dẫn hội nhập.", "%", 1, 0.1, "HIGHER_BETTER", "Nguồn: bảng dữ liệu thông tin nhân sự đã ký, hợp đồng thử việc đã ký và các thủ tục hội nhập khác. Kỳ không có nhân sự mới: ghi nhận 100%."],
      ["B. KRA 2 — ĐỘ CHÍNH XÁC & ĐÚNG HẠN CỦA C&B (CHẤM CÔNG, TIỀN LƯƠNG, BHXH, THUẾ)", "Độ chính xác tính lương & đãi ngộ", "CBNV được chi trả lương đúng, không phải điều chỉnh, truy lĩnh, truy thu sau khi chi trả.", "%", 1, 0.1, "HIGHER_BETTER", "Nguồn: bảng lương, phiếu điều chỉnh lương, phản hồi của CBNV."],
      ["B. KRA 2 — ĐỘ CHÍNH XÁC & ĐÚNG HẠN CỦA C&B (CHẤM CÔNG, TIỀN LƯƠNG, BHXH, THUẾ)", "Tiến độ chi trả lương & phúc lợi", "Chốt công, tính lương và trình duyệt đúng hạn để chi trả lương đúng ngày quy định.", "%", 1, 0.05, "HIGHER_BETTER", "Nguồn: lịch chốt công – trả lương; hồ sơ trình duyệt."],
      ["B. KRA 2 — ĐỘ CHÍNH XÁC & ĐÚNG HẠN CỦA C&B (CHẤM CÔNG, TIỀN LƯƠNG, BHXH, THUẾ)", "Nghĩa vụ BHXH, Thuế hoàn thành đúng hạn và đúng quy định", "Hồ sơ, báo cáo BHXH, Thuế TNCN hoàn thành chính xác, đúng hạn, không phát sinh chi phí phạt.", "%", 1, 0.1, "HIGHER_BETTER", "Nguồn: hồ sơ kê khai, chứng từ nộp, thông báo của cơ quan BHXH/Thuế."],
      ["C. KRA 3 — CHẤT LƯỢNG DỊCH VỤ NỘI BỘ & TUÂN THỦ", "Tiến độ & chất lượng công việc/báo cáo", "Công việc, báo cáo định kỳ/đột xuất hoàn thành đúng hạn và đạt tiêu chuẩn chất lượng yêu cầu.", "%", 1, 0.2, "HIGHER_BETTER", "Nguồn: kế hoạch công việc do Quản lý trực tiếp giao; xác nhận của người giao việc."],
      ["C. KRA 3 — CHẤT LƯỢNG DỊCH VỤ NỘI BỘ & TUÂN THỦ", "Hỗ trợ CBNV giải quyết các công việc khác liên quan vấn đề nhân sự", "Yêu cầu/sự vụ của CBNV được giải quyết thỏa đáng/hợp lý.", "%", 1, 0.15, "HIGHER_BETTER"],
      ["C. KRA 3 — CHẤT LƯỢNG DỊCH VỤ NỘI BỘ & TUÂN THỦ", "Đảm bảo nhân sự tuân thủ giờ giấc, tác phong, văn hóa doanh nghiệp, Nội quy công ty", "Bộ máy nội bộ vận hành ổn định. CBNV tuân thủ quy định giờ giấc, tác phong và không vi phạm nội quy, kỷ luật lao động.", "%", 1, 0.15, "HIGHER_BETTER"],
    ],
  },
  {
    name: "BẢNG KPI — TRƯỞNG PHÒNG HÀNH CHÍNH - NHÂN SỰ",
    subtitle: "(HR & Admin Manager)",
    items: [
      ["A. KRA 1 — HIỆU QUẢ TUYỂN DỤNG & GIỮ CHÂN NHÂN SỰ", "Hoàn thành kế hoạch tuyển dụng", "Đảm bảo nguồn nhân lực đáp ứng đúng tiến độ vận hành của các phòng ban mà vẫn duy trì chất lượng đầu vào ổn định (tỷ lệ qua thử việc).", "%", 1, 0.15, "HIGHER_BETTER", "Nguồn: kế hoạch tuyển dụng được duyệt; ngày nhận việc thực tế."],
      ["A. KRA 1 — HIỆU QUẢ TUYỂN DỤNG & GIỮ CHÂN NHÂN SỰ", "Chất lượng nhân sự sau thử việc", "Phối hợp với Quản lý trực tiếp thẩm định năng lực và tiêu chí tuyển dụng, đảm bảo tỷ lệ ứng viên vượt qua thử việc đạt yêu cầu chuyên môn của bộ phận.", "%", 1, 0.1, "HIGHER_BETTER", "Nguồn: biên bản đánh giá thử việc."],
      ["A. KRA 1 — HIỆU QUẢ TUYỂN DỤNG & GIỮ CHÂN NHÂN SỰ", "Quản trị tỷ lệ nghỉ việc", "Kiểm soát biến động nhân sự nằm trong ngưỡng cho phép. Chủ động phát hiện rủi ro nghỉ việc và đề xuất giải pháp giữ chân.", "%", 0.1, 0.1, "LOWER_BETTER", "Nguồn: danh sách nghỉ việc, báo cáo nhân sự."],
      ["B. KRA 2 — HIỆU QUẢ CHI PHÍ & VẬN HÀNH NHÂN SỰ", "Tối ưu ngân sách tuyển dụng", "Tối ưu hóa chi phí tuyển dụng, đảm bảo tuyệt đối không vượt ngân sách được phê duyệt.", "%", 1, 0.1, "LOWER_BETTER"],
      ["B. KRA 2 — HIỆU QUẢ CHI PHÍ & VẬN HÀNH NHÂN SỰ", "Tính toàn vẹn của hệ thống quy chế, chính sách", "Hệ thống văn bản (Nội quy, Thang bảng lương, Thỏa ước/CoC...) luôn đầy đủ, còn hiệu lực pháp lý và cập nhật kịp thời theo luật định.", "%", 1, 0.1, "HIGHER_BETTER", "Nguồn: danh mục văn bản nội bộ; rà soát theo quy định pháp luật hiện hành."],
      ["B. KRA 2 — HIỆU QUẢ CHI PHÍ & VẬN HÀNH NHÂN SỰ", "Hiệu quả vận hành & Đánh giá hệ thống KPI toàn Công ty", "Đảm bảo các phòng ban thực thi và đánh giá KPI đúng tiến độ, minh bạch; chủ động giám sát, đôn đốc và nâng cao hiệu suất toàn hệ thống.", "%", 1, 0.1, "HIGHER_BETTER"],
      ["C. KRA 3 — GẮN KẾT NHÂN VIÊN & TUÂN THỦ PHÁP LUẬT", "Chất lượng gắn kết & giải quyết vướng mắc nội bộ", "Xây dựng môi trường làm việc hài hòa, các ý kiến/thắc mắc của CBNV được ghi nhận và xử lý dứt điểm nhanh chóng, đúng thẩm quyền.", "%", 0.85, 0.1, "HIGHER_BETTER", "Nguồn: kết quả khảo sát hài lòng/gắn kết nội bộ. Chỉ tiêu 85% là mức đề xuất."],
      ["C. KRA 3 — GẮN KẾT NHÂN VIÊN & TUÂN THỦ PHÁP LUẬT", "Tuân thủ pháp luật lao động tuyệt đối", "Số vụ vi phạm pháp luật lao động hoặc khiếu nại, tranh chấp lao động phải xử lý qua cơ quan nhà nước phát sinh trong kỳ (chỉ tiêu: 0 vụ).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: 100% · 1 vụ: 50% · 2 vụ trở lên: 0%"],
      ["C. KRA 3 — GẮN KẾT NHÂN VIÊN & TUÂN THỦ PHÁP LUẬT", "Triển khai hoàn thành đào tạo nội bộ", "Lập kế hoạch, phối hợp với Quản lý chuyên môn tổ chức các chương trình đào tạo bắt buộc (CoC, ATVSLĐ, nội quy...) cho toàn công ty.", "%", 1, 0.1, "HIGHER_BETTER", "Nguồn: danh sách tham dự, kết quả kiểm tra sau đào tạo."],
    ],
  },
  {
    name: "BẢNG KPI — NHÂN VIÊN KHO",
    subtitle: "(Trực thuộc Phòng HR & Admin)",
    items: [
      ["A. CHÍNH XÁC & KIỂM SOÁT TỒN KHO", "Độ chính xác tồn kho khi kiểm kê", "Đảm bảo số liệu tồn kho thực tế khớp đúng với sổ sách/phần mềm; không phát sinh thất thoát, chênh lệch hay hư hỏng hàng hóa ngoài quy định.", "%", 1, 0.2, "HIGHER_BETTER", "Nguồn: biên bản kiểm kê."],
      ["A. CHÍNH XÁC & KIỂM SOÁT TỒN KHO", "Tỷ lệ thất thoát/hao hụt vật tư", "Kiểm soát hao hụt, thất thoát vật tư trong định mức; đánh giá theo số lần phát sinh biên bản xử lý thất thoát tài sản trong kỳ.", "vụ", 0, 0.15, "VIOLATION_STEPS", "Lần 01: Cảnh cáo, không ghi nhận · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
      ["B. TIẾN ĐỘ PHỤC VỤ DỰ ÁN, TUÂN THỦ QUY TRÌNH & CẬP NHẬT DỮ LIỆU", "Yêu cầu xuất kho được đáp ứng đúng hạn", "Toàn bộ phiếu xuất kho phục vụ dự án được xử lý và bàn giao đúng tiến độ cam kết, không làm gián đoạn công việc các bộ phận.", "%", 1, 0.2, "HIGHER_BETTER"],
      ["B. TIẾN ĐỘ PHỤC VỤ DỰ ÁN, TUÂN THỦ QUY TRÌNH & CẬP NHẬT DỮ LIỆU", "Tuân thủ quy trình nhập, xuất kho & an toàn kho", "Vận hành xuất - nhập kho đúng quy trình, đảm bảo an toàn PCCC và bảo quản hàng hóa; đánh giá theo số lần phát sinh biên bản vi phạm.", "vụ", 0, 0.15, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
      ["B. TIẾN ĐỘ PHỤC VỤ DỰ ÁN, TUÂN THỦ QUY TRÌNH & CẬP NHẬT DỮ LIỆU", "Cập nhật dữ liệu kho trên hệ thống", "Dữ liệu kho (nhập, xuất, tồn) trên phần mềm luôn chính xác, kịp thời, không dồn ứ quá 2 ngày sau khi có phát sinh.", "%", 1, 0.1, "HIGHER_BETTER"],
      ["C. TUÂN THỦ NỘI QUY & QUY ĐỊNH CÔNG TY", "Hoàn thành đúng hạn công việc/báo cáo được giao", "Toàn bộ nhiệm vụ phát sinh, công việc định kỳ và báo cáo theo phân công được hoàn thành đúng thời hạn, đạt yêu cầu chất lượng.", "%", 1, 0.1, "HIGHER_BETTER"],
      ["C. TUÂN THỦ NỘI QUY & QUY ĐỊNH CÔNG TY", "Tuân thủ nội quy, giờ giấc và tác phong làm việc", "Chấp hành nội quy, giờ giấc và văn hóa doanh nghiệp; đánh giá theo số lần vi phạm từ dữ liệu chấm công hoặc biên bản của phòng HCNS.", "vụ", 0, 0.1, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
    ],
  },
  // ───────── Bộ KPI chung của từng phòng (giả định) — mỗi bộ dùng đủ 4 kiểu tính ─────────
  {
    name: "BẢNG KPI — PHÒNG KẾ TOÁN",
    subtitle: "(Phòng Kế toán)",
    items: [
      ["A. BÁO CÁO & CHỨNG TỪ", "Báo cáo tài chính, thuế nộp đúng hạn", "Báo cáo tài chính, tờ khai thuế nộp đúng hạn trên tổng số phải nộp trong kỳ.", "%", 1, 0.25, "HIGHER_BETTER", "Nguồn: lịch nộp báo cáo, xác nhận của cơ quan thuế."],
      ["A. BÁO CÁO & CHỨNG TỪ", "Sai sót chứng từ phải điều chỉnh", "Số lần phát hiện chứng từ sai phải lập lại hoặc điều chỉnh sau khi đã hạch toán.", "vụ", 0, 0.15, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
      ["B. CÔNG NỢ & TUÂN THỦ", "Số ngày đối chiếu công nợ trễ hạn", "Số ngày trễ trung bình khi đối chiếu công nợ với khách hàng, nhà cung cấp.", "ngày", 2, 0.15, "LOWER_BETTER"],
      ["B. CÔNG NỢ & TUÂN THỦ", "Vi phạm bị cơ quan thuế xử phạt", "Số quyết định xử phạt vi phạm hành chính về thuế phát sinh trong kỳ (chỉ tiêu: 0 vụ).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: đạt · có vụ: không đạt (mỗi vụ trừ 50%)"],
      ["C. TIẾN ĐỘ & NỘI QUY", "Hoàn thành công việc đúng hạn", "Nhiệm vụ hoàn thành đúng hạn trên tổng nhiệm vụ đến hạn trong kỳ.", "%", 1, 0.2, "HIGHER_BETTER"],
      ["C. TIẾN ĐỘ & NỘI QUY", "Tuân thủ nội quy, giờ giấc", "Số lần vi phạm nội quy, giờ giấc theo dữ liệu chấm công hoặc biên bản của phòng HCNS.", "vụ", 0, 0.1, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
    ],
  },
  {
    name: "BẢNG KPI — PHÒNG MARKETING",
    subtitle: "(Phòng Marketing)",
    items: [
      ["A. HIỆU QUẢ TẠO NHU CẦU", "Số lead đủ chuẩn chuyển cho Sales", "Số khách hàng tiềm năng đạt tiêu chí, được Sales xác nhận tiếp nhận.", "lead", 40, 0.3, "HIGHER_BETTER", "Nguồn: CRM."],
      ["A. HIỆU QUẢ TẠO NHU CẦU", "Chi phí trên mỗi lead", "Tổng chi phí chiến dịch chia cho số lead đủ chuẩn.", "triệu đồng", 0.5, 0.2, "LOWER_BETTER"],
      ["B. TIẾN ĐỘ & CHẤT LƯỢNG", "Hoàn thành công việc đúng hạn", "Nhiệm vụ hoàn thành đúng hạn trên tổng nhiệm vụ đến hạn trong kỳ.", "%", 1, 0.2, "HIGHER_BETTER"],
      ["B. TIẾN ĐỘ & CHẤT LƯỢNG", "Nội dung sai thông tin / thương hiệu phải gỡ", "Số nội dung đã đăng phải gỡ do sai thông tin hoặc sai nhận diện thương hiệu (chỉ tiêu: 0).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: đạt · có vụ: không đạt (mỗi vụ trừ 50%)"],
      ["C. NỘI QUY", "Tuân thủ nội quy, giờ giấc", "Số lần vi phạm nội quy, giờ giấc trong kỳ.", "vụ", 0, 0.15, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
    ],
  },
  {
    name: "BẢNG KPI — PHÒNG SALES",
    subtitle: "(Phòng Sales)",
    items: [
      ["A. DOANH SỐ & KHÁCH HÀNG", "Doanh số ký mới so với chỉ tiêu", "Giá trị hợp đồng ký mới trong kỳ so với chỉ tiêu được giao.", "%", 1, 0.3, "HIGHER_BETTER", "Nguồn: CRM, hợp đồng đã ký."],
      ["A. DOANH SỐ & KHÁCH HÀNG", "Khách hàng mới", "Số khách hàng mới ký hợp đồng đầu tiên trong kỳ.", "KH", 3, 0.15, "HIGHER_BETTER"],
      ["B. THU HỒI CÔNG NỢ", "Số ngày quá hạn thu hồi công nợ bình quân", "Số ngày quá hạn bình quân của các khoản phải thu do mình phụ trách.", "ngày", 15, 0.15, "LOWER_BETTER", "Nguồn: báo cáo công nợ phòng Kế toán."],
      ["C. TIẾN ĐỘ & TUÂN THỦ", "Hoàn thành công việc đúng hạn", "Nhiệm vụ hoàn thành đúng hạn trên tổng nhiệm vụ đến hạn trong kỳ.", "%", 1, 0.15, "HIGHER_BETTER"],
      ["C. TIẾN ĐỘ & TUÂN THỦ", "Hợp đồng sai điều khoản phải ký lại", "Số hợp đồng phải ký lại do sai điều khoản thương mại (chỉ tiêu: 0).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: đạt · có vụ: không đạt (mỗi vụ trừ 50%)"],
      ["C. TIẾN ĐỘ & TUÂN THỦ", "Tuân thủ quy trình báo giá, cập nhật CRM", "Số lần vi phạm quy trình báo giá hoặc không cập nhật CRM.", "vụ", 0, 0.1, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
    ],
  },
  {
    name: "BẢNG KPI — PHÒNG PROJECT",
    subtitle: "(Phòng Project)",
    items: [
      ["A. TIẾN ĐỘ & CHI PHÍ DỰ ÁN", "Hạng mục dự án đúng tiến độ", "Số hạng mục hoàn thành đúng mốc kế hoạch trên tổng hạng mục đến hạn.", "%", 1, 0.25, "HIGHER_BETTER"],
      ["A. TIẾN ĐỘ & CHI PHÍ DỰ ÁN", "Chi phí vượt ngân sách dự án", "Phần trăm chi phí thực tế vượt ngân sách được duyệt.", "%", 0.05, 0.15, "LOWER_BETTER"],
      ["B. CHẤT LƯỢNG & AN TOÀN", "Sự cố mất an toàn lao động tại công trường", "Số sự cố mất an toàn lao động phát sinh tại công trường (chỉ tiêu: 0).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: đạt · có vụ: không đạt (mỗi vụ trừ 50%)"],
      ["B. CHẤT LƯỢNG & AN TOÀN", "Biên bản nhắc nhở của chủ đầu tư", "Số biên bản nhắc nhở về chất lượng, tiến độ do chủ đầu tư lập.", "vụ", 0, 0.15, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
      ["C. TIẾN ĐỘ CÔNG VIỆC", "Hoàn thành công việc đúng hạn", "Nhiệm vụ hoàn thành đúng hạn trên tổng nhiệm vụ đến hạn trong kỳ.", "%", 1, 0.2, "HIGHER_BETTER"],
      ["C. TIẾN ĐỘ CÔNG VIỆC", "Hồ sơ nghiệm thu đầy đủ", "Hồ sơ nghiệm thu, hoàn công đầy đủ khi bàn giao.", "%", 1, 0.1, "HIGHER_BETTER"],
    ],
  },
  {
    name: "BẢNG KPI — PHÒNG IT",
    subtitle: "(Phòng IT)",
    items: [
      ["A. VẬN HÀNH HỆ THỐNG", "Thời gian khắc phục sự cố trung bình", "Thời gian trung bình từ khi nhận sự cố đến khi khắc phục xong.", "giờ", 4, 0.2, "LOWER_BETTER"],
      ["A. VẬN HÀNH HỆ THỐNG", "Uptime hệ thống nội bộ", "Thời gian hoạt động của máy chủ, mạng nội bộ trên tổng thời gian.", "%", 0.995, 0.2, "HIGHER_BETTER"],
      ["A. VẬN HÀNH HỆ THỐNG", "Yêu cầu hỗ trợ xử lý trong SLA", "Số yêu cầu hỗ trợ xử lý trong thời hạn cam kết trên tổng yêu cầu.", "%", 0.95, 0.15, "HIGHER_BETTER"],
      ["B. AN TOÀN THÔNG TIN", "Sự cố mất dữ liệu / lộ thông tin", "Số sự cố mất dữ liệu hoặc lộ thông tin nội bộ (chỉ tiêu: 0).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: đạt · có vụ: không đạt (mỗi vụ trừ 50%)"],
      ["B. AN TOÀN THÔNG TIN", "Vi phạm quy trình sao lưu, phân quyền", "Số lần không sao lưu đúng lịch hoặc cấp quyền sai quy trình.", "vụ", 0, 0.1, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
      ["C. TIẾN ĐỘ CÔNG VIỆC", "Hoàn thành công việc đúng hạn", "Nhiệm vụ hoàn thành đúng hạn trên tổng nhiệm vụ đến hạn trong kỳ.", "%", 1, 0.2, "HIGHER_BETTER"],
    ],
  },
  {
    name: "BẢNG KPI — PHÒNG KỸ THUẬT",
    subtitle: "(Phòng Kỹ thuật)",
    items: [
      ["A. CHẤT LƯỢNG THI CÔNG & KỸ THUẬT", "Công trình nghiệm thu đạt ngay lần đầu", "Hạng mục thi công / cấu hình được nghiệm thu đạt, không phải làm lại.", "%", 1, 0.25, "HIGHER_BETTER"],
      ["A. CHẤT LƯỢNG THI CÔNG & KỸ THUẬT", "Sự cố phải xử lý lại do lỗi kỹ thuật", "Số sự cố phát sinh do lỗi thi công, cấu hình (chỉ tiêu: 0).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: đạt · có vụ: không đạt (mỗi vụ trừ 50%)"],
      ["B. TIẾN ĐỘ & PHỐI HỢP", "Hoàn thành công việc đúng hạn", "Nhiệm vụ hoàn thành đúng hạn trên tổng nhiệm vụ đến hạn trong kỳ.", "%", 1, 0.2, "HIGHER_BETTER"],
      ["B. TIẾN ĐỘ & PHỐI HỢP", "Thời gian phản hồi yêu cầu hỗ trợ", "Thời gian trung bình từ khi nhận yêu cầu đến khi phản hồi.", "giờ", 4, 0.15, "LOWER_BETTER"],
      ["C. TUÂN THỦ & PHÁT TRIỂN", "Vi phạm quy định an toàn lao động", "Số lần vi phạm quy định an toàn khi thi công tại công trình.", "vụ", 0, 0.15, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
      ["C. TUÂN THỦ & PHÁT TRIỂN", "Hoàn thành khóa đào tạo kỹ thuật", "Tham gia và hoàn thành khóa đào tạo theo kế hoạch.", "%", 1, 0.1, "HIGHER_BETTER"],
    ],
  },
  {
    name: "BẢNG KPI — TRƯỞNG PHÒNG",
    subtitle: "(Dùng chung cho trưởng các phòng)",
    items: [
      ["A. HIỆU QUẢ PHÒNG", "KPI bình quân của nhân viên trong phòng", "Trung bình % hoàn thành KPI của nhân viên trong phòng.", "%", 0.85, 0.25, "HIGHER_BETTER"],
      ["A. HIỆU QUẢ PHÒNG", "Hoàn thành công việc đúng hạn", "Nhiệm vụ do Ban điều hành giao hoàn thành đúng hạn trên tổng nhiệm vụ đến hạn.", "%", 1, 0.2, "HIGHER_BETTER"],
      ["B. QUẢN TRỊ NHÂN SỰ", "Số ngày gửi bảng tổng hợp KPI trễ hạn", "Số ngày trễ so với hạn gửi bảng tổng hợp KPI quý cho HRM.", "ngày", 1, 0.15, "LOWER_BETTER"],
      ["B. QUẢN TRỊ NHÂN SỰ", "Tỷ lệ nghỉ việc của phòng", "Số nhân viên nghỉ việc trên tổng nhân sự bình quân của phòng.", "%", 0.1, 0.1, "LOWER_BETTER"],
      ["C. TUÂN THỦ", "Khiếu nại, tranh chấp lao động của phòng", "Số khiếu nại / tranh chấp lao động phải xử lý qua cơ quan nhà nước (chỉ tiêu: 0).", "vụ", 0, 0.15, "ZERO_TOLERANCE", "0 vụ: đạt · có vụ: không đạt (mỗi vụ trừ 50%)"],
      ["C. TUÂN THỦ", "Nhân viên trong phòng vi phạm nội quy", "Số lần nhân viên trong phòng bị lập biên bản vi phạm nội quy.", "vụ", 0, 0.15, "VIOLATION_STEPS", "Lần 01: Cảnh cáo · Lần 02: 70% · Lần 03: 50% · Từ lần 04: 0%"],
    ],
  },
];

/** Chỉ số mẫu KPI theo tên (khớp KPI_TEMPLATES và src/config/kpi-sets.ts) */
const T = {
  HR_STAFF: "BẢNG KPI — NHÂN VIÊN NHÂN SỰ TỔNG HỢP",
  HR_HEAD: "BẢNG KPI — TRƯỞNG PHÒNG HÀNH CHÍNH - NHÂN SỰ",
  KHO: "BẢNG KPI — NHÂN VIÊN KHO",
  KTOAN: "BẢNG KPI — PHÒNG KẾ TOÁN",
  MKT: "BẢNG KPI — PHÒNG MARKETING",
  SALES: "BẢNG KPI — PHÒNG SALES",
  PRJ: "BẢNG KPI — PHÒNG PROJECT",
  IT: "BẢNG KPI — PHÒNG IT",
  KT: "BẢNG KPI — PHÒNG KỸ THUẬT",
  HEAD: "BẢNG KPI — TRƯỞNG PHÒNG",
} as const;

/**
 * Sinh "Mức độ thực hiện" theo mức đạt q (0–1): q cao → số liệu tốt.
 * filled = số chỉ số đầu tiên đã nhập (còn lại để trống), null = nhập đủ.
 */
function actualsFor(items: TItem[], q: number, filled: number | null = null): (number | null)[] {
  return items.map(([, , , unit, target, , formula], i) => {
    if (filled !== null && i >= filled) return null;
    const r = (v: number) => (unit.trim() === "%" ? Math.round(v * 1000) / 1000 : Math.round(v * 10) / 10);
    switch (formula) {
      case "HIGHER_BETTER":
        return r(target * Math.min(1, q + (i % 2 ? 0.03 : -0.02)));
      case "LOWER_BETTER":
        return r(q >= 0.95 ? target * 0.8 : target / Math.max(0.2, q));
      case "ZERO_TOLERANCE":
        return q >= 0.75 ? 0 : 1;
      case "VIOLATION_STEPS":
        return q >= 0.85 ? 0 : q >= 0.7 ? 1 : q >= 0.55 ? 2 : 3;
    }
  });
}

async function main() {
  // Xóa dữ liệu cũ (thứ tự con → cha)
  await db.$transaction([
    db.taskComment.deleteMany(), db.task.deleteMany(), db.followUpNote.deleteMany(), db.followUp.deleteMany(), db.reviewScore.deleteMany(), db.review.deleteMany(),
    db.reviewCycle.deleteMany(), db.kpiPlanItem.deleteMany(), db.kpiPlan.deleteMany(), db.kpiTemplateItem.deleteMany(),
    db.kpiTemplate.deleteMany(), db.checklistTask.deleteMany(), db.checklist.deleteMany(), db.checklistTemplateTask.deleteMany(),
    db.checklistTemplate.deleteMany(), db.leaveRequest.deleteMany(), db.contract.deleteMany(), db.employeeDocument.deleteMany(),
    db.documentType.deleteMany(), db.user.deleteMany(), db.department.updateMany({ data: { headId: null } }),
    db.employee.updateMany({ data: { managerId: null, mentorId: null } }), db.employee.deleteMany(), db.department.deleteMany(),
  ]);

  // ───────── Phòng ban: giai đoạn demo chỉ có HCNS (các phòng khác tạo sau) ─────────
  const dept = async (code: string, name: string, parentId?: string) => (await db.department.create({ data: { code, name, parentId } })).id;
  const HCNS = await dept("HCNS", "Phòng HR & Admin");

  // ───────── Nhân sự (tên, email giả định) ─────────
  type E = Parameters<typeof db.employee.create>[0]["data"];
  const emp = async (data: E) => (await db.employee.create({ data })).id;
  const base = (code: string, fullName: string, gender: "MALE" | "FEMALE", email: string, join: string) => ({ code, fullName, gender, workEmail: email, joinDate: D(join), officialDate: D(join) });
  const head = (code: string, name: string, g: "MALE" | "FEMALE", email: string, departmentId: string, position: string, join: string) =>
    emp({ ...base(code, name, g, email, join), departmentId, position, jobLevel: "SUPERVISOR" }); // không có quản lý trực tiếp
  const nhung = await head("NC002", "Lê Thị Hồng Nhung", "FEMALE", "nhung.le@netcab.vn", HCNS, "Trưởng phòng HCNS", "2016-08-01");
  const staff = (code: string, name: string, g: "MALE" | "FEMALE", email: string, departmentId: string, managerId: string, position: string, join: string, extra: Partial<E> = {}) =>
    emp({ ...base(code, name, g, email, join), departmentId, managerId, position, jobLevel: "STAFF", employeeType: "OFFICIAL", ...extra } as E);
  const trang = await staff("NC003", "Phạm Thu Trang", "FEMALE", "trang.pham@netcab.vn", HCNS, nhung, "HR tổng hợp", "2021-03-15");
  const hung = await staff("NC004", "Nguyễn Văn Hùng", "MALE", "hung.nguyen@netcab.vn", HCNS, nhung, "Nhân viên quản lý kho", "2019-02-11");

  await db.department.update({ where: { id: HCNS }, data: { headId: nhung } });

  // ───────── Tài khoản (mật khẩu chung: Netcab@123) ─────────
  const hash = await bcrypt.hash("Netcab@123", 10);
  const user = async (email: string, role: "ADMIN" | "HR" | "MANAGER" | "EMPLOYEE", employeeId?: string) =>
    (await db.user.create({ data: { email, role, employeeId, passwordHash: hash } })).id;
  await user("admin@netcab.vn", "ADMIN");
  const U: Record<string, string> = {};
  U.nhung = await user("nhung.le@netcab.vn", "HR", nhung);
  for (const [email, id] of [
    ["trang.pham@netcab.vn", trang], ["hung.nguyen@netcab.vn", hung],
  ] as const) U[email.split(".")[0]] = await user(email, "EMPLOYEE", id);

  // ───────── Bộ KPI + phiếu KPI ─────────
  const tplId: Record<string, string> = {};
  const ACTIVE_TEMPLATES = [T.HR_STAFF, T.HR_HEAD, T.KHO] as string[]; // giai đoạn demo: chỉ HCNS
  for (const t of KPI_TEMPLATES.filter((x) => ACTIVE_TEMPLATES.includes(x.name))) {
    tplId[t.name] = (
      await db.kpiTemplate.create({
        data: { name: t.name, subtitle: t.subtitle, items: { create: t.items.map(([section, name, measurement, unit, target, weight, formula, note], i) => ({ section, name, measurement, unit, target, weight, formula, note, sortOrder: i })) } },
      })
    ).id;
  }
  type PlanStatus = "DRAFT" | "SUBMITTED" | "MANAGER_APPROVED" | "COMPLETED";
  /** Phiếu KPI theo quý. q = mức đạt (0–1); filled = số chỉ số đã nhập (null = đủ) */
  const plan = async (employeeId: string, tName: string, quarter: number, q: number | null, filled: number | null, status: PlanStatus, createdBy: string) => {
    const t = KPI_TEMPLATES.find((x) => x.name === tName)!;
    const acts = q === null ? t.items.map(() => null) : actualsFor(t.items, q, filled);
    const items = t.items.map(([section, name, measurement, unit, target, weight, formula, note], i) => ({ section, name, measurement, unit, target, weight, formula, note, sortOrder: i, actual: acts[i] }));
    const score = planScore(items);
    const done = status !== "DRAFT";
    const end = D(`2026-${String(quarter * 3).padStart(2, "0")}-28`);
    await db.kpiPlan.create({
      data: {
        employeeId, templateId: tplId[tName], title: t.name, subtitle: t.subtitle, periodType: "QUARTER", year: 2026, period: quarter, status,
        evaluationDate: done ? end : null, score, grade: done ? kpiGrade(score)!.label : null,
        employeeSignedAt: done ? end : null,
        managerSignedAt: status === "MANAGER_APPROVED" || status === "COMPLETED" ? end : null,
        hrSignedAt: status === "COMPLETED" ? end : null,
        createdById: createdBy,
        items: { create: items },
      },
    });
  };
  // [nhân viên, bộ KPI, người giao (tài khoản quản lý trực tiếp)]
  const people: [string, string, string][] = [
    [nhung, T.HR_HEAD, U.nhung], [trang, T.HR_STAFF, U.nhung], [hung, T.KHO, U.nhung],
  ];
  const tplOf = new Map(people.map(([id, t]) => [id, t]));
  const byOf = new Map(people.map(([id, , by]) => [id, by]));

  // Quý 1–2/2026 (đã khóa)
  for (const [quarter, qs] of [[1, [0.9, 0.93, 0.86]], [2, [0.92, 0.95, 0.89]]] as const)
    for (const [i, id] of [nhung, trang, hung].entries()) await plan(id, tplOf.get(id)!, quarter, qs[i], null, "COMPLETED", byOf.get(id)!);

  // Quý 3/2026: quản lý đã xác nhận; phòng HCNS đã gửi bản cuối quý 3 cho HR (src/lib/server/demo-store.ts) → phiếu khóa.
  const q3: [string, number][] = [[nhung, 0.92], [trang, 0.95], [hung, 0.84]];
  for (const [id, q] of q3) await plan(id, tplOf.get(id)!, 3, q, null, "MANAGER_APPROVED", byOf.get(id)!);

  // Quý 4/2026 (đang diễn ra): nhập dở ở nhiều mức
  const q4: [string, number | null, number | null, PlanStatus][] = [[nhung, 0.9, 5, "DRAFT"], [trang, 0.95, 6, "DRAFT"], [hung, 0.85, 4, "DRAFT"]];
  for (const [id, q, filled, status] of q4) await plan(id, tplOf.get(id)!, 4, q, filled, status, byOf.get(id)!);

  // ───────── Nhiệm vụ quý 4/2026 (hôm nay ~ 11/11/2026) ─────────
  const at = (iso: string) => new Date(iso);
  const task = (data: Parameters<typeof db.task.create>[0]["data"]) => db.task.create({ data });
  // ───────── Phòng HCNS — kịch bản demo đầy đủ (nhật ký đúng câu chữ mà tasks/actions.ts ghi) ─────────
  // Số liệu dựa trên 3 file thật của phòng (KPI HR & kho, bảng công FastWork 10/2026, BM1-003); tên người là giả.
  // Đủ mọi trạng thái để demo vai Quản lý (Nhung) và Nhân viên (Trang, Hùng):
  //   chờ Nhung xác nhận ×2 · bị trả lại ×1 · trễ hạn ×2 · sắp đến hạn ×2 · đã xác nhận (có lần trả lại trước đó) · đã hủy.
  const L = (by: string, iso: string, content: string) => ({ authorId: by, content, createdAt: at(iso) });
  const hcns = (data: Parameters<typeof db.task.create>[0]["data"], log: ReturnType<typeof L>[] = []) =>
    db.task.create({ data: { ...data, comments: log.length ? { create: log } : undefined } });
  // — HR tổng hợp (Trang) —
  await hcns(
    { title: "Chốt bảng công tháng 10/2026 từ FastWork", description: "Xuất bảng công tháng 10 từ FastWork sau khi hết tháng, đối chiếu đơn nghỉ phép, gửi trưởng phòng xác nhận trước ngày 03/11.", assigneeId: trang, createdById: U.nhung, dueDate: D("2026-11-03"), status: "DONE",
      resultNote: "Đã xuất lại bảng công ngày 02/11, đủ 31 ngày. Tổng 55 nhân sự; các ngày nghỉ phép đã khớp đơn.", submittedAt: at("2026-11-02T02:10:00Z"), completedAt: at("2026-11-02T07:00:00Z"), createdAt: at("2026-10-26T02:00:00Z") },
    [
      L(U.trang, "2026-10-27T01:30:00Z", "Bắt đầu thực hiện"),
      L(U.trang, "2026-10-29T04:20:00Z", "Báo cáo hoàn thành: Đã xuất file Netcab 10 2026 Bang cong.xlsx (thời gian xuất 29/10/2026 10:59) và đối chiếu 55 nhân sự."),
      L(U.nhung, "2026-10-29T08:00:00Z", "Trả lại: File xuất ngày 29/10 nên chưa có công ngày 30–31/10. Xuất lại sau khi hết tháng rồi báo cáo lại."),
      L(U.trang, "2026-11-02T02:10:00Z", "Báo cáo hoàn thành: Đã xuất lại bảng công ngày 02/11, đủ 31 ngày. Tổng 55 nhân sự; các ngày nghỉ phép đã khớp đơn."),
      L(U.nhung, "2026-11-02T07:00:00Z", "Xác nhận hoàn thành: Số liệu khớp, đúng hạn chốt công."),
    ],
  );
  await hcns(
    { title: "Tính lương tháng 10/2026 và trình duyệt", description: "Tính lương theo bảng công đã chốt, đối chiếu phụ cấp và khấu trừ, trình Trưởng phòng duyệt trước ngày 14/11.", assigneeId: trang, createdById: U.nhung, dueDate: D("2026-11-14"), status: "REVIEW",
      resultNote: "Bảng lương 55 nhân sự đã trừ công đi muộn theo bảng công tháng 10; ngày nghỉ phép đã đối chiếu đơn. File trình duyệt: \\\\fileserver\\HCNS\\Luong\\2026-10.xlsx", submittedAt: at("2026-11-11T09:00:00Z"), createdAt: at("2026-11-02T07:30:00Z") },
    [
      L(U.trang, "2026-11-03T01:30:00Z", "Bắt đầu thực hiện"),
      L(U.trang, "2026-11-11T09:00:00Z", "Báo cáo hoàn thành: Bảng lương 55 nhân sự đã trừ công đi muộn theo bảng công tháng 10; ngày nghỉ phép đã đối chiếu đơn. File trình duyệt: \\\\fileserver\\HCNS\\Luong\\2026-10.xlsx"),
    ],
  );
  await hcns(
    { title: "Nộp hồ sơ BHXH tăng/giảm lao động tháng 10", description: "Lập và nộp hồ sơ tăng/giảm lao động tháng 10 trên cổng BHXH, không để phát sinh phạt chậm nộp.", assigneeId: trang, createdById: U.nhung, dueDate: D("2026-11-15"), status: "IN_PROGRESS",
      resultNote: "Đã lập hồ sơ tăng 6 lao động và giảm 1 lao động, chờ nộp.", createdAt: at("2026-11-01T02:00:00Z") },
    [
      L(U.trang, "2026-11-02T01:00:00Z", "Bắt đầu thực hiện"),
      L(U.trang, "2026-11-06T08:00:00Z", "Báo cáo hoàn thành: Đã lập hồ sơ tăng 6 lao động và giảm 1 lao động, chờ nộp."),
      L(U.nhung, "2026-11-07T02:30:00Z", "Trả lại: 6 thực tập sinh chưa thuộc diện đóng BHXH bắt buộc, tách khỏi hồ sơ tăng. Bổ sung quyết định nghỉ việc cho trường hợp giảm."),
    ],
  );
  await hcns(
    { title: "Tổng hợp đi muộn, về sớm tháng 10 gửi các trưởng phòng", description: "Từ bảng công tháng 10: lọc người đi muộn từ 3 lần trở lên, kèm số phút đi muộn và về sớm; gửi từng trưởng phòng để nhắc nhở (KPI: tuân thủ giờ giấc).", assigneeId: trang, createdById: U.nhung, dueDate: D("2026-11-13"), status: "IN_PROGRESS", createdAt: at("2026-11-05T02:00:00Z") },
    [L(U.trang, "2026-11-05T03:00:00Z", "Bắt đầu thực hiện")],
  );
  await hcns({ title: "Cập nhật danh sách nhân sự tháng 11 lên hệ thống", description: "Cập nhật nhân sự mới, nghỉ việc, đổi chức danh trong tháng 11.", assigneeId: trang, createdById: U.nhung, dueDate: D("2026-11-10"), createdAt: at("2026-11-03T02:00:00Z") });
  // — Nhân viên quản lý kho (Hùng) —
  await hcns(
    { title: "Kiểm kê kho vật tư cáp quang quý 4", description: "Đối chiếu tồn kho thực tế với phần mềm, lập biên bản kiểm kê (KPI: độ chính xác tồn kho).", assigneeId: hung, createdById: U.nhung, dueDate: D("2026-11-06"), status: "IN_PROGRESS", priority: "HIGH", createdAt: at("2026-10-30T02:00:00Z"), collaborators: { connect: [{ id: trang }] } },
    [L(U.hung, "2026-11-02T01:30:00Z", "Bắt đầu thực hiện")],
  );
  await hcns(
    { title: "Xuất kho vật tư dự án nhà xưởng Bình Dương", assigneeId: hung, createdById: U.nhung, dueDate: D("2026-11-05"), status: "DONE",
      resultNote: "Đã xuất 12 cuộn cáp quang và 40 hộp ODF theo phiếu XK-1104, bàn giao cho quản lý dự án.", submittedAt: at("2026-11-04T09:30:00Z"), completedAt: at("2026-11-05T01:30:00Z"), createdAt: at("2026-11-03T02:00:00Z") },
    [
      L(U.hung, "2026-11-03T03:00:00Z", "Bắt đầu thực hiện"),
      L(U.hung, "2026-11-04T09:30:00Z", "Báo cáo hoàn thành: Đã xuất 12 cuộn cáp quang và 40 hộp ODF theo phiếu XK-1104, bàn giao cho quản lý dự án."),
      L(U.nhung, "2026-11-05T01:30:00Z", "Xác nhận hoàn thành: Đúng tiến độ dự án."),
    ],
  );
  await hcns(
    { title: "Sắp xếp lại khu vật tư dự án Q7", assigneeId: hung, createdById: U.nhung, dueDate: D("2026-11-18"), status: "REVIEW",
      resultNote: "Đã sắp xếp, dán nhãn theo mã dự án; cập nhật vị trí kệ trên phần mềm kho.", submittedAt: at("2026-11-10T09:00:00Z"), createdAt: at("2026-11-04T02:00:00Z") },
    [
      L(U.hung, "2026-11-05T01:30:00Z", "Bắt đầu thực hiện"),
      L(U.hung, "2026-11-10T09:00:00Z", "Báo cáo hoàn thành: Đã sắp xếp, dán nhãn theo mã dự án; cập nhật vị trí kệ trên phần mềm kho."),
    ],
  );
  await hcns({ title: "Cập nhật dữ liệu nhập – xuất kho tuần 45 lên phần mềm", description: "Không để dồn dữ liệu quá 2 ngày sau khi phát sinh (KPI: cập nhật dữ liệu kho).", assigneeId: hung, createdById: U.nhung, dueDate: D("2026-11-14"), createdAt: at("2026-11-09T02:00:00Z") });
  await hcns(
    { title: "Lập biên bản hao hụt vật tư tháng 10", assigneeId: hung, createdById: U.nhung, dueDate: D("2026-11-07"), status: "CANCELLED", createdAt: at("2026-10-31T02:00:00Z") },
    [L(U.nhung, "2026-11-03T02:00:00Z", "Hủy nhiệm vụ: Đối chiếu xong không phát sinh hao hụt trong tháng 10, không cần lập biên bản.")],
  );
  // ───────── Kỳ đánh giá cuối năm 2026 (BM1-003) ─────────
  const cycle = await db.reviewCycle.create({
    data: { name: "Đánh giá cuối năm 2026", purpose: "Đánh giá thành tích cuối năm", periodStart: D("2026-01-01"), periodEnd: D("2026-12-31"), dueDate: D("2027-01-15") },
  });
  type RV = { employeeId: string; reviewerId: string | null; hodId: string | null; level: "STAFF" | "SUPERVISOR"; status: ReviewStatus; scores?: number[]; bonus?: number; extra?: Record<string, unknown> };
  const reviews: RV[] = [
    { employeeId: trang, reviewerId: nhung, hodId: nhung, level: "STAFF", status: "COMPLETED", bonus: 3,
      scores: [8, 9, 9, 8, 8, 9, 9, 9, 8, 8, 9, 8, 9, 9, 9, 10, 9, 9, 8, 9],
      extra: { contributions: "Số hóa toàn bộ hồ sơ nhân sự giấy sang file scan; đề xuất quy trình onboarding mới giúp rút ngắn 2 ngày.", shortcomings: "Báo cáo BHXH tháng 7 nộp trễ 1 ngày.", contractRecommendation: "KEEP", devPlan: true, devPlanReason: "Có tiềm năng phát triển lên vị trí HR Supervisor.", employeeComment: "Đồng ý với kết quả đánh giá.", remarks: "Đề xuất tăng lương" } },
    { employeeId: hung, reviewerId: nhung, hodId: nhung, level: "STAFF", status: "HOD_APPROVAL",
      scores: [6, 7, 7, 6, 7, 5, 7, 6, 6, 5, 6, 7, 6, 7, 5, 8, 7, 6, 6, 6],
      extra: { shortcomings: "Còn 2 lần phát sinh biên bản thất thoát vật tư trong năm; cập nhật dữ liệu kho đôi lúc chậm.", contractRecommendation: "KEEP", devPlan: false, employeeComment: "Em sẽ cố gắng cải thiện việc cập nhật dữ liệu kho." } },
    // Không tạo phiếu cho Trưởng phòng HCNS: HRM là cấp cao nhất, không có người đánh giá
  ];
  const ORDER: ReviewStatus[] = ["SELF_REVIEW", "MANAGER_REVIEW", "EMPLOYEE_ACK", "HOD_APPROVAL", "COMPLETED"];
  for (const r of reviews) {
    const keys = criteriaOf(r.level).map((c) => c.key);
    const res = r.scores ? computeReview(r.level, r.scores, r.bonus ?? 0) : null;
    const after = (s: ReviewStatus) => ORDER.indexOf(r.status) > ORDER.indexOf(s);
    await db.review.create({
      data: {
        cycleId: cycle.id, employeeId: r.employeeId, template: r.level, status: r.status, reviewerId: r.reviewerId, hodId: r.hodId,
        maxScore: keys.length * 10, bonus: r.bonus ?? 0,
        totalScore: res && after("MANAGER_REVIEW") ? res.total : null, rate: res && after("MANAGER_REVIEW") ? res.rate : null, grade: res && after("MANAGER_REVIEW") ? res.grade : null,
        selfSubmittedAt: after("SELF_REVIEW") ? new Date() : null,
        managerSubmittedAt: after("MANAGER_REVIEW") ? new Date() : null,
        employeeAckAt: after("EMPLOYEE_ACK") ? new Date() : null,
        hodApprovedAt: r.status === "COMPLETED" ? new Date() : null,
        ...r.extra,
        scores: after("SELF_REVIEW") && r.scores
          ? { create: keys.map((k, i) => ({ criterionKey: k, selfScore: Math.min(10, r.scores![i] + (i % 3 === 0 ? 1 : 0)), managerScore: after("MANAGER_REVIEW") ? r.scores![i] : null })) }
          : r.status === "MANAGER_REVIEW"
            ? { create: keys.map((k, i) => ({ criterionKey: k, selfScore: [8, 8, 9, 9, 8][i % 5] })) }
            : undefined,
      },
    });
  }

  // Không tạo: chấm công (dữ liệu mẫu phía giao diện), follow-up (đã bỏ), hồ sơ giấy tờ, hợp đồng, đơn từ, onboarding (đang ẩn).
  const [e, u, p, i, t] = await Promise.all([db.employee.count(), db.user.count(), db.kpiPlan.count(), db.kpiPlanItem.count(), db.task.count()]);
  console.log(`✔ Đã tạo dữ liệu mẫu: ${e} nhân sự, ${u} tài khoản, ${p} phiếu KPI (${i} chỉ số), ${t} nhiệm vụ. Đăng nhập: admin@netcab.vn / Netcab@123`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
