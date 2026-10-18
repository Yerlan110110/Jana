import { useMutation } from "@tanstack/react-query";
import { FlaskConical } from "lucide-react";
import { useState } from "react";
import { ActionButton as Button } from "@/components/actions";
import { Card } from "@/components/pace/card";
import { Textarea } from "@/components/pace/textarea";
import { ErrorNotice } from "@/components/ui";
import { api, unwrap } from "@/lib/api";

/* Temporary contract shim. The generated schema lacks the rehearsal endpoint
 * until the backend worktree's OpenAPI contract is integrated; when
 * packages/api-client/src/schema.d.ts grows this path natively, delete this
 * block or duplicate keys will fail typechecking. */
declare module "@janamen/api-client/schema" {
  interface paths {
    "/api/v1/knowledge/admin/documents/{document_id}/rehearsal/": {
      parameters: {
        query?: never;
        header?: never;
        path?: never;
        cookie?: never;
      };
      get?: never;
      put?: never;
      post: {
        parameters: {
          query?: never;
          header?: never;
          path: { document_id: string };
          cookie?: never;
        };
        requestBody: {
          content: {
            "application/json": {
              expected_version: number;
              language?: string;
              questions?: string[];
              gap_case_ids?: string[];
            };
          };
        };
        responses: {
          200: {
            headers: { [name: string]: unknown };
            content: { "application/json": RehearsalResponse };
          };
        };
      };
      delete?: never;
      options?: never;
      head?: never;
      patch?: never;
      trace?: never;
    };
  }
}

interface RehearsalExcerpt {
  origin: string;
  chunk_id: string | null;
  revision_id: string | null;
  revision_number: number | null;
  document_id: string | null;
  title: string | null;
  heading: string | null;
  locator: string | null;
  text: string | null;
  content_hash: string | null;
  score: number | null;
  coverage: number | null;
}

interface RehearsalSide {
  reason: string;
  excerpts: RehearsalExcerpt[];
}

type RehearsalClassification = "unchanged" | "changed" | "lost" | "gained";

interface RehearsalResult {
  source: string;
  gap_case_id: string | null;
  question: string;
  language: string;
  classification: string;
  before: RehearsalSide;
  after: RehearsalSide;
}

interface RehearsalResponse {
  document: {
    id: string;
    slug: string;
    title: string;
    state: string;
    version: number;
    has_unpublished_changes: boolean;
  };
  current: {
    revision_id: string;
    revision_number: number;
    content_hash: string;
    published_at: string;
  } | null;
  draft: {
    content_hash: string;
    language: string;
    topic: string;
    audience: string;
    effective_from: string | null;
    effective_until: string | null;
    section_count: number;
  };
  audience_impact: {
    eligible_current: number | null;
    eligible_draft: number;
    changed: number;
  };
  summary: {
    total: number;
    unchanged: number;
    changed: number;
    lost: number;
    gained: number;
  };
  impacted_employees_count: number;
  results: RehearsalResult[];
  scope: string;
  not_legal_verification: boolean;
}

const classificationText: Record<RehearsalClassification, string> = {
  unchanged: "Без изменений",
  changed: "Изменится",
  lost: "Потеряет источник",
  gained: "Получит ответ",
};

const reasonText: Record<string, string> = {
  lexical_evidence: "Есть текстовое совпадение",
  no_matching_policy: "Подходящий регламент не найден",
  clarification_required: "Ответ потребует уточнения",
  unsafe_instruction: "Вопрос отклонён как небезопасный",
};

function classificationLabel(value: string) {
  return (
    classificationText[value as RehearsalClassification] ?? value
  );
}

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
      {excerpt.score !== null && (
        <p>
          Совпадение {excerpt.score.toFixed(2)}
          {excerpt.coverage !== null &&
            ` · покрытие ${Math.round(excerpt.coverage * 100)}%`}
        </p>
      )}
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
  const preview = useMutation({
    mutationFn: async () =>
      unwrap(
        await api.POST(
          "/api/v1/knowledge/admin/documents/{document_id}/rehearsal/",
          {
            params: { path: { document_id: documentId } },
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
  const data = preview.data;
  return (
    <Card className="data-section rehearsal-panel">
      <div className="section-heading">
        <div>
          <h2>
            <FlaskConical size={17} aria-hidden="true" /> Репетиция публикации
          </h2>
          <p>
            Сравнение выдержек источников до и после публикации сохранённого
            черновика. Это предпросмотр поискового покрытия, а не юридическое
            согласование — решение о публикации принимает HR.
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
              <span aria-hidden="true" /> Новых ответов: {data.summary.gained}
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
            станет {data.audience_impact.eligible_draft} (
            {data.audience_impact.changed >= 0 ? "+" : ""}
            {data.audience_impact.changed}).
          </p>
          {!data.current && (
            <p className="rehearsal-impact">
              Документ ещё не публиковался — любая выдержка из черновика считается
              новым покрытием.
            </p>
          )}
          {data.results.map((result, index) => (
            <div className="rehearsal-result" key={index}>
              <div className="rehearsal-question">
                <p>{result.question}</p>
                <div className="rehearsal-question-meta">
                  <span className="domain-status" data-status={result.classification}>
                    <span aria-hidden="true" />
                    {classificationLabel(result.classification)}
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
