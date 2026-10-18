import type { ReactNode } from "react";
import { ActionButton } from "@/components/actions";
import { ErrorNotice } from "@/components/ui";
import { ApiError } from "@/lib/api";

export function WriteRecovery({
  error,
  refresh,
  refreshDescription,
  retry,
}: {
  error: unknown;
  refresh?: () => void;
  refreshDescription?: ReactNode;
  retry?: () => void;
}) {
  if (!error) return null;
  const uncertain = !(error instanceof ApiError) || error.status >= 500;
  return (
    <div className="stack">
      <ErrorNotice error={error} />
      <p className="muted">
        {refreshDescription ?? (
          <>
            Поля сохранены в этой форме.{" "}
            {refresh
              ? "Обновление записи не заменяет введённые значения. Проверьте актуальную версию перед повторным действием."
              : "Проверьте поля и повторите сохранение. При неизвестном результате повторите те же данные."}
          </>
        )}
      </p>
      <div className="button-row">
        {refresh && (
          <ActionButton variant="secondary" onClick={refresh}>
            Обновить запись
          </ActionButton>
        )}
        {uncertain && retry && (
          <ActionButton variant="secondary" onClick={retry}>
            Повторить те же данные
          </ActionButton>
        )}
      </div>
    </div>
  );
}

export function Facts({
  items,
}: {
  items: { label: string; value: ReactNode }[];
}) {
  return (
    <dl className="people-facts">
      {items.map((item) => (
        <div key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function isAccessDenied(error: unknown) {
  return error instanceof ApiError && [401, 403, 404].includes(error.status);
}

export function timestamp(value: string | null | undefined) {
  return value
    ? new Intl.DateTimeFormat("ru-KZ", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: "Asia/Almaty",
      }).format(new Date(value))
    : "Не указано";
}
