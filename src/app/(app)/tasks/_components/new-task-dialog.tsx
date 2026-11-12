"use client";
// Hộp thoại "Giao việc" — mở khi URL có ?new=1 (giữ nguyên các đường dẫn cũ /tasks?new=1&assignee=…).
import { useRouter } from "next/navigation";
import { Modal, SubmitButton } from "@/components/modal";
import { DescriptionField, DueField, PeopleFields, PriorityField, TitleField, type PersonOption } from "./task-fields";

export function NewTaskDialog({
  action,
  people,
  today,
  closeHref,
  defaultAssignee,
  error,
}: {
  action: (fd: FormData) => void | Promise<void>;
  people: PersonOption[];
  today: string;
  closeHref: string;
  defaultAssignee?: string;
  error?: string;
}) {
  const router = useRouter();
  const close = () => router.push(closeHref, { scroll: false });
  return (
    <Modal
      title="Giao việc mới"
      subtitle="Người thực hiện nhận việc, báo cáo khi xong; bạn xác nhận kết quả."
      onClose={close}
      action={action}
      size="lg"
      footer={
        <>
          <button type="button" onClick={close} className="btn">
            Hủy
          </button>
          <SubmitButton>Giao việc</SubmitButton>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        <TitleField />
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-4">
            <PeopleFields people={people} defaultAssignee={defaultAssignee} />
          </div>
          <div className="flex flex-col gap-4">
            <DueField today={today} />
            <PriorityField />
          </div>
        </div>
        <DescriptionField />
      </div>
    </Modal>
  );
}
