import { useState } from "react";
import type { operations } from "@janamen/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "react-router";
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
import { useSession } from "@/lib/session";
import { date } from "@/lib/format";
import { Facts, WriteRecovery } from "../requests/support";
import {
  categories,
  categoryValue,
  EnrollmentRow,
  useListParams,
} from "./common";

function HrOnly() {
  return (
    <EmptyState
      title="Управление доступно HR"
      description="Учебные материалы, публикации и назначения доступны HR в разрешённом юридическом лице."
      action={
        <Link className="text-link" to="/academy">
          К моему обучению
        </Link>
      }
    />
  );
}

export function ManageCoursesPage() {
  const session = useSession();
  const { params, page, change } = useListParams();
  const availability = params.get("availability");
  const query: NonNullable<
    operations["academy_manage_courses_list"]["parameters"]["query"]
  > = {
    page,
    search: params.get("search") ?? "",
    availability:
      availability === "draft" ||
      availability === "published" ||
      availability === "archived"
        ? availability
        : undefined,
    ordering: "slug",
  };
  const courses = useQuery({
    queryKey: ["manage-courses", session.user.id, query],
    enabled: session.user.role === "hr",
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/manage/courses/", {
          params: { query },
          signal,
        }),
      ),
  });
  if (session.user.role !== "hr") return <HrOnly />;
  return (
    <>
      <PageHeader
        eyebrow="HR · Jana Academy"
        title="Управление курсами"
        description="Черновик редактируется отдельно. Публикация создаёт неизменяемую версию."
        action={
          <ActionLink
            to="/hr/courses/new"
            iconStart={<Plus aria-hidden="true" />}
          >
            Создать курс
          </ActionLink>
        }
      />
      <div className="stack">
        <div className="filter-bar">
          <label className="field">
            Поиск
            <Input
              type="search"
              placeholder="Название или код курса"
              value={params.get("search") ?? ""}
              onChange={(e) => change("search", e.target.value)}
            />
          </label>
          <label className="field">
            Публикация
            <NativeSelect
              value={availability ?? ""}
              onChange={(e) => change("availability", e.target.value)}
            >
              <option value="">Все состояния</option>
              <option value="draft">Черновик</option>
              <option value="published">Опубликовано</option>
              <option value="archived">В архиве</option>
            </NativeSelect>
          </label>
          <Link className="text-link" to="/hr/assignments">
            Назначить обучение
          </Link>
        </div>
        {courses.isPending ? (
          <LoadingState />
        ) : courses.error ? (
          <ErrorNotice
            error={courses.error}
            retry={() => void courses.refetch()}
          />
        ) : (
          courses.data && (
            <DataSection title="Курсы">
              {courses.data.results.length ? (
                <div className="ac-list">
                  {courses.data.results.map((course) => (
                    <article className="ac-row" key={course.id}>
                      <div>
                        <h3>
                          <Link
                            className="text-link"
                            to={`/hr/courses/${course.id}`}
                          >
                            {course.title}
                          </Link>
                        </h3>
                        <p className="muted">
                          {course.slug} · Версия записи {course.version} ·
                          Обновлён {date(course.updated_at)}
                        </p>
                      </div>
                      <StatusLabel status={course.availability} />
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Курсы не найдены"
                  description="Измените фильтры или создайте новый учебный курс."
                />
              )}
              <PaginationBar
                count={courses.data.count}
                page={page}
                onPage={(p) => change("page", String(p))}
              />
            </DataSection>
          )
        )}
        <DemoNote />
      </div>
    </>
  );
}

type Draft = Model<"CourseDraftRequest">;
const emptyDraft: Draft = {
  title: "",
  title_kk: "",
  summary: "",
  summary_kk: "",
  category: "hr",
  content_language: "ru",
  passing_percent: 80,
  max_attempts: 3,
  estimated_minutes: null,
  lessons: [],
  questions: [],
};

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

function CourseFields({
  draft,
  update,
  disabled,
}: {
  draft: Draft;
  update: (draft: Draft) => void;
  disabled: boolean;
}) {
  const lessons = draft.lessons ?? [];
  const questions = draft.questions ?? [];
  function lessonChange(index: number, value: Model<"LessonRequest">) {
    update({
      ...draft,
      lessons: lessons.map((item, i) => (i === index ? value : item)),
    });
  }
  function questionChange(
    index: number,
    value: Model<"AuthorQuestionRequest">,
  ) {
    update({
      ...draft,
      questions: questions.map((item, i) => (i === index ? value : item)),
    });
  }
  return (
    <fieldset disabled={disabled} className="rq-fieldset form-stack">
      <div className="form-grid">
        <label className="field">
          Название на русском
          <Input
            required
            maxLength={200}
            value={draft.title}
            onChange={(e) => update({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="field">
          Название на казахском
          <Input
            maxLength={200}
            lang="kk"
            value={draft.title_kk}
            onChange={(e) => update({ ...draft, title_kk: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        Описание и цель курса
        <Textarea
          required
          maxLength={2000}
          rows={3}
          value={draft.summary}
          onChange={(e) => update({ ...draft, summary: e.target.value })}
        />
      </label>
      <label className="field">
        Описание на казахском
        <Textarea
          maxLength={2000}
          rows={3}
          lang="kk"
          value={draft.summary_kk}
          onChange={(e) => update({ ...draft, summary_kk: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Категория
          <NativeSelect
            value={draft.category}
            onChange={(e) => {
              const category = categoryValue(e.target.value);
              if (category) update({ ...draft, category });
            }}
          >
            {Object.entries(categories).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="field">
          Язык материалов
          <NativeSelect
            value={draft.content_language}
            onChange={(e) =>
              update({
                ...draft,
                content_language: e.target.value === "kk" ? "kk" : "ru",
              })
            }
          >
            <option value="ru">Русский</option>
            <option value="kk">Қазақша</option>
          </NativeSelect>
        </label>
        <label className="field">
          Проходной балл, %
          <Input
            type="number"
            min={1}
            max={100}
            required
            value={draft.passing_percent}
            onChange={(e) =>
              update({ ...draft, passing_percent: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          Лимит попыток · пусто без ограничения
          <Input
            type="number"
            min={1}
            max={100}
            value={draft.max_attempts ?? ""}
            onChange={(e) =>
              update({
                ...draft,
                max_attempts: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
        <label className="field">
          Ожидаемая длительность, мин · необязательно
          <Input
            type="number"
            min={1}
            max={600}
            value={draft.estimated_minutes ?? ""}
            onChange={(e) =>
              update({
                ...draft,
                estimated_minutes: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </label>
      </div>
      <div className="stack">
        <h2>Материалы</h2>
        <p className="muted">
          Публикации нужен хотя бы один обязательный материал. Порядок ниже
          задаёт порядок прохождения.
        </p>
        {lessons.map((lesson, index) => (
          <section className="ac-editor-block" key={index}>
            <h3>Материал {index + 1}</h3>
            <div className="form-grid">
              <label className="field">
                Код материала
                <Input
                  required
                  pattern="[-a-zA-Z0-9_]+"
                  maxLength={80}
                  value={lesson.id}
                  onChange={(e) =>
                    lessonChange(index, { ...lesson, id: e.target.value })
                  }
                />
              </label>
              <label className="field">
                Название материала
                <Input
                  required
                  maxLength={200}
                  value={lesson.title}
                  onChange={(e) =>
                    lessonChange(index, { ...lesson, title: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              Содержание
              <Textarea
                required
                rows={8}
                maxLength={20000}
                value={lesson.body_markdown}
                onChange={(e) =>
                  lessonChange(index, {
                    ...lesson,
                    body_markdown: e.target.value,
                  })
                }
              />
            </label>
            <label className="ac-inline-check">
              <input
                type="checkbox"
                checked={lesson.required}
                onChange={(e) =>
                  lessonChange(index, { ...lesson, required: e.target.checked })
                }
              />
              Обязательный материал
            </label>
            <div className="button-row">
              <ActionButton
                variant="secondary"
                disabled={index === 0}
                onClick={() =>
                  update({ ...draft, lessons: move(lessons, index, -1) })
                }
              >
                Выше
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={index === lessons.length - 1}
                onClick={() =>
                  update({ ...draft, lessons: move(lessons, index, 1) })
                }
              >
                Ниже
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() =>
                  update({
                    ...draft,
                    lessons: lessons.filter((_, i) => i !== index),
                  })
                }
              >
                Убрать из черновика
              </ActionButton>
            </div>
          </section>
        ))}
        <ActionButton
          variant="secondary"
          disabled={lessons.length >= 50}
          onClick={() =>
            update({
              ...draft,
              lessons: [
                ...lessons,
                {
                  id: `lesson-${crypto.randomUUID()}`,
                  title: "",
                  body_markdown: "",
                  required: true,
                },
              ],
            })
          }
        >
          Добавить материал
        </ActionButton>
      </div>
      <div className="stack">
        <h2>Вопросы теста</h2>
        <p className="muted">
          В каждой задаче один верный вариант. Ключи доступны только автору.
          Публикации нужен хотя бы один вопрос.
        </p>
        {questions.map((question, index) => (
          <section className="ac-editor-block" key={index}>
            <h3>Вопрос {index + 1}</h3>
            <label className="field">
              Код вопроса
              <Input
                required
                pattern="[-a-zA-Z0-9_]+"
                maxLength={80}
                value={question.id}
                onChange={(e) =>
                  questionChange(index, { ...question, id: e.target.value })
                }
              />
            </label>
            <label className="field">
              Формулировка
              <Textarea
                required
                rows={3}
                maxLength={2000}
                value={question.prompt}
                onChange={(e) =>
                  questionChange(index, { ...question, prompt: e.target.value })
                }
              />
            </label>
            {question.options.map((option, optionIndex) => (
              <div className="form-grid" key={optionIndex}>
                <label className="field">
                  Код варианта {optionIndex + 1}
                  <Input
                    required
                    pattern="[-a-zA-Z0-9_]+"
                    maxLength={40}
                    value={option.id}
                    onChange={(e) =>
                      questionChange(index, {
                        ...question,
                        options: question.options.map((item, i) =>
                          i === optionIndex
                            ? { ...option, id: e.target.value }
                            : item,
                        ),
                        correct_option_id:
                          question.correct_option_id === option.id
                            ? e.target.value
                            : question.correct_option_id,
                      })
                    }
                  />
                </label>
                <label className="field">
                  Текст варианта {optionIndex + 1}
                  <Input
                    required
                    maxLength={2000}
                    value={option.text}
                    onChange={(e) =>
                      questionChange(index, {
                        ...question,
                        options: question.options.map((item, i) =>
                          i === optionIndex
                            ? { ...option, text: e.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <ActionButton
                  variant="secondary"
                  disabled={question.options.length <= 2}
                  onClick={() =>
                    questionChange(index, {
                      ...question,
                      options: question.options.filter(
                        (_, i) => i !== optionIndex,
                      ),
                      correct_option_id:
                        question.correct_option_id === option.id
                          ? ""
                          : question.correct_option_id,
                    })
                  }
                >
                  Убрать вариант {optionIndex + 1}
                </ActionButton>
              </div>
            ))}
            <ActionButton
              variant="secondary"
              disabled={question.options.length >= 8}
              onClick={() =>
                questionChange(index, {
                  ...question,
                  options: [
                    ...question.options,
                    { id: `o-${crypto.randomUUID()}`, text: "" },
                  ],
                })
              }
            >
              Добавить вариант
            </ActionButton>
            <label className="field">
              Верный вариант
              <NativeSelect
                required
                value={question.correct_option_id}
                onChange={(e) =>
                  questionChange(index, {
                    ...question,
                    correct_option_id: e.target.value,
                  })
                }
              >
                <option value="">Выберите вариант</option>
                {question.options.map((option, i) => (
                  <option key={i} value={option.id}>
                    Вариант {i + 1} · {option.text || option.id}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="field">
              Объяснение для автора
              <Textarea
                required
                rows={3}
                maxLength={3000}
                value={question.explanation}
                onChange={(e) =>
                  questionChange(index, {
                    ...question,
                    explanation: e.target.value,
                  })
                }
              />
            </label>
            <div className="button-row">
              <ActionButton
                variant="secondary"
                disabled={index === 0}
                onClick={() =>
                  update({ ...draft, questions: move(questions, index, -1) })
                }
              >
                Выше
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={index === questions.length - 1}
                onClick={() =>
                  update({ ...draft, questions: move(questions, index, 1) })
                }
              >
                Ниже
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() =>
                  update({
                    ...draft,
                    questions: questions.filter((_, i) => i !== index),
                  })
                }
              >
                Убрать вопрос из черновика
              </ActionButton>
            </div>
          </section>
        ))}
        <ActionButton
          variant="secondary"
          disabled={questions.length >= 100}
          onClick={() =>
            update({
              ...draft,
              questions: [
                ...questions,
                {
                  id: `q-${crypto.randomUUID()}`,
                  prompt: "",
                  options: [
                    { id: "a", text: "" },
                    { id: "b", text: "" },
                  ],
                  correct_option_id: "",
                  explanation: "",
                },
              ],
            })
          }
        >
          Добавить вопрос
        </ActionButton>
      </div>
    </fieldset>
  );
}

function PublishedRevisions({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const revisions = useQuery({
    queryKey: ["course-revisions", id, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/manage/courses/{id}/revisions/", {
          params: { path: { id }, query: { page } },
          signal,
        }),
      ),
  });
  return (
    <DataSection
      title="История публикаций"
      description="Эти версии неизменяемы. Новая публикация не заменяет прежние назначения."
    >
      {revisions.isPending ? (
        <LoadingState />
      ) : revisions.error ? (
        <ErrorNotice
          error={revisions.error}
          retry={() => void revisions.refetch()}
        />
      ) : (
        revisions.data && (
          <>
            {revisions.data.results.length ? (
              <div className="ac-revisions">
                {revisions.data.results.map((version) => (
                  <details key={version.id}>
                    <summary>
                      Версия {version.number} · {version.title} ·{" "}
                      {date(version.published_at)}
                    </summary>
                    <div className="stack">
                      <p>{version.summary}</p>
                      <p className="muted">
                        {version.lesson_count} материалов ·{" "}
                        {version.question_count} вопросов · Порог{" "}
                        {version.passing_percent}%
                      </p>
                      {version.lessons.map((lesson) => (
                        <section key={lesson.id}>
                          <h3>{lesson.title}</h3>
                          <div className="ac-material">
                            {lesson.body_markdown}
                          </div>
                        </section>
                      ))}
                      <details>
                        <summary>
                          Вопросы и ключи этой версии · только HR
                        </summary>
                        {version.questions.map((question) => (
                          <div className="ac-editor-block" key={question.id}>
                            <h3>{question.prompt}</h3>
                            {question.options.map((option) => (
                              <p key={option.id}>
                                {option.text}
                                {option.id === question.correct_option_id
                                  ? " · Верный ответ"
                                  : ""}
                              </p>
                            ))}
                            <p>{question.explanation}</p>
                          </div>
                        ))}
                      </details>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="muted">Опубликованных версий пока нет.</p>
            )}
            <PaginationBar
              count={revisions.data.count}
              page={page}
              onPage={setPage}
            />
          </>
        )
      )}
    </DataSection>
  );
}

function CourseEditor({
  record,
  refreshRecord,
}: {
  record?: Model<"CourseAdmin">;
  refreshRecord?: () => Promise<Model<"CourseAdmin"> | undefined>;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => record?.draft ?? emptyDraft);
  const [slug, setSlug] = useState(record?.slug ?? "");
  const [version, setVersion] = useState(record?.version ?? 1);
  const [confirm, setConfirm] = useState<
    "publish" | "archive" | "restore" | null
  >(null);
  const dirty =
    !!record && JSON.stringify(draft) !== JSON.stringify(record.draft);
  const save = useCommand(
    async (
      intent: { slug: string; draft: Draft; expected_version: number },
      key,
    ) =>
      record
        ? unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/save-draft/", {
              params: {
                path: { id: record.id },
                header: { "Idempotency-Key": key },
              },
              body: {
                draft: intent.draft,
                expected_version: intent.expected_version,
              },
            }),
          )
        : unwrap(
            await api.POST("/api/v1/academy/manage/courses/", {
              params: { header: { "Idempotency-Key": key } },
              body: { slug: intent.slug, draft: intent.draft },
            }),
          ),
  );
  const transition = useCommand(
    async (
      intent: {
        action: "publish" | "archive" | "restore";
        expected_version: number;
      },
      key,
    ) => {
      const params = {
        path: { id: record?.id ?? "" },
        header: { "Idempotency-Key": key },
      };
      const body = { expected_version: intent.expected_version };
      switch (intent.action) {
        case "publish":
          return unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/publish/", {
              params,
              body,
            }),
          );
        case "archive":
          return unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/archive/", {
              params,
              body,
            }),
          );
        case "restore":
          return unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/restore/", {
              params,
              body,
            }),
          );
      }
    },
  );
  const pending = save.isPending || transition.isPending;
  async function refresh() {
    if (refreshRecord) {
      const latest = await refreshRecord();
      if (latest) setVersion(latest.version);
    }
    save.reset();
    transition.reset();
  }
  function saved(result: Model<"CourseAdmin">) {
    setVersion(result.version);
    client.setQueryData(["course-admin", result.id], result);
    if (!record) void navigate(`/hr/courses/${result.id}`, { replace: true });
  }
  const transitionLabel =
    confirm === "publish"
      ? "Опубликовать новую версию"
      : confirm === "archive"
        ? "Архивировать курс"
        : "Вернуть курс в каталог";
  return (
    <div className="stack">
      <DataSection
        title={record ? "Редактируемый черновик" : "Новый курс"}
        description={
          record
            ? `Версия записи ${version}. Публикации и назначения сохраняют свои снимки.`
            : "Сохраните черновик, затем проверьте и опубликуйте его."
        }
        action={record && <StatusLabel status={record.availability} />}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { slug, draft, expected_version: version },
              { onSuccess: saved },
            );
          }}
        >
          <label className="field">
            Код курса
            <Input
              required
              pattern="[-a-zA-Z0-9_]+"
              maxLength={80}
              disabled={!!record || pending}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <span className="muted">
              Латинские буквы, цифры, дефис и подчёркивание. После создания код
              не меняется.
            </span>
          </label>
          <CourseFields draft={draft} update={setDraft} disabled={pending} />
          <WriteRecovery
            error={save.error}
            refresh={() => {
              void refresh();
            }}
            retry={
              save.variables
                ? () => {
                    if (save.variables)
                      save.mutate(save.variables, { onSuccess: saved });
                  }
                : undefined
            }
          />
          <ActionButton
            type="submit"
            loading={save.isPending}
            disabled={transition.isPending}
          >
            Сохранить черновик
          </ActionButton>
          <p role="status" className="muted">
            {dirty
              ? "Есть несохранённые изменения."
              : save.isSuccess
                ? "Черновик сохранён."
                : ""}
          </p>
        </form>
      </DataSection>
      {record && (
        <>
          <DataSection
            title="Публикация и доступность"
            description="Публикация создаёт новую версию. Архив закрывает прохождение и новые назначения, сохраняя историю."
          >
            <div className="stack">
              {dirty && (
                <p className="notice-panel">
                  Сначала сохраните черновик. Публикация использует сохранённое
                  содержание.
                </p>
              )}
              <div className="button-row">
                <ActionButton
                  disabled={dirty || pending}
                  onClick={() => setConfirm("publish")}
                >
                  Опубликовать новую версию
                </ActionButton>
                {record.availability === "published" && (
                  <ActionButton
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setConfirm("archive")}
                  >
                    Архивировать курс
                  </ActionButton>
                )}
                {record.availability === "archived" && (
                  <ActionButton
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setConfirm("restore")}
                  >
                    Вернуть курс в каталог
                  </ActionButton>
                )}
              </div>
              {confirm && (
                <div className="notice-panel stack">
                  <h3>{transitionLabel}</h3>
                  <p>
                    {confirm === "publish"
                      ? "Сохранённый черновик станет новой неизменяемой версией. Существующие назначения останутся на своих версиях."
                      : confirm === "archive"
                        ? "Сотрудники не смогут продолжать этот курс. Их результаты и история сохранятся."
                        : "Текущая опубликованная версия снова станет доступна. Новая версия не создаётся."}
                  </p>
                  <div className="button-row">
                    <ActionButton
                      loading={transition.isPending}
                      disabled={save.isPending}
                      onClick={() =>
                        transition.mutate(
                          { action: confirm, expected_version: version },
                          {
                            onSuccess: (result) => {
                              saved(result);
                              setConfirm(null);
                            },
                          },
                        )
                      }
                    >
                      {transitionLabel}
                    </ActionButton>
                    <ActionButton
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setConfirm(null)}
                    >
                      Вернуться без действия
                    </ActionButton>
                  </div>
                </div>
              )}
              <WriteRecovery
                error={transition.error}
                refresh={() => {
                  void refresh();
                }}
                retry={
                  transition.variables
                    ? () => {
                        if (transition.variables)
                          transition.mutate(transition.variables, {
                            onSuccess: (result) => {
                              saved(result);
                              setConfirm(null);
                            },
                          });
                      }
                    : undefined
                }
              />
              <p role="status">
                {transition.isSuccess ? "Изменение сохранено сервером." : ""}
              </p>
            </div>
          </DataSection>
          <PublishedRevisions id={record.id} />
        </>
      )}
      <DemoNote />
    </div>
  );
}

export function CourseEditorPage() {
  const { id } = useParams();
  const session = useSession();
  const course = useQuery({
    queryKey: ["course-admin", id],
    enabled: !!id && session.user.role === "hr",
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/manage/courses/{id}/", {
          params: { path: { id: id ?? "" } },
          signal,
        }),
      ),
  });
  if (session.user.role !== "hr") return <HrOnly />;
  return (
    <>
      <BackLink to="/hr/courses">К управлению курсами</BackLink>
      <PageHeader
        eyebrow="HR · Jana Academy"
        title={id ? (course.data?.title ?? "Курс") : "Создать курс"}
      />
      {id ? (
        course.isPending ? (
          <LoadingState />
        ) : course.error ? (
          <ErrorNotice
            error={course.error}
            retry={() => void course.refetch()}
          />
        ) : (
          course.data && (
            <CourseEditor
              key={course.data.id}
              record={course.data}
              refreshRecord={async () => (await course.refetch()).data}
            />
          )
        )
      ) : (
        <CourseEditor key="new" />
      )}
    </>
  );
}

export function AssignLearningPage() {
  const session = useSession();
  const [personSearch, setPersonSearch] = useState("");
  const [courseSearch, setCourseSearch] = useState("");
  const [personPage, setPersonPage] = useState(1);
  const [coursePage, setCoursePage] = useState(1);
  const [person, setPerson] = useState<Model<"Employee"> | null>(null);
  const [course, setCourse] = useState<Model<"CatalogCourse"> | null>(null);
  const [required, setRequired] = useState(true);
  const [due, setDue] = useState("");
  const [created, setCreated] = useState<Model<"EnrollmentDetail"> | null>(
    null,
  );
  const [assignmentPage, setAssignmentPage] = useState(1);
  const allowed = session.user.role === "hr";
  const people = useQuery({
    queryKey: ["assignment-people", personSearch, personPage],
    enabled: allowed,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/employees/", {
          params: {
            query: {
              search: personSearch,
              page: personPage,
              ordering: "full_name",
            },
          },
          signal,
        }),
      ),
  });
  const courses = useQuery({
    queryKey: ["assignment-courses", courseSearch, coursePage],
    enabled: allowed,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/courses/", {
          params: {
            query: { search: courseSearch, page: coursePage, ordering: "slug" },
          },
          signal,
        }),
      ),
  });
  const existing = useQuery({
    queryKey: ["existing-assignments", person?.id, course?.id, assignmentPage],
    enabled: allowed && !!person && !!course,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/enrollments/", {
          params: {
            query: {
              employee: person?.id,
              course: course?.id,
              page: assignmentPage,
            },
          },
          signal,
        }),
      ),
  });
  const assign = useCommand(async (body: Model<"AssignmentRequest">, key) =>
    unwrap(
      await api.POST("/api/v1/academy/enrollments/", {
        body,
        params: { header: { "Idempotency-Key": key } },
      }),
    ),
  );
  function send(body: Model<"AssignmentRequest">) {
    assign.mutate(body, { onSuccess: setCreated });
  }
  if (!allowed) return <HrOnly />;
  return (
    <>
      <BackLink to="/hr/courses">К управлению курсами</BackLink>
      <PageHeader
        eyebrow="HR · Jana Academy"
        title="Назначить обучение"
        description="Одно назначение одному сотруднику. Публикация курса закрепляется в назначении."
      />
      <div className="stack">
        <div className="content-grid">
          <DataSection title="1. Выберите сотрудника">
            <div className="form-stack">
              <label className="field">
                Поиск сотрудника
                <Input
                  type="search"
                  placeholder="Имя или должность"
                  value={personSearch}
                  onChange={(e) => {
                    setPersonSearch(e.target.value);
                    setPersonPage(1);
                  }}
                />
              </label>
              {people.isPending ? (
                <LoadingState />
              ) : people.error ? (
                <ErrorNotice
                  error={people.error}
                  retry={() => void people.refetch()}
                />
              ) : (
                people.data && (
                  <>
                    <fieldset
                      className="ac-question"
                      disabled={assign.isPending}
                    >
                      <legend>Сотрудники в вашей области</legend>
                      {people.data.results.map((item) => (
                        <label className="ac-choice" key={item.id}>
                          <input
                            type="radio"
                            name="assignment-person"
                            checked={person?.id === item.id}
                            onChange={() => {
                              setPerson(item);
                              setCreated(null);
                              setAssignmentPage(1);
                            }}
                          />
                          <span>
                            {item.full_name}
                            <span className="muted"> · {item.position}</span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {!people.data.results.length && (
                      <p className="muted">Нет сотрудников. Измените поиск.</p>
                    )}
                    <PaginationBar
                      count={people.data.count}
                      page={personPage}
                      onPage={setPersonPage}
                    />
                  </>
                )
              )}
            </div>
          </DataSection>
          <DataSection title="2. Выберите курс">
            <div className="form-stack">
              <label className="field">
                Поиск курса
                <Input
                  type="search"
                  placeholder="Название курса"
                  value={courseSearch}
                  onChange={(e) => {
                    setCourseSearch(e.target.value);
                    setCoursePage(1);
                  }}
                />
              </label>
              {courses.isPending ? (
                <LoadingState />
              ) : courses.error ? (
                <ErrorNotice
                  error={courses.error}
                  retry={() => void courses.refetch()}
                />
              ) : (
                courses.data && (
                  <>
                    <fieldset
                      className="ac-question"
                      disabled={assign.isPending}
                    >
                      <legend>Опубликованные курсы</legend>
                      {courses.data.results.map((item) => (
                        <label className="ac-choice" key={item.id}>
                          <input
                            type="radio"
                            name="assignment-course"
                            checked={course?.id === item.id}
                            onChange={() => {
                              setCourse(item);
                              setCreated(null);
                              setAssignmentPage(1);
                            }}
                          />
                          <span>
                            {item.published_version.title}
                            <span className="muted">
                              {" "}
                              · Версия {item.published_version.number}
                            </span>
                          </span>
                        </label>
                      ))}
                    </fieldset>
                    {!courses.data.results.length && (
                      <p className="muted">
                        Нет курсов. Измените поиск или опубликуйте курс.
                      </p>
                    )}
                    <PaginationBar
                      count={courses.data.count}
                      page={coursePage}
                      onPage={setCoursePage}
                    />
                  </>
                )
              )}
            </div>
          </DataSection>
        </div>
        <DataSection title="3. Проверьте назначение">
          <form
            className="form-stack"
            onSubmit={(e) => {
              e.preventDefault();
              if (person && course)
                send({
                  employee: person.id,
                  course_version: course.published_version.id,
                  required,
                  due_at: due ? new Date(due).toISOString() : null,
                });
            }}
          >
            <Facts
              items={[
                {
                  label: "Сотрудник",
                  value: person?.full_name ?? "Выберите сотрудника выше",
                },
                {
                  label: "Курс",
                  value:
                    course?.published_version.title ?? "Выберите курс выше",
                },
                {
                  label: "Версия курса",
                  value: course?.published_version.number ?? "Не выбрана",
                },
              ]}
            />
            <label className="ac-inline-check">
              <input
                type="checkbox"
                checked={required}
                disabled={assign.isPending}
                onChange={(e) => setRequired(e.target.checked)}
              />
              Обязательное обучение
            </label>
            <label className="field">
              Срок · необязательно
              <Input
                type="datetime-local"
                value={due}
                disabled={assign.isPending}
                onChange={(e) => setDue(e.target.value)}
              />
              <span className="muted">
                Дата и время в часовом поясе этого устройства.
              </span>
            </label>
            <WriteRecovery
              error={assign.error}
              refresh={() => {
                void Promise.all([
                  people.refetch(),
                  courses.refetch(),
                  existing.refetch(),
                ]).then(() => assign.reset());
              }}
              retry={
                assign.variables
                  ? () => {
                      if (assign.variables) send(assign.variables);
                    }
                  : undefined
              }
            />
            {(!person || !course) && (
              <p className="muted">
                Для назначения выберите сотрудника и опубликованный курс.
              </p>
            )}
            <ActionButton
              type="submit"
              loading={assign.isPending}
              disabled={!person || !course}
            >
              Назначить обучение
            </ActionButton>
            {created && (
              <div role="status" className="notice-panel">
                <p>
                  Назначение сохранено для {created.employee_name}. Существующее
                  назначение той же версии может быть возвращено без создания
                  дубликата.
                </p>
                <Link
                  className="text-link"
                  to={`/academy/enrollments/${created.id}`}
                >
                  Открыть назначение
                </Link>
              </div>
            )}
          </form>
        </DataSection>
        {person && course && (
          <DataSection title="Уже назначено этому сотруднику">
            {existing.isPending ? (
              <LoadingState />
            ) : existing.error ? (
              <ErrorNotice
                error={existing.error}
                retry={() => void existing.refetch()}
              />
            ) : (
              existing.data && (
                <>
                  {existing.data.results.length ? (
                    existing.data.results.map((enrollment) => (
                      <EnrollmentRow
                        key={enrollment.id}
                        enrollment={enrollment}
                      />
                    ))
                  ) : (
                    <p className="muted">Назначений этого курса пока нет.</p>
                  )}
                  <PaginationBar
                    count={existing.data.count}
                    page={assignmentPage}
                    onPage={setAssignmentPage}
                  />
                </>
              )
            )}
          </DataSection>
        )}
        <DemoNote />
      </div>
    </>
  );
}
