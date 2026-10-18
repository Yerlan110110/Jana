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
      <h5>
        {excerpt.title ?? "Источник"}
        {excerpt.locator ? ` · ${excerpt.locator}` : ""}
      </h5>
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
      <h4>{label}</h4>
      <p className="rehearsal-reason">{reasonText[side.reason] ?? side.reason}</p>
      {side.excerpts.length > 0 && (
        <ul>
          {side.excerpts.map((excerpt, index) => (
            <Excerpt key={index} excerpt={excerpt} />
          ))}
        </ul>
      )}
      {!side.excerpts.length && (
        <p className="rehearsal-empty">{side.restricted_excerpts ? "Источник доступен сотруднику, но скрыт для вашей роли." : "Источник не найден."}</p>
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
                ? { questions: [question.trim()] }
                : {}),
            },
          },
        ),
      ),
  });
  const data = !blocked && preview.data?.document.version === expectedVersion
    ? preview.data
    : undefined;
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
          Свой вопрос для проверки (необязательно)
        </label>
        <Textarea
          id="rehearsal-question"
          rows={2}
          maxLength={2000}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Например: можно ли перенести часть отпуска на следующий год?"
        />
        <p className="field-help">
          Если поле пустое, проверяются свежие вопросы сотрудников, оставшиеся
          без ответа.
        </p>
      </div>
      {blocked && blockReason && (
        <p className="field-error" role="status">
          {blockReason}
        </p>
      )}
      <div className="action-row">
        <Button
          variant="secondary"
          disabled={blocked}
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
            <span className="domain-status">
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
          {data.results.map((result, index) => (
            <div className="rehearsal-result" key={index}>
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
