import { ActionLink } from "@/components/actions";
import {
  DataSection,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
} from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import { Facts } from "../../requests/support";
import {
  enrollmentFilters,
  EnrollmentRow,
  LearningFilters,
  useListParams,
  type EnrollmentQuery,
} from "../common";

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
  const nextCourse = enrollments.data?.results.find(item => item.completion_state !== "completed");
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
    <div className="interior-page interior-academy">
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
      {!team && !history && <section className="academy-launchpad" aria-label="Ваш учебный маршрут">
        <div className="academy-editorial">
          <span className="interior-kicker">JANA ACADEMY / ВАШ РОСТ</span>
          <h2>Новый навык.<br /><em>Следующий шаг.</em></h2>
          <p>Короткие материалы. Практика на рабочих ситуациях. Результат, к которому можно вернуться.</p>
          <Link to="/academy/catalog">Выбрать новый курс <span>↗</span></Link>
        </div>
        <div className="academy-next">
          <span className="interior-kicker">ПРОДОЛЖИТЬ ОБУЧЕНИЕ <span>↗</span></span>
          {nextCourse ? <><span className="academy-next-number">01</span><h3>{nextCourse.course_version.title}</h3><p>Материалы пройдены на {nextCourse.material_progress.percent}%</p><progress max={100} value={nextCourse.material_progress.percent} aria-label="Прогресс следующего курса" /><Link to={`/academy/enrollments/${nextCourse.id}`}>Вернуться к материалам <span>→</span></Link></> : <><span className="academy-next-number">✓</span><h3>{enrollments.isPending ? "Собираем ваш маршрут" : "Можно открыть новое"}</h3><Link to="/academy/catalog">Перейти в каталог →</Link></>}
        </div>
      </section>}
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
      </div>
    </div>
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
