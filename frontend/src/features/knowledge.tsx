import { useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import {
  ArrowRight,
  BookOpen,
  CheckCheck,
  FileText,
  Plus,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { ActionButton as Button, ActionLink } from "@/components/actions";
import { Card } from "@/components/pace/card";
import { Input } from "@/components/upstream/input";
import { Textarea } from "@/components/pace/textarea";
import { NativeSelect } from "@/components/pace/native-select";
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
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";

const modeLabels: Record<Model<"ModeEnum">, string> = {
  extractive: "Выдержки из регламента",
  generated: "Ответ по источникам",
  insufficient_evidence: "Основание не найдено",
  provider_unavailable: "Помощник временно недоступен",
};

export function AssistantPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [question, setQuestion] = useState(params.get("q") ?? "");
  const history = useQuery({
    queryKey: [session.user.id, "answers", page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/assistant/answers/", {
          params: { query: { page } },
          signal,
        }),
      ),
  });
  const ask = useCommand(async (text: string, key) => {
    const result = await api.POST("/api/v1/assistant/answers/", {
      body: { question: text, language: "ru", client_message_id: key },
    });
    if (result.error?.answer) return result.error.answer;
    return unwrap(result);
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const answer = await ask.mutateAsync(question.trim());
    navigate(`/assistant/answers/${answer.id}`);
  }
  return (
    <>
      <PageHeader
        eyebrow="AI JANA"
        title="Ответ начинается с источника"
        description="Задайте рабочий вопрос. Jana найдёт основание в доступных вам регламентах."
        action={
          <ActionLink variant="secondary" to="/knowledge">
            <BookOpen size={16} aria-hidden="true" />
            Все регламенты
          </ActionLink>
        }
      />
      <Card className="assistant-intro">
        <div className="assistant-symbol">
          <Sparkles size={28} aria-hidden="true" />
        </div>
        <h2>Что вы хотите узнать?</h2>
        <p>
          Отпуск, аванс, обучение или порядок работы.
          <br />
          Каждый ответ можно проверить по опубликованной версии.
        </p>
        <form
          onSubmit={(event) => {
            void submit(event).catch(() => undefined);
          }}
          className="question-form"
        >
          <label className="sr-only" htmlFor="question">
            Ваш вопрос
          </label>
          <Textarea
            id="question"
            name="question"
            minLength={8}
            maxLength={2000}
            required
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Например, как подать заявление на отпуск?"
            rows={3}
          />
          <div className="question-footer">
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              Только доступные вам источники
            </span>
            <Button
              type="submit"
              loading={ask.isPending}
              loadingLabel="Ищем основание"
              iconEnd={<Send size={16} aria-hidden="true" />}
            >
              Найти ответ
            </Button>
          </div>
        </form>
        <ErrorNotice error={ask.error} />
        <div className="suggested-questions">
          {[
            "Как подать заявление на отпуск?",
            "Что делать, если заявку вернули?",
            "Как пройти назначенный курс?",
          ].map((text) => (
            <Button
              key={text}
              variant="secondary"
              size="sm"
              onClick={() => setQuestion(text)}
            >
              {text}
            </Button>
          ))}
        </div>
      </Card>
      <div className="explanation-line">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Без подключённой модели Jana показывает найденные фрагменты. Если
          основания нет, можно обратиться к HR. Помощник не принимает кадровых
          решений.
        </p>
      </div>
      <DataSection
        title="Ваши вопросы"
        description="Сохранённые ответы и их основания"
        action={
          <Link className="text-link" to="/knowledge/cases">
            Обращения к HR <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        {history.isPending ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorNotice
            error={history.error}
            retry={() => {
              void history.refetch();
            }}
          />
        ) : history.data.results.length ? (
          <div className="record-list">
            {history.data.results.map((answer) => (
              <Link
                className="record-row"
                key={answer.id}
                to={`/assistant/answers/${answer.id}`}
              >
                <span className="record-icon">
                  <FileText size={19} aria-hidden="true" />
                </span>
                <div className="record-main">
                  <h3>{answer.question}</h3>
                  <p>
                    {modeLabels[answer.mode]} · {date(answer.created_at)}
                  </p>
                </div>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Здесь появятся ваши ответы"
            description="Задайте первый вопрос. Он сохранится вместе с основанием ответа."
          />
        )}
        {history.data && (
          <PaginationBar
            count={history.data.count ?? 0}
            page={page}
            onPage={(next) => {
              const updated = new URLSearchParams(params);
              updated.set("page", String(next));
              setParams(updated);
            }}
          />
        )}
      </DataSection>
      <DemoNote />
    </>
  );
}

export function AnswerPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const answer = useQuery({
    queryKey: [user.id, "answer", id],
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/assistant/answers/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const escalation = useCommand(async (answerId: string, key) =>
    unwrap(
      await api.POST("/api/v1/knowledge/gaps/", {
        body: { answer_id: answerId, details: "" },
        params: { header: { "Idempotency-Key": key } },
      }),
    ),
  );
  if (answer.isPending) return <LoadingState />;
  if (answer.isError)
    return (
      <>
        <BackLink to="/assistant">К вопросам</BackLink>
        <ErrorNotice
          error={answer.error}
          retry={() => {
            void answer.refetch();
          }}
        />
      </>
    );
  const record = answer.data;
  return (
    <>
      <BackLink to="/assistant">К вопросам</BackLink>
      <PageHeader
        eyebrow="ВАШ ВОПРОС"
        title={record.question}
        description={date(record.created_at)}
      />
      <Card className="answer-card">
        <div className="answer-mode">
          <Sparkles size={18} aria-hidden="true" />
          {modeLabels[record.mode]}
        </div>
        <div className="prose">
          <p>{record.message}</p>
          {record.claims.map((claim, index) => (
            <p key={index}>{claim.text}</p>
          ))}
        </div>
        {record.evidence_status === "superseded" && (
          <p className="standing-note">
            У источника появилась новая редакция. Откройте регламент и проверьте
            действующую версию.
          </p>
        )}
        {record.evidence_status === "unavailable" && (
          <p className="standing-note">
            Прежнее основание больше недоступно. Старый ответ не подтверждает
            действующее правило.
          </p>
        )}
        {record.citations.length > 0 && (
          <div className="source-list">
            <h2>Проверьте основание</h2>
            {record.citations.map((citation) => (
              <Link
                className="source-card"
                key={citation.chunk_id}
                to={`/knowledge/citations/${citation.chunk_id}`}
              >
                <FileText size={20} aria-hidden="true" />
                <div>
                  <h3>{citation.title}</h3>
                  <p>
                    {citation.heading} · Редакция {citation.revision_number} ·{" "}
                    {citation.language === "ru" ? "Русский" : "Қазақша"}
                  </p>
                </div>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
        <div className="action-row">
          {record.allowed_actions.includes("escalate_to_hr") && (
            <Button
              loading={escalation.isPending}
              onClick={() => {
                void escalation
                  .mutateAsync(record.id)
                  .then((result) => {
                    toast.success("Обращение отправлено HR");
                    navigate(`/knowledge/cases/${result.id}`);
                  })
                  .catch(() => undefined);
              }}
            >
              Обратиться к HR
            </Button>
          )}
          {record.case_id && (
            <ActionLink
              variant="secondary"
              to={`/knowledge/cases/${record.case_id}`}
            >
              Открыть обращение
            </ActionLink>
          )}
          <ActionLink
            variant="secondary"
            to={`/assistant?q=${encodeURIComponent(record.question)}`}
          >
            Задать вопрос снова
          </ActionLink>
        </div>
        <ErrorNotice error={escalation.error} />
      </Card>
      <DemoNote />
    </>
  );
}

export function CitationPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const query = useQuery({
    queryKey: [user.id, "citation", id],
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/citations/{id}/", {
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
        <BackLink to="/assistant">К вопросам</BackLink>
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  const source = query.data;
  return (
    <>
      <BackLink to="/assistant">К вопросам</BackLink>
      <PageHeader
        eyebrow="ПРОВЕРЕННОЕ ОСНОВАНИЕ"
        title={source.title}
        description={`Редакция ${source.revision_number} · Опубликовано ${date(source.published_at)}`}
      />
      <Card className="reading-card">
        <div className="source-metadata">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            {source.is_current
              ? "Действующая редакция"
              : "Сохранённая предыдущая редакция"}
          </span>
          <span>
            {source.language === "ru"
              ? "Материал на русском"
              : "Қазақша материал"}
          </span>
        </div>
        <h2>{source.heading}</h2>
        <blockquote>{source.text}</blockquote>
        <p className="muted">
          Действует с {date(source.effective_from)}
          {source.effective_until
            ? ` до ${date(source.effective_until)}`
            : ""}{" "}
          · {source.locator}
        </p>
        <details className="evidence-details">
          <summary>Версия и контрольная сумма</summary>
          <code>
            {source.revision_id}
            <br />
            {source.content_hash}
          </code>
        </details>
        {source.is_synthetic && <DemoNote />}
      </Card>
    </>
  );
}

export function DocumentsPage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? 1);
  const query = useQuery({
    queryKey: [user.id, "documents", search, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/documents/", {
          params: { query: { search, page } },
          signal,
        }),
      ),
  });
  const setSearch = (value: string) =>
    setParams(value ? { search: value } : {});
  return (
    <>
      <PageHeader
        eyebrow="БАЗА ЗНАНИЙ"
        title="Правила, к которым можно вернуться"
        description="Опубликованные регламенты в вашей области доступа."
        action={
          user.role === "hr" ? (
            <ActionLink to="/hr/policies">
              <FileText size={16} aria-hidden="true" />
              Управлять регламентами
            </ActionLink>
          ) : undefined
        }
      />
      <div className="filter-bar">
        <Input
          aria-label="Поиск регламентов"
          placeholder="Найти регламент"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
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
          <div className="document-grid">
            {query.data.results.map((document) => (
              <Card key={document.id} className="document-card">
                <div className="category-icon">
                  <FileText size={22} aria-hidden="true" />
                </div>
                <p className="eyebrow">РЕДАКЦИЯ {document.revision.number}</p>
                <h2>
                  <Link to={`/knowledge/documents/${document.id}`}>
                    {document.revision.title}
                  </Link>
                </h2>
                <p>{document.revision.summary}</p>
                <div className="card-end">
                  <span>
                    {document.revision.language === "ru"
                      ? "На русском"
                      : "Қазақша"}
                  </span>
                  <Link
                    className="text-link"
                    to={`/knowledge/documents/${document.id}`}
                  >
                    Открыть <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          {!query.data.count && (
            <EmptyState
              title={
                search
                  ? "Регламент не найден"
                  : "Пока нет опубликованных регламентов"
              }
              description={
                search
                  ? "Попробуйте другой запрос или задайте вопрос HR."
                  : "HR опубликует материалы, доступные вашей роли."
              }
            />
          )}
          <PaginationBar
            count={query.data.count ?? 0}
            page={page}
            onPage={(next) => setParams({ search, page: String(next) })}
          />
        </>
      )}
      <DemoNote />
    </>
  );
}

function PublishedPolicy({ revision }: { revision: Model<"Revision"> }) {
  return (
    <Card className="reading-card">
      <div className="source-metadata">
        <ShieldCheck size={18} aria-hidden="true" />
        Редакция {revision.number} · Действует с {date(revision.effective_from)}
      </div>
      <div className="prose">
        {revision.sections.map((section, index) => (
          <section key={index}>
            <h2>{section.heading}</h2>
            <p className="preserve-lines">{section.text}</p>
          </section>
        ))}
      </div>
      <details className="evidence-details">
        <summary>Сведения о публикации</summary>
        <p>Опубликовано {date(revision.published_at)}</p>
        <code>{revision.content_hash}</code>
      </details>
      {revision.is_synthetic && <DemoNote />}
    </Card>
  );
}

export function DocumentPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const query = useQuery({
    queryKey: [user.id, "document", id],
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/documents/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <>
        <BackLink to="/knowledge">К регламентам</BackLink>
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
      <BackLink to="/knowledge">К регламентам</BackLink>
      <PageHeader
        eyebrow="БАЗА ЗНАНИЙ"
        title={query.data.revision.title}
        description={query.data.revision.summary}
      />
      <PublishedPolicy revision={query.data.revision} />
    </>
  );
}

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
      values: {
        expected_version: number;
        response: string;
        published_revision_id?: string;
      },
      key,
    ) =>
      unwrap(
        await api.POST("/api/v1/knowledge/gaps/{id}/resolve/", {
          params: { path: { id }, header: { "Idempotency-Key": key } },
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

export function ManagePoliciesPage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const page = Number(params.get("page") ?? 1);
  const query = useQuery({
    queryKey: [user.id, "manage-policies", page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/admin/documents/", {
          params: { query: { page } },
          signal,
        }),
      ),
  });
  return (
    <>
      <PageHeader
        eyebrow="HR · ПУБЛИКАЦИИ"
        title="Регламенты компании"
        description="Черновик остаётся у HR. Публикация создаёт неизменяемую редакцию."
        action={
          <ActionLink to="/hr/policies/new">
            <Plus size={16} aria-hidden="true" />
            Создать регламент
          </ActionLink>
        }
      />
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
              {query.data.results.map((document) => (
                <Link
                  className="record-row"
                  key={document.id}
                  to={`/hr/policies/${document.id}`}
                >
                  <span className="record-icon">
                    <FileText size={19} aria-hidden="true" />
                  </span>
                  <div className="record-main">
                    <h2>{document.title}</h2>
                    <p>
                      Версия записи {document.version} ·{" "}
                      {document.has_unpublished_changes
                        ? "Есть неопубликованные изменения"
                        : "Публикация актуальна"}
                    </p>
                  </div>
                  <StatusLabel status={document.state} />
                  <ArrowRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </div>
            {!query.data.count && (
              <EmptyState
                title="Регламентов пока нет"
                description="Подготовьте первый черновик и опубликуйте проверенное правило."
              />
            )}
            <PaginationBar
              count={query.data.count ?? 0}
              page={page}
              onPage={(next) => setParams({ page: String(next) })}
            />
          </>
        )}
      </Card>
    </>
  );
}

export function PolicyEditorPage() {
  const { id } = useParams();
  const { user } = useSession();
  const query = useQuery({
    queryKey: [user.id, "manage-policy", id],
    enabled: Boolean(id),
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/admin/documents/{id}/", {
          params: { path: { id: id ?? "" } },
          signal,
        }),
      ),
  });
  if (id && query.isPending) return <LoadingState />;
  if (id && query.isError)
    return (
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );
  return (
    <PolicyEditor
      key={id ?? "new"}
      document={query.data}
      reload={async () => (await query.refetch()).data}
    />
  );
}

type PolicyDraft = Pick<
  Model<"DocumentCreateRequest">,
  | "title"
  | "summary"
  | "topic"
  | "audience"
  | "language"
  | "draft_sections"
  | "effective_from"
  | "effective_until"
>;

function policyDraft(document?: Model<"DocumentAdmin">): PolicyDraft {
  return {
    title: document?.title ?? "",
    summary: document?.summary ?? "",
    topic: document?.topic ?? "hr",
    audience: document?.audience ?? "all",
    language: document?.language ?? "ru",
    draft_sections: document?.draft_sections ?? [{ heading: "", text: "" }],
    effective_from:
      document?.effective_from ??
      new Intl.DateTimeFormat("sv-SE", { timeZone: "Asia/Almaty" }).format(
        new Date(),
      ),
    effective_until: document?.effective_until ?? null,
  };
}

function PolicyEditor({
  document,
  reload,
}: {
  document?: Model<"DocumentAdmin">;
  reload: () => Promise<Model<"DocumentAdmin"> | undefined>;
}) {
  const navigate = useNavigate();
  const { employee } = useSession();
  const [editor, setEditor] = useState(() => {
    const draft = policyDraft(document);
    return {
      draft,
      baseVersion: document?.version ?? 0,
      saved: JSON.stringify(draft),
    };
  });
  const { draft, baseVersion, saved } = editor;
  const dirty = JSON.stringify(draft) !== saved;
  const stale = Boolean(document && document.version !== baseVersion);
  function update<K extends keyof PolicyDraft>(key: K, value: PolicyDraft[K]) {
    setEditor((current) => ({
      ...current,
      draft: { ...current.draft, [key]: value },
    }));
  }
  function acceptSaved(record: Model<"DocumentAdmin">) {
    const next = policyDraft(record);
    setEditor({
      draft: next,
      baseVersion: record.version,
      saved: JSON.stringify(next),
    });
  }
  const save = useCommand(
    async (values: { draft: PolicyDraft; expected_version: number }, key) =>
      document
        ? unwrap(
            await api.PATCH("/api/v1/knowledge/admin/documents/{id}/", {
              params: {
                path: { id: document.id },
                header: { "Idempotency-Key": key },
              },
              body: {
                ...values.draft,
                expected_version: values.expected_version,
              },
            }),
          )
        : unwrap(
            await api.POST("/api/v1/knowledge/admin/documents/", {
              params: { header: { "Idempotency-Key": key } },
              body: {
                ...values.draft,
                slug: `policy-${key}`,
                legal_entity: employee?.legal_entity.id,
                is_synthetic: true,
              },
            }),
          ),
  );
  const publish = useCommand(async (version: number, key) =>
    unwrap(
      await api.POST("/api/v1/knowledge/admin/documents/{id}/publish/", {
        params: {
          path: { id: document?.id ?? "" },
          header: { "Idempotency-Key": key },
        },
        body: { expected_version: version },
      }),
    ),
  );
  const archive = useCommand(async (version: number, key) =>
    unwrap(
      await api.POST("/api/v1/knowledge/admin/documents/{id}/archive/", {
        params: {
          path: { id: document?.id ?? "" },
          header: { "Idempotency-Key": key },
        },
        body: { expected_version: version },
      }),
    ),
  );
  const busy = save.isPending || publish.isPending || archive.isPending;
  async function loadCurrentDraft() {
    if (
      dirty &&
      !window.confirm(
        "Загрузить текущий черновик с сервера? Несохранённые поля будут заменены.",
      )
    )
      return;
    const current = await reload();
    if (!current) return;
    acceptSaved(current);
    save.reset();
    publish.reset();
    archive.reset();
  }
  const topics = [
    { value: "hr", label: "Кадровые вопросы" },
    { value: "leave", label: "Отпуск" },
    { value: "advance", label: "Аванс" },
    { value: "learning", label: "Обучение" },
    { value: "operations", label: "Рабочий порядок" },
  ];
  return (
    <>
      <BackLink to="/hr/policies">К регламентам</BackLink>
      <PageHeader
        eyebrow="HR · РЕДАКТОР"
        title={document ? document.title : "Новый регламент"}
        description="Проверьте содержание, срок действия и аудиторию. Публикация создаст отдельную сохранённую редакцию."
        action={document && <StatusLabel status={document.state} />}
      />
      {stale && (
        <div className="standing-note" role="status">
          Черновик на сервере изменился. Ваши поля сохранены в форме. Загрузите
          текущую версию перед следующим действием.
        </div>
      )}
      {document && (
        <Button
          variant="secondary"
          disabled={busy}
          onClick={() => {
            void loadCurrentDraft();
          }}
        >
          Загрузить текущий черновик
        </Button>
      )}
      <Card className="editor-card">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save
              .mutateAsync({ draft, expected_version: baseVersion })
              .then((result) => {
                acceptSaved(result);
                toast.success("Черновик сохранён");
                navigate(`/hr/policies/${result.id}`);
              })
              .catch(() => undefined);
          }}
        >
          <fieldset className="editor-fields" disabled={busy}>
            <legend className="sr-only">Содержание регламента</legend>
            <div className="field">
              <label htmlFor="policy-title">Название</label>
              <Input
                id="policy-title"
                required
                maxLength={240}
                value={draft.title}
                onChange={(event) => update("title", event.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="policy-summary">Краткое описание</label>
              <Textarea
                id="policy-summary"
                rows={2}
                maxLength={4000}
                value={draft.summary}
                onChange={(event) => update("summary", event.target.value)}
              />
            </div>
            <div className="form-columns">
              <div>
                <label htmlFor="policy-topic">Тема</label>
                <NativeSelect
                  id="policy-topic"
                  value={draft.topic}
                  onChange={(event) => update("topic", event.target.value)}
                >
                  {!topics.some((topic) => topic.value === draft.topic) && (
                    <option value={draft.topic}>Текущая тема</option>
                  )}
                  {topics.map((topic) => (
                    <option key={topic.value} value={topic.value}>
                      {topic.label}
                    </option>
                  ))}
                </NativeSelect>
              </div>
              <div>
                <label htmlFor="policy-language">Язык материала</label>
                <NativeSelect
                  id="policy-language"
                  value={draft.language}
                  onChange={(event) => {
                    const value = event.target.value;
                    if (value === "ru" || value === "kk")
                      update("language", value);
                  }}
                >
                  <option value="ru">Русский</option>
                  <option value="kk">Қазақша</option>
                </NativeSelect>
              </div>
            </div>
            <div className="field">
              <label htmlFor="policy-audience">Кому доступен</label>
              <NativeSelect
                id="policy-audience"
                value={draft.audience}
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value === "all" ||
                    value === "employee" ||
                    value === "manager" ||
                    value === "hr"
                  )
                    update("audience", value);
                }}
              >
                <option value="all">Всем сотрудникам</option>
                <option value="employee">Сотрудникам</option>
                <option value="manager">Руководителям</option>
                <option value="hr">HR</option>
              </NativeSelect>
              <p className="field-help">
                {document?.legal_entity === null
                  ? "Общий документ для разрешённой аудитории."
                  : `Организация: ${employee?.legal_entity.name ?? "ваша организация"}.`}
                {document?.department
                  ? " Дополнительно ограничен подразделением."
                  : ""}
              </p>
            </div>
            <div className="form-columns">
              <div>
                <label htmlFor="policy-from">Действует с</label>
                <Input
                  id="policy-from"
                  type="date"
                  required
                  value={draft.effective_from ?? ""}
                  onChange={(event) =>
                    update("effective_from", event.target.value)
                  }
                />
              </div>
              <div>
                <label htmlFor="policy-until">Действует до, включительно</label>
                <Input
                  id="policy-until"
                  type="date"
                  value={draft.effective_until ?? ""}
                  min={draft.effective_from}
                  onChange={(event) =>
                    update("effective_until", event.target.value || null)
                  }
                />
                <p className="field-help">
                  Оставьте пустым для бессрочного правила.
                </p>
              </div>
            </div>
            {draft.draft_sections.map((section, index) => (
              <fieldset className="policy-section-editor" key={index}>
                <legend>Раздел {index + 1}</legend>
                <label htmlFor={`heading-${index}`}>Заголовок раздела</label>
                <Input
                  id={`heading-${index}`}
                  required
                  maxLength={240}
                  value={section.heading}
                  onChange={(event) =>
                    update(
                      "draft_sections",
                      draft.draft_sections.map((item, i) =>
                        i === index
                          ? { ...item, heading: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
                <label htmlFor={`text-${index}`}>Текст правила</label>
                <Textarea
                  id={`text-${index}`}
                  required
                  minLength={20}
                  maxLength={12000}
                  rows={7}
                  value={section.text}
                  onChange={(event) =>
                    update(
                      "draft_sections",
                      draft.draft_sections.map((item, i) =>
                        i === index
                          ? { ...item, text: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              </fieldset>
            ))}
            <Button
              variant="secondary"
              disabled={draft.draft_sections.length >= 40}
              onClick={() =>
                update("draft_sections", [
                  ...draft.draft_sections,
                  { heading: "", text: "" },
                ])
              }
              iconStart={<Plus size={15} aria-hidden="true" />}
            >
              Добавить раздел
            </Button>
            <ErrorNotice error={save.error} />
            <Button type="submit" loading={save.isPending} disabled={stale}>
              Сохранить черновик
            </Button>
          </fieldset>
        </form>
        {document && (
          <div className="publication-actions">
            <h2>Публикация</h2>
            <p>
              Публикуется сохранённый черновик. Прежние ответы сохраняют своё
              основание.
            </p>
            {dirty && (
              <p role="status">
                Есть несохранённые изменения. Сохраните черновик перед
                публикацией.
              </p>
            )}
            {document.current_revision && (
              <p>
                Текущая редакция {document.current_revision.number} ·{" "}
                {date(document.current_revision.published_at)}
              </p>
            )}
            <div className="action-row">
              {document.allowed_actions.includes("publish") && (
                <Button
                  variant="secondary"
                  loading={publish.isPending}
                  disabled={
                    dirty || stale || save.isPending || archive.isPending
                  }
                  onClick={() => {
                    void publish
                      .mutateAsync(baseVersion)
                      .then((result) => {
                        acceptSaved(result);
                        toast.success("Новая редакция опубликована");
                      })
                      .catch(() => undefined);
                  }}
                >
                  Опубликовать сохранённую версию
                </Button>
              )}
              {document.allowed_actions.includes("archive") && (
                <Button
                  variant="destructive"
                  loading={archive.isPending}
                  disabled={stale || save.isPending || publish.isPending}
                  onClick={() => {
                    if (
                      window.confirm(
                        "Убрать регламент из доступных источников? Старые ответы сохранятся, но основание станет недоступным.",
                      )
                    )
                      void archive
                        .mutateAsync(baseVersion)
                        .then((result) => {
                          acceptSaved(result);
                          toast.success("Регламент убран в архив");
                        })
                        .catch(() => undefined);
                  }}
                >
                  Убрать в архив
                </Button>
              )}
            </div>
            <ErrorNotice error={publish.error ?? archive.error} />
            <details className="evidence-details">
              <summary>Сведения о документе</summary>
              <p>
                Создан {date(document.created_at)} · Изменён{" "}
                {date(document.updated_at)}
              </p>
              <p>
                Автор <code>{document.owner}</code>
              </p>
              <p>Версия записи {document.version}</p>
            </details>
          </div>
        )}
      </Card>
      <DemoNote />
    </>
  );
}
