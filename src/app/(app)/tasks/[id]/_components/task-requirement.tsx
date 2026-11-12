// "Yêu cầu và kết quả mong muốn" — mô tả nhiệm vụ. Trống thì chỉ 1 dòng chữ mờ có nhãn, không dùng thẻ lớn.
export function TaskRequirement({ description }: { description: string | null }) {
  if (!description?.trim())
    return (
      <p className="rounded-lg border border-dashed border-slate-200 px-4 py-2.5 text-sm text-slate-400">
        <span className="font-medium text-slate-500">Yêu cầu và kết quả mong muốn:</span> chưa có mô tả
      </p>
    );
  return (
    <section className="card card-pad">
      <h2 className="mb-2">Yêu cầu và kết quả mong muốn</h2>
      <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{description}</p>
    </section>
  );
}
