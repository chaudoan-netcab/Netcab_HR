"use client";
// Khung hộp thoại dùng chung: nền mờ, Esc / bấm ra ngoài để đóng, tự focus ô nhập đầu tiên.
// Có `action` → nội dung + hàng nút nằm trong 1 <form> (dùng được SubmitButton hiện "Đang gửi…").
import { useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2, X } from "lucide-react";

export function Modal({
  title,
  subtitle,
  onClose,
  children,
  footer,
  action,
  size = "md",
}: {
  title: string;
  subtitle?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  action?: (fd: FormData) => void | Promise<void>;
  size?: "md" | "lg" | "xl";
}) {
  const box = useRef<HTMLDivElement>(null);
  // Giữ onClose mới nhất trong ref: effect chỉ chạy 1 lần khi mở, không focus lại ô đầu tiên mỗi lần nội dung vẽ lại
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    document.addEventListener("keydown", onKey);
    box.current?.querySelector<HTMLElement>("textarea, input:not([type=hidden]):not([tabindex='-1']), select")?.focus();
    // Khóa cuộn trang phía sau
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, []);

  const inner = (
    <>
      <div className="min-h-0 flex-1 overflow-y-auto p-5 max-md:p-4">{children}</div>
      {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border p-4 max-sm:[&>*]:flex-1">{footer}</div>}
    </>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/10 p-4 backdrop-blur-xs dark:bg-black/50"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={box}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className={`flex max-h-[90dvh] w-full flex-col overflow-hidden rounded-[6px] border border-transparent bg-card shadow-xl dark:border-border dark:bg-popover ${size === "xl" ? "sm:max-w-4xl" : size === "lg" ? "sm:max-w-2xl" : "sm:max-w-lg"}`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-border p-5 max-md:p-4">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-[17px] font-semibold leading-snug">{title}</h2>
            {subtitle && <p className="mt-0.5 text-[13px] text-muted-foreground">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="-mr-2 -mt-1 flex size-9 shrink-0 items-center justify-center rounded-[4px] text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Đóng">
            <X className="size-4.5" aria-hidden />
          </button>
        </div>
        {action ? (
          <form action={action} className="flex min-h-0 flex-1 flex-col">
            {inner}
          </form>
        ) : (
          inner
        )}
      </div>
    </div>
  );
}

/** Nút gửi tự khóa và hiện "Đang gửi…" khi form đang chạy */
export function SubmitButton({ children, className = "btn btn-primary", name, value, disabled }: { children: ReactNode; className?: string; name?: string; value?: string; disabled?: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={className}>
      {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
      {pending ? "Đang gửi…" : children}
    </button>
  );
}
