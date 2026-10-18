import { useQuery } from "@tanstack/react-query";
import type { operations } from "@janamen/api-client";
import { Link, useSearchParams } from "react-router";
import { Input } from "@/components/upstream/input";
import { NativeSelect } from "@/components/pace/native-select";
import { StatusLabel } from "@/components/ui";
import { api, unwrap, type Model } from "@/lib/api";
import { date } from "@/lib/format";

export const categories = {
  hr: "Кадровые действия",
  logistics: "Логистические данные",
  communication: "Общение",
  information_security: "Доступ и информация",
  team: "Руководитель и HR",
  knowledge: "Регламенты и знания",
} satisfies Record<Model<"CategoryEnum">, string>;
export function categoryValue(
  value: string | null,
): Model<"CategoryEnum"> | undefined {
  return value === "hr" ||
    value === "logistics" ||
    value === "communication" ||
    value === "information_security" ||
    value === "team" ||
    value === "knowledge"
    ? value
    : undefined;
}
export function categoryLabel(value: string) {
  const category = categoryValue(value);
  return category ? categories[category] : value;
}
export type EnrollmentQuery = NonNullable<
  operations["academy_enrollments_list"]["parameters"]["query"]
>;

export function useListParams() {
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  function change(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, value) : next.delete(key);
      if (key !== "page") next.delete("page");
      return next;
    });
  }
  return { params, page, change };
}

export function LearningFilters({
  params,
  change,
  catalogue = false,
}: {
  params: URLSearchParams;
  change: (key: string, value: string) => void;
  catalogue?: boolean;
}) {
  return (
    <div className="filter-bar learning-filter-bar">
      <label className="field">
        Поиск
        <Input
          type="search"
          placeholder={
            catalogue ? "Название или описание курса" : "Курс или сотрудник"
          }
          value={params.get("search") ?? ""}
          onChange={(e) => change("search", e.target.value)}
        />
      </label>
      <label className="field">
        Категория
        <NativeSelect
          value={categoryValue(params.get("category")) ?? ""}
          onChange={(e) => change("category", e.target.value)}
        >
          <option value="">Все категории</option>
          {Object.entries(categories).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </NativeSelect>
      </label>
      {catalogue ? (
        <label className="field">
          Язык материала
          <NativeSelect
            value={params.get("language") ?? ""}
            onChange={(e) => change("language", e.target.value)}
          >
            <option value="">Все языки</option>
            <option value="ru">Русский</option>
            <option value="kk">Қазақша</option>
          </NativeSelect>
        </label>
      ) : (
        <>
          <label className="field">
            Завершение
            <NativeSelect
              value={params.get("state") ?? ""}
              onChange={(e) => change("state", e.target.value)}
            >
              <option value="">Все состояния</option>
              <option value="not_started">Не начато</option>
              <option value="in_progress">В процессе</option>
              <option value="completed">Завершено</option>
            </NativeSelect>
          </label>
          <label className="ac-inline-check">
            <input
              type="checkbox"
              checked={params.get("overdue") === "true"}
              onChange={(e) =>
                change("overdue", e.target.checked ? "true" : "")
              }
            />
            Срок прошёл
          </label>
          <label className="ac-inline-check">
            <input
              type="checkbox"
              checked={params.get("failed") === "true"}
              onChange={(e) => change("failed", e.target.checked ? "true" : "")}
            />
            Есть неуспешная попытка
          </label>
        </>
      )}
    </div>
  );
}

export function enrollmentFilters(params: URLSearchParams): EnrollmentQuery {
  const state = params.get("state");
  return {
    search: params.get("search") ?? "",
    category: categoryValue(params.get("category")),
    completion_state:
      state === "not_started" ||
      state === "in_progress" ||
      state === "completed"
        ? state
        : undefined,
    overdue: params.get("overdue") === "true" ? true : undefined,
    has_failed_attempt: params.get("failed") === "true" ? true : undefined,
  };
}

export function useEnrollment(id: string) {
  return useQuery({
    queryKey: ["enrollment", id],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/enrollments/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
}

export function EnrollmentRow({
  enrollment,
  showEmployee = false,
}: {
  enrollment: Model<"Enrollment">;
  showEmployee?: boolean;
}) {
  const progress = enrollment.material_progress;
  return (
    <article className="ac-row">
      <div>
        <h3>
          <Link
            className="text-link"
            to={`/academy/enrollments/${enrollment.id}`}
          >
            {enrollment.course_version.title}
          </Link>
        </h3>
        {showEmployee && <p>{enrollment.employee_name}</p>}
        <div className="ac-meta">
          <span>
            {enrollment.required ? "Обязательный" : "Рекомендованный"}
          </span>
          <span>Срок {date(enrollment.due_at)}</span>
          <span>Версия курса {enrollment.course_version.number}</span>
          <span>{categoryLabel(enrollment.course_version.category)}</span>
        </div>
        <label className="muted">
          Материалы {progress.required_completed} из {progress.required_total}
          <progress className="ac-progress" max={100} value={progress.percent}>
            {progress.percent}%
          </progress>
        </label>
        <div className="ac-meta">
          <span>Попыток {enrollment.attempt_count}</span>
          {enrollment.last_attempt && (
            <Link
              to={`/academy/attempts/${enrollment.last_attempt.id}?enrollment=${enrollment.id}`}
              className="text-link"
            >
              Последний результат {enrollment.last_attempt.score}%
            </Link>
          )}
        </div>
      </div>
      <div className="stack">
        <StatusLabel status={enrollment.completion_state} />
        {enrollment.overdue && <StatusLabel status="overdue" />}
        {enrollment.has_failed_attempt && (
          <span className="muted">Есть неуспешная попытка</span>
        )}
        {enrollment.availability !== "published" && (
          <StatusLabel status={enrollment.availability} />
        )}
      </div>
    </article>
  );
}

export function Rules({ version }: { version: Model<"CourseVersionSummary"> }) {
  return (
    <div className="ac-meta">
      <span>Материалы {version.lesson_count}</span>
      <span>Вопросы {version.question_count}</span>
      <span>Порог {version.passing_percent}%</span>
      <span>
        {version.max_attempts === null
          ? "Попытки без ограничения"
          : `Лимит попыток ${version.max_attempts}`}
      </span>
      <span>
        {version.estimated_minutes === null
          ? "Длительность не указана"
          : `${version.estimated_minutes} мин`}
      </span>
      <span>
        {version.content_language === "kk"
          ? "Материалы на казахском"
          : "Материалы на русском"}
      </span>
    </div>
  );
}
