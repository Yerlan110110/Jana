import { ActionButton as Button } from "@/components/actions";
import { Card } from "@/components/pace/card";
import {
  BackLink,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
} from "@/components/ui";
import { api, unwrap, useCommand } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, BookOpenCheck, CircleCheck, Clock3 } from "lucide-react";
import { useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";

const statusLabels: Record<string, string> = {
  pending: "Нужно ознакомиться",
  completed: "Ознакомление пройдено",
  superseded: "Заменено новой редакцией",
};

export function PolicyUpdatesPage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const query = useQuery({
    queryKey: [user.id, "policy-updates", page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/updates/", {
          params: { query: { page } },
          signal,
        }),
      ),
  });

  const isEmployee = user.role === "employee";
  const title =
    user.role === "manager"
      ? "Изменения правил команды"
      : user.role === "hr"
        ? "Ознакомление сотрудников"
        : "Изменения правил";

  return (
    <>
      <PageHeader
        eyebrow="ОБНОВЛЕНИЯ РЕГЛАМЕНТОВ"
        title={title}
        description={
          isEmployee
            ? "Новые правила с коротким сравнением и вопросом по ситуации."
            : "Сотрудники подтверждают, что поняли обновлённое правило."
        }
      />
      <Card className="records-panel">
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorNotice
            error={query.error}
            retry={() => {
              void query.refetch();
            }}
          />
        ) : (
          <>
            <div className="policy-update-list">
              {query.data.results.map((item) => {
                const content = (
                  <>
                    <span className="record-icon">
                      {item.status === "completed" ? (
                        <CircleCheck size={19} aria-hidden="true" />
                      ) : item.status === "pending" ? (
                        <Clock3 size={19} aria-hidden="true" />
                      ) : (
                        <BookOpenCheck size={19} aria-hidden="true" />
                      )}
                    </span>
                    <div className="record-main">
                      <h2>{item.title}</h2>
                      <p>
                        Редакция {item.revision_number}
                        {item.previous_revision_number
                          ? ` · вместо редакции ${item.previous_revision_number}`
                          : ""}
                        {item.employee_name && !item.is_mine
                          ? ` · ${item.employee_name}`
                          : ""}
                      </p>
                      <small>{date(item.published_at)}</small>
                    </div>
                    <span
                      className={`policy-update-status policy-update-status--${item.status}`}
                    >
                      {statusLabels[item.status] ?? item.status}
                    </span>
                    {item.is_mine && (
                      <ArrowRight size={16} aria-hidden="true" />
                    )}
                  </>
                );

                return item.is_mine ? (
                  <Link
                    className="policy-update-row"
                    key={item.id}
                    to={`/policy-updates/${item.id}`}
                  >
                    {content}
                  </Link>
                ) : (
                  <article className="policy-update-row" key={item.id}>
                    {content}
                  </article>
                );
              })}
            </div>
            {!query.data.count && (
              <EmptyState
                title={
                  isEmployee
                    ? "Новых правил пока нет"
                    : "Назначений пока нет"
                }
                description={
                  isEmployee
                    ? "Когда HR опубликует изменение для вашей аудитории, оно появится здесь."
                    : "После публикации новой редакции здесь появятся сотрудники и их статус ознакомления."
                }
              />
            )}
            <PaginationBar
              count={query.data.count ?? 0}
              page={page}
              onPage={(next) => setParams({ page: String(next) })}
            />
          </>
        )}
      </Card>
    </>
  );
}

