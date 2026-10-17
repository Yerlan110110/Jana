import { ActionButton } from "@/components/actions";
import { NativeSelect } from "@/components/pace/native-select";
import { Textarea } from "@/components/pace/textarea";
import { Input } from "@/components/upstream/input";
import { type Model } from "@/lib/api";
import { categories, categoryValue } from "../common";
import type { Draft } from "./common";
import { move } from "./common";

export function CourseFields({
  draft,
  update,
  disabled,
}: {
  draft: Draft;
  update: (draft: Draft) => void;
  disabled: boolean;
}) {
  const lessons = draft.lessons ?? [];
  const questions = draft.questions ?? [];
  function lessonChange(index: number, value: Model<"LessonRequest">) {
    update({
      ...draft,
      lessons: lessons.map((item, i) => (i === index ? value : item)),
    });
  }
  function questionChange(
    index: number,
    value: Model<"AuthorQuestionRequest">,
  ) {
    update({
      ...draft,
      questions: questions.map((item, i) => (i === index ? value : item)),
    });
  }
  return (
    <fieldset disabled={disabled} className="rq-fieldset form-stack">
      <div className="form-grid">
        <label className="field">
          Название на русском
          <Input
            required
            maxLength={200}
            value={draft.title}
            onChange={(e) => update({ ...draft, title: e.target.value })}
          />
        </label>
        <label className="field">
          Название на казахском
          <Input
            maxLength={200}
            lang="kk"
            value={draft.title_kk}
            onChange={(e) => update({ ...draft, title_kk: e.target.value })}
          />
        </label>
      </div>
      <label className="field">
        Описание и цель курса
        <Textarea
          required
          maxLength={2000}
          rows={3}
          value={draft.summary}
          onChange={(e) => update({ ...draft, summary: e.target.value })}
        />
      </label>
      <label className="field">
        Описание на казахском
        <Textarea
          maxLength={2000}
          rows={3}
          lang="kk"
          value={draft.summary_kk}
          onChange={(e) => update({ ...draft, summary_kk: e.target.value })}
        />
      </label>
      <div className="form-grid">
        <label className="field">
          Категория
          <NativeSelect
            value={draft.category}
            onChange={(e) => {
              const category = categoryValue(e.target.value);
              if (category) update({ ...draft, category });
            }}
          >
            {Object.entries(categories).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="field">
          Язык материалов
          <NativeSelect
            value={draft.content_language}
            onChange={(e) =>
              update({
                ...draft,
                content_language: e.target.value === "kk" ? "kk" : "ru",
              })
            }
          >
            <option value="ru">Русский</option>
            <option value="kk">Қазақша</option>
          </NativeSelect>
        </label>
        <label className="field">
          Проходной балл, %
          <Input
            type="number"
            min={1}
            max={100}
            required
            value={draft.passing_percent}
            onChange={(e) =>
              update({ ...draft, passing_percent: Number(e.target.value) })
            }
          />
        </label>
        <label className="field">
          Лимит попыток · пусто без ограничения
          <Input
            type="number"
            min={1}
            max={100}
            value={draft.max_attempts ?? ""}
            onChange={(e) =>
              update({
                ...draft,
                max_attempts: e.target.value ? Number(e.target.value) : null,
              })
            }
          />
        </label>
        <label className="field">
          Ожидаемая длительность, мин · необязательно
          <Input
            type="number"
            min={1}
            max={600}
            value={draft.estimated_minutes ?? ""}
            onChange={(e) =>
              update({
                ...draft,
                estimated_minutes: e.target.value
                  ? Number(e.target.value)
                  : null,
              })
            }
          />
        </label>
      </div>
      <div className="stack">
        <h2>Материалы</h2>
        <p className="muted">
          Публикации нужен хотя бы один обязательный материал. Порядок ниже
          задаёт порядок прохождения.
        </p>
        {lessons.map((lesson, index) => (
          <section className="ac-editor-block" key={index}>
            <h3>Материал {index + 1}</h3>
            <div className="form-grid">
              <label className="field">
                Название материала
                <Input
                  required
                  maxLength={200}
                  value={lesson.title}
                  onChange={(e) =>
                    lessonChange(index, { ...lesson, title: e.target.value })
                  }
                />
              </label>
            </div>
            <label className="field">
              Содержание
              <Textarea
                required
                rows={8}
                maxLength={20000}
                value={lesson.body_markdown}
                onChange={(e) =>
                  lessonChange(index, {
                    ...lesson,
                    body_markdown: e.target.value,
                  })
                }
              />
            </label>
            <label className="ac-inline-check">
              <input
                type="checkbox"
                checked={lesson.required}
                onChange={(e) =>
                  lessonChange(index, { ...lesson, required: e.target.checked })
                }
              />
              Обязательный материал
            </label>
            <div className="button-row">
              <ActionButton
                variant="secondary"
                disabled={index === 0}
                onClick={() =>
                  update({ ...draft, lessons: move(lessons, index, -1) })
                }
              >
                Выше
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={index === lessons.length - 1}
                onClick={() =>
                  update({ ...draft, lessons: move(lessons, index, 1) })
                }
              >
                Ниже
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() =>
                  update({
                    ...draft,
                    lessons: lessons.filter((_, i) => i !== index),
                  })
                }
              >
                Убрать из черновика
              </ActionButton>
            </div>
          </section>
        ))}
        <ActionButton
          variant="secondary"
          disabled={lessons.length >= 50}
          onClick={() =>
            update({
              ...draft,
              lessons: [
                ...lessons,
                {
                  id: `lesson-${crypto.randomUUID()}`,
                  title: "",
                  body_markdown: "",
                  required: true,
                },
              ],
            })
          }
        >
          Добавить материал
        </ActionButton>
      </div>
      <div className="stack">
        <h2>Вопросы теста</h2>
        <p className="muted">
          В каждой задаче один верный вариант. Ключи доступны только автору.
          Публикации нужен хотя бы один вопрос.
        </p>
        {questions.map((question, index) => (
          <section className="ac-editor-block" key={index}>
            <h3>Вопрос {index + 1}</h3>

            <label className="field">
              Формулировка
              <Textarea
                required
                rows={3}
                maxLength={2000}
                value={question.prompt}
                onChange={(e) =>
                  questionChange(index, { ...question, prompt: e.target.value })
                }
              />
            </label>
            {question.options.map((option, optionIndex) => (
              <div className="form-grid" key={optionIndex}>
                <label className="field">
                  Текст варианта {optionIndex + 1}
                  <Input
                    required
                    maxLength={2000}
                    value={option.text}
                    onChange={(e) =>
                      questionChange(index, {
                        ...question,
                        options: question.options.map((item, i) =>
                          i === optionIndex
                            ? { ...option, text: e.target.value }
                            : item,
                        ),
                      })
                    }
                  />
                </label>
                <ActionButton
                  variant="secondary"
                  disabled={question.options.length <= 2}
                  onClick={() =>
                    questionChange(index, {
                      ...question,
                      options: question.options.filter(
                        (_, i) => i !== optionIndex,
                      ),
                      correct_option_id:
                        question.correct_option_id === option.id
                          ? ""
                          : question.correct_option_id,
                    })
                  }
                >
                  Убрать вариант {optionIndex + 1}
                </ActionButton>
              </div>
            ))}
            <ActionButton
              variant="secondary"
              disabled={question.options.length >= 8}
              onClick={() =>
                questionChange(index, {
                  ...question,
                  options: [
                    ...question.options,
                    { id: `o-${crypto.randomUUID()}`, text: "" },
                  ],
                })
              }
            >
              Добавить вариант
            </ActionButton>
            <label className="field">
              Верный вариант
              <NativeSelect
                required
                value={question.correct_option_id}
                onChange={(e) =>
                  questionChange(index, {
                    ...question,
                    correct_option_id: e.target.value,
                  })
                }
              >
                <option value="">Выберите вариант</option>
                {question.options.map((option, i) => (
                  <option key={i} value={option.id}>
                    Вариант {i + 1} · {option.text || option.id}
                  </option>
                ))}
              </NativeSelect>
            </label>
            <label className="field">
              Объяснение для автора
              <Textarea
                required
                rows={3}
                maxLength={3000}
                value={question.explanation}
                onChange={(e) =>
                  questionChange(index, {
                    ...question,
                    explanation: e.target.value,
                  })
                }
              />
            </label>
            <div className="button-row">
              <ActionButton
                variant="secondary"
                disabled={index === 0}
                onClick={() =>
                  update({ ...draft, questions: move(questions, index, -1) })
                }
              >
                Выше
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={index === questions.length - 1}
                onClick={() =>
                  update({ ...draft, questions: move(questions, index, 1) })
                }
              >
                Ниже
              </ActionButton>
              <ActionButton
                variant="secondary"
                onClick={() =>
                  update({
                    ...draft,
                    questions: questions.filter((_, i) => i !== index),
                  })
                }
              >
                Убрать вопрос из черновика
              </ActionButton>
            </div>
          </section>
        ))}
        <ActionButton
          variant="secondary"
          disabled={questions.length >= 100}
          onClick={() =>
            update({
              ...draft,
              questions: [
                ...questions,
                {
                  id: `q-${crypto.randomUUID()}`,
                  prompt: "",
                  options: [
                    { id: "a", text: "" },
                    { id: "b", text: "" },
                  ],
                  correct_option_id: "",
                  explanation: "",
                },
              ],
            })
          }
        >
          Добавить вопрос
        </ActionButton>
      </div>
    </fieldset>
  );
}
