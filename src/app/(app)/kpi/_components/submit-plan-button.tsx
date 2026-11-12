"use client";
// Nút "Gửi báo cáo cuối kỳ": chỉ bật khi mọi chỉ số đã có số liệu (kể cả kiểu đếm vi phạm: phải nhập 0 nếu không có vụ).
// Theo dõi trực tiếp các ô "Mức độ thực hiện" trong cùng form, nên bật/tắt ngay khi người dùng gõ.
// Server (savePlan) kiểm tra lại lần nữa, không phụ thuộc vào nút này.
import { useEffect, useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";

/** autoApprove: chủ phiếu không có quản lý trực tiếp (HRM — cấp cao nhất) → gửi là chốt luôn */
export function SubmitPlanButton({ initialMissing, autoApprove = false }: { initialMissing: string[]; autoApprove?: boolean }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [missing, setMissing] = useState(initialMissing);

  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const check = () => {
      const inputs = [...form.querySelectorAll<HTMLInputElement>('input[name^="actual_"]')];
      // Không có ô nhập (phiếu chỉ xem) → giữ danh sách từ server
      if (inputs.length) setMissing(inputs.filter((i) => i.value.trim() === "").map((i) => i.dataset.kpiName ?? i.name));
    };
    check();
    form.addEventListener("input", check);
    return () => form.removeEventListener("input", check);
  }, []);

  const blocked = missing.length > 0;
  return (
    <span ref={ref} className="contents">
      {blocked && (
        <span id="kpi-missing" role="status" className="flex max-w-xl basis-full items-start gap-1.5 text-xs text-amber-800 sm:basis-auto">
          <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            Chưa gửi được: còn {missing.length} chỉ số chưa có số liệu ({missing.join("; ")}). Kiểu đếm vi phạm nhập 0 nếu không có vụ nào.
          </span>
        </span>
      )}
      <button name="intent" value="submit" className="btn btn-primary" disabled={blocked} aria-describedby={blocked ? "kpi-missing" : undefined}>
        {autoApprove ? "Chốt kết quả cuối kỳ" : "Gửi báo cáo cuối kỳ"}
      </button>
    </span>
  );
}
