// Thanh tiến trình mảnh (4px), 4 đoạn: Chưa bắt đầu → Đang làm → Chờ xác nhận → Hoàn thành.
// Đoạn đã qua: màu nhấn; còn lại: nền nhạt. Bị trả lại: đoạn "Chờ xác nhận" màu cảnh báo.
// Tên bước ghi ngay dưới mỗi đoạn (bước hiện tại in đậm) để đọc được mà không cần rê chuột.
import type { TaskStatus } from "@prisma/client";

const STEPS: { key: TaskStatus; label: string }[] = [
  { key: "TODO", label: "Chưa bắt đầu" },
  { key: "IN_PROGRESS", label: "Đang làm" },
  { key: "REVIEW", label: "Chờ xác nhận" },
  { key: "DONE", label: "Hoàn thành" },
];

export function TaskProgress({ status, returned }: { status: TaskStatus; returned: boolean }) {
  if (status === "CANCELLED")
    return (
      <div className="mb-6">
        <div className="h-1 rounded-full bg-slate-200" />
        <div className="mt-1.5 text-xs font-medium text-slate-500">Nhiệm vụ đã hủy</div>
      </div>
    );
  const idx = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="mb-6 grid grid-cols-4 gap-1" aria-label={`Tiến trình: bước ${idx + 1}/4`}>
      {STEPS.map((s, i) => {
        const warn = returned && s.key === "REVIEW";
        const done = status === "DONE";
        const bar = warn ? "bg-red-400" : i <= idx ? (done ? "bg-emerald-500" : "bg-brand-500") : "bg-slate-200";
        const current = i === idx;
        const text = warn ? "text-red-600 font-medium" : current ? (done ? "font-semibold text-emerald-700" : "font-semibold text-brand-700") : i < idx ? "text-slate-600" : "text-slate-400";
        return (
          <li key={s.key} aria-current={current ? "step" : undefined}>
            <span className={`block h-1 rounded-full ${bar}`} />
            <span className={`mt-1.5 block text-[11px] leading-tight sm:text-xs ${text}`}>{warn ? "Bị trả lại" : s.label}</span>
          </li>
        );
      })}
    </ol>
  );
}
