import type { createJanaClient } from "@janamen/api-client";

type Client = ReturnType<typeof createJanaClient>;
export type Role = "employee" | "manager" | "hr";
export type View = { id: string; path: string; ready: string; state: string };

export function data<T>(result: { data?: T; response: Response }): T {
  if (!result.response.ok || !result.data) {
    throw new Error(`Visual fixture API failed (${result.response.status})`);
  }
  return result.data;
}

function required<T>(value: T | undefined, description: string): T {
  if (!value) throw new Error(`Required real visual fixture is missing: ${description}`);
  return value;
}

export async function viewsFor(client: Client, role: Role): Promise<View[]> {
  const me = data(await client.GET("/api/v1/auth/me/"));
  if (!me.employee || me.user.role !== role) throw new Error("Visual role does not match its session");
  if (role === "employee") {
    const catalog = data(await client.GET("/api/v1/academy/courses/", {
      params: { query: { page_size: 100 } },
    }));
    if (catalog.count < 30) throw new Error("The real employee catalog must retain at least 30 courses");
    const requests = data(await client.GET("/api/v1/requests/", {
      params: { query: { employee: me.employee.id, page_size: 100 } },
    })).results;
    const returned = required(requests.find((item) => item.status === "returned"), "returned request");
    const approved = required(requests.find((item) => item.status === "approved"), "approved request");
    const enrollments = data(await client.GET("/api/v1/academy/enrollments/", {
      params: { query: { employee: me.employee.id, page_size: 100 } },
    })).results;
    const lesson = required(enrollments.find((item) => item.availability === "published" && item.started_at && !item.completed_at), "active course material");
    const blocked = required(enrollments.find((item) => item.availability === "published" && item.material_progress.required_completed < item.material_progress.required_total && !item.completed_at), "assessment prerequisites");
    const quiz = required(enrollments.find((item) => item.allowed_actions.includes("submit_attempt")), "available assessment");
    const result = required(enrollments.find((item) => item.last_attempt?.passed), "passed attempt");
    const attempt = required(result.last_attempt ?? undefined, "saved attempt identity");
    const answer = data(await client.POST("/api/v1/assistant/answers/", {
      body: { question: "Как подать заявление на отпуск?", language: "ru", client_message_id: crypto.randomUUID() },
    }));
    const citation = required(answer.citations[0], "accessible policy citation");
    const refusal = data(await client.POST("/api/v1/assistant/answers/", {
      body: { question: "Каков лимит компенсации межпланетной командировки?", language: "ru", client_message_id: crypto.randomUUID() },
    }));
    if (!refusal.allowed_actions.includes("escalate_to_hr")) throw new Error("Visual refusal has no real HR escalation capability");
    return [
      { id: "S02", path: "/", ready: "Ваш отпуск", state: "loaded workbench with returned requests" },
      { id: "S03", path: "/profile", ready: "Кадровые данные", state: "read-only populated profile" },
      { id: "S04", path: "/requests", ready: "Мои заявления", state: "populated mixed request list" },
      { id: "S05", path: "/requests/new?type=leave", ready: "Данные заявления", state: "new leave form" },
      { id: "S06", path: "/requests/new?type=advance", ready: "Данные заявления", state: "new advance form" },
      { id: "S07", path: `/requests/${approved.id}`, ready: "Сохранённые данные", state: "approved own request with fulfillment projection" },
      { id: "S08", path: `/requests/${returned.id}`, ready: "Сохранённые данные", state: "returned own request with correction form and history" },
      { id: "S13", path: "/academy", ready: "Моё обучение", state: "populated own enrollments" },
      { id: "S14", path: "/academy/catalog", ready: "Каталог курсов", state: "published course catalog" },
      { id: "S15", path: `/academy/courses/${lesson.course_version.course}`, ready: "О курсе", state: "published assigned course" },
      { id: "S16", path: `/academy/enrollments/${lesson.id}`, ready: "Назначение", state: "active lesson and outline" },
      { id: "S17", path: `/academy/enrollments/${blocked.id}/quiz`, ready: "Условия теста", state: "prerequisites block answers" },
      { id: "S18", path: `/academy/enrollments/${quiz.id}/quiz`, ready: "Вопросы", state: "eligible questions without selected answers" },
      { id: "S19", path: `/academy/attempts/${attempt.id}?enrollment=${result.id}`, ready: "Тест пройден", state: "persisted successful attempt" },
      { id: "S20", path: "/academy/history", ready: "История обучения", state: "completed enrollment history" },
      { id: "S21", path: `/assistant/answers/${answer.id}`, ready: "Проверьте основание", state: "real extractive answer and citations" },
      { id: "S22", path: `/knowledge/citations/${citation.chunk_id}`, ready: citation.title, state: "freshly accessible published source" },
      { id: "S23", path: `/assistant/answers/${refusal.id}`, ready: refusal.question, state: "real refusal with explicit escalation action" },
      { id: "S24", path: "/notifications", ready: "Уведомления", state: "populated notification center" },
    ];
  }
  if (role === "manager") {
    const queue = data(await client.GET("/api/v1/requests/", {
      params: { query: { needs_my_action: true, page_size: 100 } },
    })).results;
    const request = required(queue[0], "manager decision queue");
    const people = data(await client.GET("/api/v1/employees/", {
      params: { query: { page_size: 100 } },
    })).results;
    const person = required(people.find((item) => item.id !== me.employee?.id), "scoped direct report");
    return [
      { id: "S09", path: "/team/requests", ready: "Требует моего решения", state: "server-filtered manager queue" },
      { id: "S10", path: `/requests/${request.id}`, ready: "Сохранённые данные", state: "actionable team request" },
      { id: "S11", path: `/team/${person.id}`, ready: "Кадровые данные", state: "scoped read-only employee" },
      { id: "S12", path: "/team/learning", ready: "Обучение команды", state: "scoped learning list and denominator" },
    ];
  }
  const courses = data(await client.GET("/api/v1/academy/manage/courses/", {
    params: { query: { page_size: 100 } },
  })).results;
  const course = required(courses.find((item) => item.availability === "published"), "published editable course");
  return [
    { id: "S25", path: "/team/requests?kind=hr", ready: "Очередь HR", state: "server-filtered HR queue" },
    { id: "S26", path: "/hr/courses", ready: "Управление курсами", state: "course publication states" },
    { id: "S27", path: `/hr/courses/${course.id}`, ready: "Редактируемый черновик", state: "populated course draft and publication controls" },
    { id: "S28", path: "/hr/assignments", ready: "Назначить обучение", state: "real people and course selection" },
    { id: "S29", path: "/hr/policies", ready: "Регламенты компании", state: "policy revisions and publication states" },
    { id: "S30", path: "/knowledge/cases", ready: "Обращения сотрудников", state: "open scoped HR knowledge cases" },
    { id: "S31", path: "/hr/integrations", ready: "Передача и источники", state: "operator delivery and source lists" },
  ];
}
