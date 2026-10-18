import { useQuery } from "@tanstack/react-query";
import { Link, useSearchParams } from "react-router";
import { Bell, Check, ChevronRight } from "lucide-react";
import { ActionButton as Button } from "@/components/actions";
import { Card } from "@/components/pace/card";
import {
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
} from "@/components/ui";
import { api, unwrap, useCommand } from "@/lib/api";
import { useSession } from "@/lib/session";
import { date, statusText } from "@/lib/format";

function targetRoute(type: string, id: string) {
  switch (type) {
    case "hr_request":
      return `/requests/${id}`;
    case "enrollment":
      return `/academy/enrollments/${id}`;
    case "knowledge_gap":
      return `/knowledge/cases/${id}`;
    default:
      return null;
  }
}

export function NotificationsPage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const unread = params.get("unread") === "true";
  const query = useQuery({
    queryKey: [user.id, "notifications", page, unread],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/notifications/", {
          params: {
            query: {
              page,
              ordering: "-created_at",
              unread: unread || undefined,
            },
          },
          signal,
        }),
      ),
  });
  const read = useCommand(async (id: string) =>
    unwrap(
      await api.POST("/api/v1/notifications/{id}/read/", {
        params: { path: { id } },
      }),
    ),
  );
  return (
    <>
      <PageHeader
        eyebrow="МОЙ КАБИНЕТ"
        title="Уведомления"
        description="Изменения по заявкам, обучение и ответы HR. Прочтение не меняет состояние задачи."
      />
      <div className="filter-bar">
        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={unread}
            onChange={(event) =>
              setParams(event.target.checked ? { unread: "true" } : {})
            }
          />
          Только непрочитанные
        </label>
      </div>
      <ErrorNotice error={read.error} />
      <Card className="records-panel">
        {query.isPending ? (
          <LoadingState />
        ) : query.isError ? (
          <ErrorNotice
            error={query.error}
            retry={() => {
              if (page > 1) setParams(unread ? { unread: "true" } : {});
              else void query.refetch();
            }}
          />
        ) : (
          <>
            <div className="notification-list">
              {query.data.results.map((item) => {
                const route = targetRoute(item.target_type, item.target_id);
                return (
                  <article
                    className="notification-row"
                    key={item.id}
                    data-unread={!item.read_at}
                  >
                    <span className="record-icon">
                      <Bell size={18} aria-hidden="true" />
                    </span>
                    <div className="record-main">
                      <div className="notification-title">
                        <h2>{item.title}</h2>
                        {!item.read_at && (
                          <span className="unread-label">Новое</span>
                        )}
                      </div>
                      <p>
                        {item.request_status
                          ? `Заявка: ${statusText(item.request_status)}`
                          : item.body}
                      </p>
                      <small>{date(item.created_at)}</small>
                      {route && (
                        <Link className="text-link" to={route}>
                          Открыть задачу
                          <ChevronRight size={14} aria-hidden="true" />
                        </Link>
                      )}
                    </div>
                    {!item.read_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        loading={read.isPending && read.variables === item.id}
                        disabled={read.isPending}
                        onClick={() => read.mutate(item.id)}
                        iconStart={<Check size={15} aria-hidden="true" />}
                      >
                        Отметить прочитанным
                      </Button>
                    )}
                  </article>
                );
              })}
            </div>
            {!query.data.count && (
              <EmptyState
                title={
                  unread ? "Непрочитанных событий нет" : "Событий пока нет"
                }
                description="Здесь появятся изменения по вашим задачам и назначениям."
              />
            )}
            <PaginationBar
              count={query.data.count ?? 0}
              page={page}
              onPage={(next) =>
                setParams({
                  page: String(next),
                  ...(unread ? { unread: "true" } : {}),
                })
              }
            />
          </>
        )}
      </Card>
    </>
  );
}
