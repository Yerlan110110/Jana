import { ActionButton } from "@/components/actions";
import {
  BackLink,
  DataSection,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
  StatusLabel,
} from "@/components/ui";
import { Input } from "@/components/upstream/input";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { isAccessDenied, WriteRecovery } from "../../requests/support";
import type { Draft } from "./common";
import { emptyDraft, HrOnly } from "./common";
import { CourseFields } from "./course-fields";

function PublishedRevisions({ id }: { id: string }) {
  const [page, setPage] = useState(1);
  const revisions = useQuery({
    queryKey: ["course-revisions", id, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/manage/courses/{id}/revisions/", {
          params: { path: { id }, query: { page } },
          signal,
        }),
      ),
  });
  return (
    <DataSection
      title="История публикаций"
      description="Эти версии неизменяемы. Новая публикация не заменяет прежние назначения."
    >
      {revisions.isPending ? (
        <LoadingState />
      ) : revisions.error ? (
        <ErrorNotice
          error={revisions.error}
          retry={() => void revisions.refetch()}
        />
      ) : (
        revisions.data && (
          <>
            {revisions.data.results.length ? (
              <div className="ac-revisions">
                {revisions.data.results.map((version) => (
                  <details key={version.id}>
                    <summary>
                      Версия {version.number} · {version.title} ·{" "}
                      {date(version.published_at)}
                    </summary>
                    <div className="stack">
                      <p>{version.summary}</p>
                      <p className="muted">
                        {version.lesson_count} материалов ·{" "}
                        {version.question_count} вопросов · Порог{" "}
                        {version.passing_percent}%
                      </p>
                      {version.lessons.map((lesson) => (
                        <section key={lesson.id}>
                          <h3>{lesson.title}</h3>
                          <div className="ac-material">
                            {lesson.body_markdown}
                          </div>
                        </section>
                      ))}
                      <details>
                        <summary>
                          Вопросы и ключи этой версии · только HR
                        </summary>
                        {version.questions.map((question) => (
                          <div className="ac-editor-block" key={question.id}>
                            <h3>{question.prompt}</h3>
                            {question.options.map((option) => (
                              <p key={option.id}>
                                {option.text}
                                {option.id === question.correct_option_id
                                  ? " · Верный ответ"
                                  : ""}
                              </p>
                            ))}
                            <p>{question.explanation}</p>
                          </div>
                        ))}
                      </details>
                    </div>
                  </details>
                ))}
              </div>
            ) : (
              <p className="muted">Опубликованных версий пока нет.</p>
            )}
            <PaginationBar
              count={revisions.data.count}
              page={page}
              onPage={setPage}
            />
          </>
        )
      )}
    </DataSection>
  );
}

