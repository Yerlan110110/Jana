import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { ActionButton, ActionLink } from "@/components/actions";
import { NativeSelect } from "@/components/pace/native-select";
import {
  BackLink,
  DataSection,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
  StatusLabel,
} from "@/components/ui";
import { api, ApiError, unwrap, useCommand, type Model } from "@/lib/api";
import { useSession } from "@/lib/session";
import { Facts, timestamp } from "./requests/support";

const deliveryOutcomeLabels: Record<Model<"OutcomeEnum">, string> = {
  accepted: "Документ принят",
  retry_scheduled: "Запланирован повтор",
  failed: "Передача не удалась",
  lease_expired: "Срок обработки истёк. Worker может повторить передачу",
};

export function IntegrationsPage() {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const selectedView = params.get("view");
  const view =
    selectedView === "sources" || selectedView === "imports"
      ? selectedView
      : "exports";
  const page = Math.max(1, Number(params.get("page")) || 1);
  const statusValue = params.get("status");
  const status =
    statusValue === "pending" ||
    statusValue === "processing" ||
    statusValue === "processed" ||
    statusValue === "failed"
      ? statusValue
      : undefined;
  const exportsQuery = useQuery({
    queryKey: ["exports", session.user.id, page, status],
    enabled: view === "exports",
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/integrations/exports/", {
          params: { query: { page, status, ordering: "-created_at" } },
          signal,
        }),
      ),
    refetchInterval: (query) =>
      query.state.data?.results.some((record) =>
        ["pending", "processing"].includes(record.delivery_status),
      )
        ? 5000
        : false,
  });
  const sources = useQuery({
    queryKey: ["integration-sources", session.user.id, page],
    enabled: view === "sources",
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/integrations/sources/", {
          params: { query: { page } },
          signal,
        }),
      ),
  });
  const imports = useQuery({
    queryKey: ["integration-imports", session.user.id, page],
    enabled: view === "imports",
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/integrations/imports/", {
          params: { query: { page, ordering: "-created_at" } },
          signal,
        }),
      ),
  });
  const active =
    view === "sources" ? sources : view === "imports" ? imports : exportsQuery;
  function change(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, value) : next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  return (
    <>
      <PageHeader
        eyebrow="Оператор HR"
        title="Передача и источники"
        description="Согласование заявления, получение документа и учёт в кадровом источнике подтверждаются отдельно."
        action={
          <ActionButton
            variant="secondary"
            loading={active.isFetching}
            onClick={() => void active.refetch()}
          >
            Обновить
          </ActionButton>
        }
      />
      <div className="stack">
        <nav className="button-row" aria-label="Реестры интеграций">
          {[
            ["exports", "Документы"],
            ["sources", "Состояние 1С"],
            ["imports", "История импорта"],
          ].map(([key, label]) => (
            <ActionLink
              key={key}
              variant="secondary"
              to={`?view=${key}`}
              aria-current={view === key ? "page" : undefined}
            >
              {label}
            </ActionLink>
          ))}
        </nav>
        <p className="muted">
          Используются mock 1С и mock Documentolog. Полученная квитанция
          подтверждает приём документа адаптером. Подписание, выплата и
          промышленная интеграция не выполняются.
        </p>
        {view === "exports" && (
          <label className="field">
            Доставка
            <NativeSelect
              value={status ?? ""}
              onChange={(event) => change("status", event.target.value)}
            >
              <option value="">Все состояния</option>
              <option value="pending">В очереди</option>
              <option value="processing">Передаётся</option>
              <option value="processed">Обработано</option>
              <option value="failed">Ошибка передачи</option>
            </NativeSelect>
          </label>
        )}
        {active.isPending ? (
          <LoadingState />
        ) : active.error ? (
          <ErrorNotice
            error={active.error}
            retry={() =>
              page > 1 ? change("page", "") : void active.refetch()
            }
          />
        ) : (
          <>
            {view === "exports" && exportsQuery.data && (
              <DataSection title="Документы к передаче">
                {exportsQuery.data.results.length ? (
                  <div className="rq-list">
                    {exportsQuery.data.results.map((record) => (
                      <article className="rq-row" key={record.id}>
                        <div>
                          <h3>
                            <Link
                              className="text-link"
                              to={`/hr/integrations/exports/${record.id}`}
                            >
                              {record.employee_name}
                            </Link>
                          </h3>
                          <p>
                            {timestamp(record.created_at)} · Попыток{" "}
                            {record.attempt_count}
                          </p>
                          <p className="muted">
                            {record.export_receipt
                              ? `Квитанция от ${timestamp(record.export_receipt.accepted_at)}`
                              : "Получение документа не подтверждено"}
                          </p>
                        </div>
                        <StatusLabel status={record.delivery_status} />
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Документов нет"
                    description="Измените фильтр. После финального согласования сервер добавляет документ в очередь."
                  />
                )}
              </DataSection>
            )}
            {view === "sources" && sources.data && (
              <DataSection
                title="Последний принятый снимок 1С"
                description="Отклонённый импорт не заменяет последнюю принятую версию."
              >
                {sources.data.results.length ? (
                  <div className="stack">
                    {sources.data.results.map((record) => (
                      <article key={record.id}>
                        <h3>{record.legal_entity_name}</h3>
                        <Facts
                          items={[
                            {
                              label: "Принятая версия",
                              value: record.last_revision,
                            },
                            {
                              label: "Данные источника на",
                              value: timestamp(record.last_captured_at),
                            },
                            {
                              label: "Принято порталом",
                              value: timestamp(record.updated_at),
                            },
                          ]}
                        />
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="Нет принятого снимка"
                    description="Кадровые данные появятся после приёма нормализованного импорта оператором."
                  />
                )}
              </DataSection>
            )}
            {view === "imports" && imports.data && (
              <DataSection title="История приёма кадровых данных">
                {imports.data.results.length ? (
                  <div className="stack">
                    {imports.data.results.map((record) => (
                      <article key={record.id}>
                        <h3>
                          {record.legal_entity_name} · Версия{" "}
                          {record.source_revision}
                        </h3>
                        <StatusLabel status={record.import_status} />
                        <Facts
                          items={[
                            {
                              label: "Сотрудников в снимке",
                              value: record.employee_count,
                            },
                            {
                              label: "Данные на",
                              value: timestamp(record.captured_at),
                            },
                            {
                              label: "Попытка импорта",
                              value: timestamp(record.created_at),
                            },
                          ]}
                        />
                        {record.import_status === "rejected" && (
                          <div className="error-notice">
                            <div>
                              <p>
                                Снимок отклонён. Последние принятые кадровые
                                данные сохранены. Оператор должен исправить
                                входной снимок и отправить его через API.
                              </p>
                              <details>
                                <summary>Причина отклонения</summary>
                                <p>{record.error_message}</p>
                                <code>{record.error_code}</code>
                              </details>
                            </div>
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                ) : (
                  <EmptyState
                    title="История импорта пуста"
                    description="Здесь появятся принятые и отклонённые снимки. Загрузка произвольных кадровых файлов через интерфейс не поддерживается."
                  />
                )}
              </DataSection>
            )}
            {active.data && (
              <PaginationBar
                count={active.data.count}
                page={page}
                onPage={(value) => change("page", String(value))}
              />
            )}
          </>
        )}
      </div>
    </>
  );
}

type ExportIntent = { id: string; expected_version: number } & (
  | { action: "retry" }
  | { action: "fault"; permanent_failure: boolean; transient_failures: number }
);

export function ExportPage() {
  const { id = "" } = useParams();
  const session = useSession();
  const query = useQuery({
    queryKey: ["export", session.user.id, id],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/integrations/exports/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
    refetchInterval: (state) =>
      state.state.data &&
      ["pending", "processing"].includes(state.state.data.delivery_status)
        ? 5000
        : false,
  });
  const command = useCommand(async (intent: ExportIntent, key) => {
    const params = {
      path: { id: intent.id },
      header: { "Idempotency-Key": key },
    };
    return intent.action === "retry"
      ? unwrap(
          await api.POST("/api/v1/integrations/exports/{id}/retry/", {
            params,
            body: { expected_version: intent.expected_version },
          }),
        )
      : unwrap(
          await api.POST("/api/v1/integrations/exports/{id}/mock-fault/", {
            params,
            body: {
              expected_version: intent.expected_version,
              permanent_failure: intent.permanent_failure,
              transient_failures: intent.transient_failures,
            },
          }),
        );
  });
  function run(
    record: Model<"ExportDetail">,
    action: "retry" | "restore" | "fail",
  ) {
    const prompt =
      action === "retry"
        ? "Повторить передачу этого документа? Согласование заявления останется прежним."
        : action === "restore"
          ? "Восстановить mock-адаптер для этого документа? Повтор передачи запускается отдельно."
          : "Включить демонстрационный сбой для этого документа? Передача завершится ошибкой до восстановления mock-адаптера.";
    if (!window.confirm(prompt)) return;
    command.mutate(
      action === "retry"
        ? { id: record.id, expected_version: record.version, action: "retry" }
        : {
            id: record.id,
            expected_version: record.version,
            action: "fault",
            permanent_failure: action === "fail",
            transient_failures: 0,
          },
    );
  }
  const uncertain =
    command.error &&
    (!(command.error instanceof ApiError) || command.error.status >= 500);
  if (query.isPending) return <LoadingState />;
  if (query.error)
    return (
      <ErrorNotice error={query.error} retry={() => void query.refetch()} />
    );
  if (!query.data) return null;
  const record = query.data;
  return (
    <>
      <BackLink to="/hr/integrations">К передаче документов</BackLink>
      <PageHeader
        eyebrow="Mock Documentolog"
        title="Передача документа"
        description={record.employee_name}
        action={
          <ActionButton
            variant="secondary"
            loading={query.isFetching}
            onClick={() => void query.refetch()}
          >
            Обновить
          </ActionButton>
        }
      />
      <div className="stack">
        <DataSection title="Подтверждённый этап">
          <StatusLabel status={record.delivery_status} />
          <p>
            {record.export_receipt
              ? "Mock-адаптер подтвердил получение документа. Выплата и подписание этим не подтверждаются."
              : "Квитанции о получении нет. Согласованное заявление сохранено отдельно от доставки."}
          </p>
          <Facts
            items={[
              { label: "Попыток передачи", value: record.attempt_count },
              { label: "Версия записи", value: record.version },
              {
                label: "Следующая попытка не раньше",
                value: timestamp(record.available_at),
              },
              {
                label: "Последнее изменение",
                value: timestamp(record.updated_at),
              },
            ]}
          />
          {record.request_id && (
            <ActionLink
              variant="secondary"
              to={`/requests/${record.request_id}`}
            >
              Открыть заявление
            </ActionLink>
          )}
          {record.last_error && (
            <details>
              <summary>Диагностика последнего сбоя</summary>
              <p>{record.last_error}</p>
              <code>{record.failure_code}</code>
            </details>
          )}
          {record.allowed_actions.includes("retry") && (
            <div className="stack">
              <p>
                Устраните причину сбоя и повторите передачу. Повтор использует
                идентификатор исходного документа.
              </p>
              <ActionButton
                loading={command.isPending}
                onClick={() => run(record, "retry")}
              >
                Повторить передачу
              </ActionButton>
            </div>
          )}
          <ErrorNotice
            error={command.error}
            retry={() => void query.refetch()}
          />
          {uncertain && command.variables && (
            <ActionButton
              variant="secondary"
              loading={command.isPending}
              onClick={() =>
                command.variables && command.mutate(command.variables)
              }
            >
              Повторить те же данные
            </ActionButton>
          )}
        </DataSection>
        {record.export_receipt && (
          <DataSection title="Квитанция о получении">
            <Facts
              items={[
                {
                  label: "Документ адаптера",
                  value: record.export_receipt.document_id,
                },
                {
                  label: "Принят",
                  value: timestamp(record.export_receipt.accepted_at),
                },
              ]}
            />
            <details>
              <summary>Идентичность документа</summary>
              <p>Идентификатор редакции заявления</p>
              <code>{record.export_receipt.request_revision}</code>
              <p>Контрольная сумма содержимого</p>
              <code>{record.export_receipt.payload_hash}</code>
            </details>
          </DataSection>
        )}
        <DataSection title="История передачи">
          {record.delivery_attempts.length ? (
            <ol className="rq-history">
              {record.delivery_attempts.map((attempt) => (
                <li key={attempt.id}>
                  <h3>Попытка {attempt.number}</h3>
                  <p>{timestamp(attempt.created_at)}</p>
                  <p>
                    {attempt.result
                      ? deliveryOutcomeLabels[attempt.result.outcome]
                      : "Ожидаем результат адаптера"}
                  </p>
                  {attempt.result?.error_message && (
                    <p>{attempt.result.error_message}</p>
                  )}
                  {attempt.result?.next_attempt_at && (
                    <p>
                      Повтор не раньше{" "}
                      {timestamp(attempt.result.next_attempt_at)}
                    </p>
                  )}
                </li>
              ))}
            </ol>
          ) : (
            <p className="muted">Worker ещё не начал передачу.</p>
          )}
        </DataSection>
        {record.mock_fault_available && (
          <details>
            <summary>Демонстрация сбоя mock-адаптера</summary>
            <div className="stack">
              <p>
                Эти команды доступны только при явно включённом серверном режиме
                демонстрации. Они меняют поведение mock-адаптера для этого
                документа.
              </p>
              <div className="button-row">
                <ActionButton
                  variant="secondary"
                  disabled={command.isPending}
                  onClick={() => run(record, "restore")}
                >
                  Восстановить mock-адаптер
                </ActionButton>
                <ActionButton
                  variant="destructive"
                  disabled={command.isPending}
                  onClick={() => run(record, "fail")}
                >
                  Включить демонстрационный сбой
                </ActionButton>
              </div>
            </div>
          </details>
        )}
      </div>
    </>
  );
}
