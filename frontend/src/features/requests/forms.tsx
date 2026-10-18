import { ActionButton } from "@/components/actions";
import { NativeSelect } from "@/components/pace/native-select";
import { Textarea } from "@/components/pace/textarea";
import {
  BackLink,
  DataSection,
  ErrorNotice,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { Input } from "@/components/upstream/input";
import { api, ApiError, unwrap, useCommand, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useId, useRef, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router";
import { z } from "zod";
import { RequestActions } from "./actions";
import type { EditIntent, RequestFields, RequestRecord } from "./common";
import { initialFields } from "./common";
import { WriteRecovery } from "./support";

type SubmittedFields = Partial<Pick<Model<"RequestCreateRequest">,
  "start_date" | "end_date" | "amount" | "requested_payment_date" | "reason">>;
const fieldMessage = z.union([z.string(), z.array(z.string())]);

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
  error,
  submittedValues,
}: {
  values: RequestFields;
  setValues: (values: RequestFields) => void;
  disabled: boolean;
  error?: unknown;
  submittedValues?: SubmittedFields;
}) {
  const prefix = useId();
  const fields = useRef<HTMLFieldSetElement>(null);
  const current: SubmittedFields = values;
  function message(name: keyof SubmittedFields) {
    if (!(error instanceof ApiError) || error.status !== 400 ||
      current[name] !== submittedValues?.[name]) return undefined;
    const parsed = fieldMessage.safeParse(error.fields[name]);
    return parsed.success
      ? typeof parsed.data === "string" ? parsed.data : parsed.data.join(" ")
      : undefined;
  }
  function inputProps(name: keyof SubmittedFields) {
    return {
      id: `${prefix}-${name}`,
      "aria-invalid": message(name) ? true : undefined,
      "aria-describedby": message(name) ? `${prefix}-${name}-error` : undefined,
    };
  }
  function errorText(name: keyof SubmittedFields) {
    const text = message(name);
    return text && <p id={`${prefix}-${name}-error`} className="field-error">{text}</p>;
  }
  useEffect(() => {
    if (error instanceof ApiError && error.status === 400)
      fields.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus();
  }, [error]);
  return (
    <fieldset ref={fields} disabled={disabled} className="rq-fieldset form-stack">
      {values.kind === "leave" ? (
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${prefix}-start_date`}>Первый день отпуска</label>
            <Input
              {...inputProps("start_date")}
              name="start_date"
              type="date"
              required
              value={values.start_date}
              onChange={(e) =>
                setValues({ ...values, start_date: e.target.value })
              }
            />
            {errorText("start_date")}
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-end_date`}>Последний день отпуска</label>
            <Input
              {...inputProps("end_date")}
              name="end_date"
              type="date"
              required
              min={values.start_date || undefined}
              value={values.end_date}
              onChange={(e) =>
                setValues({ ...values, end_date: e.target.value })
              }
            />
            {errorText("end_date")}
          </div>
        </div>
      ) : (
        <div className="form-grid">
          <div className="field">
            <label htmlFor={`${prefix}-amount`}>Сумма аванса, KZT</label>
            <Input
              {...inputProps("amount")}
              name="amount"
              type="number"
              inputMode="decimal"
              min="0.01"
              step="0.01"
              required
              value={values.amount}
              onChange={(e) => setValues({ ...values, amount: e.target.value })}
            />
            {errorText("amount")}
          </div>
          <div className="field">
            <label htmlFor={`${prefix}-requested_payment_date`}>Желаемая дата выплаты</label>
            <Input
              {...inputProps("requested_payment_date")}
              name="requested_payment_date"
              type="date"
              required
              value={values.requested_payment_date}
              onChange={(e) =>
                setValues({ ...values, requested_payment_date: e.target.value })
              }
            />
            {errorText("requested_payment_date")}
          </div>
        </div>
      )}
      <div className="field">
        <label htmlFor={`${prefix}-reason`}>Причина</label>
        <Textarea
          {...inputProps("reason")}
          name="reason"
          rows={4}
          maxLength={2000}
          value={values.reason}
          onChange={(e) => setValues({ ...values, reason: e.target.value })}
        />
        {errorText("reason")}
      </div>
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
              error={create.error}
              submittedValues={create.variables}
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
      </div>
    </>
  );
}

export function RequestEditor({
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
    const submittedValues = initialFields({ ...record, ...body });
    save.mutate(body, {
      onSuccess: (result) => {
        setVersion(result.version);
        setSaved(true);
        setValues((current) =>
          JSON.stringify(current) === JSON.stringify(submittedValues)
            ? initialFields(result)
            : current,
        );
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
            error={save.error}
            submittedValues={save.variables}
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
