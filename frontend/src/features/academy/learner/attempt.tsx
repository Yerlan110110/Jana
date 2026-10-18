import { ActionLink } from "@/components/actions";
import {
  BackLink,
  DataSection,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  StatusLabel,
} from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams, useSearchParams } from "react-router";
import { Facts, timestamp } from "../../requests/support";
import { AttemptRows } from "./learning";

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
                  value: timestamp(saved.attempt.submitted_at),
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
