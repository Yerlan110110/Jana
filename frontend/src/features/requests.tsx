import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { Plus } from "lucide-react";
import { ActionButton, ActionLink } from "@/components/actions";
import { Input } from "@/components/upstream/input";
import { NativeSelect } from "@/components/pace/native-select";
import { Textarea } from "@/components/pace/textarea";
import {
  BackLink,
  DataSection,
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
  StatusLabel,
} from "@/components/ui";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { date, money } from "@/lib/format";
import { useSession } from "@/lib/session";
import {
  Facts,
  WriteRecovery,
  isAccessDenied,
  timestamp,
} from "./requests/support";
import "./journeys.css";

type RequestRecord = Model<"RequestDetail">;
type EditIntent = Model<"PatchedRequestEditRequest"> & { id: string };
type RequestFields =
  | { kind: "leave"; start_date: string; end_date: string; reason: string }
  | {
      kind: "advance";
      amount: string;
      currency: "KZT";
      requested_payment_date: string;
      reason: string;
    };
type RequestAction =
  | "approve"
  | "reject"
  | "return_for_changes"
  | "submit"
  | "cancel";
const actionLabels: Record<RequestAction, string> = {
  approve: "Одобрить",
  reject: "Отклонить",
  return_for_changes: "Вернуть на исправление",
  submit: "Отправить на рассмотрение",
  cancel: "Отменить заявление",
};
const actionPaths = {
  approve: "/api/v1/requests/{id}/approve/",
  reject: "/api/v1/requests/{id}/reject/",
  return_for_changes: "/api/v1/requests/{id}/return-for-changes/",
  submit: "/api/v1/requests/{id}/submit/",
  cancel: "/api/v1/requests/{id}/cancel/",
} satisfies Record<RequestAction, `/api/v1/requests/{id}/${string}/`>;

