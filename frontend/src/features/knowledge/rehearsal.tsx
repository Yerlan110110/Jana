import { useMutation } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { ActionButton as Button } from "@/components/actions";
import { Card } from "@/components/pace/card";
import { Textarea } from "@/components/pace/textarea";
import { ErrorNotice } from "@/components/ui";
import { api, unwrap, type Model } from "@/lib/api";

type RehearsalExcerpt = Model<"RehearsalExcerpt">;
type RehearsalSide = Model<"RehearsalRetrieval">;
type RehearsalClassification = Model<"ClassificationEnum">;

const classificationText: Record<RehearsalClassification, string> = {
  unchanged: "Без изменений",
  changed: "Изменится",
  lost: "Потеряет источник",
  gained: "Получит источник",
};

const reasonText: Record<string, string> = {
  lexical_evidence: "Есть текстовое совпадение",
  no_matching_policy: "Подходящий регламент не найден",
  clarification_required: "Ответ потребует уточнения",
  unsafe_instruction: "Вопрос отклонён как небезопасный",
};

function Excerpt({ excerpt }: { excerpt: RehearsalExcerpt }) {
  return (
    <li className="excerpt-item">
      <h4>
        {excerpt.title ?? "Источник"}
        {excerpt.locator ? ` · ${excerpt.locator}` : ""}
      </h4>
      <span
        className={`excerpt-origin${excerpt.origin === "draft" ? " draft" : ""}`}
      >
        {excerpt.origin === "draft"
          ? "черновик"
          : `редакция ${excerpt.revision_number ?? "—"}`}
      </span>
      {excerpt.text && <p>{excerpt.text}</p>}
    </li>
  );
}

function Side({ label, side }: { label: string; side: RehearsalSide }) {
  return (
    <div className="rehearsal-side">
      <h3>{label}</h3>
      <p className="rehearsal-reason">{reasonText[side.reason] ?? side.reason}</p>
      {side.excerpts.length > 0 && (
        <ul>
          {side.excerpts.map((excerpt, index) => (
            <Excerpt key={index} excerpt={excerpt} />
          ))}
        </ul>
      )}
      {side.restricted_excerpts > 0 && (
        <p className="rehearsal-empty">Часть источников доступна сотруднику, но скрыта для вашей роли.</p>
      )}
      {!side.excerpts.length && !side.restricted_excerpts && (
        <p className="rehearsal-empty">Источник не найден.</p>
      )}
    </div>
  );
}

