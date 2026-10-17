import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { AlertCircle, ArrowLeft, ArrowRight, Inbox, RefreshCw } from 'lucide-react';
import { ActionButton as Button } from '@/components/actions';
import { Card } from '@/components/pace/card';
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/pace/empty';
import { Skeleton } from '@/components/pace/skeleton';
import { ApiError } from '@/lib/api';
import { statusText } from '@/lib/format';

export function PageHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{eyebrow && <p className="eyebrow">{eyebrow}</p>}<h1>{title}</h1>{description && <p className="page-description">{description}</p>}</div>{action}</div>;
}

export function LoadingState() {
  return <div role="status" aria-label="Загружаем данные" className="loading-state"><Skeleton className="h-9 w-48" /><Skeleton className="h-28 w-full" /><Skeleton className="h-28 w-full" /><span className="sr-only">Загружаем данные…</span></div>;
}

export function ErrorNotice({ error, retry }: { error: unknown; retry?: () => void }) {
  if (!error) return null;
  const status = error instanceof ApiError ? error.status : 0;
  const text = status === 409 ? 'Запись изменилась в другой вкладке. Обновите её и проверьте данные перед следующим действием.'
    : status === 404 ? 'Запись недоступна. Возможно, у вас больше нет доступа. Вернитесь к списку.'
    : status === 403 ? 'Действие недоступно. Проверьте текущую роль или войдите заново.'
    : status === 401 ? 'Сессия закончилась. Войдите снова, чтобы продолжить.'
    : status === 429 ? 'Слишком много запросов. Подождите немного и повторите действие.'
    : status === 400 ? 'Проверьте заполненные поля. Введённые значения сохранены в форме.'
    : status === 503 ? 'Сервис временно недоступен. Сохраните вопрос и повторите позже.'
    : 'Ответ сервера не получен. Результат действия неизвестен. Повторите с теми же данными: повтор не создаст дубликат.';
  return <div className="error-notice" role="alert"><AlertCircle size={18} aria-hidden="true" /><div><p>{text}</p>{error instanceof ApiError && Object.keys(error.fields).length > 0 && <ul>{Object.entries(error.fields).map(([key, value]) => <li key={key}>{key}: {typeof value === 'string' ? value : JSON.stringify(value)}</li>)}</ul>}{error instanceof ApiError && error.requestId && <details><summary>Данные для поддержки</summary><code>{error.requestId}</code></details>}</div>{retry && <Button variant="secondary" onClick={retry} iconStart={<RefreshCw aria-hidden="true" />}>Обновить</Button>}</div>;
}

export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Empty><EmptyHeader><EmptyMedia variant="icon"><Inbox aria-hidden="true" /></EmptyMedia><EmptyTitle>{title}</EmptyTitle><EmptyDescription>{description}</EmptyDescription></EmptyHeader>{action}</Empty>;
}

export function StatusLabel({ status }: { status: string }) {
  return <span className="domain-status" data-status={status}><span aria-hidden="true" />{statusText(status)}</span>;
}

export function PaginationBar({ count, page, pageSize = 20, onPage }: { count: number; page: number; pageSize?: number; onPage: (page: number) => void }) {
  const pages = Math.max(1, Math.ceil(count / pageSize));
  if (count <= pageSize) return <p className="list-count">Всего записей: {count}</p>;
  return <nav className="pagination-bar" aria-label="Страницы реестра"><span>Страница {page} из {pages} · Всего {count}</span><div><Button variant="secondary" disabled={page <= 1} onClick={() => onPage(page - 1)} iconStart={<ArrowLeft aria-hidden="true" />}>Назад</Button><Button variant="secondary" disabled={page >= pages} onClick={() => onPage(page + 1)} iconEnd={<ArrowRight aria-hidden="true" />}>Далее</Button></div></nav>;
}

export function BackLink({ to, children }: { to: string; children: ReactNode }) {
  return <Link className="back-link" to={to}><ArrowLeft size={15} aria-hidden="true" />{children}</Link>;
}

export function DemoNote() {
  return <p className="demo-note">Демонстрационные данные. Люди, регламенты и учебные кейсы вымышлены.</p>;
}

export function DataSection({ title, description, action, children, className = '' }: { title: string; description?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return <Card className={`data-section ${className}`}><div className="section-heading"><div><h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>{children}</Card>;
}
