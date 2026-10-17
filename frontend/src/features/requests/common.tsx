import { type Model } from "@/lib/api";
import { date, money } from "@/lib/format";

export type RequestRecord = Model<"RequestDetail">;

export type EditIntent = Model<"PatchedRequestEditRequest"> & { id: string };

export type RequestFields =
  | { kind: "leave"; start_date: string; end_date: string; reason: string }
  | {
      kind: "advance";
      amount: string;
      currency: "KZT";
      requested_payment_date: string;
      reason: string;
    };

export type RequestAction =
  | "approve"
  | "reject"
  | "return_for_changes"
  | "submit"
  | "cancel";

export const actionLabels: Record<RequestAction, string> = {
  approve: "Одобрить",
  reject: "Отклонить",
  return_for_changes: "Вернуть на исправление",
  submit: "Отправить на рассмотрение",
  cancel: "Отменить заявление",
};

export const actionPaths = {
  approve: "/api/v1/requests/{id}/approve/",
  reject: "/api/v1/requests/{id}/reject/",
  return_for_changes: "/api/v1/requests/{id}/return-for-changes/",
  submit: "/api/v1/requests/{id}/submit/",
  cancel: "/api/v1/requests/{id}/cancel/",
} satisfies Record<RequestAction, `/api/v1/requests/{id}/${string}/`>;

export function initialFields(record: RequestRecord): RequestFields {
  return record.kind === "leave"
    ? {
        kind: "leave",
        reason: record.reason,
        start_date: record.start_date ?? "",
        end_date: record.end_date ?? "",
      }
    : {
        kind: "advance",
        reason: record.reason,
        amount: record.amount ?? "",
        currency: "KZT",
        requested_payment_date: record.requested_payment_date ?? "",
      };
}

type SummaryFields = Pick<
  Model<"Request">,
  | "kind"
  | "start_date"
  | "end_date"
  | "leave_days"
  | "amount"
  | "currency"
  | "requested_payment_date"
>;

export function RequestSummary({ record }: { record: SummaryFields }) {
  const duration =
    record.leave_days === null || record.leave_days === undefined
      ? "Количество дней не указано"
      : new Intl.NumberFormat("ru-KZ", {
          style: "unit",
          unit: "day",
          unitDisplay: "long",
          maximumFractionDigits: 2,
        }).format(Number(record.leave_days));
  return (
    <>
      {record.kind === "leave"
        ? `${date(record.start_date)} → ${date(record.end_date)} · ${duration}`
        : `${money(record.amount ?? "0", record.currency)} · дата ${date(record.requested_payment_date)}`}
    </>
  );
}

export const historyLabels: Record<string, string> = {
  created: "Создан черновик",
  edited: "Сохранены изменения",
  submitted: "Отправлено на рассмотрение",
  approved: "Одобрено",
  returned: "Возвращено на исправление",
  rejected: "Отклонено",
  cancelled: "Отменено",
};
