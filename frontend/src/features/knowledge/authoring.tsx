import { ActionLink, ActionButton as Button } from "@/components/actions";
import { Card } from "@/components/pace/card";
import { NativeSelect } from "@/components/pace/native-select";
import { Textarea } from "@/components/pace/textarea";
import {
  BackLink,
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
  StatusLabel,
} from "@/components/ui";
import { Input } from "@/components/upstream/input";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { RehearsalPanel } from "@/features/knowledge/rehearsal";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, Plus } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

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
                        : "Черновик соответствует публикации"}
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
  | "draft_knowledge_check"
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
    draft_knowledge_check: document?.draft_knowledge_check ?? null,
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
  type KnowledgeCheckDraft = NonNullable<PolicyDraft["draft_knowledge_check"]>;
  function updateKnowledgeCheck(
    change: Partial<KnowledgeCheckDraft>,
  ) {
    const current: KnowledgeCheckDraft = draft.draft_knowledge_check ?? {
      question: "",
      options: ["", "", ""],
      correct_option: 0,
      explanation: "",
    };
    update("draft_knowledge_check", { ...current, ...change });
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
  const knowledgeCheck = draft.draft_knowledge_check;
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
            {document?.current_revision && (
              <fieldset className="policy-section-editor">
                <legend>Практический вопрос для новой редакции</legend>
                <p className="field-help">
                  После изменения текста правило будет назначено сотрудникам
                  вашей аудитории. Добавьте ситуацию, три варианта ответа и
                  отметьте правильный. Ответ сотрудника проверит сервер.
                </p>
                {knowledgeCheck ? (
                  <>
                    <label htmlFor="policy-check-question">Ситуация и вопрос</label>
                    <Textarea
                      id="policy-check-question"
                      required
                      minLength={8}
                      maxLength={600}
                      rows={3}
                      value={knowledgeCheck.question}
                      onChange={(event) =>
                        updateKnowledgeCheck({ question: event.target.value })
                      }
                      placeholder="Например: клиент просит принять возврат без чека. Что нужно сделать по новому правилу?"
                    />
                    {knowledgeCheck.options.map((option, index) => (
                      <div className="policy-option-editor" key={index}>
                        <label htmlFor={`policy-check-option-${index}`}>
                          Вариант {index + 1}
                        </label>
                        <Input
                          id={`policy-check-option-${index}`}
                          required
                          minLength={1}
                          maxLength={300}
                          value={option}
                          onChange={(event) => {
                            const options = [
                              ...knowledgeCheck.options,
                            ];
                            options[index] = event.target.value;
                            updateKnowledgeCheck({ options });
                          }}
                        />
                        <label className="checkbox-label">
                          <input
                            type="radio"
                            name="policy-check-correct-option"
                            checked={
                              knowledgeCheck.correct_option === index
                            }
                            onChange={() =>
                              updateKnowledgeCheck({ correct_option: index })
                            }
                          />
                          Правильный ответ
                        </label>
                      </div>
                    ))}
                    <label htmlFor="policy-check-explanation">
                      Пояснение после правильного ответа
                    </label>
                    <Textarea
                      id="policy-check-explanation"
                      maxLength={1200}
                      rows={2}
                      value={knowledgeCheck.explanation}
                      onChange={(event) =>
                        updateKnowledgeCheck({ explanation: event.target.value })
                      }
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => update("draft_knowledge_check", null)}
                    >
                      Удалить вопрос
                    </Button>
                  </>
                ) : (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                      updateKnowledgeCheck({
                        question: "",
                        options: ["", "", ""],
                        correct_option: 0,
                        explanation: "",
                      })
                    }
                    iconStart={<Plus size={15} aria-hidden="true" />}
                  >
                    Добавить практический вопрос
                  </Button>
                )}
              </fieldset>
            )}
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
      {document && (
        <RehearsalPanel
          documentId={document.id}
          expectedVersion={baseVersion}
          blocked={dirty || stale || document.state === "archived"}
          blockReason={
            document.state === "archived"
              ? "Архивный регламент недоступен для поиска. Выберите действующий документ."
              : dirty
              ? "Сохраните черновик. Проверка работает только с сохранённой версией."
              : stale
                ? "Черновик изменился на сервере. Загрузите текущую версию перед проверкой."
                : null
          }
        />
      )}
      <DemoNote />
    </>
  );
}
