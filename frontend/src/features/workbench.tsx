import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router";
import {
  ArrowRight,
  ChevronRight,
  FileText,
} from "lucide-react";
import { ActionLink } from "@/components/actions";
import { Card } from "@/components/pace/card";
import {
  DemoNote,
  ErrorNotice,
  LoadingState,
  PageHeader,
} from "@/components/ui";
import { api, unwrap } from "@/lib/api";
import { useSession } from "@/lib/session";
import { date } from "@/lib/format";

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
        title: "Заявку нужно исправить",
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
      <div className="crextio-metrics">
        <div className="crextio-strip">
          <Link to="/requests?waiting=true"><span>Заявки</span><strong>{data.waiting_request_count} в работе</strong></Link>
          <Link to="/academy"><span>Обучение</span><strong>{data.learning_summary.completed} завершено</strong></Link>
          <Link to="/knowledge/cases"><span>Обращения</span><strong>{data.open_knowledge_cases.count} открыто</strong></Link>
        </div>
        <div className="crextio-counters">
          <Link to="/academy"><strong>{data.learning_summary.total}</strong><span>Назначено курсов</span></Link>
          <Link to="/requests?waiting=true"><strong>{data.waiting_request_count}</strong><span>Ждут решения</span></Link>
          <Link to="/notifications?unread=true"><strong>{data.unread_notification_count}</strong><span>Новые события</span></Link>
        </div>
      </div>
      <div className="crextio-bento">
        <section className="crextio-day-card" aria-label="Маршрут рабочего дня">
          <span className="crextio-day-kicker">ВАШ РАБОЧИЙ МАРШРУТ</span>
          <h2>Всё начинается<br />с одного шага.</h2>
          <div className="crextio-day-route" aria-hidden="true"><i /><span /><i /><span /><i /></div>
          <Link to="/requests/new"><span>01</span> Подать заявку <ArrowRight size={16} /></Link>
          <Link to="/assistant"><span>02</span> Найти ответ <ArrowRight size={16} /></Link>
          <Link to="/academy"><span>03</span> Продолжить обучение <ArrowRight size={16} /></Link>
          <p>{employee?.full_name ?? user.first_name}</p>
        </section>
        <Card className="crextio-progress-card">
          <div className="crextio-card-title"><h2>Прогресс</h2><Link to="/academy" aria-label="Открыть моё обучение">↗</Link></div>
          <p className="crextio-large">{data.learning_summary.completed}<small> / {data.learning_summary.total}</small></p>
          <p className="muted">Завершено курсов</p>
          <div className="crextio-course-bars">
            {data.learning_outstanding.results.slice(0, 7).map((item, index) => (
              <Link key={item.id} to={`/academy/enrollments/${item.id}`} title={item.course_version.title}>
                <span className="crextio-bar-track"><span style={{height: `${item.material_progress.percent}%`}} /></span>
                <small>{index + 1}</small>
              </Link>
            ))}
            {!data.learning_outstanding.results.length && <p>Все назначения завершены</p>}
          </div>
        </Card>
        <Card className="crextio-gauge-card">
          <div className="crextio-card-title"><h2>Ваш отпуск</h2><Link to="/requests/new?type=leave" aria-label="Запланировать отпуск">↗</Link></div>
          <div className="crextio-gauge">
            <svg viewBox="0 0 180 180" aria-hidden="true">
              <circle cx="90" cy="90" r="72" fill="none" stroke="#e5e3da" strokeWidth="15" strokeDasharray="2 5" />
              <circle cx="90" cy="90" r="72" fill="none" stroke="var(--brand)" strokeWidth="15" strokeDasharray={`${Math.max(0, Math.min(1, Number(data.leave.projected_balance) / Math.max(1, Number(data.leave.official_balance)))) * 452} 452`} transform="rotate(-90 90 90)" />
            </svg>
            <div><strong>{data.leave.projected_balance}</strong><span>дней по прогнозу</span></div>
          </div>
          <p className="muted">Официально {data.leave.official_balance} дн.</p>
        </Card>
        <div className="crextio-task-column">
          <Card className="crextio-onboarding">
            <div className="crextio-card-title"><h2>Моё обучение</h2><strong>{data.learning_summary.total ? Math.round(data.learning_summary.completed / data.learning_summary.total * 100) : 0}%</strong></div>
            <progress max={Math.max(1, data.learning_summary.total)} value={data.learning_summary.completed} aria-label="Завершённые курсы" />
            <p>{data.learning_summary.required_outstanding} обязательных осталось</p>
          </Card>
          <div className="crextio-task-stack">
            <p>Следующий шаг</p><h2>{next.title}</h2><p>{next.text}</p>
            <ActionLink to={next.to} iconEnd={<ArrowRight size={16} />}>{next.action}</ActionLink>
            <Link to="/requests/new">Подать заявку <ArrowRight size={15} /></Link>
            <Link to="/assistant">Найти рабочее правило <ArrowRight size={15} /></Link>
            <Link to="/academy/catalog">Каталог обучения <ArrowRight size={15} /></Link>
          </div>
        </div>
        <Card className="crextio-details-card">
          <h2>Рабочее место</h2>
          <Link to="/profile">Кадровые данные <ChevronRight size={16}/></Link>
          <Link to="/requests">Мои заявки <ChevronRight size={16}/></Link>
          <Link to="/knowledge">Регламенты <ChevronRight size={16}/></Link>
          <Link to="/academy/history">История обучения <ChevronRight size={16}/></Link>
        </Card>
        <Card className="crextio-schedule-card">
          <div className="crextio-card-title"><h2>Ближайшее обучение</h2><Link to="/academy">Все →</Link></div>
          {data.learning_outstanding.results.slice(0, 3).map((item) => (
            <Link key={item.id} to={`/academy/enrollments/${item.id}`}>
              <time>{item.due_at ? date(item.due_at) : "Без срока"}</time><span>{item.course_version.title}</span><ArrowRight size={16}/>
            </Link>
          ))}
          {!data.learning_outstanding.results.length && <p>Незавершённых назначений нет.</p>}
        </Card>
      </div>
      <DemoNote />
    </>
  );
}