export function PolicyUpdatePage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const [choice, setChoice] = useState<number | null>(null);
  const query = useQuery({
    queryKey: [user.id, "policy-update", id],
    enabled: Boolean(id),
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/updates/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const answer = useCommand(async (option_index: number, key) =>
    unwrap(
      await api.POST("/api/v1/knowledge/updates/{id}/attempt/", {
        params: { path: { id }, header: { "Idempotency-Key": key } },
        body: { option_index },
      }),
    ),
  );

  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <ErrorNotice
        error={query.error}
        retry={() => {
          void query.refetch();
        }}
      />
    );

  const update = query.data;
  const superseded = update.status === "superseded";
  const result = answer.data;
  const complete = update.status === "completed" || result?.completed === true;

  return (
    <>
      <BackLink to="/policy-updates">К изменениям правил</BackLink>
      <PageHeader
        eyebrow={`РЕДАКЦИЯ ${update.revision_number}`}
        title={update.title}
        description={`Опубликовано ${date(update.published_at)} · действует с ${date(update.effective_from)}`}
      />

      {update.is_synthetic && (
        <p className="demo-note" role="note">
          Это учебное правило для демонстрационного стенда.
        </p>
      )}

      {superseded ? (
        <Card className="policy-update-notice" role="status">
          <BookOpenCheck size={20} aria-hidden="true" />
          <div>
            <h2>Опубликована более новая редакция</h2>
            <p>Откройте список изменений и ознакомьтесь с актуальным правилом.</p>
          </div>
        </Card>
      ) : (
        <>
          <section aria-labelledby="policy-change-heading">
            <div className="section-heading">
              <div>
                <p className="eyebrow">СРАВНЕНИЕ РЕДАКЦИЙ</p>
                <h2 id="policy-change-heading">Что изменилось</h2>
              </div>
            </div>
            {update.changes.length ? (
              <div className="policy-change-list">
                {update.changes.map((change, index) => (
                  <Card className="policy-change-card" key={`${change.heading}-${index}`}>
                    <h3>{change.heading}</h3>
                    <div className="policy-change-columns">
                      <div>
                        <p className="eyebrow">РАНЬШЕ</p>
                        <p>{change.before ?? "В предыдущей редакции этого раздела не было."}</p>
                      </div>
                      <div>
                        <p className="eyebrow">ТЕПЕРЬ</p>
                        <p>{change.after ?? "Раздел удалён из действующей редакции."}</p>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="policy-update-notice">
                <BookOpenCheck size={20} aria-hidden="true" />
                <p>Сравнение текста этой редакции недоступно.</p>
              </Card>
            )}
          </section>

          <Card className="policy-check-card">
            <p className="eyebrow">ПРОВЕРКА ПОНИМАНИЯ</p>
            <h2>{update.question}</h2>
            {complete ? (
              <div className="policy-answer-success" role="status">
                <CircleCheck size={19} aria-hidden="true" />
                <div>
                  <strong>Ознакомление подтверждено</strong>
                  <p>
                    {update.explanation ||
                      "Вы верно ответили на вопрос по новой редакции."}
                  </p>
                </div>
              </div>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  if (choice === null) return;
                  void answer.mutateAsync(choice).catch(() => undefined);
                }}
              >
                <fieldset className="policy-answer-options" disabled={answer.isPending}>
                  <legend className="sr-only">Выберите один ответ</legend>
                  {update.options.map((option, index) => (
                    <label className="policy-answer-option" key={index}>
                      <input
                        type="radio"
                        name="policy-answer"
                        value={index}
                        checked={choice === index}
                        onChange={() => {
                          setChoice(index);
                          answer.reset();
                        }}
                      />
                      <span>{option}</span>
                    </label>
                  ))}
                </fieldset>
                {result && !result.is_correct && (
                  <p className="policy-answer-retry" role="status">
                    Ответ пока не совпал с правилом. Сравните изменения и попробуйте ещё раз.
                  </p>
                )}
                <ErrorNotice error={answer.error} />
                <Button
                  type="submit"
                  disabled={choice === null}
                  loading={answer.isPending}
                  loadingLabel="Проверяем ответ"
                  iconEnd={<ArrowRight size={16} aria-hidden="true" />}
                >
                  Проверить ответ
                </Button>
              </form>
            )}
          </Card>
        </>
      )}
    </>
  );
}
