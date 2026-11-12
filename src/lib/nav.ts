// Các tab đầu trang của từng mục — gom "của tôi" và "quản lý" vào cùng 1 mục menu.
// Hiện / ẩn theo NĂNG LỰC (tính ở server bằng capsOf() trong access.ts), không so sánh role ở đây.

/** Năng lực của người dùng, truyền xuống giao diện (client) để ẩn / hiện menu, tab, nút */
export type Caps = { employee: boolean; manager: boolean; hrm: boolean; admin: boolean; tracker: boolean };

type Tab = { key: string; label: string; href: string };

export function kpiTabs(c: Caps): Tab[] {
  return [
    { key: "mine", label: "KPI cá nhân", href: "/kpi" },
    ...(c.manager || c.hrm ? [{ key: "plans", label: "Phiếu KPI nhân viên", href: "/kpi/plans" }] : []),
    ...(c.manager || c.hrm ? [{ key: "sets", label: "Bộ KPI của phòng", href: "/kpi/sets" }] : []),
    ...(c.manager ? [{ key: "summary", label: "Bản cuối gửi HR", href: "/kpi/summary" }] : []),
  ];
}

export function reviewTabs(c: Caps): Tab[] {
  return [
    { key: "mine", label: "Phiếu đánh giá", href: "/reviews" },
    ...(c.hrm ? [{ key: "cycles", label: "Kỳ đánh giá & tổng hợp", href: "/reviews/cycles" }] : []),
  ];
}


/** Cookie lưu trạng thái thu gọn sidebar ("collapsed" | "open") */
export const SIDEBAR_COOKIE = "sidebar";
