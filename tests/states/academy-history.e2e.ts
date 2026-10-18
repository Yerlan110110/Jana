import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { capturePreparedPage, type RenderCase } from "../visual/inventory.js";
import { data } from "../visual/views.js";
import { sessionClient } from "../web/api.js";

const cases: readonly RenderCase[] = process.env.JANAMEN_ZOOM_CDP
  ? [{ kind: "native-zoom", factor: 2 }]
  : [1280, 1440, 768, 390, 320].map((width) => ({ kind: "viewport", width }));

async function publishedCourse(client: Awaited<ReturnType<typeof sessionClient>>["client"]) {
  const listed = data(await client.GET("/api/v1/academy/manage/courses/", {
    params: { query: { availability: "published", page_size: 1 } },
  })).results[0];
  if (!listed) throw new Error("The synthetic curriculum needs a published course");
  const template = data(await client.GET("/api/v1/academy/manage/courses/{id}/", { params: { path: { id: listed.id } } }));
  const publication = data(await client.GET("/api/v1/academy/manage/courses/{id}/revisions/", { params: { path: { id: listed.id } } })).results[0];
  if (!publication) throw new Error("The published course has no immutable revision");
  const record = data(await client.POST("/api/v1/academy/manage/courses/", {
    params: { header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { slug: `state-course-${crypto.randomUUID()}`, draft: {
      ...template.draft,
      title: `Проверка версии ${crypto.randomUUID()}`,
      lessons: publication.lessons.slice(0, 1).map((lesson) => ({ ...lesson, required: true })),
      questions: publication.questions.slice(0, 1),
    } },
  }));
  return data(await client.POST("/api/v1/academy/manage/courses/{id}/publish/", {
    params: { path: { id: record.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: record.version },
  }));
}

test("HR reads an immutable course revision and can cancel archive and restore", { session: "visual-hr", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const first = await publishedCourse(client);
  const draft = data(await client.POST("/api/v1/academy/manage/courses/{id}/save-draft/", {
    params: { path: { id: first.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: first.version, draft: { ...first.draft, title: `${first.title} · редакция 2` } },
  }));
  const second = data(await client.POST("/api/v1/academy/manage/courses/{id}/publish/", {
    params: { path: { id: first.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: draft.version },
  }));
  const path = `/hr/courses/${first.id}`;
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-course-history-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await app.open(path);
    await screen.getByText(new RegExp(`^Версия 1 · ${first.title}`)).press("Enter");
    const revision = browser.locator(".ac-revisions > details[open]");
    await revision.getByText("Вопросы и ключи этой версии · только HR", { exact: true }).press("Enter");
    await expect(revision).toContainText("Верный ответ");
    await expect(screen.getByLabel("Название на русском")).toHaveValue(second.title);
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S27-pinned-revision", path, ready: "История публикаций", state: "two real publications; old immutable material and HR-only answer key expanded beside current draft",
    } });
    await screen.getByRole("button", "Архивировать курс", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Архивировать курс", { exact: true })).toBeVisible();
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S27-archive-confirmation", path, ready: "Архивировать курс", state: "inline archive consequence with old publication still accessible; cancellation has no server transition",
    } });
    await screen.getByRole("button", "Вернуться без действия", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Архивировать курс", { exact: true })).toHaveCount(0);
    expect(data(await client.GET("/api/v1/academy/manage/courses/{id}/", { params: { path: { id: first.id } } })).version).toBe(second.version);
  }
  const revisions = data(await client.GET("/api/v1/academy/manage/courses/{id}/revisions/", { params: { path: { id: first.id } } }));
  expect(revisions.count).toBe(2);
  expect(revisions.results.find((revision) => revision.number === 1)?.title).toBe(first.title);
  const archived = data(await client.POST("/api/v1/academy/manage/courses/{id}/archive/", {
    params: { path: { id: first.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: second.version },
  }));
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await app.open(path);
    await screen.getByRole("button", "Вернуть курс в каталог", { exact: true }).tap();
    await expect(screen.getByRole("heading", "Вернуть курс в каталог", { exact: true })).toBeVisible();
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S27-restore-confirmation", path, ready: "Вернуть курс в каталог", state: "archived course retains its two publications; restore confirmation explains that no new revision is created",
    } });
    await screen.getByRole("button", "Вернуться без действия", { exact: true }).tap();
    expect(data(await client.GET("/api/v1/academy/manage/courses/{id}/", { params: { path: { id: first.id } } })).version).toBe(archived.version);
  }
});

