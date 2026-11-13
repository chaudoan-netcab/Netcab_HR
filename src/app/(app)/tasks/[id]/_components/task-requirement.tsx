// "Yêu cầu và kết quả mong muốn" — mô tả nhiệm vụ. Trống thì chỉ 1 dòng chữ mờ có nhãn, không dùng thẻ lớn.
import { Card } from "@/components/ui";

export function TaskRequirement({ description }: { description: string | null }) {
  if (!description?.trim())
    return (
      <p className="card px-5 py-3 text-[13px] text-muted-foreground max-md:px-3">
        <span className="font-medium text-foreground">Yêu cầu và kết quả mong muốn:</span> chưa có mô tả
      </p>
    );
  return (
    <Card title="Yêu cầu và kết quả mong muốn">
      <p className="whitespace-pre-line text-[13px] leading-relaxed text-foreground">{description}</p>
    </Card>
  );
}
