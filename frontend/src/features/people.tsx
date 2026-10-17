import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from 'react-router';
import { useState } from 'react';
import { Input } from '@/components/upstream/input';
import { BackLink, DataSection, DemoNote, EmptyState, ErrorNotice, LoadingState, PageHeader, PaginationBar } from '@/components/ui';
import { api, unwrap, type Model } from '@/lib/api';
import { useSession } from '@/lib/session';
import { date } from '@/lib/format';
import { Facts } from './requests/support';
import './journeys.css';

function EmployeeFacts({ employee }: { employee: Model<'Employee'> }) {
  return <div className="stack"><DataSection title="Кадровые данные" description="Данные из кадрового источника доступны только для чтения."><Facts items={[
    { label: 'ФИО', value: employee.full_name }, { label: 'Должность', value: employee.position },
    { label: 'Юридическое лицо', value: employee.legal_entity.name }, { label: 'Подразделение', value: employee.department.name },
    { label: 'Руководитель', value: employee.manager_name || 'Не назначен' }, { label: 'Дата приёма', value: date(employee.hired_on) },
    { label: 'Табельный номер', value: employee.external_id }, { label: 'Статус', value: employee.is_active ? 'Работает' : 'Неактивен' },
  ]} /></DataSection><DataSection title="Остаток отпуска" description="Официальный остаток. Согласованные заявления в портале не изменяют его автоматически."><Facts items={[
    { label: 'Официальный остаток', value: `${employee.leave_balance} дней` }, { label: 'Остаток на дату', value: date(employee.balance_as_of) },
    { label: 'Синхронизация', value: date(employee.synced_at) }, { label: 'Версия источника', value: employee.source_revision || 'Не указана' },
  ]} /></DataSection><p className="muted">Если данные неверны, обратитесь в HR. Изменения вносятся в кадровом источнике.</p><DemoNote /></div>;
}

export function ProfilePage() {
  const session = useSession();
  const profile = useQuery({ queryKey: ['employee', session.employee?.id], enabled: !!session.employee, queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/employees/{id}/', { params: { path: { id: session.employee?.id ?? '' } }, signal })) });
  return <><PageHeader eyebrow="Личный кабинет" title="Мой профиль" description="Кадровые факты и дата их обновления." />{profile.isPending && session.employee ? <LoadingState /> : profile.error ? <ErrorNotice error={profile.error} retry={() => void profile.refetch()} /> : profile.data ? <EmployeeFacts employee={profile.data} /> : <EmptyState title="Профиль не предоставлен" description="Обратитесь в HR, чтобы проверить связь аккаунта с кадровой записью." />}</>;
}

export function TeamPage() {
  const session = useSession();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const team = useQuery({ queryKey: ['team', session.user.id, page, search], enabled: session.user.role !== 'employee', queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/employees/', { params: { query: { page, search, ordering: 'full_name' } }, signal })) });
  if (session.user.role === 'employee') return <EmptyState title="Команда доступна руководителю и HR" description="Свою кадровую запись можно открыть в профиле." action={<Link to="/profile" className="text-link">Открыть профиль</Link>} />;
  return <><PageHeader eyebrow={session.user.role === 'hr' ? 'HR' : 'Руководитель'} title={session.user.role === 'hr' ? 'Сотрудники' : 'Команда'} description={session.user.role === 'hr' ? 'Сотрудники в разрешённом юридическом лице.' : 'Ваша запись и прямые подчинённые. Область доступа задаёт сервер.'} /><div className="stack"><div className="filter-bar"><label className="field">Поиск сотрудника<Input type="search" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Имя, должность, табельный номер" /></label></div>{team.isPending ? <LoadingState /> : team.error ? <ErrorNotice error={team.error} retry={() => void team.refetch()} /> : team.data && <DataSection title="Доступные сотрудники">{team.data.results.length ? <div className="people-list">{team.data.results.map(person => <div className="people-row" key={person.id}><div><h3><Link to={`/team/${person.id}`} className="text-link">{person.full_name}</Link></h3><p>{person.position}</p><p className="muted">{person.department.name} · {person.legal_entity.name}</p></div></div>)}</div> : <EmptyState title={search ? 'Сотрудники не найдены' : 'Список пуст'} description={search ? 'Измените поиск или очистите поле.' : 'В разрешённой области пока нет сотрудников.'} />}<PaginationBar count={team.data.count} page={page} onPage={setPage} /></DataSection>}</div></>;
}

export function EmployeePage() {
  const { id = '' } = useParams();
  const person = useQuery({ queryKey: ['employee', id], queryFn: async ({ signal }) => unwrap(await api.GET('/api/v1/employees/{id}/', { params: { path: { id } }, signal })) });
  return <><BackLink to="/team">К сотрудникам</BackLink><PageHeader title={person.data?.full_name ?? 'Сотрудник'} description="Разрешённая кадровая запись." />{person.isPending ? <LoadingState /> : person.error ? <ErrorNotice error={person.error} retry={() => void person.refetch()} /> : person.data && <div className="stack"><EmployeeFacts employee={person.data} /><div className="button-row"><Link className="text-link" to={`/team/learning?employee=${id}`}>Обучение сотрудника</Link><Link className="text-link" to={`/team/requests?employee=${id}`}>Заявления на рассмотрение</Link></div></div>}</>;
}
