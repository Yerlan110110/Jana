import { ActionButton, ActionLink } from "@/components/actions";
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
import { api, unwrap, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import { RequestSummary } from "./common";

function RequestsList({ queue = false }: { queue?: boolean }) {
  const session = useSession();
  const [params, setParams] = useSearchParams();
  const page = Math.max(1, Number(params.get("page")) || 1);
  const search = params.get("search") ?? "";
  const kind: Model<"KindEnum"> | undefined =
    params.get("type") === "leave"
      ? "leave"
      : params.get("type") === "advance"
        ? "advance"
        : undefined;
  const status = params.get("status");
  const validStatus: Model<"HRRequestStatusEnum"> | undefined =
    status === "draft" ||
    status === "returned" ||
    status === "pending_manager" ||
    status === "pending_hr" ||
    status === "approved" ||
    status === "rejected" ||
    status === "cancelled"
      ? status
      : undefined;
  const canRead = queue ? session.user.role !== "employee" : !!session.employee;
  const query = {
    page,
    search,
    kind,
    status: validStatus,
    waiting: !queue && params.get("waiting") === "true" ? true : undefined,
    ordering: "-created_at",
    ...(queue
      ? { needs_my_action: true, employee: params.get("employee") || undefined }
      : { employee: session.employee?.id }),
  };
  const requests = useQuery({
    queryKey: ["requests", session.user.id, queue, query],
    enabled: canRead,
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/requests/", { params: { query }, signal })),
  });
  function filter(key: string, value: string) {
    setParams((previous) => {
      const next = new URLSearchParams(previous);
      value ? next.set(key, value) : next.delete(key);
      next.delete("page");
      return next;
    });
  }
  if (!canRead)
    return (
      <EmptyState
        title="Нет доступа к этому реестру"
        description="Проверьте роль и кадровый профиль. Для очереди нужна роль руководителя или HR."
      />
    );
  return (
    <div className="interior-page interior-requests">
      <PageHeader
        eyebrow={queue ? "Рассмотрение заявлений" : "Личный кабинет"}
        title={
          queue
            ? params.get("kind") === "hr"
              ? "Очередь HR"
              : "Требует моего решения"
            : "Мои заявления"
        }
        description={
          queue
            ? "Сервер показывает только заявления, по которым вы можете принять решение сейчас."
            : "Отпуск и зарплатный аванс. История и подтверждённый этап по каждому заявлению."
        }
        action={
          !queue && (
            <ActionLink
              to="/requests/new"
              iconStart={<Plus aria-hidden="true" />}
            >
              Создать заявление
            </ActionLink>
          )
        }
      />
      {!queue && <section className="request-launchpad" aria-label="Быстрые действия">
        <Link to="/requests/new?type=leave" className="leave-launch">
          <span className="interior-kicker">ВРЕМЯ ДЛЯ СЕБЯ <span>↗</span></span>
          <h2>Планы начинаются<br />с отпуска.</h2>
          <div className="leave-orbits" aria-hidden="true"><i /><i /><i /><span>J</span></div>
          <span className="launch-bottom">Запланировать отпуск <span>↗</span></span>
        </Link>
        <div className="request-route-card">
          <span className="interior-kicker">ПОНЯТНЫЙ МАРШРУТ</span>
          <h2>От заявления<br />до решения.</h2>
          <ol><li><span>01</span> Вы отправляете</li><li><span>02</span> Руководитель согласует</li><li><span>03</span> HR оформляет</li></ol>
          <Link to="/requests/new?type=advance" className="advance-launch">Нужен зарплатный аванс? <span>↗</span></Link>
        </div>
        <div className="request-count-card">
          <span className="interior-kicker">ВАШ РЕЕСТР</span>
          <strong>{requests.data?.count ?? "—"}</strong>
          <p>заявлений по выбранным условиям</p>
          <div className="count-stacks" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <span>История каждого решения сохраняется</span>
        </div>
      </section>}
      <div className="stack">
        <div className="filter-bar">
          <label className="field">
            Поиск
            <Input
              type="search"
              placeholder="Причина или имя сотрудника"
              value={search}
              onChange={(e) => filter("search", e.target.value)}
            />
          </label>
          <label className="field">
            Тип
            <NativeSelect
              value={kind ?? ""}
              onChange={(e) => filter("type", e.target.value)}
            >
              <option value="">Все типы</option>
              <option value="leave">Отпуск</option>
              <option value="advance">Аванс</option>
            </NativeSelect>
          </label>
          <label className="field">
            Этап
            <NativeSelect
              value={validStatus ?? ""}
              onChange={(e) => filter("status", e.target.value)}
            >
              <option value="">Все этапы</option>
              <option value="draft">Черновик</option>
              <option value="returned">На исправлении</option>
              <option value="pending_manager">У руководителя</option>
              <option value="pending_hr">У HR</option>
              <option value="approved">Согласовано</option>
              <option value="rejected">Отклонено</option>
              <option value="cancelled">Отменено</option>
            </NativeSelect>
          </label>
        </div>
        {!queue && (
          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={params.get("waiting") === "true"}
              onChange={(event) =>
                filter("waiting", event.target.checked ? "true" : "")
              }
            />
            Только ожидают рассмотрения
          </label>
        )}
        {requests.isPending ? (
          <LoadingState />
        ) : requests.error ? (
          <ErrorNotice
            error={requests.error}
            retry={() =>
              page > 1 ? filter("page", "") : void requests.refetch()
            }
          />
        ) : (
          requests.data && (
            <DataSection
              title={queue ? "Заявления на рассмотрение" : "Заявления"}
            >
              {requests.data.results.length ? (
                <div className="rq-list">
                  <div className="crextio-request-head" aria-hidden="true"><span>Заявление</span><span>Период / сумма</span><span>Этап</span></div>
                  {requests.data.results.map((record) => (
                    <article key={record.id} className="rq-row">
                      <div>
                        <h3>
                          <Link
                            className="text-link"
                            to={`/requests/${record.id}`}
                          >
                            {record.kind === "leave"
                              ? "Отпуск"
                              : "Зарплатный аванс"}
                            {queue ? ` · ${record.employee_name}` : ""}
                          </Link>
                        </h3>
                        <div className="rq-meta">
                          <span>Создано {date(record.created_at)}</span>
                          <span>Версия {record.version}</span>
                          <span>
                            {record.status === "pending_manager"
                              ? "Рассматривает назначенный руководитель"
                              : record.status === "pending_hr"
                                ? "Рассматривает HR"
                                : ""}
                          </span>
                        </div>
                      </div>
                      <p className="crextio-request-summary"><RequestSummary record={record} /></p>
                      <StatusLabel status={record.status} />
                    </article>
                  ))}
                </div>
              ) : (
                <EmptyState
                  title={
                    search ||
                    kind ||
                    validStatus ||
                    params.get("waiting") === "true"
                      ? "Нет заявлений по фильтрам"
                      : queue
                        ? "Решений не требуется"
                        : "Заявлений пока нет"
                  }
                  description={
                    search ||
                    kind ||
                    validStatus ||
                    params.get("waiting") === "true"
                      ? "Измените фильтры или очистите их."
                      : queue
                        ? "Новые заявления появятся, когда будут доступны вам для рассмотрения."
                        : "Создайте заявление на отпуск или зарплатный аванс."
                  }
                  action={
                    search ||
                    kind ||
                    validStatus ||
                    params.get("waiting") === "true" ? (
                      <ActionButton
                        variant="secondary"
                        onClick={() =>
                          setParams(
                            queue ? { kind: params.get("kind") ?? "" } : {},
                          )
                        }
                      >
                        Сбросить фильтры
                      </ActionButton>
                    ) : (
                      !queue && (
                        <Link className="text-link" to="/requests/new">
                          Создать заявление
                        </Link>
                      )
                    )
                  }
                />
              )}
              <PaginationBar
                count={requests.data.count}
                page={page}
                onPage={(nextPage) =>
                  setParams((previous) => {
                    const next = new URLSearchParams(previous);
                    next.set("page", String(nextPage));
                    return next;
                  })
                }
              />
            </DataSection>
          )
        )}
      </div>
    </div>
  );
}

export function RequestsPage() {
  return <RequestsList />;
}

export function RequestQueuePage() {
  return <RequestsList queue />;
}
