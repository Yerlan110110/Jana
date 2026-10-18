import { createJanaClient, type components } from "@janamen/api-client";
import {
  QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useRef } from "react";
import { z } from "zod";

export type Model<K extends keyof components["schemas"]> =
  components["schemas"][K];
let csrfToken: string | undefined;
export const api = createJanaClient({
  baseUrl: "",
  getCsrfToken: () => csrfToken,
});
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 15_000, retry: false, refetchOnWindowFocus: true },
    mutations: { retry: false },
  },
});

function clearPrivateSession() {
  csrfToken = undefined;
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "session",
  });
  queryClient.getMutationCache().clear();
  queryClient.setQueryData(["session"], null);
}

const requestSessions = new WeakMap<Request, string | undefined>();
api.use({
  onRequest({ request }) {
    requestSessions.set(request, csrfToken);
  },
  onResponse({ request, response }) {
    if (
      response.status === 401 &&
      requestSessions.get(request) === csrfToken &&
      queryClient.getQueryData(["session"])
    ) {
      clearPrivateSession();
    }
  },
});

const errorSchema = z.object({
  code: z.string().optional(),
  message: z.string().optional(),
  field_errors: z.record(z.string(), z.unknown()).optional(),
  request_id: z.string().nullable().optional(),
});

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fields: Record<string, unknown>;
  readonly requestId: string | null;
  constructor(response: Response, error: unknown) {
    const parsed = errorSchema.safeParse(error);
    super(
      parsed.success ? parsed.data.message : "Не удалось выполнить запрос.",
    );
    this.status = response.status;
    this.code = parsed.success
      ? (parsed.data.code ?? "request_failed")
      : "request_failed";
    this.fields = parsed.success ? (parsed.data.field_errors ?? {}) : {};
    this.requestId = parsed.success ? (parsed.data.request_id ?? null) : null;
  }
}

export function unwrap<T>(result: {
  data?: T;
  error?: unknown;
  response: Response;
}): T {
  if (!result.response.ok || result.error)
    throw new ApiError(result.response, result.error);
  if (result.data === undefined)
    throw new Error("Сервер не вернул данные. Обновите страницу.");
  return result.data;
}

export function useCommand<V, T>(
  execute: (values: V, key: string) => Promise<T>,
) {
  const client = useQueryClient();
  const intent = useRef<{ fingerprint: string; key: string } | null>(null);
  return useMutation({
    mutationFn: async (values: V) => {
      const fingerprint = JSON.stringify(values);
      if (intent.current?.fingerprint !== fingerprint) {
        intent.current = { fingerprint, key: crypto.randomUUID() };
      }
      return execute(values, intent.current.key);
    },
    onSuccess: async () => {
      intent.current = null;
      await client.invalidateQueries();
    },
  });
}

export async function readSession(signal?: AbortSignal) {
  const result = await api.GET("/api/v1/auth/me/", { signal });
  if ([401, 403].includes(result.response.status)) return null;
  const session = unwrap(result);
  csrfToken = session.csrf_token;
  return session;
}

export async function signIn(username: string, password: string) {
  await queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "session",
  });
  queryClient.getMutationCache().clear();
  csrfToken = unwrap(await api.GET("/api/v1/auth/csrf/")).csrf_token;
  const session = unwrap(
    await api.POST("/api/v1/auth/login/", { body: { username, password } }),
  );
  csrfToken = session.csrf_token;
  queryClient.setQueryData(["session"], session);
  return session;
}

export type DemoAccount = Model<"DemoAccountEnum">;

export async function readDemoAccounts(signal?: AbortSignal) {
  const result = await api.GET("/api/v1/auth/demo-login/", { signal });
  if (result.response.status === 404) return null;
  return unwrap(result).accounts;
}

export async function signInDemo(account: DemoAccount) {
  await queryClient.cancelQueries();
  queryClient.removeQueries({
    predicate: (query) => query.queryKey[0] !== "session",
  });
  queryClient.getMutationCache().clear();
  csrfToken = unwrap(await api.GET("/api/v1/auth/csrf/")).csrf_token;
  const session = unwrap(
    await api.POST("/api/v1/auth/demo-login/", { body: { account } }),
  );
  csrfToken = session.csrf_token;
  queryClient.setQueryData(["session"], session);
  return session;
}

export async function signOut() {
  const sessionToken = csrfToken;
  const result = await api.POST("/api/v1/auth/logout/");
  if (!result.response.ok && result.response.status !== 401)
    throw new ApiError(result.response, result.error);
  if (csrfToken === sessionToken) clearPrivateSession();
}
