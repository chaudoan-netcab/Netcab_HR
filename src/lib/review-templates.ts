// Mẫu BM1-003 "Bảng kế hoạch & đánh giá thành tích" — lấy từ file "Bảng đánh giá cuối năm - NC.xlsx"
import type { ReviewTemplate } from "@prisma/client";
import type { Tone } from "./labels";

export type Criterion = { key: string; text: string };
export type Section = { title: string; weightNote?: string; criteria: Criterion[] };
export type TemplateDef = { code: ReviewTemplate; title: string; sections: Section[] };

const common = {
  nhanThuc: {
    title: "Nhận thức công việc",
    criteria: [
      { key: "nt1", text: "Chia sẻ kinh nghiệm/hiểu biết và hỗ trợ đồng nghiệp/nhân viên." },
      { key: "nt2", text: "Hiểu rõ về Tuân thủ, Nguyên tắc ứng xử và Nội quy công ty." },
    ],
  },
  chatLuong: [
    { key: "cl1", text: "Mức độ hoàn thành công việc được giao." },
    { key: "cl2", text: "Hiệu quả hoàn thành công việc được giao." },
    { key: "cl3", text: "Kỹ năng xử lý hiệu quả." },
    { key: "cl4", text: "Báo cáo kịp thời, chính xác." },
    { key: "cl5", text: "Quản lý thời gian hoàn thành công việc được giao." },
  ],
  chuDong: {
    title: "Tính chủ động",
    criteria: [
      { key: "cd1", text: "Luôn hành động theo nguyên tắc “đúng” hoặc “sai”." },
      { key: "cd2", text: "Thái độ hợp tác, chấp nhận và thích nghi với các thay đổi trong công việc và/hoặc chính sách công ty." },
      { key: "cd3", text: "Chủ động góp ý, đề xuất thay đổi để cải tiến quy trình hoạt động." },
    ],
  },
  thaiDo: {
    title: "Thái độ làm việc",
    criteria: [
      { key: "td1", text: "“Đảm nhiệm” và “làm nhiều hơn” những đòi hỏi trong công việc." },
      { key: "td2", text: "Hoàn thành công việc với sự cống hiến, hăng say, tận tâm và nỗ lực cao." },
    ],
  },
  khachHang: {
    title: "Phục vụ khách hàng",
    weightNote: "10%",
    criteria: [
      { key: "kh1", text: "Luôn luôn mỉm cười thân thiện và tự hào trong việc phục vụ khách hàng hoặc công việc của mình. Đánh giá mức độ hài lòng của khách hàng." },
      { key: "kh2", text: "Mức độ tiếp nhận, giải đáp các thắc mắc của khách hàng. Lắng nghe ý kiến, góp ý của khách hàng, cân nhắc/báo cáo, sửa chữa/thay đổi nếu ý kiến khách hàng là hợp lý." },
    ],
  },
  trungThuc: { key: "tt3", text: "Mức độ trung thực trong công việc đảm nhiệm." },
  thuaNhan: { key: "tt4", text: "Thái độ thành thật thừa nhận sai phạm, khắc phục, sửa đổi, và cải thiện bản thân." },
  tapHuan: { key: "tt5", text: "Tham gia đầy đủ các khóa tập huấn, đào tạo bắt buộc của công ty." },
};

