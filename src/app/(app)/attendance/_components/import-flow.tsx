"use client";
// Luồng import: chọn tháng + tải file → kiểm tra → xem trước → "Xác nhận và khóa".
// Tháng đã khóa vẫn import lại được (ghi đè) nhưng bắt buộc nhập lý do.
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import { checkAttendanceFile, commitAttendanceImport, type CheckResult } from "../actions";

/** Số kiểu Việt Nam: 17,9 · 143,35 */
const vn = (n: number) => n.toLocaleString("vi-VN", { maximumFractionDigits: 2 });

type Ok = Extract<CheckResult, { ok: true }>;

export function ImportFlow({ months, defaultMonth }: { months: { value: string; label: string; locked: boolean }[]; defaultMonth?: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [result, setResult] = useState<Ok | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [pending, start] = useTransition();

  if (months.length === 0)
    return <p className="text-[13px] text-muted-foreground">Chưa đến tháng bắt đầu áp dụng import chấm công. Thời điểm bắt đầu đặt trong cấu hình ATTENDANCE_START_MONTH.</p>;

  const check = (fd: FormData) => {
    setError(null);
    setDone(null);
    setResult(null);
    setReason("");
    start(async () => {
      const r = await checkAttendanceFile(fd);
      if (r.ok) setResult(r);
      else setError(r.error);
    });
  };

  const commit = () => {
    if (!result) return;
    setError(null);
    start(async () => {
      const r = await commitAttendanceImport({ month: result.month, fileName: result.fileName, rows: result.preview.filter((p) => p.matched).length, reason });
      if (!r.ok) return setError(r.error);
      setDone(r.message);
      setResult(null);
      setReason("");
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    });
  };

  const needReason = !!result?.alreadyImported;
  return (
    <div className="flex flex-col gap-4">
      <form action={check} className="grid items-end gap-3 sm:grid-cols-[12rem_1fr_auto]">
        <label className="block">
          <span className="label">Tháng</span>
          <select name="month" defaultValue={defaultMonth} className="input" required>
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}{m.locked ? " (đã khóa)" : ""}</option>
            ))}
          </select>
        </label>
        <label className="block">
          <span className="label">File xuất từ FastWork (.xlsx, .xls, .csv)</span>
          <input ref={fileRef} type="file" name="file" accept=".xlsx,.xls,.csv" required className="input py-1.5" />
        </label>
        <button className={result ? "btn" : "btn btn-primary"} disabled={pending}>{pending && !result ? "Đang kiểm tra…" : "Kiểm tra file"}</button>
      </form>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-[13px] text-status-danger-text">
          <XCircle size={16} className="mt-0.5 shrink-0" aria-hidden /> {error}
        </p>
      )}
      {done && (
        <p role="status" className="flex items-center gap-2 text-[13px] text-status-success-text">
          <CheckCircle2 size={16} aria-hidden /> {done}
        </p>
      )}

      {result && (
        <div className="flex flex-col gap-4">
          <div>
            <h3 className="section-title mb-1">Kết quả kiểm tra · {result.fileName} · {result.monthLabel}</h3>
            <p className="mb-2 text-[13px] text-muted-foreground">
              Thời gian xuất (dòng 2 của file): <b className="font-medium tabular-nums text-foreground">{result.exportedAtLabel}</b>{!result.exportedFromFile && <span className="text-xs"> · dữ liệu mẫu</span>}
            </p>
            <ul className="flex flex-col gap-2">
              {result.checks.map((c) => (
                <li key={c.title} className="flex items-start gap-2 text-[13px]">
                  {c.level === "ok" ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-status-success-text" aria-label="Đạt" /> : c.level === "warning" ? <AlertTriangle size={16} className="mt-0.5 shrink-0 text-status-warning-text" aria-label="Cảnh báo" /> : <XCircle size={16} className="mt-0.5 shrink-0 text-status-danger-text" aria-label="Lỗi" />}
                  <span>
                    <span className="font-medium text-foreground">{c.title}</span>
                    <span className="block text-xs text-muted-foreground">{c.detail}</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="section-title mb-2">Xem trước ({result.preview.length} dòng)</h3>
            <div className="max-h-80 overflow-auto rounded-[4px] border border-border">
              <table className="table max-md:hidden">
                <thead>
                  <tr>
                    <th>MSNV</th>
                    <th>Nhân viên · Phòng ban</th>
                    <th className="text-right">Số công</th>
                    <th className="text-right">Số giờ</th>
                    <th className="text-right">Đi muộn</th>
                    <th className="text-right">Về sớm</th>
                    <th className="text-right">Nghỉ phép</th>
                  </tr>
                </thead>
                <tbody>
                  {result.preview.map((r, i) => (
                    <tr key={i} className={r.matched && r.fromFile ? "bg-accent/60" : ""}>
                      <td className="text-xs tabular-nums text-muted-foreground">{r.code}</td>
                      <td>
                        {r.name}
                        <span className="block text-xs text-muted-foreground">
                          {r.department}
                          {!r.matched && <span className="text-status-warning-text"> · không khớp, bỏ qua</span>}
                          {r.fromFile && <span className="text-primary-text"> · số liệu từ file</span>}
                        </span>
                      </td>
                      <td className="text-right tabular-nums">{vn(r.days)}</td>
                      <td className="text-right tabular-nums">{vn(r.hours)}</td>
                      <td className="text-right tabular-nums">
                        {r.lateCount} lần
                        {r.lateMinutes > 0 && <span className="block text-xs text-muted-foreground">{r.lateMinutes} phút</span>}
                      </td>
                      <td className="text-right tabular-nums">{r.earlyCount} lần</td>
                      <td className="text-right tabular-nums">{vn(r.leave)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Điện thoại: danh sách xếp chồng, cùng dữ liệu với bảng */}
              <ul className="divide-y divide-border md:hidden">
                {result.preview.map((r, i) => (
                  <li key={i} className={`px-3 py-2.5 ${r.matched && r.fromFile ? "bg-accent/60" : ""}`}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-[14px] font-medium text-foreground">{r.name}</span>
                      <span className="text-xs tabular-nums text-muted-foreground">{r.code}</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {r.department}
                      {!r.matched && <span className="text-status-warning-text"> · không khớp, bỏ qua</span>}
                      {r.fromFile && <span className="text-primary-text"> · số liệu từ file</span>}
                    </div>
                    <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-0.5 text-[13px] tabular-nums">
                      <div><dt className="inline text-muted-foreground">Số công:</dt> <dd className="inline">{vn(r.days)}</dd></div>
                      <div><dt className="inline text-muted-foreground">Số giờ:</dt> <dd className="inline">{vn(r.hours)}</dd></div>
                      <div><dt className="inline text-muted-foreground">Đi muộn:</dt> <dd className="inline">{r.lateCount} lần{r.lateMinutes > 0 && ` (${r.lateMinutes} phút)`}</dd></div>
                      <div><dt className="inline text-muted-foreground">Về sớm:</dt> <dd className="inline">{r.earlyCount} lần</dd></div>
                      <div><dt className="inline text-muted-foreground">Nghỉ phép:</dt> <dd className="inline">{vn(r.leave)}</dd></div>
                    </dl>
                  </li>
                ))}
              </ul>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Khớp nhân viên theo Họ tên + Phòng ban (file FastWork không có cột Email). Dòng tô xanh: số liệu thật của phòng HCNS từ file bảng công tháng 10/2026; các dòng khác là số mẫu — hệ thống chưa đọc nội dung file.
            </p>
          </div>

          {needReason && (
            <label className="block">
              <span className="label">Lý do import lại (bắt buộc)</span>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} className="input min-h-16" placeholder="Vd: bổ sung ngày công tác bị thiếu ở file trước" />
            </label>
          )}
          <div className="flex flex-wrap items-center justify-end gap-3">
            {result.blocked && <span className="text-[13px] text-status-danger-text">Sửa các lỗi ở trên rồi kiểm tra lại.</span>}
            <button type="button" onClick={() => setResult(null)} className="btn">Hủy</button>
            <button type="button" onClick={commit} disabled={pending || result.blocked || (needReason && !reason.trim())} className="btn btn-primary">
              {needReason ? "Import lại và khóa" : "Xác nhận và khóa"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