function initialFields(record: RequestRecord): RequestFields {
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

function RequestSummary({ record }: { record: Model<"Request"> }) {
  return (
    <>
      {record.kind === "leave"
        ? `${date(record.start_date)} → ${date(record.end_date)} · ${record.leave_days ?? "—"} дней`
        : `${money(record.amount ?? "0", record.currency)} · дата ${date(record.requested_payment_date)}`}
    </>
  );
}

function RequestsList({ queue = false }: { queue?: boolean }) {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("search") ?? "";
  const kind: Model<"KindEnum"> | undefined =
    params.get("type") === "leave"
      ? "leave"
      : params.get("type") === "advance"
        ? "advance"
        : undefined;
  const status = params.get("status");
  const validStatus: Model<"HRRequestStatusEnum"> | undefined =
    status === "draft" ||
    status === "returned" ||
    status === "pending_manager" ||
    status === "pending_hr" ||
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled"
      ? status
      : undefined;
  const canRead = queue ? session.user.role !== "employee" : !!session.employee;
  const query = {
    page,
    search,
    kind,
    status: validStatus,
    ordering: "-created_at",
    ...(queue
      ? { needs_my_action: true, employee: params.get("employee") || undefined }
      : { employee: session.employee?.id }),
  };
  const requests = useQuery({
    queryKey: ["requests", session.user.id, queue, query],
    enabled: canRead,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/requests/", { params: { query }, signal })),
  });
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, value) : next.delete(key);
      next.delete("page");
      return next;
    });
  }
  if (!canRead)
    return (
      <EmptyState
        title="Нет доступа к этому реестру"
        description="Проверьте роль и кадровый профиль. Для очереди нужна роль руководителя или HR."
      />
    );
  return (
    <>
      <PageHeader
        eyebrow={queue ? "Рассмотрение заявлений" : "Личный кабинет"}
        title={
          queue
            ? params.get("kind") === "hr"
              ? "Очередь HR"
              : "Требует моего решения"
            : "Мои заявления"
        }
        description={
          queue
            ? "Сервер показывает только заявления, по которым вы можете принять решение сейчас."
            : "Отпуск и зарплатный аванс. История и подтверждённый этап по каждому заявлению."
        }
        action={
          !queue && (
            <ActionLink
              to="/requests/new"
              iconStart={<Plus aria-hidden="true" />}
            >
              Создать заявление
            </ActionLink>
          )
        }
      />
      <div className="stack">
        <div className="filter-bar">
          <label className="field">
            Поиск
            <Input
              type="search"
              placeholder="Причина или имя сотрудника"
              value={search}
              onChange={(e) => filter("search", e.target.value)}
            />
          </label>
          <label className="field">
            Тип
            <NativeSelect
              value={kind ?? ""}
              onChange={(e) => filter("type", e.target.value)}
            >
              <option value="">Все типы</option>
              <option value="leave">Отпуск</option>
              <option value="advance">Аванс</option>
            </NativeSelect>
          </label>
          <label className="field">
            Этап
            <NativeSelect
              value={validStatus ?? ""}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">Все этапы</option>
              <option value="draft">Черновик</option>
              <option value="returned">На исправлении</option>
              <option value="pending_manager">У руководителя</option>
              <option value="pending_hr">У HR</option>
              <option value="approved">Согласовано</option>
              <option value="rejected">Отклонено</option>
              <option value="cancelled">Отменено</option>
            </NativeSelect>
          </label>
        </div>
        {requests.isPending ? (
          <LoadingState />
        ) : requests.error ? (
          <ErrorNotice
            error={requests.error}
            retry={() => void requests.refetch()}
          />
        ) : (
          requests.data && (
            <DataSection
              title={queue ? "Заявления на рассмотрение" : "Заявления"}
            >
              {requests.data.results.length ? (
                <div className="rq-list">
                  {requests.data.results.map((record) => (
                    <article key={record.id} className="rq-row">
                      <div>
                        <h3>
                          <Link
                            className="text-link"
                            to={`/requests/${record.id}`}
                          >
                            {record.kind === "leave"
                              ? "Отпуск"
                              : "Зарплатный аванс"}
                            {queue ? ` · ${record.employee_name}` : ""}
                          </Link>
                        </h3>
                        <p>
                          <RequestSummary record={record} />
                        </p>
                        <div className="rq-meta">
                          <span>Создано {date(record.created_at)}</span>
                          <span>Версия {record.version}</span>
                          <span>
                            {record.status === "pending_manager"
                              ? "Рассматривает назначенный руководитель"
                              : record.status === "pending_hr"
                                ? "Рассматривает HR"
                                : ""}
                          </span>
                        </div>
                      </div>
                      <StatusLabel status={record.status} />
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={
                    search || kind || validStatus
                      ? "Нет заявлений по фильтрам"
                      : queue
                        ? "Решений не требуется"
                        : "Заявлений пока нет"
                  }
                  description={
                    search || kind || validStatus
                      ? "Измените фильтры или очистите их."
                      : queue
                        ? "Новые заявления появятся, когда будут доступны вам для рассмотрения."
                        : "Создайте заявление на отпуск или зарплатный аванс."
                  }
                  action={
                    search || kind || validStatus ? (
                      <ActionButton
                        variant="secondary"
                        onClick={() =>
                          setParams(
                            queue ? { kind: params.get("kind") ?? "" } : {},
                          )
                        }
                      >
                        Сбросить фильтры
                      </ActionButton>
                    ) : (
                      !queue && (
                        <Link className="text-link" to="/requests/new">
                          Создать заявление
                        </Link>
                      )
                    )
                  }
                />
              )}
              <PaginationBar
                count={requests.data.count}
                page={page}
                onPage={(nextPage) =>
                  setParams((previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("page", String(nextPage));
                    return next;
                  })
                }
              />
            </DataSection>
          )
        )}
        <DemoNote />
      </div>
    </>
  );
}

export function RequestsPage() {
  return <RequestsList />;
}
export function RequestQueuePage() {
  return <RequestsList queue />;
}

function LeaveBalance() {
  const balance = useQuery({
    queryKey: ["leave-balance"],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/requests/leave-balance/", { signal })),
  });
  return (
    <DataSection
      title="Отпускные дни"
      description="Синтетическая политика считает календарные дни включительно."
    >
      {balance.isPending ? (
        <LoadingState />
      ) : balance.error ? (
        <ErrorNotice
          error={balance.error}
          retry={() => void balance.refetch()}
        />
      ) : (
        balance.data && (
          <>
            <div className="rq-balance">
              <p>
                <strong>{balance.data.official_balance}</strong>Официальный
                остаток на {date(balance.data.balance_as_of)}
              </p>
              <p>
                <strong>{balance.data.portal_reserved_days}</strong>
                Зарезервировано в портале
              </p>
              <p>
                <strong>{balance.data.projected_balance}</strong>Прогноз
                доступных дней
              </p>
            </div>
            <p className="muted">
              Учтено источником {balance.data.source_incorporated_days} дней.
              Прогноз относится к существующим заявлениям и ещё не вычитает даты
              в этой форме.
            </p>
          </>
        )
      )}
    </DataSection>
  );
}

function RequestFieldsForm({
  values,
  setValues,
  disabled,
}: {
  values: RequestFields;
  setValues: (values: RequestFields) => void;
  disabled: boolean;
}) {
  return (
    <fieldset disabled={disabled} className="rq-fieldset form-stack">
      {values.kind === "leave" ? (
        <div className="form-grid">
          <label className="field">
            Первый день отпуска
            <Input
              name="start_date"
              type="date"
              required
              value={values.start_date}
              onChange={(e) =>
                setValues({ ...values, start_date: e.target.value })
              }
            />
          </label>
          <label className="field">
            Последний день отпуска
            <Input
              name="end_date"
              type="date"
              required
              min={values.start_date || undefined}
              value={values.end_date}
              onChange={(e) =>
                setValues({ ...values, end_date: e.target.value })
              }
            />
          </label>
        </div>
      ) : (
        <div className="form-grid">
          <label className="field">
            Сумма аванса, KZT
            <Input
              name="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={values.amount}
              onChange={(e) => setValues({ ...values, amount: e.target.value })}
            />
          </label>
          <label className="field">
            Желаемая дата выплаты
            <Input
              name="requested_payment_date"
              type="date"
              required
              value={values.requested_payment_date}
              onChange={(e) =>
                setValues({ ...values, requested_payment_date: e.target.value })
              }
            />
          </label>
        </div>
      )}
      <label className="field">
        Причина
        <Textarea
          name="reason"
          rows={4}
          maxLength={2000}
          value={values.reason}
          onChange={(e) => setValues({ ...values, reason: e.target.value })}
        />
      </label>
    </fieldset>
  );
}

export function RequestCreatePage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [values, setValues] = useState<RequestFields>(() =>
    params.get("type") === "advance"
      ? {
          kind: "advance",
          amount: "",
          currency: "KZT",
          requested_payment_date: "",
          reason: "",
        }
      : { kind: "leave", start_date: "", end_date: "", reason: "" },
  );
  const create = useCommand(async (body: Model<"RequestCreateRequest">, key) =>
    unwrap(
      await api.POST("/api/v1/requests/", {
        body,
        params: { header: { "Idempotency-Key": key } },
      }),
    ),
  );
  function save(body: Model<"RequestCreateRequest">) {
    create.mutate(body, {
      onSuccess: (record) => void navigate(`/requests/${record.id}`),
    });
  }
  return (
    <>
      <BackLink to="/requests">К заявлениям</BackLink>
      <PageHeader
        title="Новое заявление"
        description="Сначала сохраните черновик. Проверьте данные и отправьте его на рассмотрение."
      />
      <div className="stack">
        <DataSection title="Данные заявления">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              save(values);
            }}
          >
            <label className="field">
              Тип заявления
              <NativeSelect
                disabled={create.isPending}
                value={values.kind}
                onChange={(e) =>
                  setValues(
                    e.target.value === "advance"
                      ? {
                          kind: "advance",
                          amount: "",
                          currency: "KZT",
                          requested_payment_date: "",
                          reason: values.reason,
                        }
                      : {
                          kind: "leave",
                          start_date: "",
                          end_date: "",
                          reason: values.reason,
                        },
                  )
                }
              >
                <option value="leave">Отпуск</option>
                <option value="advance">Зарплатный аванс</option>
              </NativeSelect>
            </label>
            <RequestFieldsForm
              values={values}
              setValues={setValues}
              disabled={create.isPending}
            />
            <WriteRecovery
              error={create.error}
              retry={
                create.variables
                  ? () => {
                      if (create.variables) save(create.variables);
                    }
                  : undefined
              }
            />
            <div className="button-row">
              <ActionButton type="submit" loading={create.isPending}>
                Сохранить черновик
              </ActionButton>
              <Link className="text-link" to="/requests">
                К списку заявлений
              </Link>
            </div>
          </form>
        </DataSection>
        {values.kind === "leave" && <LeaveBalance />}
        <p className="muted">
          Демонстрационный порядок рассмотрения. Руководитель, затем HR. Если
          руководитель не назначен, заявление направляется HR.
        </p>
        <DemoNote />
      </div>
    </>
  );
}

