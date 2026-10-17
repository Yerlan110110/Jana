import { ActionLink, ActionButton as Button } from "@/components/actions";
import { Card } from "@/components/pace/card";
import { NativeSelect } from "@/components/pace/native-select";
import { Textarea } from "@/components/pace/textarea";
import {
  BackLink,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
  StatusLabel,
} from "@/components/ui";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, CheckCheck, FileText } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";
import { PublishedPolicy } from "./reading";

export function CasesPage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const state = params.get("status") === "resolved" ? "resolved" : "open";
  const query = useQuery({
    queryKey: [user.id, "cases", state, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/gaps/", {
          params: { query: { status: state, page } },
          signal,
        }),
      ),
  });
  return (
    <>
      <PageHeader
        eyebrow={user.role === "hr" ? "HR · БАЗА ЗНАНИЙ" : "ВОПРОСЫ И ОТВЕТЫ"}
        title={
          user.role === "hr" ? "Обращения сотрудников" : "Мои обращения к HR"
        }
        description="От вопроса к человеческому ответу и проверяемому основанию."
      />
      <div className="filter-bar">
        <label htmlFor="case-state">Состояние</label>
        <NativeSelect
          id="case-state"
          value={state}
          onChange={(event) => setParams({ status: event.target.value })}
        >
          <option value="open">Ждут ответа</option>
          <option value="resolved">Ответ получен</option>
        </NativeSelect>
      </div>
      <Card className="records-panel">
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorNotice
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <>
            <div className="record-list">
              {query.data.results.map((record) => (
                <Link
                  className="record-row"
                  key={record.id}
                  to={`/knowledge/cases/${record.id}`}
                >
                  <span className="record-icon">
                    <FileText size={19} aria-hidden="true" />
                  </span>
                  <div className="record-main">
                    <h2>{record.question}</h2>
                    <p>
                      № {record.id.slice(0, 8)} · {date(record.created_at)}
                    </p>
                  </div>
                  <StatusLabel status={record.status} />
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
            {!query.data.count && (
              <EmptyState
                title="Таких обращений пока нет"
                description="Открытые вопросы и ответы HR будут сохранены здесь."
              />
            )}
            <PaginationBar
              count={query.data.count ?? 0}
              page={page}
              onPage={(next) =>
                setParams({ status: state, page: String(next) })
              }
            />
          </>
        )}
      </Card>
    </>
  );
}

