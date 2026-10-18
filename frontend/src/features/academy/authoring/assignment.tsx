import { ActionButton } from "@/components/actions";
import {
  BackLink,
  DataSection,
  DemoNote,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
} from "@/components/ui";
import { Input } from "@/components/upstream/input";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Link } from "react-router";
import { Facts, WriteRecovery } from "../../requests/support";
import { EnrollmentRow } from "../common";
import { HrOnly } from "./common";

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
                            checked={
                              course?.published_version.id === item.published_version.id
                            }
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
              refreshDescription="Сотрудник, обязательность и срок сохранятся. После обновления выберите действующую публикацию курса и проверьте назначение."
              refresh={() => {
                setCourse(null);
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
