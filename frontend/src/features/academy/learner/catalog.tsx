import {
  BackLink,
  DataSection,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
  StatusLabel,
} from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import type { operations } from "@janamen/api-client";
import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router";
import {
  categoryLabel,
  categoryValue,
  EnrollmentRow,
  LearningFilters,
  Rules,
  useListParams,
} from "../common";

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
    <div className="interior-page interior-catalog">
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
      </div>
    </div>
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
      </div>
    </>
  );
}
