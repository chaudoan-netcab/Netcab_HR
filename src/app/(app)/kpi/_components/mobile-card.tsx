// Thẻ điện thoại (NETCAB): bảng ở `hidden md:block`, danh sách thẻ ở `<MobileList>` (dưới 768px).
// Dùng chung cho các màn KPI và Đánh giá. Chỉ trình bày lại cùng dữ liệu của bảng.
import Link from "next/link";
import type { ReactNode } from "react";
import type { Tone } from "@/lib/labels";

/** Bảng: chỉ hiện từ 768px (khi in vẫn hiện bảng) */
export const TABLE_MD = "hidden md:block print:block";

/** Khối bao danh sách: trên điện thoại bỏ nền/khung để thẻ nằm thẳng trên nền trang */
export const FLAT_ON_MOBILE = "max-md:border-transparent max-md:bg-transparent max-md:[&>div:first-child]:px-0 max-md:[&>div:first-child]:pt-0";

/** Ghim cột đầu khi bảng phải cuộn ngang (th và td) */
export const STICKY_COL = "sticky left-0 z-[1] bg-card";

export function MobileList({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <ul className={`space-y-3 md:hidden print:hidden ${className}`}>{children}</ul>;
}

export function MobileCard({
  meta,
  status,
  title,
  href,
  children,
  actions,
}: {
  meta?: ReactNode;
  status?: ReactNode;
  title: ReactNode;
  href?: string;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <li>
      <article className="rounded-[6px] border border-border bg-card p-3">
        {(meta || status) && (
          <div className="flex items-center justify-between gap-2">
            <span className="min-w-0 truncate text-xs text-muted-foreground">{meta}</span>
            {status}
          </div>
        )}
        <div className="mt-0.5 text-[14px] font-medium text-foreground">{href ? <Link href={href}>{title}</Link> : title}</div>
        {children && <dl className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[13px]">{children}</dl>}
        {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
      </article>
    </li>
  );
}

export function MobileField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="inline text-muted-foreground">{label}:</dt> <dd className="inline text-foreground">{children}</dd>
    </div>
  );
}

/**
 * Xếp loại là phân loại, không phải trạng thái: chữ thường không màu.
 * Chỉ tô màu khi mức đó báo cần chú ý (vàng: cần cải thiện / trung bình, đỏ: không hoàn thành).
 */
export function gradeColor(tone: Tone): string {
  return tone === "red" ? "text-status-danger-text" : tone === "amber" ? "text-status-warning-text" : "text-foreground";
}

export function gradeClass(tone: Tone): string {
  return tone === "red" || tone === "amber" ? `${gradeColor(tone)} font-medium` : gradeColor(tone);
}

/** Như gradeClass nhưng giữ màu chữ của chỗ đặt (dòng phụ xám) khi xếp loại không cần chú ý */
export function gradeWarnClass(tone: Tone): string {
  return tone === "red" || tone === "amber" ? gradeClass(tone) : "";
}

export function GradeText({ tone, children, className = "" }: { tone: Tone; children: ReactNode; className?: string }) {
  return <span className={`whitespace-nowrap ${gradeClass(tone)} ${className}`}>{children}</span>;
}
