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
import { useListParams } from "../common";
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
      </div>
    </>
  );
}