function CourseEditor({
  record,
  refreshRecord,
}: {
  record?: Model<"CourseAdmin">;
  refreshRecord?: () => Promise<Model<"CourseAdmin"> | undefined>;
}) {
  const navigate = useNavigate();
  const client = useQueryClient();
  const [draft, setDraft] = useState<Draft>(() => record?.draft ?? emptyDraft);
  const [slug, setSlug] = useState(record?.slug ?? "");
  const [version, setVersion] = useState(record?.version ?? 1);
  const [confirm, setConfirm] = useState<
    "publish" | "archive" | "restore" | null
  >(null);
  const dirty =
    !!record && JSON.stringify(draft) !== JSON.stringify(record.draft);
  const save = useCommand(
    async (
      intent: {
        id?: string;
        slug: string;
        draft: Draft;
        expected_version: number;
      },
      key,
    ) =>
      intent.id
        ? unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/save-draft/", {
              params: {
                path: { id: intent.id },
                header: { "Idempotency-Key": key },
              },
              body: {
                draft: intent.draft,
                expected_version: intent.expected_version,
              },
            }),
          )
        : unwrap(
            await api.POST("/api/v1/academy/manage/courses/", {
              params: { header: { "Idempotency-Key": key } },
              body: { slug: intent.slug, draft: intent.draft },
            }),
          ),
  );
  const transition = useCommand(
    async (
      intent: {
        id: string;
        action: "publish" | "archive" | "restore";
        expected_version: number;
      },
      key,
    ) => {
      const params = {
        path: { id: intent.id },
        header: { "Idempotency-Key": key },
      };
      const body = { expected_version: intent.expected_version };
      switch (intent.action) {
        case "publish":
          return unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/publish/", {
              params,
              body,
            }),
          );
        case "archive":
          return unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/archive/", {
              params,
              body,
            }),
          );
        case "restore":
          return unwrap(
            await api.POST("/api/v1/academy/manage/courses/{id}/restore/", {
              params,
              body,
            }),
          );
      }
    },
  );
  const pending = save.isPending || transition.isPending;
  async function refresh() {
    if (refreshRecord) {
      const latest = await refreshRecord();
      if (latest) setVersion(latest.version);
    }
    save.reset();
    transition.reset();
  }
  function saved(result: Model<"CourseAdmin">) {
    setVersion(result.version);
    client.setQueryData(["course-admin", result.id], result);
    if (!record) void navigate(`/hr/courses/${result.id}`, { replace: true });
  }
  const transitionLabel =
    confirm === "publish"
      ? "Опубликовать новую версию"
      : confirm === "archive"
        ? "Архивировать курс"
        : "Вернуть курс в каталог";
  return (
    <div className="stack">
      <DataSection
        title={record ? "Редактируемый черновик" : "Новый курс"}
        description={
          record
            ? `Версия записи ${version}. Публикации и назначения сохраняют свои снимки.`
            : "Сохраните черновик, затем проверьте и опубликуйте его."
        }
        action={record && <StatusLabel status={record.availability} />}
      >
        <form
          className="form-stack"
          onSubmit={(e) => {
            e.preventDefault();
            save.mutate(
              { id: record?.id, slug, draft, expected_version: version },
              { onSuccess: saved },
            );
          }}
        >
          <label className="field">
            Код курса
            <Input
              required
              pattern={"[a-zA-Z0-9_\\-]+"}
              maxLength={80}
              disabled={!!record || pending}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <span className="muted">
              Латинские буквы, цифры, дефис и подчёркивание. После создания код
              не меняется.
            </span>
          </label>
          <CourseFields draft={draft} update={setDraft} disabled={pending} />
          <WriteRecovery
            error={save.error}
            refresh={
              record
                ? () => {
                    void refresh();
                  }
                : undefined
            }
            retry={
              save.variables
                ? () => {
                    if (save.variables)
                      save.mutate(save.variables, { onSuccess: saved });
                  }
                : undefined
            }
          />
          <ActionButton
            type="submit"
            loading={save.isPending}
            disabled={transition.isPending}
          >
            Сохранить черновик
          </ActionButton>
          <p role="status" className="muted">
            {dirty
              ? "Есть несохранённые изменения."
              : save.isSuccess
                ? "Черновик сохранён."
                : ""}
          </p>
        </form>
      </DataSection>
      {record && (
        <>
          <DataSection
            title="Публикация и доступность"
            description="Публикация создаёт новую версию. Архив закрывает прохождение и новые назначения, сохраняя историю."
          >
            <div className="stack">
              {dirty && (
                <p className="notice-panel">
                  Сначала сохраните черновик. Публикация использует сохранённое
                  содержание.
                </p>
              )}
              <div className="button-row">
                <ActionButton
                  disabled={dirty || pending}
                  onClick={() => setConfirm("publish")}
                >
                  Опубликовать новую версию
                </ActionButton>
                {record.availability === "published" && (
                  <ActionButton
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setConfirm("archive")}
                  >
                    Архивировать курс
                  </ActionButton>
                )}
                {record.availability === "archived" && (
                  <ActionButton
                    variant="secondary"
                    disabled={pending}
                    onClick={() => setConfirm("restore")}
                  >
                    Вернуть курс в каталог
                  </ActionButton>
                )}
              </div>
              {confirm && (
                <div className="notice-panel stack">
                  <h3>{transitionLabel}</h3>
                  <p>
                    {confirm === "publish"
                      ? "Сохранённый черновик станет новой неизменяемой версией. Существующие назначения останутся на своих версиях."
                      : confirm === "archive"
                        ? "Сотрудники не смогут продолжать этот курс. Их результаты и история сохранятся."
                        : "Текущая опубликованная версия снова станет доступна. Новая версия не создаётся."}
                  </p>
                  <div className="button-row">
                    <ActionButton
                      loading={transition.isPending}
                      disabled={save.isPending}
                      onClick={() =>
                        transition.mutate(
                          {
                            id: record.id,
                            action: confirm,
                            expected_version: version,
                          },
                          {
                            onSuccess: (result) => {
                              saved(result);
                              setConfirm(null);
                            },
                          },
                        )
                      }
                    >
                      {transitionLabel}
                    </ActionButton>
                    <ActionButton
                      variant="secondary"
                      disabled={pending}
                      onClick={() => setConfirm(null)}
                    >
                      Вернуться без действия
                    </ActionButton>
                  </div>
                </div>
              )}
              <WriteRecovery
                error={transition.error}
                refresh={() => {
                  void refresh();
                }}
                retry={
                  transition.variables
                    ? () => {
                        if (transition.variables)
                          transition.mutate(transition.variables, {
                            onSuccess: (result) => {
                              saved(result);
                              setConfirm(null);
                            },
                          });
                      }
                    : undefined
                }
              />
              <p role="status">
                {transition.isSuccess ? "Изменение сохранено сервером." : ""}
              </p>
            </div>
          </DataSection>
          <PublishedRevisions id={record.id} />
        </>
      )}
    </div>
  );
}

export function CourseEditorPage() {
  const { id } = useParams();
  const session = useSession();
  const course = useQuery({
    queryKey: ["course-admin", id],
    enabled: !!id && session.user.role === "hr",
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/academy/manage/courses/{id}/", {
          params: { path: { id: id ?? "" } },
          signal,
        }),
      ),
  });
  if (session.user.role !== "hr") return <HrOnly />;
  return (
    <>
      <BackLink to="/hr/courses">К управлению курсами</BackLink>
      <PageHeader
        eyebrow="HR · Jana Academy"
        title={id ? (course.data?.title ?? "Курс") : "Создать курс"}
      />
      {id ? (
        course.isPending ? (
          <LoadingState />
        ) : course.error && (!course.data || isAccessDenied(course.error)) ? (
          <ErrorNotice
            error={course.error}
            retry={() => void course.refetch()}
          />
        ) : (
          course.data && (
            <>
              <ErrorNotice
                error={course.error}
                retry={() => void course.refetch()}
              />
              <CourseEditor
                key={course.data.id}
                record={course.data}
                refreshRecord={async () => (await course.refetch()).data}
              />
            </>
          )
        )
      ) : (
        <CourseEditor key="new" />
      )}
    </>
  );
}
