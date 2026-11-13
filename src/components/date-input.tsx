"use client";
// Ô nhập ngày hiển thị dd/mm/yyyy ở mọi trình duyệt (ô date gốc hiển thị theo ngôn ngữ máy).
// - Người dùng gõ dd/mm/yyyy (tự chèn dấu "/") hoặc bấm biểu tượng lịch để chọn.
// - Giá trị gửi lên server vẫn là yyyy-mm-dd qua ô ẩn mang `name` → server không cần đổi.
import { useEffect, useRef, useState } from "react";
import { CalendarDays } from "lucide-react";

const isoToVn = (iso: string) => (/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : "");

/** "d/m/yyyy" → "yyyy-mm-dd"; null nếu không phải ngày hợp lệ */
function vnToIso(text: string): string | null {
  const m = text.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [d, mo, y] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

/** Tự chèn "/" khi gõ số liên tục (12112026 → 12/11/2026), vẫn nhận kiểu gõ tay 5/1/2026 */
function mask(raw: string) {
  const seg = [""];
  for (const ch of raw) {
    const i = seg.length - 1;
    if (ch === "/") {
      if (seg[i] && seg.length < 3) seg.push("");
    } else if (/\d/.test(ch)) {
      if (seg[i].length < (i < 2 ? 2 : 4)) seg[i] += ch;
      else if (seg.length < 3) seg.push(ch);
    }
  }
  return seg.join("/");
}

export function DateInput({
  name,
  defaultValue = "",
  value,
  onChange,
  min,
  max,
  required,
  className = "",
  id,
  "aria-label": ariaLabel,
}: {
  name: string;
  /** yyyy-mm-dd */
  defaultValue?: string;
  /** yyyy-mm-dd — dùng khi điều khiển từ ngoài */
  value?: string;
  onChange?: (iso: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  className?: string;
  id?: string;
  "aria-label"?: string;
}) {
  const controlled = value !== undefined;
  const [iso, setIso] = useState(controlled ? value : defaultValue);
  const [text, setText] = useState(isoToVn(controlled ? value : defaultValue));
  const textRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLInputElement>(null);

  // Giá trị đổi từ ngoài (vd "Đến ngày" bị đẩy theo "Từ ngày")
  useEffect(() => {
    if (controlled && value !== iso) {
      setIso(value);
      setText(isoToVn(value));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const validate = (next: string, t: string) => {
    const el = textRef.current;
    if (!el) return;
    if (t && !next) el.setCustomValidity("Nhập ngày theo dạng dd/mm/yyyy");
    else if (next && min && next < min) el.setCustomValidity(`Ngày không được trước ${isoToVn(min)}`);
    else if (next && max && next > max) el.setCustomValidity(`Ngày không được sau ${isoToVn(max)}`);
    else el.setCustomValidity("");
  };

  const commit = (next: string, t: string) => {
    setIso(next);
    setText(t);
    validate(next, t);
    if (next !== iso) onChange?.(next);
  };

  // Kiểm tra lại khi min/max đổi
  useEffect(() => validate(iso, text)); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className={`relative ${className}`}>
      <input
        ref={textRef}
        id={id}
        aria-label={ariaLabel}
        inputMode="numeric"
        autoComplete="off"
        placeholder="dd/mm/yyyy"
        value={text}
        required={required}
        onChange={(e) => {
          const t = mask(e.target.value);
          commit(vnToIso(t) ?? "", t);
        }}
        onBlur={() => iso && setText(isoToVn(iso))}
        className="input pr-10 tabular-nums"
      />
      <input type="hidden" name={name} value={iso} />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => {
          const p = pickerRef.current;
          if (!p) return;
          try {
            p.showPicker();
          } catch {
            p.focus();
          }
        }}
        className="absolute inset-y-0 right-0 flex w-10 items-center justify-center rounded-r-[4px] text-muted-foreground hover:text-foreground"
        aria-label="Chọn ngày trên lịch"
      >
        <CalendarDays size={16} aria-hidden />
      </button>
      {/* Ô lịch gốc chỉ để mở bảng chọn ngày; không mang name nên không gửi lên server */}
      <input
        ref={pickerRef}
        type="date"
        tabIndex={-1}
        aria-hidden
        value={iso}
        min={min}
        max={max}
        onChange={(e) => commit(e.target.value, isoToVn(e.target.value))}
        className="pointer-events-none absolute bottom-0 left-0 h-px w-full opacity-0"
      />
    </div>
  );
}