export const REVIEW_TEMPLATES: Record<ReviewTemplate, TemplateDef> = {
  STAFF: {
    code: "STAFF",
    title: "Dành cho Nhân viên – Chuyên viên",
    sections: [
      common.nhanThuc,
      { title: "Chất lượng công việc", weightNote: "50%", criteria: common.chatLuong },
      common.chuDong,
      common.thaiDo,
      {
        title: "Làm việc nhóm",
        criteria: [
          { key: "ln1", text: "Hòa đồng, có tinh thần hợp tác, hỗ trợ và tôn trọng đồng nghiệp trong công việc để hoàn thành nhiệm vụ được giao." },
        ],
      },
      {
        title: "Tính tuân thủ",
        weightNote: "15%",
        criteria: [
          { key: "tt1", text: "Thực hiện tốt các nội quy, quy định, chính sách của công ty với tinh thần tự giác cao." },
          { key: "tt2", text: "Chuyên cần." },
          common.trungThuc,
          common.thuaNhan,
          common.tapHuan,
        ],
      },
      common.khachHang,
    ],
  },
  SUPERVISOR: {
    code: "SUPERVISOR",
    title: "Dành cho cấp Giám sát – Trưởng nhóm trở lên",
    sections: [
      common.nhanThuc,
      { title: "Chất lượng công việc", weightNote: "40%", criteria: common.chatLuong },
      common.chuDong,
      common.thaiDo,
      {
        title: "Làm việc nhóm",
        criteria: [
          { key: "ln1", text: "Hòa đồng, có tinh thần hợp tác, đoàn kết, hỗ trợ đồng nghiệp trong công việc để hoàn thành nhiệm vụ được giao." },
        ],
      },
      {
        title: "Tính tuân thủ",
        weightNote: "15%",
        criteria: [
          { key: "tt1", text: "Chuyên cần." },
          { key: "tt2", text: "Mức độ tuân thủ quy trình, quy định của công ty." },
          common.trungThuc,
          common.thuaNhan,
          common.tapHuan,
        ],
      },
      common.khachHang,
      {
        title: "Kỹ năng quản lý",
        weightNote: "15%",
        criteria: [
          { key: "ql1", text: "Kỹ năng lắng nghe, xử lý tình huống và hướng dẫn cấp dưới công việc hằng ngày." },
          { key: "ql2", text: "Kỹ năng hướng dẫn, đào tạo." },
          { key: "ql3", text: "Chịu trách nhiệm cho thuộc cấp/đội nhóm." },
          { key: "ql4", text: "Tìm kiếm các giải pháp, cải thiện nhóm, hoàn thành chỉ tiêu/công việc của nhóm." },
        ],
      },
    ],
  },
};

export function criteriaOf(t: ReviewTemplate): Criterion[] {
  return REVIEW_TEMPLATES[t].sections.flatMap((s) => s.criteria);
}

/** Điểm tối đa: 10 × số tiêu chí (Nhân viên 200, Giám sát 240) */
export function maxScoreOf(t: ReviewTemplate): number {
  return criteriaOf(t).length * 10;
}

export const WEIGHT_NOTE: Record<ReviewTemplate, string> = {
  STAFF:
    "Chất lượng công việc 50%; Tính tuân thủ 15%; Phục vụ khách hàng 10%; Làm việc nhóm + Nhiệt tình + Tính chủ động + Nhận thức công việc 25%.",
  SUPERVISOR:
    "Chất lượng công việc 40%; Tính tuân thủ 15%; Phục vụ khách hàng 10%; Kỹ năng quản lý 15%; Làm việc nhóm + Nhiệt tình + Tính chủ động + Nhận thức công việc 20%.",
};

export const SCORE_SCALE = [
  { value: 0, label: "Không đạt" },
  { value: 1, label: "Ít đạt" },
  { value: 2, label: "Ít đạt" },
  { value: 3, label: "Ít đạt" },
  { value: 4, label: "Ít đạt" },
  { value: 5, label: "Đạt yêu cầu" },
  { value: 6, label: "Đạt hoàn toàn" },
  { value: 7, label: "Đạt hoàn toàn" },
  { value: 8, label: "Đạt hoàn toàn" },
  { value: 9, label: "Đạt hoàn toàn" },
  { value: 10, label: "Xuất sắc" },
];

/** Điểm cộng Phần B (đóng góp, cải tiến): 1, 3 hoặc 5 — cộng thẳng vào Tỷ lệ đạt được */
export const BONUS_OPTIONS = [0, 1, 3, 5];

/**
 * Tỷ lệ đạt được (%) = Tổng điểm / Điểm tối đa × 100 + điểm Phần B.
 * Xếp hạng theo đúng công thức ô K31 trong Excel:
 * A > 90% · B: 80–90% · C: 70–80% · D: 50–70% · E < 50%
 */
export function computeReview(template: ReviewTemplate, scores: (number | null | undefined)[], bonus: number) {
  const total = scores.reduce<number>((s, v) => s + (v ?? 0), 0);
  const max = maxScoreOf(template);
  const rate = Math.round(((total / max) * 100 + bonus) * 100) / 100;
  return { total, max, rate, grade: reviewGrade(rate) };
}

export function reviewGrade(rate: number): "A" | "B" | "C" | "D" | "E" {
  if (rate > 90) return "A";
  if (rate < 50) return "E";
  if (rate <= 70) return "D";
  if (rate <= 80) return "C";
  return "B";
}

export const GRADE_INFO: Record<string, { range: string; tone: Tone }> = {
  A: { range: "> 90%", tone: "green" },
  B: { range: "81% – 90%", tone: "blue" },
  C: { range: "71% – 80%", tone: "violet" },
  D: { range: "50% – 70%", tone: "amber" },
  E: { range: "< 50%", tone: "red" },
};
