import { ActionLink } from "@/components/actions";
import { Card } from "@/components/pace/card";
import {
  BackLink,
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
} from "@/components/ui";
import { Input } from "@/components/upstream/input";
import { api, unwrap, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, FileText, ShieldCheck } from "lucide-react";
import { Link, useParams, useSearchParams } from "react-router";

export function CitationPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const query = useQuery({
    queryKey: [user.id, "citation", id],
    staleTime: 0,
    gcTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/citations/{id}/", {
          params: { path: { id } },
          signal,
          cache: "no-store",
        }),
      ),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <>
        <BackLink to="/assistant">К вопросам</BackLink>
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  const source = query.data;
  return (
    <>
      <BackLink to="/assistant">К вопросам</BackLink>
      <PageHeader
        eyebrow="ПРОВЕРЕННОЕ ОСНОВАНИЕ"
        title={source.title}
        description={`Редакция ${source.revision_number} · Опубликовано ${date(source.published_at)}`}
      />
      <Card className="reading-card">
        <div className="source-metadata">
          <ShieldCheck size={18} aria-hidden="true" />
          <span>
            {source.is_current
              ? "Действующая редакция"
              : "Сохранённая предыдущая редакция"}
          </span>
          <span>
            {source.language === "ru"
              ? "Материал на русском"
              : "Қазақша материал"}
          </span>
        </div>
        <h2>{source.heading}</h2>
        <blockquote>{source.text}</blockquote>
        <p className="muted">
          Действует с {date(source.effective_from)}
          {source.effective_until
            ? ` до ${date(source.effective_until)}`
            : ""}{" "}
          · {source.locator}
        </p>
        <details className="evidence-details">
          <summary>Версия и контрольная сумма</summary>
          <code>
            {source.revision_id}
            <br />
            {source.content_hash}
          </code>
        </details>
        {source.is_synthetic && <DemoNote />}
      </Card>
    </>
  );
}

export function DocumentsPage() {
  const { user } = useSession();
  const [params, setParams] = useSearchParams();
  const search = params.get("search") ?? "";
  const page = Number(params.get("page") ?? 1);
  const query = useQuery({
    queryKey: [user.id, "documents", search, page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/documents/", {
          params: { query: { search, page } },
          signal,
        }),
      ),
  });
  const setSearch = (value: string) =>
    setParams(value ? { search: value } : {});
  return (
    <>
      <PageHeader
        eyebrow="БАЗА ЗНАНИЙ"
        title="Правила, к которым можно вернуться"
        description="Опубликованные регламенты в вашей области доступа."
        action={
          user.role === "hr" ? (
            <ActionLink to="/hr/policies">
              <FileText size={16} aria-hidden="true" />
              Управлять регламентами
            </ActionLink>
          ) : undefined
        }
      />
      <div className="filter-bar">
        <Input
          aria-label="Поиск регламентов"
          placeholder="Найти регламент"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
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
          <div className="document-grid">
            {query.data.results.map((document) => (
              <Card key={document.id} className="document-card">
                <div className="category-icon">
                  <FileText size={22} aria-hidden="true" />
                </div>
                <p className="eyebrow">РЕДАКЦИЯ {document.revision.number}</p>
                <h2>
                  <Link to={`/knowledge/documents/${document.id}`}>
                    {document.revision.title}
                  </Link>
                </h2>
                <p>{document.revision.summary}</p>
                <div className="card-end">
                  <span>
                    {document.revision.language === "ru"
                      ? "На русском"
                      : "Қазақша"}
                  </span>
                  <Link
                    className="text-link"
                    to={`/knowledge/documents/${document.id}`}
                  >
                    Открыть <ArrowRight size={15} aria-hidden="true" />
                  </Link>
                </div>
              </Card>
            ))}
          </div>
          {!query.data.count && (
            <EmptyState
              title={
                search
                  ? "Регламент не найден"
                  : "Пока нет опубликованных регламентов"
              }
              description={
                search
                  ? "Попробуйте другой запрос или задайте вопрос HR."
                  : "HR опубликует материалы, доступные вашей роли."
              }
            />
          )}
          <PaginationBar
            count={query.data.count ?? 0}
            page={page}
            onPage={(next) => setParams({ search, page: String(next) })}
          />
        </>
      )}
      <DemoNote />
    </>
  );
}

export function PublishedPolicy({ revision }: { revision: Model<"Revision"> }) {
  return (
    <Card className="reading-card">
      <div className="source-metadata">
        <ShieldCheck size={18} aria-hidden="true" />
        Редакция {revision.number} · Действует с {date(revision.effective_from)}
      </div>
      <div className="prose">
        {revision.sections.map((section, index) => (
          <section key={index}>
            <h2>{section.heading}</h2>
            <p className="preserve-lines">{section.text}</p>
          </section>
        ))}
      </div>
      <details className="evidence-details">
        <summary>Сведения о публикации</summary>
        <p>Опубликовано {date(revision.published_at)}</p>
        <code>{revision.content_hash}</code>
      </details>
      {revision.is_synthetic && <DemoNote />}
    </Card>
  );
}

export function DocumentPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const query = useQuery({
    queryKey: [user.id, "document", id],
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/knowledge/documents/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  if (query.isPending) return <LoadingState />;
  if (query.isError)
    return (
      <>
        <BackLink to="/knowledge">К регламентам</BackLink>
        <ErrorNotice
          error={query.error}
          retry={() => {
            void query.refetch();
          }}
        />
      </>
    );
  return (
    <>
      <BackLink to="/knowledge">К регламентам</BackLink>
      <PageHeader
        eyebrow="БАЗА ЗНАНИЙ"
        title={query.data.revision.title}
        description={query.data.revision.summary}
      />
      <PublishedPolicy revision={query.data.revision} />
    </>
  );
}
