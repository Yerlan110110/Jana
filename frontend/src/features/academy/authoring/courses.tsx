import { ActionLink } from "@/components/actions";
import { NativeSelect } from "@/components/pace/native-select";
import {
  DataSection,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
  StatusLabel,
} from "@/components/ui";
import { Input } from "@/components/upstream/input";
import { api, unwrap } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { operations } from "@janamen/api-client";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link } from "react-router";
import { categories, categoryValue, useListParams } from "../common";
import { HrOnly } from "./common";

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
  const learning = useQuery({
    queryKey: ["hr-academy-health", session.user.id],
    enabled: session.user.role === "hr",
    queryFn: async ({ signal }) => unwrap(await api.GET("/api/v1/academy/enrollments/summary/", { signal })),
  });
  const directions = useQuery({
    queryKey: ["hr-academy-directions", session.user.id],
    enabled: session.user.role === "hr",
    queryFn: ({ signal }) => Promise.all(Object.entries(categories).map(async ([key, title]) => ({
      key, title,
      summary: unwrap(await api.GET("/api/v1/academy/enrollments/summary/", {
        params: { query: { category: categoryValue(key) } }, signal,
      })),
    }))),
  });
  if (session.user.role !== "hr") return <HrOnly />;
  return (
    <div className="hr-studio">
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
      <section className="hr-studio-hero" aria-label="Центр обучения HR">
        <div><span className="interior-kicker">JANA ACADEMY / HR STUDIO</span><h2>От назначения<br />к <em>пониманию.</em></h2><p>Найдите тех, кому нужна помощь. Откройте попытки и материалы, прежде чем назначать обучение снова.</p><ActionLink to="/hr/assignments">Назначить обучение →</ActionLink></div>
        <div className="hr-studio-score"><span>Завершение обучения</span><strong>{learning.data?.completion_percent == null ? "—" : `${learning.data.completion_percent}%`}</strong><p>{learning.data ? `${learning.data.completed} из ${learning.data.total} назначений завершено` : "Загружаем сводку"}</p><Link to="/team/learning">Открыть всю команду ↗</Link></div>
      </section>
      {learning.error && <ErrorNotice error={learning.error} retry={() => void learning.refetch()} />}
      <section className="hr-priority-grid" aria-label="Приоритеты обучения">
        <Link to="/team/learning?overdue=true"><span>01 / СРОКИ</span><strong>{learning.data?.overdue ?? "—"}</strong><h3>Срок прошёл</h3><p>Разобрать просроченные назначения →</p></Link>
        <Link to="/team/learning?failed=true"><span>02 / ПОНИМАНИЕ</span><strong>{learning.data?.has_failed_attempt ?? "—"}</strong><h3>Есть неуспешная попытка</h3><p>Проверить результат и помочь сотруднику →</p></Link>
        <Link to="/team/learning?state=not_started"><span>03 / ПЕРВЫЙ ШАГ</span><strong>{learning.data?.not_started ?? "—"}</strong><h3>Ещё не начали</h3><p>Посмотреть, кому нужен первый шаг →</p></Link>
      </section>
      <p className="muted">Сводка по всем назначениям в вашей области доступа. Неуспешная попытка может быть и у уже завершённого курса.</p>
      <DataSection title="Карта обучения по направлениям">
        <p className="muted">Каждый переход открывает назначения выбранного направления. Ошибки и просрочки могут пересекаться; мы не складываем их в искусственный рейтинг сотрудников.</p>
        {directions.isPending ? <LoadingState /> : directions.error ? <ErrorNotice error={directions.error} retry={() => void directions.refetch()} /> : <div className="academy-direction-grid">
          {directions.data?.map(({ key, title, summary }) => <article className="academy-direction" key={key}>
            <div className="section-heading"><h3>{title}</h3><span>{summary.total} назначений</span></div>
            <div className="academy-direction-rate"><strong>{summary.completion_percent === null ? "Нет назначений" : `${summary.completion_percent}%`}</strong><span>завершено</span></div>
            <progress max={summary.total || 1} value={summary.completed} aria-label={`Завершено в направлении ${title}`} />
            <div className="academy-direction-actions">
              <Link to={`/team/learning?category=${key}&failed=true`}>Неуспешные попытки <b>{summary.has_failed_attempt}</b></Link>
              <Link to={`/team/learning?category=${key}&overdue=true`}>Срок прошёл <b>{summary.overdue}</b></Link>
              <Link to={`/team/learning?category=${key}&state=not_started`}>Не начали <b>{summary.not_started}</b></Link>
            </div>
            <Link className="text-link" to={`/team/learning?category=${key}`}>Разобрать направление →</Link>
          </article>)}
        </div>}
      </DataSection>
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
      </div>
    </div>
  );
}