export function CasePage() {
  const { id = "" } = useParams();
  const { user, employee } = useSession();
  const [response, setResponse] = useState("");
  const [revisionId, setRevisionId] = useState("");
  const query = useQuery({
    queryKey: [user.id, "case", id],
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/gaps/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const documents = useQuery({
    queryKey: [user.id, "policy-options"],
    enabled: user.role === "hr",
    queryFn: async ({ signal }) => {
      const records: Model<"DocumentAdmin">[] = [];
      let page = 1;
      while (true) {
        const result = unwrap(
          await api.GET("/api/v1/knowledge/admin/documents/", {
            params: { query: { state: "published", page_size: 100, page } },
            signal,
          }),
        );
        records.push(...result.results);
        if (!result.next) return records;
        page += 1;
      }
    },
  });
  const resolve = useCommand(
    async (
      { id: caseId, ...values }: Model<"GapResolutionRequest"> & { id: string },
      key,
    ) =>
      unwrap(
        await api.POST("/api/v1/knowledge/gaps/{id}/resolve/", {
          params: { path: { id: caseId }, header: { "Idempotency-Key": key } },
          body: values,
        }),
      ),
  );
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <>
        <BackLink to="/knowledge/cases">К обращениям</BackLink>
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  const record = query.data;
  return (
    <>
      <BackLink to="/knowledge/cases">К обращениям</BackLink>
      <PageHeader
        eyebrow={`ОБРАЩЕНИЕ № ${record.id.slice(0, 8)}`}
        title={record.question}
        description={`Создано ${date(record.created_at)}`}
        action={<StatusLabel status={record.status} />}
      />
      <Card className="reading-card">
        <h2>Вопрос сотрудника</h2>
        <p className="preserve-lines">{record.details || record.question}</p>
        {record.employee === employee?.id && (
          <Link
            className="text-link"
            to={`/assistant/answers/${record.answer}`}
          >
            Первоначальный ответ Jana{" "}
            <ArrowRight size={14} aria-hidden="true" />
          </Link>
        )}
        {record.status === "resolved" && (
          <div className="hr-response">
            <div className="answer-mode">
              <CheckCheck size={18} aria-hidden="true" />
              Ответ HR · {date(record.resolved_at)}
            </div>
            <p className="preserve-lines">{record.response}</p>
            {record.policy_reference && (
              <div className="standing-note">
                {record.policy_reference.state === "unavailable" ? (
                  "Опубликованное основание сейчас недоступно. Уточните актуальное правило у HR."
                ) : (
                  <>
                    <p>
                      {record.policy_reference.state === "current"
                        ? "Ответ связан с опубликованным регламентом."
                        : "После ответа появилась новая редакция регламента."}
                    </p>
                    <ActionLink
                      variant="secondary"
                      to={`/knowledge/cases/${id}/source`}
                    >
                      Проверить основание
                    </ActionLink>
                  </>
                )}
              </div>
            )}
            {record.resolution_kind === "individual_answer" && (
              <p className="muted">
                Это индивидуальный ответ HR. Он не публикует новый регламент и
                не обучает модель.
              </p>
            )}
          </div>
        )}
        {record.allowed_actions.includes("resolve") && (
          <form
            className="domain-form"
            onSubmit={(event) => {
              event.preventDefault();
              void resolve
                .mutateAsync({
                  id: record.id,
                  expected_version: record.version,
                  response,
                  ...(revisionId ? { published_revision_id: revisionId } : {}),
                })
                .then(() =>
                  toast.success("Ответ сохранён и доступен сотруднику"),
                )
                .catch(() => undefined);
            }}
          >
            <h2>Подготовить ответ</h2>
            <label htmlFor="hr-response">Ответ сотруднику</label>
            <Textarea
              id="hr-response"
              rows={5}
              required
              minLength={10}
              maxLength={8000}
              value={response}
              onChange={(event) => setResponse(event.target.value)}
            />
            <label htmlFor="policy-reference">Опубликованное основание</label>
            <NativeSelect
              id="policy-reference"
              value={revisionId}
              onChange={(event) => setRevisionId(event.target.value)}
            >
              <option value="">Индивидуальный ответ без нового правила</option>
              {documents.data
                ?.filter((document) => document.current_revision)
                .map((document) => (
                  <option
                    key={document.id}
                    value={document.current_revision.id}
                  >
                    {document.title} · Редакция{" "}
                    {document.current_revision.number}
                  </option>
                ))}
            </NativeSelect>
            <p className="field-help">
              Основание должно быть доступно сотруднику. Если правила нет,{" "}
              <Link
                className="text-link"
                to="/hr/policies/new"
                target="_blank"
                rel="noopener noreferrer"
              >
                создайте и опубликуйте регламент в новой вкладке
              </Link>
              , затем обновите список.
            </p>
            <Button
              variant="secondary"
              onClick={() => {
                void documents.refetch();
              }}
            >
              Обновить регламенты
            </Button>
            <ErrorNotice error={documents.error} />
            <ErrorNotice
              error={resolve.error}
              retry={() => {
                void query.refetch();
              }}
            />
            <Button type="submit" loading={resolve.isPending}>
              Сохранить ответ и закрыть обращение
            </Button>
          </form>
        )}
      </Card>
    </>
  );
}

export function CaseSourcePage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const query = useQuery({
    queryKey: [user.id, "case-source", id],
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/gaps/{id}/policy-reference/", {
          params: { path: { id } },
          signal,
          cache: "no-store",
        }),
      ),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <>
        <BackLink to={`/knowledge/cases/${id}`}>К ответу HR</BackLink>
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  return (
    <>
      <BackLink to={`/knowledge/cases/${id}`}>К ответу HR</BackLink>
      {query.data.revision ? (
        <>
          <PageHeader
            eyebrow="ОСНОВАНИЕ ОТВЕТА HR"
            title={query.data.revision.title}
            description={
              query.data.state === "superseded"
                ? "Сохранённое основание. У документа есть новая редакция."
                : "Доступ проверен сервером при открытии."
            }
          />
          <PublishedPolicy revision={query.data.revision} />
        </>
      ) : (
        <EmptyState
          title="Основание недоступно"
          description="Обратитесь к HR для уточнения актуального правила."
        />
      )}
    </>
  );
}
