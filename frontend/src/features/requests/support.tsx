import type { ReactNode } from 'react';
import { ActionButton } from '@/components/actions';
import { ErrorNotice } from '@/components/ui';
import { ApiError } from '@/lib/api';

export function WriteRecovery({ error, refresh, retry }: { error: unknown; refresh: () => void; retry?: () => void }) {
  if (!error) return null;
  const uncertain = !(error instanceof ApiError) || error.status >= 500;
  return <div className="stack"><ErrorNotice error={error} /><p className="muted">Поля сохранены в этой форме. Обновление записи не заменяет введённые значения. Проверьте актуальную версию перед повторным действием.</p><div className="button-row"><ActionButton variant="secondary" onClick={refresh}>Обновить запись</ActionButton>{uncertain && retry && <ActionButton variant="secondary" onClick={retry}>Повторить те же данные</ActionButton>}</div></div>;
}

export function Facts({ items }: { items: { label: string; value: ReactNode }[] }) {
  return <dl className="people-facts">{items.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>;
}
