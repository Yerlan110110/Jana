import { useState } from "react";
import type { operations } from "@janamen/api-client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { ActionButton, ActionLink } from "@/components/actions";
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
  categoryLabel,
  categoryValue,
  EnrollmentRow,
  enrollmentFilters,
  LearningFilters,
  Rules,
  useEnrollment,
  useListParams,
  type EnrollmentQuery,
} from "./common";

function Enrollments({
  team = false,
  history = false,
}: {
  team?: boolean;
  history?: boolean;
}) {
  const session = useSession();
  const { params, page, change } = useListParams();
  const query: EnrollmentQuery = {
    ...enrollmentFilters(params),
    page,
    ordering: history ? "-completed_at" : "due_at",
    ...(team
      ? { employee: params.get("employee") || undefined }
      : { employee: session.employee?.id }),
    ...(history ? { completion_state: "completed" } : {}),
  };
  const enabled = team ? session.user.role !== "employee" : !!session.employee;
  const enrollments = useQuery({
    queryKey: ["enrollments", session.user.id, query],
    enabled,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/enrollments/", {
          params: { query },
          signal,
        }),
      ),
  });
  const { page: _page, ...summaryQuery } = query;
  const summary = useQuery({
    queryKey: ["learning-summary", session.user.id, summaryQuery],
    enabled: enabled && team,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/enrollments/summary/", {
          params: { query: summaryQuery },
          signal,
        }),
      ),
  });
  if (!enabled)
    return (
      <EmptyState
        title="Обучение недоступно в этой области"
        description={
          team
            ? "Обучение команды доступно руководителю и HR."
            : "Проверьте кадровый профиль у HR."
        }
      />
    );
  return (
    <>
      <PageHeader
        eyebrow="Jana Academy"
        title={
          history
            ? "История обучения"
            : team
              ? "Обучение команды"
              : "Моё обучение"
        }
        description={
          history
            ? "Завершённые назначения с сохранённой версией курса и результатами."
            : team
              ? "Серверная область доступа и сводка по выбранным фильтрам."
              : "Срок, завершение материала и результат теста показаны отдельно."
        }
        action={
          !team && (
            <ActionLink
              variant="secondary"
              to={history ? "/academy" : "/academy/catalog"}
            >
              {history ? "К назначениям" : "Открыть каталог"}
            </ActionLink>
          )
        }
      />
      <div className="stack">
        <nav className="button-row" aria-label="Разделы Academy">
          <Link className="text-link" to="/academy">
            Моё обучение
          </Link>
          <Link className="text-link" to="/academy/catalog">
            Каталог
          </Link>
          <Link className="text-link" to="/academy/history">
            История
          </Link>
        </nav>
        <LearningFilters params={params} change={change} />
        {team && (
          <DataSection title="Сводка по фильтрам">
            {summary.isPending ? (
              <LoadingState />
            ) : summary.error ? (
              <ErrorNotice
                error={summary.error}
                retry={() => void summary.refetch()}
              />
            ) : (
              summary.data && (
                <>
                  <Facts
                    items={[
                      {
                        label: "Завершено назначений",
                        value: `${summary.data.completed} из ${summary.data.total}`,
                      },
                      {
                        label: "Доля завершённых",
                        value:
                          summary.data.completion_percent === null
                            ? "Нет назначений"
                            : `${summary.data.completion_percent}%`,
                      },
                      { label: "Срок прошёл", value: summary.data.overdue },
                      {
                        label: "Обязательных не завершено",
                        value: summary.data.required_outstanding,
                      },
                    ]}
                  />
                  <p className="muted">
                    Знаменатель включает все разрешённые назначения по текущим
                    фильтрам, а не только эту страницу. Рассчитано{" "}
                    {date(summary.data.computed_at)}.
                  </p>
                </>
              )
            )}
          </DataSection>
        )}
        {enrollments.isPending ? (
          <LoadingState />
        ) : enrollments.error ? (
          <ErrorNotice
            error={enrollments.error}
            retry={() => void enrollments.refetch()}
          />
        ) : (
          enrollments.data && (
            <DataSection title={history ? "Завершённые курсы" : "Назначения"}>
              {enrollments.data.results.length ? (
                <div className="ac-list">
                  {enrollments.data.results.map((enrollment) => (
                    <EnrollmentRow
                      key={enrollment.id}
                      enrollment={enrollment}
                      showEmployee={team}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Нет назначений по этим условиям"
                  description="Измените фильтры. Если ожидаемого курса нет, уточните назначение у HR."
                  action={
                    <Link
                      className="text-link"
                      to={
                        team
                          ? "/team/learning"
                          : history
                            ? "/academy/history"
                            : "/academy"
                      }
                    >
                      Сбросить фильтры
                    </Link>
                  }
                />
              )}
              <PaginationBar
                count={enrollments.data.count}
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

export function AcademyPage() {
  return <Enrollments />;
}
export function LearningHistoryPage() {
  return <Enrollments history />;
}
export function TeamLearningPage() {
  return <Enrollments team />;
}

export function CatalogPage() {
  const { params, page, change } = useListParams();
  const language = params.get("language");
  const query: NonNullable<
    operations["academy_courses_list"]["parameters"]["query"]
  > = {
    page,
    search: params.get("search") ?? "",
    category: categoryValue(params.get("category")),
    language: language === "ru" || language === "kk" ? language : undefined,
    ordering: "slug",
  };
  const courses = useQuery({
    queryKey: ["catalogue", query],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/courses/", {
          params: { query },
          signal,
        }),
      ),
  });
  return (
    <>
      <BackLink to="/academy">К моему обучению</BackLink>
      <PageHeader
        eyebrow="Jana Academy"
        title="Каталог курсов"
        description="Опубликованные курсы в вашей области доступа. Обучение назначает HR."
      />
      <div className="stack">
        <LearningFilters params={params} change={change} catalogue />
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
              <p className="muted">
                Найдено курсов {courses.data.count}. Все результаты доступны
                через страницы.
              </p>
              {courses.data.results.length ? (
                <div className="ac-grid">
                  {courses.data.results.map((course) => (
                    <article className="ac-course" key={course.id}>
                      <span className="eyebrow">
                        {categoryLabel(course.published_version.category)}
                      </span>
                      <h2>
                        <Link
                          className="text-link"
                          to={`/academy/courses/${course.id}`}
                        >
                          {course.published_version.title}
                        </Link>
                      </h2>
                      {course.published_version.title_kk && (
                        <p lang="kk" className="muted">
                          {course.published_version.title_kk}
                        </p>
                      )}
                      <p>{course.published_version.summary}</p>
                      <Rules version={course.published_version} />
                      <span className="muted">
                        Версия {course.published_version.number}
                      </span>
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title="Курсы не найдены"
                  description="Измените поиск, категорию или язык материала."
                  action={
                    <Link className="text-link" to="/academy/catalog">
                      Сбросить фильтры
                    </Link>
                  }
                />
              )}
              <PaginationBar
                count={courses.data.count}
                page={page}
                onPage={(p) => change("page", String(p))}
              />
            </>
          )
        )}
        <DemoNote />
      </div>
    </>
  );
}

export function CoursePage() {
  const { id = "" } = useParams();
  const session = useSession();
  const { page, change } = useListParams();
  const course = useQuery({
    queryKey: ["catalogue-course", id],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/courses/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const assignments = useQuery({
    queryKey: ["course-enrollments", id, session.employee?.id, page],
    enabled: !!session.employee,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/enrollments/", {
          params: {
            query: { course: id, employee: session.employee?.id, page },
          },
          signal,
        }),
      ),
  });
  const version = course.data?.published_version;
  return (
    <>
      <BackLink to="/academy/catalog">К каталогу</BackLink>
      <PageHeader
        eyebrow="Jana Academy"
        title={version?.title ?? "Курс"}
        description={version?.summary}
      />
      <div className="stack">
        {course.isPending ? (
          <LoadingState />
        ) : course.error ? (
          <ErrorNotice
            error={course.error}
            retry={() => void course.refetch()}
          />
        ) : (
          version && (
            <DataSection
              title="О курсе"
              action={
                <StatusLabel
                  status={course.data?.availability ?? "unavailable"}
                />
              }
            >
              <Rules version={version} />
              <p className="muted">
                Опубликована версия {version.number} ·{" "}
                {date(version.published_at)}
              </p>
              {version.title_kk && <p lang="kk">{version.title_kk}</p>}
              <p>
                Для завершения нужно подтвердить обязательные материалы и
                набрать проходной балл в тесте. Условия закреплены за
                назначенной версией.
              </p>
            </DataSection>
          )
        )}
        <DataSection title="Мои назначения этого курса">
          {assignments.isPending && session.employee ? (
            <LoadingState />
          ) : assignments.error ? (
            <ErrorNotice
              error={assignments.error}
              retry={() => void assignments.refetch()}
            />
          ) : assignments.data?.results.length ? (
            <>
              <div className="ac-list">
                {assignments.data.results.map((enrollment) => (
                  <EnrollmentRow key={enrollment.id} enrollment={enrollment} />
                ))}
              </div>
              <PaginationBar
                count={assignments.data.count}
                page={page}
                onPage={(p) => change("page", String(p))}
              />
            </>
          ) : (
            <EmptyState
              title="Курс пока не назначен"
              description="Уточните у HR, подходит ли курс вашей роли. Самозапись не предусмотрена."
            />
          )}
        </DataSection>
        <DemoNote />
      </div>
    </>
  );
}

function AttemptRows({
  enrollment,
}: {
  enrollment: Model<"EnrollmentDetail">;
}) {
  return enrollment.attempts.length ? (
    <div className="ac-list">
      {enrollment.attempts.map((attempt) => (
        <div key={attempt.id} className="ac-row">
          <div>
            <h3>
              <Link
                className="text-link"
                to={`/academy/attempts/${attempt.id}?enrollment=${enrollment.id}`}
              >
                Попытка {attempt.number} · {attempt.score}%
              </Link>
            </h3>
            <p className="muted">
              {date(attempt.submitted_at)} · Версия курса{" "}
              {enrollment.course_version.number}
            </p>
          </div>
          <span>{attempt.passed ? "Тест пройден" : "Тест не пройден"}</span>
        </div>
      ))}
    </div>
  ) : (
    <p className="muted">Сохранённых попыток пока нет.</p>
  );
}

export function LearningPage() {
  const { id = "" } = useParams();
  const session = useSession();
  const client = useQueryClient();
  const enrollment = useEnrollment(id);
  const own =
    !!enrollment.data && enrollment.data.employee === session.employee?.id;
  const learning = useQuery({
    queryKey: ["learning", id],
    enabled: own,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/enrollments/{id}/learning/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const [params, setParams] = useSearchParams();
  const content = learning.data;
  const lesson =
    content?.lessons.find((item) => item.id === params.get("lesson")) ??
    content?.lessons[0];
  const position =
    content?.lessons.findIndex((item) => item.id === lesson?.id) ?? 0;
  const record = enrollment.data;
  const command = useCommand(
    async (
      intent: {
        action: "start" | "complete_lesson";
        expected_version: number;
        lesson_id?: string;
      },
      key,
    ) => {
      const params = { path: { id }, header: { "Idempotency-Key": key } };
      return intent.action === "start"
        ? unwrap(
            await api.POST("/api/v1/academy/enrollments/{id}/start/", {
              params,
              body: { expected_version: intent.expected_version },
            }),
          )
        : unwrap(
            await api.POST(
              "/api/v1/academy/enrollments/{id}/complete-lesson/",
              {
                params,
                body: {
                  expected_version: intent.expected_version,
                  lesson_id: intent.lesson_id ?? "",
                },
              },
            ),
          );
    },
  );
  function run(intent: {
    action: "start" | "complete_lesson";
    expected_version: number;
    lesson_id?: string;
  }) {
    command.mutate(intent, {
      onSuccess: (result) => client.setQueryData(["enrollment", id], result),
    });
  }
  function choose(lessonId: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      next.set("lesson", lessonId);
      return next;
    });
  }
  return (
    <>
      <BackLink to={own ? "/academy" : "/team/learning"}>
        К назначениям
      </BackLink>
      <PageHeader
        eyebrow="Jana Academy"
        title={record?.course_version.title ?? "Обучение"}
        description={
          record
            ? `Назначено ${record.employee_name} · Версия курса ${record.course_version.number}`
            : undefined
        }
      />
      {enrollment.isPending ? (
        <LoadingState />
      ) : enrollment.error ? (
        <ErrorNotice
          error={enrollment.error}
          retry={() => void enrollment.refetch()}
        />
      ) : (
        record && (
          <div className="stack">
            <DataSection
              title="Назначение"
              action={<StatusLabel status={record.completion_state} />}
            >
              <Rules version={record.course_version} />
              <Facts
                items={[
                  {
                    label: "Обязательность",
                    value: record.required ? "Обязательный" : "Рекомендованный",
                  },
                  { label: "Срок", value: date(record.due_at) },
                  {
                    label: "Материалы",
                    value: `${record.material_progress.required_completed} из ${record.material_progress.required_total} обязательных`,
                  },
                  {
                    label: "Осталось попыток",
                    value: record.remaining_attempts ?? "Без ограничения",
                  },
                ]}
              />
              {record.overdue && <StatusLabel status="overdue" />}
              {record.availability !== "published" && (
                <p className="notice-panel">
                  Курс сейчас недоступен для прохождения. История сохранена.
                  Уточните доступ у HR.
                </p>
              )}
              {record.allowed_actions.includes("start") && (
                <ActionButton
                  loading={command.isPending}
                  onClick={() =>
                    run({ action: "start", expected_version: record.version })
                  }
                >
                  Начать обучение
                </ActionButton>
              )}
            </DataSection>
            <WriteRecovery
              error={command.error}
              refresh={() => {
                void enrollment.refetch().then(() => command.reset());
              }}
              retry={
                command.variables
                  ? () => {
                      if (command.variables) run(command.variables);
                    }
                  : undefined
              }
            />
            {own &&
              (learning.isPending ? (
                <LoadingState />
              ) : learning.error ? (
                <ErrorNotice
                  error={learning.error}
                  retry={() => void learning.refetch()}
                />
              ) : (
                content && (
                  <div className="ac-player">
                    <nav className="ac-outline" aria-label="Содержание курса">
                      {content.lessons.map((item, i) => (
                        <Link
                          key={item.id}
                          to={`?lesson=${encodeURIComponent(item.id)}`}
                          aria-current={
                            lesson?.id === item.id ? "page" : undefined
                          }
                        >
                          {i + 1}. {item.title}
                          <span className="muted">
                            {record.material_progress.completed_lesson_ids.includes(
                              item.id,
                            )
                              ? " · Завершён"
                              : item.required
                                ? " · Обязательный"
                                : " · Дополнительный"}
                          </span>
                        </Link>
                      ))}
                      <Link to={`/academy/enrollments/${id}/quiz`}>
                        Тест · {content.question_count} вопросов
                      </Link>
                    </nav>
                    {lesson ? (
                      <DataSection
                        title={lesson.title}
                        description={`Материал ${position + 1} из ${content.lessons.length}`}
                      >
                        <div className="stack">
                          <div className="ac-material">
                            {lesson.body_markdown}
                          </div>
                          {record.material_progress.completed_lesson_ids.includes(
                            lesson.id,
                          ) ? (
                            <p role="status">Завершение материала сохранено.</p>
                          ) : (
                            record.allowed_actions.includes(
                              "complete_lesson",
                            ) && (
                              <ActionButton
                                loading={command.isPending}
                                onClick={() =>
                                  run({
                                    action: "complete_lesson",
                                    expected_version: record.version,
                                    lesson_id: lesson.id,
                                  })
                                }
                              >
                                Подтвердить завершение материала
                              </ActionButton>
                            )
                          )}
                          <div className="button-row">
                            {content.lessons[position - 1] && (
                              <ActionButton
                                variant="secondary"
                                onClick={() =>
                                  choose(content.lessons[position - 1].id)
                                }
                              >
                                Предыдущий материал
                              </ActionButton>
                            )}
                            {content.lessons[position + 1] ? (
                              <ActionButton
                                variant="secondary"
                                onClick={() =>
                                  choose(content.lessons[position + 1].id)
                                }
                              >
                                Следующий материал
                              </ActionButton>
                            ) : (
                              <Link
                                className="text-link"
                                to={`/academy/enrollments/${id}/quiz`}
                              >
                                Перейти к условиям теста
                              </Link>
                            )}
                          </div>
                        </div>
                      </DataSection>
                    ) : (
                      <EmptyState
                        title="В версии нет материалов"
                        description="Обратитесь в HR, чтобы проверить публикацию курса."
                      />
                    )}
                  </div>
                )
              ))}
            <DataSection title="Попытки и результаты">
              <AttemptRows enrollment={record} />
            </DataSection>
            <DemoNote />
          </div>
        )
      )}
    </>
  );
}

function QuizForm({
  enrollment,
  content,
  refresh,
}: {
  enrollment: Model<"EnrollmentDetail">;
  content: Model<"LearningContent">;
  refresh: () => void;
}) {
  const navigate = useNavigate();
  const [selections, setSelections] = useState<Record<string, string>>({});
  const submit = useCommand(async (body: Model<"AttemptCommandRequest">, key) =>
    unwrap(
      await api.POST("/api/v1/academy/enrollments/{id}/submit-attempt/", {
        body,
        params: {
          path: { id: enrollment.id },
          header: { "Idempotency-Key": key },
        },
      }),
    ),
  );
  function send(body: Model<"AttemptCommandRequest">) {
    submit.mutate(body, {
      onSuccess: (result) =>
        void navigate(
          `/academy/attempts/${result.attempt.id}?enrollment=${enrollment.id}`,
        ),
    });
  }
  return (
    <form
      className="form-stack"
      onSubmit={(e) => {
        e.preventDefault();
        send({
          expected_version: enrollment.version,
          answers: content.questions.map((question) => ({
            question_id: question.id,
            selected_option_id: selections[question.id] ?? "",
          })),
        });
      }}
    >
      <p className="muted">
        Ответы сохранятся после отправки всей попытки. Правильные ответы не
        показываются. Вопросов {content.questions.length}.
      </p>
      {content.questions.map((question, i) => (
        <fieldset
          className="ac-question"
          key={question.id}
          disabled={submit.isPending}
        >
          <legend>
            {i + 1}. {question.prompt}
          </legend>
          {question.options.map((option) => (
            <label className="ac-choice" key={option.id}>
              <input
                type="radio"
                name={`question-${question.id}`}
                required
                value={option.id}
                checked={selections[question.id] === option.id}
                onChange={() =>
                  setSelections((previous) => ({
                    ...previous,
                    [question.id]: option.id,
                  }))
                }
              />
              <span>{option.text}</span>
            </label>
          ))}
        </fieldset>
      ))}
      <WriteRecovery
        error={submit.error}
        refresh={() => {
          refresh();
          submit.reset();
        }}
        retry={
          submit.variables
            ? () => {
                if (submit.variables) send(submit.variables);
              }
            : undefined
        }
      />
      <ActionButton
        type="submit"
        loading={submit.isPending}
        loadingLabel="Отправляем ответы"
      >
        Отправить ответы и завершить попытку
      </ActionButton>
    </form>
  );
}

export function QuizPage() {
  const { id = "" } = useParams();
  const session = useSession();
  const enrollment = useEnrollment(id);
  const own = enrollment.data?.employee === session.employee?.id;
  const learning = useQuery({
    queryKey: ["learning", id],
    enabled: !!enrollment.data && own,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/enrollments/{id}/learning/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const record = enrollment.data;
  return (
    <>
      <BackLink to={`/academy/enrollments/${id}`}>
        К материалам и истории
      </BackLink>
      <PageHeader
        eyebrow="Jana Academy"
        title="Проверка знаний"
        description={record?.course_version.title}
      />
      {enrollment.isPending ? (
        <LoadingState />
      ) : enrollment.error ? (
        <ErrorNotice
          error={enrollment.error}
          retry={() => void enrollment.refetch()}
        />
      ) : (
        record && (
          <div className="stack">
            <DataSection title="Условия теста">
              <Rules version={record.course_version} />
              <p>
                Обязательные материалы{" "}
                {record.material_progress.required_completed} из{" "}
                {record.material_progress.required_total}. Осталось попыток{" "}
                {record.remaining_attempts ?? "без ограничения"}.
              </p>
              <p className="muted">
                Результат считает сервер. Переход к вопросам не создаёт попытку.
                Таймера нет.
              </p>
            </DataSection>
            {!own ? (
              <EmptyState
                title="Ответы доступны только назначенному сотруднику"
                description="Руководитель и HR могут просматривать сохранённые результаты в назначении."
              />
            ) : !record.allowed_actions.includes("submit_attempt") ? (
              <EmptyState
                title={
                  record.completed_at
                    ? "Обучение уже завершено"
                    : record.availability !== "published"
                      ? "Курс недоступен"
                      : record.remaining_attempts === 0
                        ? "Попытки закончились"
                        : "Сначала завершите обязательные материалы"
                }
                description={
                  record.remaining_attempts === 0 ||
                  record.availability !== "published"
                    ? "Уточните следующий шаг у HR. Ранее сохранённые результаты доступны в истории."
                    : "Откройте материалы и историю назначения, чтобы продолжить."
                }
                action={
                  <Link className="text-link" to={`/academy/enrollments/${id}`}>
                    Открыть назначение
                  </Link>
                }
              />
            ) : learning.isPending ? (
              <LoadingState />
            ) : learning.error ? (
              <ErrorNotice
                error={learning.error}
                retry={() => void learning.refetch()}
              />
            ) : (
              learning.data && (
                <DataSection title="Вопросы">
                  <QuizForm
                    key={record.id}
                    enrollment={record}
                    content={learning.data}
                    refresh={() => void enrollment.refetch()}
                  />
                </DataSection>
              )
            )}
            <DemoNote />
          </div>
        )
      )}
    </>
  );
}

async function locateAttempt({
  id,
  employee,
  hint,
  signal,
}: {
  id: string;
  employee: string;
  hint: string | null;
  signal: AbortSignal;
}) {
  if (hint) {
    const enrollment = unwrap(
      await api.GET("/api/v1/academy/enrollments/{id}/", {
        params: { path: { id: hint } },
        signal,
      }),
    );
    const attempt = enrollment.attempts.find((item) => item.id === id);
    return attempt ? { enrollment, attempt } : null;
  }
  for (let page = 1; ; page += 1) {
    const list = unwrap(
      await api.GET("/api/v1/academy/enrollments/", {
        params: { query: { employee, page, page_size: 100 } },
        signal,
      }),
    );
    for (const item of list.results) {
      const enrollment = unwrap(
        await api.GET("/api/v1/academy/enrollments/{id}/", {
          params: { path: { id: item.id } },
          signal,
        }),
      );
      const attempt = enrollment.attempts.find((value) => value.id === id);
      if (attempt) return { enrollment, attempt };
    }
    if (!list.next) return null;
  }
}

export function AttemptPage() {
  const { id = "" } = useParams();
  const [params] = useSearchParams();
  const session = useSession();
  const hint = params.get("enrollment");
  const result = useQuery({
    queryKey: ["attempt-result", session.user.id, id, hint],
    enabled: !!session.employee,
    queryFn: ({ signal }) =>
      locateAttempt({ id, employee: session.employee?.id ?? "", hint, signal }),
  });
  const saved = result.data;
  return (
    <>
      <BackLink
        to={
          saved
            ? `/academy/enrollments/${saved.enrollment.id}`
            : "/academy/history"
        }
      >
        К обучению
      </BackLink>
      <PageHeader
        eyebrow="Jana Academy"
        title={saved ? `Попытка ${saved.attempt.number}` : "Результат попытки"}
        description={saved?.enrollment.course_version.title}
      />
      {result.isPending ? (
        <LoadingState />
      ) : result.error ? (
        <ErrorNotice error={result.error} retry={() => void result.refetch()} />
      ) : saved ? (
        <div className="stack">
          <DataSection
            title={saved.attempt.passed ? "Тест пройден" : "Тест не пройден"}
          >
            <div className="ac-result">
              <strong>{saved.attempt.score}%</strong>
              <p>
                Порог {saved.attempt.passing_percent}%. Верных ответов{" "}
                {saved.attempt.correct_count} из {saved.attempt.question_count}.
              </p>
            </div>
            <Facts
              items={[
                {
                  label: "Дата попытки",
                  value: date(saved.attempt.submitted_at),
                },
                {
                  label: "Версия курса",
                  value: saved.enrollment.course_version.number,
                },
                {
                  label: "Материалы на момент попытки",
                  value: saved.attempt.material_completed
                    ? "Завершены"
                    : "Не завершены",
                },
                {
                  label: "Текущее завершение назначения",
                  value: (
                    <StatusLabel status={saved.enrollment.completion_state} />
                  ),
                },
                {
                  label: "Доступность курса сейчас",
                  value: <StatusLabel status={saved.enrollment.availability} />,
                },
              ]}
            />
            <p className="muted">
              Результат относится к назначенной версии. Новая публикация не
              заменяет эту историю.
            </p>
            <ActionLink to={`/academy/enrollments/${saved.enrollment.id}`}>
              {saved.enrollment.allowed_actions.includes("submit_attempt")
                ? "Вернуться к материалам и повторить тест"
                : "Открыть материалы и историю"}
            </ActionLink>
          </DataSection>
          <DataSection title="Все попытки назначения">
            <AttemptRows enrollment={saved.enrollment} />
          </DataSection>
          <DemoNote />
        </div>
      ) : (
        <EmptyState
          title="Результат недоступен"
          description="Откройте попытку из истории своего обучения или разрешённого назначения команды."
          action={
            <Link to="/academy/history" className="text-link">
              Открыть историю
            </Link>
          }
        />
      )}
    </>
  );
}