test("assignment shows the selected pair and preserves one enrollment after duplicate and archive conflicts", { session: "visual-hr", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const course = await publishedCourse(client);
  const person = data(await client.GET("/api/v1/employees/", { params: { query: { search: "Дана Нұрланқызы", page_size: 1 } } })).results[0];
  if (!person) throw new Error("The synthetic employee is missing");
  const path = "/hr/assignments";
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/composed-assignment-${Date.now()}`;
  await app.open(path);
  await screen.getByLabel("Поиск сотрудника").fill(person.full_name);
  const selectedPerson = screen.getByRole("radio", new RegExp(person.full_name));
  await selectedPerson.focus();
  await selectedPerson.press("Space");
  await expect(selectedPerson).toBeChecked();
  await screen.getByLabel("Поиск курса").fill(course.title);
  const selectedCourse = screen.getByRole("radio", new RegExp(course.title));
  await selectedCourse.focus();
  await selectedCourse.press("Space");
  await expect(selectedCourse).toBeChecked();
  await expect(screen.getByText("Назначений этого курса пока нет.", { exact: true })).toBeVisible();
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S28-selected-new", path, ready: "3. Проверьте назначение", state: "real selected employee and published version; no existing assignment; editable due date and required flag",
    } });
  }
  await screen.getByRole("button", "Назначить обучение", { exact: true }).tap();
  await expect(screen.getByRole("link", "Открыть назначение", { exact: true })).toBeVisible();
  const assigned = data(await client.GET("/api/v1/academy/enrollments/", { params: { query: { employee: person.id, course: course.id } } }));
  expect(assigned.count).toBe(1);
  const enrollment = assigned.results[0];
  if (!enrollment) throw new Error("The saved assignment is missing");
  await expect(screen.getByRole("link", "Открыть назначение", { exact: true })).toHaveAttribute("href", `/academy/enrollments/${enrollment.id}`);
  const [duplicate] = await Promise.all([
    browser.waitForResponse("**/api/v1/academy/enrollments/"),
    screen.getByRole("button", "Назначить обучение", { exact: true }).tap(),
  ]);
  expect(duplicate.status).toBe(409);
  expect(await duplicate.text()).toContain("already has an enrollment");
  await expect(screen.getByRole("alert")).toBeVisible();
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S28-duplicate-conflict", path, ready: "Уже назначено этому сотруднику", state: "second distinct assignment rejected409; selected pair, saved assignment link and existing row remain readable",
    } });
  }
  data(await client.POST("/api/v1/academy/manage/courses/{id}/archive/", {
    params: { path: { id: course.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: course.version },
  }));
  const [unavailable] = await Promise.all([
    browser.waitForResponse("**/api/v1/academy/enrollments/"),
    screen.getByRole("button", "Назначить обучение", { exact: true }).tap(),
  ]);
  expect(unavailable.status).toBe(409);
  expect(await unavailable.text()).toContain("course is unavailable");
  await expect(screen.getByRole("alert")).toBeVisible();
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S28-course-archived", path, ready: "3. Проверьте назначение", state: "selected course archived by a second writer; actual409 retains selected pair and recovery, without creating an enrollment",
    } });
  }
  const remaining = data(await client.GET("/api/v1/academy/enrollments/", { params: { query: { employee: person.id, course: course.id } } }));
  expect(remaining.count).toBe(1);
  expect(remaining.results[0]?.id).toBe(enrollment.id);
});

test("assignment refresh requires the current publication and preserves the other choices", { session: "visual-hr", timeout: 240_000 }, async ({ app, browser, screen }) => {
  if (!app.baseUrl) throw new Error("Select the synthetic fixture");
  const { client } = await sessionClient(browser, new URL(app.baseUrl).origin);
  await browser.addInitScript({ path: "node_modules/axe-core/axe.min.js" });
  const first = await publishedCourse(client);
  await app.open("/hr/assignments");
  await screen.getByLabel("Поиск сотрудника").fill("Дана Нұрланқызы");
  const person = screen.getByRole("radio", /Дана Нұрланқызы/);
  await person.check();
  await screen.getByLabel("Поиск курса").fill(first.title);
  await screen.getByRole("radio", new RegExp(first.title)).check();
  const due = "2027-01-18T10:00";
  await screen.getByLabel(/^Срок · необязательно/).fill(due);
  await screen.getByRole("checkbox", "Обязательное обучение").uncheck();
  const draft = data(await client.POST("/api/v1/academy/manage/courses/{id}/save-draft/", {
    params: { path: { id: first.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: first.version, draft: { ...first.draft, title: `${first.title} · редакция 2` } },
  }));
  const second = data(await client.POST("/api/v1/academy/manage/courses/{id}/publish/", {
    params: { path: { id: first.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: draft.version },
  }));
  const [conflict] = await Promise.all([
    browser.waitForResponse("**/api/v1/academy/enrollments/"),
    screen.getByRole("button", "Назначить обучение", { exact: true }).tap(),
  ]);
  if (!second.published_version) throw new Error("The new publication is missing");
  expect(conflict.status).toBe(409);
  expect(await conflict.text()).toContain("newer course revision");
  await screen.getByRole("button", "Обновить запись", { exact: true }).tap();
  const current = screen.getByRole("radio", new RegExp(second.title));
  await expect(current).toBeVisible();
  await expect(current).not.toBeChecked();
  await expect(screen.getByRole("button", "Назначить обучение", { exact: true })).toBeDisabled();
  await expect(person).toBeChecked();
  await expect(screen.getByLabel(/^Срок · необязательно/)).toHaveValue(due);
  await expect(screen.getByRole("checkbox", "Обязательное обучение")).not.toBeChecked();
  const directory = `${process.env.JANAMEN_CAPTURE_ROOT ?? ".artifacts/visual"}/assignment-refresh-${Date.now()}`;
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S28-selection-cleared", path: "/hr/assignments", ready: "3. Проверьте назначение", state: "refreshed v2 is unselected; submission disabled; selected employee, optional status and due date preserved",
    } });
  }
  await current.focus();
  await current.press("Space");
  await expect(current).toBeChecked();
  for (const environment of cases) {
    if (environment.kind === "viewport") await browser.setViewport({ width: environment.width, height: 800 });
    await capturePreparedPage({ app, browser, environment, directory, view: {
      id: "S28-refreshed-publication", path: "/hr/assignments", ready: "3. Проверьте назначение", state: "explicit refresh cleared the stale publication; HR selected v2 by keyboard, retaining person, optional status and due date",
    } });
  }
  const [saved] = await Promise.all([
    browser.waitForResponse("**/api/v1/academy/enrollments/"),
    screen.getByRole("button", "Назначить обучение", { exact: true }).tap(),
  ]);
  expect(saved.status).toBe(201);
  await expect(screen.getByRole("link", "Открыть назначение", { exact: true })).toBeVisible();
  const assigned = data(await client.GET("/api/v1/academy/enrollments/", { params: { query: { course: first.id } } }));
  expect(assigned.count).toBe(1);
  expect(assigned.results[0]?.course_version.id).toBe(second.published_version);
  expect(assigned.results[0]?.required).toBe(false);
  const enrollment = assigned.results[0];
  if (!enrollment?.due_at) throw new Error("The saved due date is missing");
  expect(Date.parse(enrollment.due_at)).toBe(Date.parse("2027-01-18T05:00:00Z"));
  data(await client.POST("/api/v1/academy/manage/courses/{id}/archive/", {
    params: { path: { id: first.id }, header: { "Idempotency-Key": crypto.randomUUID() } },
    body: { expected_version: second.version },
  }));
  const [unavailable] = await Promise.all([
    browser.waitForResponse("**/api/v1/academy/enrollments/"),
    screen.getByRole("button", "Назначить обучение", { exact: true }).tap(),
  ]);
  expect(unavailable.status).toBe(409);
  expect(await unavailable.text()).toContain("course is unavailable");
  await screen.getByRole("button", "Обновить запись", { exact: true }).tap();
  await expect(screen.getByText("Нет курсов. Измените поиск или опубликуйте курс.", { exact: true })).toBeVisible();
  await expect(screen.getByRole("button", "Назначить обучение", { exact: true })).toBeDisabled();
  await expect(person).toBeChecked();
  await expect(screen.getByLabel(/^Срок · необязательно/)).toHaveValue(due);
  await expect(screen.getByRole("checkbox", "Обязательное обучение")).not.toBeChecked();
  const remaining = data(await client.GET("/api/v1/academy/enrollments/", { params: { query: { course: first.id } } }));
  expect(remaining.count).toBe(1);
  expect(remaining.results[0]?.id).toBe(enrollment.id);
});
