import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  ArrowRight,
  Bell,
  CalendarDays,
  ChevronRight,
  FileText,
  GraduationCap,
  Sparkles,
} from "lucide-react";
import { ActionLink } from "@/components/actions";
import { Card } from "@/components/pace/card";
import {
  DataSection,
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  StatusLabel,
} from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { useSession } from "@/lib/session";
import { date, money } from "@/lib/format";

export function HomePage() {
  const { user, employee } = useSession();
  const query = useQuery({
    queryKey: [user.id, "workbench"],
    queryFn: async ({ signal }) =>
      unwrap(await api.GET("/api/v1/workbench/", { signal })),
  });
  const firstName = employee?.full_name.split(" ")[0] ?? user.first_name;
  if (query.isPending)
    return (
      <>
        <PageHeader
          eyebrow="МОЙ КАБИНЕТ"
          title={`Здравствуйте${firstName ? `, ${firstName}` : ""}`}
        />
        <LoadingState />
      </>
    );
  if (query.isError)
    return (
      <>
        <PageHeader title="Мой кабинет" />
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  const data = query.data;
  const next = data.returned_requests.results[0]
    ? {
        title: "Заявку ждут после исправления",
        text: "Откройте причину возврата, исправьте данные и отправьте снова.",
        to: `/requests/${data.returned_requests.results[0].id}`,
        action: "Исправить заявку",
      }
    : data.requests_to_review.results[0]
      ? {
          title: "Ваше решение продолжит процесс",
          text: `В вашей очереди: ${data.requests_to_review.count}. Поданные данные и история доступны перед решением.`,
          to: "/team/requests",
          action: "Открыть согласование",
        }
      : data.learning_outstanding.results[0]
        ? {
            title: "Продолжите назначенное обучение",
            text: data.learning_outstanding.results[0].course_version.title,
            to: `/academy/enrollments/${data.learning_outstanding.results[0].id}`,
            action: "Продолжить курс",
          }
        : data.open_knowledge_cases.results[0]
          ? {
              title:
                user.role === "hr"
                  ? "Сотрудник ждёт ответа HR"
                  : "Ваш вопрос остаётся на виду",
              text: data.open_knowledge_cases.results[0].question,
              to: `/knowledge/cases/${data.open_knowledge_cases.results[0].id}`,
              action: "Открыть обращение",
            }
          : {
              title: "Срочных действий пока нет",
              text: "Можно подготовить заявку, найти рабочее правило или выбрать материал в каталоге.",
              to: "/academy/catalog",
              action: "Открыть каталог",
            };
  return (
    <>
      <PageHeader
        eyebrow={new Intl.DateTimeFormat("ru-KZ", {
          day: "numeric",
          month: "long",
          weekday: "long",
          timeZone: "Asia/Almaty",
        }).format(new Date())}
        title={`Здравствуйте${firstName ? `, ${firstName}` : ""}`}
        description="Ваши задачи, результаты и следующие шаги."
        action={
          <ActionLink
            iconStart={<FileText size={16} aria-hidden="true" />}
            to="/requests/new"
          >
            Создать заявку
          </ActionLink>
        }
      />
      <Card className="next-step-card">
        <div className="next-step-copy">
          <p className="eyebrow">СЛЕДУЮЩИЙ ШАГ</p>
          <h2>{next.title}</h2>
          <p>{next.text}</p>
          <ActionLink iconEnd={<ArrowRight aria-hidden="true" />} to={next.to}>
            {next.action}
          </ActionLink>
        </div>
        <div className="next-step-symbol" aria-hidden="true">
          <span />
          <ArrowRight size={52} strokeWidth={1.2} />
        </div>
      </Card>
      <div className="home-status-grid">
        <Link className="home-stat" to="/requests?waiting=true">
          <FileText size={20} aria-hidden="true" />
          <div>
            <span>Ждут решения</span>
            <strong>{data.waiting_request_count}</strong>
            <small>Ваши отправленные заявки</small>
          </div>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link className="home-stat" to="/academy">
          <GraduationCap size={21} aria-hidden="true" />
          <div>
            <span>Обучение</span>
            <strong>
              {data.learning_summary.completed}
              <em> / {data.learning_summary.total}</em>
            </strong>
            <small>Завершено из назначенного вам</small>
          </div>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
        <Link className="home-stat" to="/notifications?unread=true">
          <Bell size={20} aria-hidden="true" />
          <div>
            <span>Новые события</span>
            <strong>{data.unread_notification_count}</strong>
            <small>Непрочитанные уведомления</small>
          </div>
          <ArrowRight size={17} aria-hidden="true" />
        </Link>
      </div>
      <div className="home-columns">
        <div className="stack">
          {data.returned_requests.count > 0 && (
            <DataSection
              title="Нужно исправить"
              description="Причина возврата сохранена в истории"
              action={
                <Link className="text-link" to="/requests?status=returned">
                  Все заявки ({data.returned_requests.count})
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              }
            >
              {data.returned_requests.results.map((request) => (
                <Link
                  className="record-row"
                  key={request.id}
                  to={`/requests/${request.id}`}
                >
                  <span className="record-icon">
                    <FileText size={19} aria-hidden="true" />
                  </span>
                  <div className="record-main">
                    <h3>
                      {request.kind === "leave"
                        ? "Заявление на отпуск"
                        : `Зарплатный аванс ${money(request.amount ?? "0")}`}
                    </h3>
                    <p>
                      {request.kind === "leave"
                        ? `${date(request.start_date)} – ${date(request.end_date)}`
                        : date(request.requested_payment_date)}
                    </p>
                  </div>
                  <StatusLabel status={request.status} />
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              ))}
            </DataSection>
          )}
          <DataSection
            title="Моё обучение"
            description={
              data.learning_summary.required_outstanding
                ? `Незавершённых обязательных назначений: ${data.learning_summary.required_outstanding}`
                : "Ближайшие незавершённые назначения"
            }
            action={
              <Link className="text-link" to="/academy">
                Всё обучение
                <ArrowRight size={14} aria-hidden="true" />
              </Link>
            }
          >
            {data.learning_outstanding.results.length ? (
              data.learning_outstanding.results.map((enrollment) => (
                <Link
                  className="record-row"
                  key={enrollment.id}
                  to={`/academy/enrollments/${enrollment.id}`}
                >
                  <span className="record-icon learning">
                    <GraduationCap size={21} aria-hidden="true" />
                  </span>
                  <div className="record-main">
                    <h3>{enrollment.course_version.title}</h3>
                    <p>
                      {enrollment.required ? "Обязательный" : "Назначенный"}
                      {enrollment.due_at
                        ? ` · До ${date(enrollment.due_at)}`
                        : ""}
                    </p>
                    <div className="mini-progress">
                      <progress
                        max={100}
                        value={enrollment.material_progress.percent}
                        aria-label={`Материалы курса пройдены на ${enrollment.material_progress.percent}%`}
                      />
                      <span>{enrollment.material_progress.percent}%</span>
                    </div>
                  </div>
                  <ChevronRight size={17} aria-hidden="true" />
                </Link>
              ))
            ) : (
              <EmptyState
                title="Нет незавершённых назначений"
                description="Завершённые результаты сохранены в истории обучения."
                action={
                  <Link className="text-link" to="/academy/history">
                    История обучения
                  </Link>
                }
              />
            )}
          </DataSection>
          {data.requests_to_review.count > 0 && (
            <DataSection
              title="На вашем согласовании"
              description="Только заявки, по которым вам доступно решение"
              action={
                <Link className="text-link" to="/team/requests">
                  Очередь ({data.requests_to_review.count})
                  <ArrowRight size={14} aria-hidden="true" />
                </Link>
              }
            >
              {data.requests_to_review.results.map((request) => (
                <Link
                  className="record-row"
                  key={request.id}
                  to={`/requests/${request.id}`}
                >
                  <div className="record-main">
                    <h3>{request.employee_name}</h3>
                    <p>
                      {request.kind === "leave"
                        ? "Заявление на отпуск"
                        : "Зарплатный аванс"}{" "}
                      · {date(request.submitted_at)}
                    </p>
                  </div>
                  <StatusLabel status={request.status} />
                  <ChevronRight size={16} aria-hidden="true" />
                </Link>
              ))}
            </DataSection>
          )}
        </div>
        <div className="stack">
          <Card className="balance-card">
            <div className="section-heading">
              <h2>Ваш отпуск</h2>
              <CalendarDays size={20} aria-hidden="true" />
            </div>
            <p className="balance-number">
              {data.leave.official_balance}
              <span> дней</span>
            </p>
            <p className="muted">
              Официальный остаток на {date(data.leave.balance_as_of)}
            </p>
            <dl className="balance-detail">
              <div>
                <dt>В резерве портала</dt>
                <dd>{data.leave.portal_reserved_days} дн.</dd>
              </div>
              <div>
                <dt>Прогноз доступного</dt>
                <dd>{data.leave.projected_balance} дн.</dd>
              </div>
            </dl>
            <p className="field-help">
              Прогноз учитывает заявки отдельно. Одобрение не изменяет
              официальный остаток в кадровом источнике.
            </p>
            <ActionLink variant="secondary" to="/requests/new?type=leave">
              Запланировать отпуск
            </ActionLink>
          </Card>
          <Card className="home-help-card">
            <div className="assistant-symbol">
              <Sparkles size={22} aria-hidden="true" />
            </div>
            <h2>Есть рабочий вопрос?</h2>
            <p>
              Найдите ответ в регламенте. Если основания нет, передайте вопрос
              HR.
            </p>
            <Link className="text-link" to="/assistant">
              Спросить Jana
              <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Card>
          {data.open_knowledge_cases.count > 0 && (
            <DataSection
              title={user.role === "hr" ? "Вопросы к HR" : "Мои обращения"}
              action={
                <Link className="text-link" to="/knowledge/cases">
                  Все обращения ({data.open_knowledge_cases.count})
                </Link>
              }
            >
              {data.open_knowledge_cases.results.slice(0, 3).map((record) => (
                <Link
                  className="compact-case"
                  key={record.id}
                  to={`/knowledge/cases/${record.id}`}
                >
                  <p>{record.question}</p>
                  <span>
                    Ждёт ответа
                    <ArrowRight size={14} aria-hidden="true" />
                  </span>
                </Link>
              ))}
            </DataSection>
          )}
        </div>
      </div>
      <DemoNote />
    </>
  );
}
