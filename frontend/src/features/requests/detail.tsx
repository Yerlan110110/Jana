import {
  BackLink,
  DataSection,
  DemoNote,
  ErrorNotice,
  LoadingState,
  PageHeader,
  StatusLabel,
} from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { date } from "@/lib/format";
import { useQuery } from "@tanstack/react-query";
import { useParams } from "react-router";
import "../journeys.css";
import { RequestActions } from "./actions";
import { RequestSummary, historyLabels } from "./common";
import { RequestEditor } from "./forms";
import { Facts, isAccessDenied, timestamp } from "./support";

export function RequestDetailPage() {
  const { id = "" } = useParams();
  const request = useQuery({
    queryKey: ["request", id],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/requests/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const fulfillment = useQuery({
    queryKey: ["fulfillment", id],
    enabled: !!request.data,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/requests/{id}/fulfillment/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  async function refresh() {
    const result = await request.refetch();
    void fulfillment.refetch();
    return result.data;
  }
  const record = request.data;
  return (
    <>
      <BackLink to="/requests">К заявлениям</BackLink>
      <PageHeader
        title={
          record
            ? record.kind === "leave"
              ? "Заявление на отпуск"
              : "Заявление на аванс"
            : "Заявление"
        }
        description={record?.employee_name}
      />
      {request.isPending ? (
        <LoadingState />
      ) : request.error && (!record || isAccessDenied(request.error)) ? (
        <ErrorNotice error={request.error} retry={() => void refresh()} />
      ) : (
        record && (
          <div className="stack">
            <ErrorNotice error={request.error} retry={() => void refresh()} />
            <DataSection
              title="Сохранённые данные"
              action={<StatusLabel status={record.status} />}
            >
              <Facts
                items={[
                  {
                    label: record.kind === "leave" ? "Период" : "Сумма и дата",
                    value: <RequestSummary record={record} />,
                  },
                  { label: "Причина", value: record.reason || "Не указана" },
                  { label: "Версия записи", value: record.version },
                  { label: "Номер подачи", value: record.submission_number },
                  { label: "Подано", value: date(record.submitted_at) },
                  {
                    label: "Кто рассматривает",
                    value:
                      record.status === "pending_hr"
                        ? "HR"
                        : record.status === "pending_manager"
                          ? "Назначенный руководитель"
                          : "Нет текущего рассмотрения",
                  },
                ]}
              />
              {record.assigned_manager && (
                <details>
                  <summary>Назначенный согласующий</summary>
                  <p className="muted">Идентификатор на поданной версии</p>
                  <code>{record.assigned_manager}</code>
                </details>
              )}
            </DataSection>
            {record.allowed_actions.includes("update_draft") && (
              <RequestEditor
                key={record.id}
                record={record}
                refresh={refresh}
              />
            )}
            {!record.allowed_actions.includes("update_draft") && (
              <RequestActions
                key={`actions-${record.id}`}
                record={record}
                refresh={refresh}
              />
            )}
            <DataSection
              title="Исполнение"
              description="Согласование, доставка документа и учёт источником подтверждаются отдельно."
            >
              {fulfillment.isPending ? (
                <LoadingState />
              ) : fulfillment.error ? (
                <ErrorNotice
                  error={fulfillment.error}
                  retry={() => void fulfillment.refetch()}
                />
              ) : (
                fulfillment.data && (
                  <>
                    <Facts
                      items={[
                        {
                          label: "Согласование",
                          value: (
                            <StatusLabel
                              status={fulfillment.data.approval.status}
                            />
                          ),
                        },
                        {
                          label: "Доставка документа",
                          value: {
                            not_queued: "Не поставлен в доставку",
                            queued: "Ожидает доставки",
                            accepted: "Получена квитанция",
                            needs_operator: "Требует внимания оператора",
                          }[fulfillment.data.delivery.state],
                        },
                        {
                          label: "Квитанция получена",
                          value: date(fulfillment.data.delivery.accepted_at),
                        },
                        {
                          label: "Учёт в кадровом источнике",
                          value: {
                            not_applicable: "Неприменимо к авансу",
                            not_confirmed: "Не подтверждён",
                            incorporated: "Учтено источником",
                            reversed: "Учёт отменён источником",
                          }[fulfillment.data.source_accounting.state],
                        },
                        {
                          label: "Версия источника",
                          value:
                            fulfillment.data.source_accounting
                              .source_revision ?? "Нет подтверждения",
                        },
                        {
                          label: "Подтверждение источника",
                          value: date(
                            fulfillment.data.source_accounting.confirmed_at,
                          ),
                        },
                      ]}
                    />
                    <p className="muted">
                      Квитанция означает получение документа. Она не
                      подтверждает выплату, подпись или учёт отпуска в
                      официальном остатке.
                    </p>
                  </>
                )
              )}
            </DataSection>
            <DataSection title="История заявления">
              <ol className="rq-history">
                {record.history.map((event) => (
                  <li key={event.id}>
                    <div className="rq-meta">
                      <span>{timestamp(event.created_at)}</span>
                      <span>
                        Версия {event.version} · Подача{" "}
                        {event.submission_number}
                      </span>
                    </div>
                    <p>
                      <strong>
                        {historyLabels[event.action] ?? event.action}
                      </strong>{" "}
                      · {event.actor_name}
                    </p>
                    <StatusLabel status={event.to_status} />
                    {event.comment && <p>{event.comment}</p>}
                  </li>
                ))}
              </ol>
            </DataSection>
            <DataSection
              title="Поданные версии"
              description="Точные неизменяемые снимки сервера. Исправления создают новую подачу."
            >
              {record.revisions.length ? (
                record.revisions.map((revision) => (
                  <details key={revision.id}>
                    <summary>
                      Подача {revision.number} ·{" "}
                      {timestamp(revision.created_at)}
                    </summary>
                    <pre className="rq-snapshot">
                      {JSON.stringify(revision.payload, null, 2)}
                    </pre>
                  </details>
                ))
              ) : (
                <p className="muted">
                  Заявление ещё не отправлено. Снимок появится после подачи.
                </p>
              )}
            </DataSection>
            <DemoNote />
          </div>
        )
      )}
    </>
  );
}
