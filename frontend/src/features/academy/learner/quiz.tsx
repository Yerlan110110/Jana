import { ActionButton } from "@/components/actions";
import {
  BackLink,
  DataSection,
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import {
  Link,
  useBeforeUnload,
  useBlocker,
  useNavigate,
  useParams,
} from "react-router";
import { isAccessDenied, WriteRecovery } from "../../requests/support";
import { Rules, useEnrollment } from "../common";

type QuizIntent = Model<"AttemptCommandRequest"> & { id: string };

function useQuizSubmission() {
  const navigate = useNavigate();
  const savedEnrollment = useRef<string | null>(null);
  const submit = useCommand(async ({ id, ...body }: QuizIntent, key) =>
    unwrap(
      await api.POST("/api/v1/academy/enrollments/{id}/submit-attempt/", {
        body,
        params: {
          path: { id },
          header: { "Idempotency-Key": key },
        },
      }),
    ),
  );
  function send(body: QuizIntent) {
    submit.mutate(body, {
      onSuccess: (result) => {
        savedEnrollment.current = body.id;
        void navigate(
          `/academy/attempts/${result.attempt.id}?enrollment=${body.id}`,
        );
      },
    });
  }
  return { submit, send, savedEnrollment };
}

function QuizForm({
  enrollment,
  content,
  refresh,
  submission,
}: {
  enrollment: Model<"EnrollmentDetail">;
  content: Model<"LearningContent">;
  refresh: () => void;
  submission: ReturnType<typeof useQuizSubmission>;
}) {
  const [selections, setSelections] = useState<Record<string, string>>({});
  const warning = useRef<HTMLDialogElement>(null);
  const warningId = useId();
  const dirty = Object.keys(selections).length > 0;
  const { submit, send, savedEnrollment } = submission;
  const blocker = useBlocker(() => dirty && savedEnrollment.current !== enrollment.id);
  useBeforeUnload(
    useCallback((event) => {
      if (dirty && savedEnrollment.current !== enrollment.id) {
        event.preventDefault();
        event.returnValue = "";
      }
    }, [dirty, enrollment.id, savedEnrollment]),
  );
  useEffect(() => {
    if (blocker.state === "blocked") warning.current?.showModal();
    else warning.current?.close();
  }, [blocker.state]);
  return (
    <>
      <form
        className="form-stack"
        onSubmit={(e) => {
          e.preventDefault();
          send({
            id: enrollment.id,
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
      <dialog
        ref={warning}
        className="quiz-exit-dialog"
        aria-labelledby={`${warningId}-title`}
        aria-describedby={`${warningId}-description`}
        onCancel={(event) => {
          event.preventDefault();
          if (blocker.state === "blocked") blocker.reset();
        }}
      >
        <div className="stack">
          <h2 id={`${warningId}-title`}>
            {submit.isPending ? "Дождитесь результата отправки" : "Уйти без отправки ответов?"}
          </h2>
          <p id={`${warningId}-description`}>
            {submit.isPending
              ? "Ответы отправляются. Дождитесь результата, чтобы проверить сохранение попытки."
              : "Выбранные ответы ещё не сохранены. Если уйдёте, они потеряются. Попытка не будет отправлена."}
          </p>
          <div className="button-row">
            <ActionButton autoFocus onClick={() => {
              if (blocker.state === "blocked") blocker.reset();
            }}>Остаться в тесте</ActionButton>
            {!submit.isPending && <ActionButton variant="secondary" onClick={() => {
              if (blocker.state === "blocked") blocker.proceed();
            }}>Уйти без отправки</ActionButton>}
          </div>
        </div>
      </dialog>
    </>
  );
}

export function QuizPage() {
  const { id = "" } = useParams();
  const session = useSession();
  const submission = useQuizSubmission();
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
      ) : enrollment.error && (!record || isAccessDenied(enrollment.error)) ? (
        <ErrorNotice
          error={enrollment.error}
          retry={() => void enrollment.refetch()}
        />
      ) : (
        record && (
          <div className="stack">
            <ErrorNotice
              error={enrollment.error}
              retry={() => void enrollment.refetch()}
            />
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
                    submission={submission}
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