function RequestEditor({
  record,
  refresh,
}: {
  record: RequestRecord;
  refresh: () => Promise<RequestRecord | undefined>;
}) {
  const client = useQueryClient();
  const [values, setValues] = useState(() => initialFields(record));
  const [version, setVersion] = useState(record.version);
  const [saved, setSaved] = useState(false);
  const save = useCommand(async ({ id, ...body }: EditIntent, key) =>
    unwrap(
      await api.PATCH("/api/v1/requests/{id}/", {
        body,
        params: {
          path: { id },
          header: { "Idempotency-Key": key },
        },
      }),
    ),
  );
  const dirty =
    JSON.stringify(values) !== JSON.stringify(initialFields(record));
  function persist(body: EditIntent) {
    save.mutate(body, {
      onSuccess: (result) => {
        setVersion(result.version);
        setSaved(true);
        client.setQueryData(["request", record.id], result);
      },
    });
  }
  return (
    <>
      <DataSection
        title={
          record.status === "returned"
            ? "Исправить заявление"
            : "Редактировать черновик"
        }
        description={`Редактируете на основе версии ${version}. Сохраните изменения перед отправкой.`}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            const { kind, ...fields } = values;
            persist({ id: record.id, ...fields, expected_version: version });
          }}
        >
          <RequestFieldsForm
            values={values}
            setValues={(next) => {
              setValues(next);
              setSaved(false);
            }}
            disabled={save.isPending}
          />
          <WriteRecovery
            error={save.error}
            refresh={() => {
              void refresh().then((current) => {
                if (current) {
                  setVersion(current.version);
                  save.reset();
                }
              });
            }}
            retry={
              save.variables
                ? () => {
                    if (save.variables) persist(save.variables);
                  }
                : undefined
            }
          />
          <p role="status" className="muted">
            {saved && !dirty
              ? "Изменения сохранены."
              : dirty
                ? "Есть несохранённые изменения. Сохраните их, чтобы перейти к отправке."
                : ""}
          </p>
          <ActionButton type="submit" loading={save.isPending}>
            Сохранить изменения
          </ActionButton>
        </form>
      </DataSection>
      {!dirty && !save.isPending && (
        <RequestActions record={record} refresh={refresh} />
      )}
    </>
  );
}

