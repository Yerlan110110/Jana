import { ActionLink, ActionButton as Button } from "@/components/actions";
import { Card } from "@/components/pace/card";
import { Textarea } from "@/components/pace/textarea";
import {
  BackLink,
  DataSection,
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
  PageHeader,
  PaginationBar,
} from "@/components/ui";
import { api, unwrap, useCommand, type Model } from "@/lib/api";
import { date } from "@/lib/format";
import { useSession } from "@/lib/session";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  BookOpen,
  FileText,
  Send,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router";
import { toast } from "sonner";

const modeLabels: Record<Model<"ModeEnum">, string> = {
  extractive: "Выдержки из регламента",
  generated: "Ответ по источникам",
  insufficient_evidence: "Основание не найдено",
  provider_unavailable: "Помощник временно недоступен",
};

export function AssistantPage() {
  const session = useSession();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const rawPage = Number(params.get("page") ?? 1);
  const page = Number.isSafeInteger(rawPage) && rawPage > 0 ? rawPage : 1;
  const [question, setQuestion] = useState(params.get("q") ?? "");
  const history = useQuery({
    queryKey: [session.user.id, "answers", page],
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/assistant/answers/", {
          params: { query: { page } },
          signal,
        }),
      ),
  });
  const ask = useCommand(async (text: string, key) => {
    const result = await api.POST("/api/v1/assistant/answers/", {
      body: { question: text, language: "ru", client_message_id: key },
    });
    if (result.error?.answer) return result.error.answer;
    return unwrap(result);
  });
  async function submit(event: FormEvent) {
    event.preventDefault();
    const answer = await ask.mutateAsync(question.trim());
    navigate(`/assistant/answers/${answer.id}`);
  }
  return (
    <>
      <PageHeader
        eyebrow="AI JANA"
        title="Ответ начинается с источника"
        description="Задайте рабочий вопрос. Jana найдёт основание в доступных вам регламентах."
        action={
          <ActionLink variant="secondary" to="/knowledge">
            <BookOpen size={16} aria-hidden="true" />
            Все регламенты
          </ActionLink>
        }
      />
      <Card className="assistant-intro">
        <div className="assistant-symbol">
          <Sparkles size={28} aria-hidden="true" />
        </div>
        <h2>Что вы хотите узнать?</h2>
        <p>
          Отпуск, аванс, обучение или порядок работы.
          <br />
          Каждый ответ можно проверить по опубликованной версии.
        </p>
        <form
          onSubmit={(event) => {
            void submit(event).catch(() => undefined);
          }}
          className="question-form"
        >
          <label className="sr-only" htmlFor="question">
            Ваш вопрос
          </label>
          <Textarea
            id="question"
            name="question"
            minLength={8}
            maxLength={2000}
            required
            value={question}
            onChange={(event) => setQuestion(event.target.value)}
            placeholder="Например, как подать заявление на отпуск?"
            rows={3}
          />
          <div className="question-footer">
            <span>
              <ShieldCheck size={14} aria-hidden="true" />
              Только доступные вам источники
            </span>
            <Button
              type="submit"
              loading={ask.isPending}
              loadingLabel="Ищем основание"
              iconEnd={<Send size={16} aria-hidden="true" />}
            >
              Найти ответ
            </Button>
          </div>
        </form>
        <ErrorNotice error={ask.error} />
        <div className="suggested-questions">
          {[
            "Как подать заявление на отпуск?",
            "Что делать, если заявку вернули?",
            "Как пройти назначенный курс?",
          ].map((text) => (
            <Button
              key={text}
              variant="secondary"
              size="sm"
              onClick={() => setQuestion(text)}
            >
              {text}
            </Button>
          ))}
        </div>
      </Card>
      <div className="explanation-line">
        <ShieldCheck size={18} aria-hidden="true" />
        <p>
          Без подключённой модели Jana показывает найденные фрагменты. Если
          основания нет, можно обратиться к HR. Помощник не принимает кадровых
          решений.
        </p>
      </div>
      <DataSection
        title="Ваши вопросы"
        description="Сохранённые ответы и их основания"
        action={
          <Link className="text-link" to="/knowledge/cases">
            Обращения к HR <ArrowRight size={14} aria-hidden="true" />
          </Link>
        }
      >
        {history.isPending ? (
          <LoadingState />
        ) : history.isError ? (
          <ErrorNotice
            error={history.error}
            retry={() => {
              void history.refetch();
            }}
          />
        ) : history.data.results.length ? (
          <div className="record-list">
            {history.data.results.map((answer) => (
              <Link
                className="record-row"
                key={answer.id}
                to={`/assistant/answers/${answer.id}`}
              >
                <span className="record-icon">
                  <FileText size={19} aria-hidden="true" />
                </span>
                <div className="record-main">
                  <h3>{answer.question}</h3>
                  <p>
                    {modeLabels[answer.mode]} · {date(answer.created_at)}
                  </p>
                </div>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Здесь появятся ваши ответы"
            description="Задайте первый вопрос. Он сохранится вместе с основанием ответа."
          />
        )}
        {history.data && (
          <PaginationBar
            count={history.data.count ?? 0}
            page={page}
            onPage={(next) => {
              const updated = new URLSearchParams(params);
              updated.set("page", String(next));
              setParams(updated);
            }}
          />
        )}
      </DataSection>
      <DemoNote />
    </>
  );
}

export function AnswerPage() {
  const { id = "" } = useParams();
  const { user } = useSession();
  const navigate = useNavigate();
  const answer = useQuery({
    queryKey: [user.id, "answer", id],
    staleTime: 0,
    queryFn: async ({ signal }) =>
      unwrap(
        await api.GET("/api/v1/assistant/answers/{id}/", {
          params: { path: { id } },
          signal,
        }),
      ),
  });
  const escalation = useCommand(async (answerId: string, key) =>
    unwrap(
      await api.POST("/api/v1/knowledge/gaps/", {
        body: { answer_id: answerId, details: "" },
        params: { header: { "Idempotency-Key": key } },
      }),
    ),
  );
  if (answer.isPending) return <LoadingState />;
  if (answer.isError)
    return (
      <>
        <BackLink to="/assistant">К вопросам</BackLink>
        <ErrorNotice
          error={answer.error}
          retry={() => {
            void answer.refetch();
          }}
        />
      </>
    );
  const record = answer.data;
  return (
    <>
      <BackLink to="/assistant">К вопросам</BackLink>
      <PageHeader
        eyebrow="ВАШ ВОПРОС"
        title={record.question}
        description={date(record.created_at)}
      />
      <Card className="answer-card">
        <div className="answer-mode">
          <Sparkles size={18} aria-hidden="true" />
          {modeLabels[record.mode]}
        </div>
        <div className="prose">
          <p>{record.message}</p>
        </div>
        {record.evidence_status === "superseded" && (
          <p className="standing-note">
            У источника появилась новая редакция. Откройте регламент и проверьте
            действующую версию.
          </p>
        )}
        {record.evidence_status === "unavailable" && (
          <p className="standing-note">
            Прежнее основание больше недоступно. Старый ответ не подтверждает
            действующее правило.
          </p>
        )}
        {record.citations.length > 0 && (
          <div className="source-list">
            <h2>Проверьте основание</h2>
            {record.citations.map((citation) => (
              <Link
                className="source-card"
                key={citation.chunk_id}
                to={`/knowledge/citations/${citation.chunk_id}`}
              >
                <FileText size={20} aria-hidden="true" />
                <div>
                  <h3>{citation.title}</h3>
                  <p>
                    {citation.heading} · Редакция {citation.revision_number} ·{" "}
                    {citation.language === "ru" ? "Русский" : "Қазақша"}
                  </p>
                </div>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            ))}
          </div>
        )}
        {record.claims.length > 0 && (
          <div className="prose">
            <h2>Текст ответа</h2>
            {record.claims.map((claim, index) => (
              <p key={index}>{claim.text}</p>
            ))}
          </div>
        )}
        <div className="action-row">
          {record.allowed_actions.includes("escalate_to_hr") && (
            <Button
              loading={escalation.isPending}
              onClick={() => {
                void escalation
                  .mutateAsync(record.id)
                  .then((result) => {
                    toast.success("Обращение отправлено HR");
                    navigate(`/knowledge/cases/${result.id}`);
                  })
                  .catch(() => undefined);
              }}
            >
              Обратиться к HR
            </Button>
          )}
          {record.case_id && (
            <ActionLink
              variant="secondary"
              to={`/knowledge/cases/${record.case_id}`}
            >
              Открыть обращение
            </ActionLink>
          )}
          <ActionLink
            variant="secondary"
            to={`/assistant?q=${encodeURIComponent(record.question)}`}
          >
            Задать вопрос снова
          </ActionLink>
        </div>
        <ErrorNotice error={escalation.error} />
      </Card>
      <DemoNote />
    </>
  );
}
