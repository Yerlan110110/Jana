export const date = (value: string | null | undefined) =>
  value
    ? new Intl.DateTimeFormat("ru-KZ", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Asia/Almaty",
      }).format(
        new Date(value.length === 10 ? `${value}T12:00:00+05:00` : value),
      )
    : "Не указано";
export const money = (value: string | number, currency = "KZT") =>
  new Intl.NumberFormat("ru-KZ", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(Number(value));
export const statusLabels: Record<string, string> = {
  draft: "Черновик",
  pending_manager: "У руководителя",
  pending_hr: "У HR",
  approved: "Согласовано",
  rejected: "Отклонено",
  returned: "На исправлении",
  cancelled: "Отменено",
  assigned: "Назначено",
  not_started: "Не начато",
  in_progress: "В процессе",
  completed: "Завершено",
  overdue: "Срок прошёл",
  published: "Опубликовано",
  archived: "В архиве",
  open: "Ждёт ответа",
  resolved: "Ответ получен",
  active: "Доступно",
  unavailable: "Недоступно",
  failed: "Нужна повторная попытка",
  accepted: "Принят",
  pending: "В очереди",
  processing: "Передаётся",
  processed: "Обработано",
  delivered: "Передано",
};
export const statusText = (status: string) => statusLabels[status] ?? status;
export const roleText = (role: string) =>
  ({ employee: "Сотрудник", manager: "Руководитель", hr: "HR" })[role] ?? role;
