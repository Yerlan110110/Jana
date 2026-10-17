import { ActionButton } from "@/components/actions";
import { Textarea } from "@/components/pace/textarea";
import { DataSection } from "@/components/ui";
import { api, unwrap, useCommand } from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import type { RequestAction, RequestRecord } from "./common";
import { actionLabels, actionPaths } from "./common";
import { WriteRecovery } from "./support";

export function RequestActions({
  record,
  refresh,
}: {
  record: RequestRecord;
  refresh: () => Promise<RequestRecord | undefined>;
}) {
  const client = useQueryClient();
  const [comment, setComment] = useState("");
  const [selected, setSelected] = useState<{
    action: RequestAction;
    expected_version: number;
  } | null>(null);
  const command = useCommand(
    async (
      intent: {
        id: string;
        action: RequestAction;
        expected_version: number;
        comment: string;
      },
      key,
    ) => {
      const body =
        intent.action === "submit" || intent.action === "cancel"
          ? { expected_version: intent.expected_version }
          : {
              expected_version: intent.expected_version,
              comment: intent.comment,
            };
      return unwrap(
        await api.POST(actionPaths[intent.action], {
          params: {
            path: { id: intent.id },
            header: { "Idempotency-Key": key },
          },
          body,
        }),
      );
    },
  );
  function run(intent: {
    id: string;
    action: RequestAction;
    expected_version: number;
    comment: string;
  }) {
    command.mutate(intent, {
      onSuccess: (result) => {
        client.setQueryData(["request", record.id], result);
        setSelected(null);
        setComment("");
      },
    });
  }
  const allActions: RequestAction[] = [
    "submit",
    "approve",
    "return_for_changes",
    "reject",
    "cancel",
  ];
  const actions = allActions.filter((action) =>
    record.allowed_actions.includes(action),
  );
  if (!actions.length)
    return (
      <p className="notice-panel">
        Сейчас нет доступных команд. Следующий этап и принятые решения указаны в
        истории.
      </p>
    );
  return (
    <DataSection
      title="Следующее действие"
      description="Доступные команды определяет сервер для текущей версии."
    >
      <div className="stack">
        <div className="button-row">
          {actions.map((action) => (
            <ActionButton
              key={action}
              variant={
                action === "approve" || action === "submit"
                  ? "default"
                  : "secondary"
              }
              disabled={command.isPending}
              onClick={() => {
                setSelected({ action, expected_version: record.version });
                command.reset();
              }}
            >
              {actionLabels[action]}
            </ActionButton>
          ))}
        </div>
        {selected && (
          <form
            className="form-stack notice-panel"
            onSubmit={(e) => {
              e.preventDefault();
              run({
                id: record.id,
                action: selected.action,
                comment,
                expected_version: selected.expected_version,
              });
            }}
          >
            <h3>{actionLabels[selected.action]}</h3>
            <p>
              {selected.action === "cancel"
                ? "Заявление будет отменено. Его история сохранится."
                : selected.action === "submit"
                  ? "На рассмотрение уйдут последние сохранённые данные. Проверьте их выше."
                  : "Решение будет записано в историю вместе с вашим именем и комментарием."}
            </p>
            {selected.action !== "cancel" && selected.action !== "submit" && (
              <label className="field">
                Комментарий
                {selected.action !== "approve"
                  ? " · обязательно"
                  : " · необязательно"}
                <Textarea
                  rows={3}
                  required={selected.action !== "approve"}
                  maxLength={2000}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  disabled={command.isPending}
                />
              </label>
            )}
            <div className="button-row">
              <ActionButton type="submit" loading={command.isPending}>
                {actionLabels[selected.action]}
              </ActionButton>
              <ActionButton
                variant="secondary"
                disabled={command.isPending}
                onClick={() => setSelected(null)}
              >
                Вернуться без действия
              </ActionButton>
            </div>
          </form>
        )}
        <WriteRecovery
          error={command.error}
          refresh={() => {
            void refresh().then(() => {
              command.reset();
              setSelected(null);
            });
          }}
          retry={
            command.variables
              ? () => {
                  if (command.variables) run(command.variables);
                }
              : undefined
          }
        />
        <p role="status">
          {command.isSuccess
            ? "Действие сохранено. Показана новая версия."
            : ""}
        </p>
      </div>
    </DataSection>
  );
}
