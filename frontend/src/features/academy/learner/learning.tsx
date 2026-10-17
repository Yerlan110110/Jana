import { ActionButton } from "@/components/actions";
import {
  BackLink,
  DataSection,
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  StatusLabel,
} from "@/components/ui";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import {
  Facts,
  isAccessDenied,
  timestamp,
  WriteRecovery,
} from "../../requests/support";
import { Rules, useEnrollment } from "../common";

type LearningIntent = { id: string; expected_version: number } & (
  | { action: "start" }
  | { action: "complete_lesson"; lesson_id: string }
);

export function AttemptRows({
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
              {timestamp(attempt.submitted_at)} · Версия курса{" "}
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
  const command = useCommand(async (intent: LearningIntent, key) => {
    const params = {
      path: { id: intent.id },
      header: { "Idempotency-Key": key },
    };
    return intent.action === "start"
      ? unwrap(
          await api.POST("/api/v1/academy/enrollments/{id}/start/", {
            params,
            body: { expected_version: intent.expected_version },
          }),
        )
      : unwrap(
          await api.POST("/api/v1/academy/enrollments/{id}/complete-lesson/", {
            params,
            body: {
              expected_version: intent.expected_version,
              lesson_id: intent.lesson_id,
            },
          }),
        );
  });
  function run(intent: LearningIntent) {
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
      ) : enrollment.error && (!record || isAccessDenied(enrollment.error)) ? (
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
                    run({
                      id,
                      action: "start",
                      expected_version: record.version,
                    })
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
                                    id,
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