export function RehearsalPanel({
  documentId,
  expectedVersion,
  blocked,
  blockReason,
}: {
  documentId: string;
  expectedVersion: number;
  blocked: boolean;
  blockReason: string | null;
}) {
  const [question, setQuestion] = useState("");
  const [resultFilter, setResultFilter] = useState<"all" | "risk" | "missing">("all");
  const questions = question.split("\n").map(item => item.trim()).filter(Boolean);
  const invalidQuestions = questions.length > 10 || questions.some(item => item.length < 8 || item.length > 2000);
  const preview = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST(
          "/api/v1/knowledge/admin/documents/{id}/rehearsal/",
          {
            params: { path: { id: documentId } },
            body: {
              expected_version: expectedVersion,
              ...(question.trim()
                ? { questions }
                : {}),
            },
          },
        ),
      ),
  });
  const data = !blocked && preview.data?.document.version === expectedVersion
    ? preview.data
    : undefined;
  const missingSources = data?.results.filter(result => result.after.excerpts.length + result.after.restricted_excerpts === 0).length ?? 0;
  return (
    <Card className="data-section rehearsal-panel">
      <div className="section-heading">
        <div>
          <h2>
            <FlaskConical size={17} aria-hidden="true" /> Репетиция публикации
          </h2>
          <p>
            Сравнение выдержек источников до и после публикации сохранённого
            черновика. Проверка показывает найденные источники. Правильность самого правила проверяет HR.
          </p>
        </div>
      </div>
      <div className="field">
        <label htmlFor="rehearsal-question">
          Проверочные вопросы (по одному на строку)
        </label>
        <Textarea
          id="rehearsal-question"
          rows={4}
          maxLength={20009}
          value={question}
          onChange={(event) => { setQuestion(event.target.value); preview.reset(); }}
          placeholder="Например: можно ли перенести часть отпуска на следующий год?"
        />
        <p className="field-help">
          До 10 вопросов, от 8 до 2000 символов каждый. Свои вопросы проверяются с правами HR. Для проверки с правами сотрудника
          оставьте поле пустым: используются его сохранённые вопросы без ответа.
          Если таких вопросов нет, введите свой вопрос.
        </p>
      </div>
      {invalidQuestions && <p className="field-error" role="alert">Введите не больше 10 вопросов. Каждый вопрос должен содержать от 8 до 2000 символов.</p>}
      {blocked && blockReason && (
        <p className="field-error" role="status">
          {blockReason}
        </p>
      )}
      <div className="action-row">
        <Button
          variant="secondary"
          disabled={blocked || invalidQuestions}
          loading={preview.isPending}
          loadingLabel="Сравниваем ответы"
          onClick={() => preview.mutate()}
        >
          Сравнить ответы
        </Button>
      </div>
      <ErrorNotice error={preview.error} />
      {data && (
        <div className="rehearsal-results">
          <section className="hr-risk-verdict" aria-label="Итог проверки источников">
            <span className="interior-kicker">RAG / ПРОВЕРКА ПЕРЕД ПУБЛИКАЦИЕЙ</span>
            <h3>{data.summary.lost > 0 ? "Есть ответы, которые потеряют источник" : data.summary.total === 0 ? "Нет вопросов для оценки ответов" : missingSources > 0 ? "В проверке остались вопросы без источника" : "Потерь источников в этой проверке нет"}</h3>
            <p>{data.summary.lost > 0 ? "Проверьте текст и аудиторию черновика. Ниже видно, какое основание исчезнет у конкретного вопроса." : "Это проверка найденных выдержек, а не гарантия правильности ответов. Перед публикацией проверьте изменившиеся источники и аудиторию."}</p>
            <div className="button-row"><Button variant="secondary" aria-pressed={resultFilter === "all"} onClick={() => setResultFilter("all")}>Все вопросы · {data.summary.total}</Button><Button variant="secondary" aria-pressed={resultFilter === "risk"} onClick={() => setResultFilter("risk")}>Изменения и потери · {data.summary.changed + data.summary.lost}</Button><Button variant="secondary" aria-pressed={resultFilter === "missing"} onClick={() => setResultFilter("missing")}>Без источника после · {missingSources}</Button></div>
          </section>
          <section className="rag-matrix" aria-label="Матрица источников">
            <h3>Проверка каждого вопроса</h3>
            <p>Наличие источника не доказывает правильность ответа. Отсутствие новых потерь не означает, что все вопросы покрыты.</p>
            {data.results.map((result, index) => <a className="rag-matrix-row" href={`#rehearsal-result-${index}`} key={index} onClick={() => setResultFilter("all")}>
              <span><b>{String(index + 1).padStart(2, "0")}</b> {result.question}</span>
              <span data-found={result.before.excerpts.length + result.before.restricted_excerpts > 0}>Сейчас · {result.before.excerpts.length + result.before.restricted_excerpts > 0 ? "источник есть" : "нет источника"}</span>
              <span data-found={result.after.excerpts.length + result.after.restricted_excerpts > 0}>После · {result.after.excerpts.length + result.after.restricted_excerpts > 0 ? "источник есть" : "нет источника"}</span>
            </a>)}
          </section>
          <div className="rehearsal-summary">
            <span className="domain-status" data-status="gained">
              <span aria-hidden="true" /> Новых оснований: {data.summary.gained}
            </span>
            <span className="domain-status" data-status="changed">
              <span aria-hidden="true" /> Изменятся: {data.summary.changed}
            </span>
            <span className="domain-status" data-status="lost">
              <span aria-hidden="true" /> Потеряют источник: {data.summary.lost}
            </span>
            <span className="domain-status" data-status="unchanged">
              <span aria-hidden="true" /> Без изменений:{" "}
              {data.summary.unchanged}
            </span>
          </div>
          <p className="rehearsal-impact">
            Вопросов проверено: {data.summary.total} · затронуты вопросы{" "}
            {data.impacted_employees_count} сотрудников · документ найдут: было{" "}
            {data.audience_impact.eligible_current ?? "ещё не опубликовано"} →
            станет {data.audience_impact.eligible_draft}. Доступ изменится у {data.audience_impact.changed} сотрудников.
          </p>
          {!data.current && (
            <p className="rehearsal-impact">
              Документ ещё не публиковался. Сравнение учитывает и другие доступные регламенты.
            </p>
          )}
          {resultFilter === "risk" && data.summary.changed + data.summary.lost === 0 && <p role="status">Изменившихся и потерянных источников в этой проверке нет.</p>}
          {resultFilter === "missing" && missingSources === 0 && <p role="status">Для всех вопросов найден источник после изменения.</p>}
          {data.results.map((result, index) => (
            <div className="rehearsal-result" id={`rehearsal-result-${index}`} hidden={resultFilter === "risk" ? result.classification !== "lost" && result.classification !== "changed" : resultFilter === "missing" && result.after.excerpts.length + result.after.restricted_excerpts > 0} key={index}>
              <div className="rehearsal-question">
                <p>{result.question}</p>
                <div className="rehearsal-question-meta">
                  <span className="domain-status" data-status={result.classification}>
                    <span aria-hidden="true" />
                    {classificationText[result.classification]}
                  </span>
                  {result.source === "gap_case" && (
                    <small>Из вопросов без ответа</small>
                  )}
                </div>
              </div>
              <div className="rehearsal-columns">
                <Side label="Сейчас" side={result.before} />
                <Side label="После публикации" side={result.after} />
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