function RequestActions({
  record,
  refresh,
}: {
  record: RequestRecord;
  refresh: () => Promise<RequestRecord | undefined>;
}) {
  const client = useQueryClient();
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<{
    action: RequestAction;
    expected_version: number;
  } | null>(null);
  const command = useCommand(
    async (
      intent: {
        id: string;
        action: RequestAction;
        expected_version: number;
        comment: string;
      },
      key,
    ) => {
      const body =
        intent.action === "submit" || intent.action === "cancel"
          ? { expected_version: intent.expected_version }
          : {
              expected_version: intent.expected_version,
              comment: intent.comment,
            };
      return unwrap(
        await api.POST(actionPaths[intent.action], {
          params: {
            path: { id: intent.id },
            header: { "Idempotency-Key": key },
          },
          body,
        }),
      );
    },
  );
  function run(intent: {
    id: string;
    action: RequestAction;
    expected_version: number;
    comment: string;
  }) {
    command.mutate(intent, {
      onSuccess: (result) => {
        client.setQueryData(["request", record.id], result);
        setSelected(null);
        setComment("");
      },
    });
  }
  const allActions: RequestAction[] = [
    "submit",
    "approve",
    "return_for_changes",
    "reject",
    "cancel",
  ];
  const actions = allActions.filter((action) =>
    record.allowed_actions.includes(action),
  );
  if (!actions.length)
    return (
      <p className="notice-panel">
        Сейчас нет доступных команд. Следующий этап и принятые решения указаны в
        истории.
      </p>
    );
  return (
    <DataSection
      title="Следующее действие"
      description="Доступные команды определяет сервер для текущей версии."
    >
      <div className="stack">
        <div className="button-row">
          {actions.map((action) => (
            <ActionButton
              key={action}
              variant={
                action === "approve" || action === "submit"
                  ? "default"
                  : "secondary"
              }
              disabled={command.isPending}
              onClick={() => {
                setSelected({ action, expected_version: record.version });
                command.reset();
              }}
            >
              {actionLabels[action]}
            </ActionButton>
          ))}
        </div>
        {selected && (
          <form
            className="form-stack notice-panel"
            onSubmit={(e) => {
              e.preventDefault();
              run({
                id: record.id,
                action: selected.action,
                comment,
                expected_version: selected.expected_version,
              });
            }}
          >
            <h3>{actionLabels[selected.action]}</h3>
            <p>
              {selected.action === "cancel"
                ? "Заявление будет отменено. Его история сохранится."
                : selected.action === "submit"
                  ? "На рассмотрение уйдут последние сохранённые данные. Проверьте их выше."
                  : "Решение будет записано в историю вместе с вашим именем и комментарием."}
            </p>
            {selected.action !== "cancel" && selected.action !== "submit" && (
              <label className="field">
                Комментарий
                {selected.action !== "approve"
                  ? " · обязательно"
                  : " · необязательно"}
                <Textarea
                  rows={3}
                  required={selected.action !== "approve"}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={command.isPending}
                />
              </label>
            )}
            <div className="button-row">
              <ActionButton type="submit" loading={command.isPending}>
                {actionLabels[selected.action]}
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={command.isPending}
                onClick={() => setSelected(null)}
              >
                Вернуться без действия
              </ActionButton>
            </div>
          </form>
        )}
        <WriteRecovery
          error={command.error}
          refresh={() => {
            void refresh().then(() => {
              command.reset();
              setSelected(null);
            });
          }}
          retry={
            command.variables
              ? () => {
                  if (command.variables) run(command.variables);
                }
              : undefined
          }
        />
        <p role="status">
          {command.isSuccess
            ? "Действие сохранено. Показана новая версия."
            : ""}
        </p>
      </div>
    </DataSection>
  );
}

const historyLabels: Record<string, string> = {
  created: "Создан черновик",
  edited: "Сохранены изменения",
  submitted: "Отправлено на рассмотрение",
  approved: "Одобрено",
  returned: "Возвращено на исправление",
  rejected: "Отклонено",
  cancelled: "Отменено",
};

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
