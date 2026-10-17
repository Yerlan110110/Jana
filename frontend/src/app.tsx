import {
  lazy,
  Suspense,
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import {
  Link,
  NavLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router";
import {
  ArrowRight,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  ChevronRight,
  CircleHelp,
  FileCheck2,
  FileText,
  GraduationCap,
  House,
  LogOut,
  Menu,
  PanelTop,
  ShieldCheck,
  Sparkles,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { ActionButton as Button, ActionLink } from "@/components/actions";
import { Input } from "@/components/upstream/input";
import {
  DemoNote,
  EmptyState,
  ErrorNotice,
  LoadingState,
} from "@/components/ui";
import { readSession, signIn, signOut } from "@/lib/api";
import { SessionProvider, useSession } from "@/lib/session";
import { roleText } from "@/lib/format";
import { NotificationsPage } from "@/features/notifications";

const HomePage = lazy(() =>
  import("@/features/workbench").then((m) => ({ default: m.HomePage })),
);

const AssistantPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.AssistantPage })),
);
const AnswerPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.AnswerPage })),
);
const CitationPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.CitationPage })),
);
const DocumentsPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.DocumentsPage })),
);
const DocumentPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.DocumentPage })),
);
const CasesPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.CasesPage })),
);
const CasePage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.CasePage })),
);
const CaseSourcePage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.CaseSourcePage })),
);
const ManagePoliciesPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({
    default: m.ManagePoliciesPage,
  })),
);
const PolicyEditorPage = lazy(() =>
  import("@/features/knowledge").then((m) => ({ default: m.PolicyEditorPage })),
);

const RequestsPage = lazy(() =>
  import("@/features/requests").then((m) => ({ default: m.RequestsPage })),
);
const RequestCreatePage = lazy(() =>
  import("@/features/requests").then((m) => ({ default: m.RequestCreatePage })),
);
const RequestDetailPage = lazy(() =>
  import("@/features/requests").then((m) => ({ default: m.RequestDetailPage })),
);
const RequestQueuePage = lazy(() =>
  import("@/features/requests").then((m) => ({ default: m.RequestQueuePage })),
);
const AcademyPage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({
    default: m.AcademyPage,
  })),
);
const CatalogPage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({
    default: m.CatalogPage,
  })),
);
const CoursePage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({ default: m.CoursePage })),
);
const LearningPage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({
    default: m.LearningPage,
  })),
);
const QuizPage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({ default: m.QuizPage })),
);
const AttemptPage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({
    default: m.AttemptPage,
  })),
);
const LearningHistoryPage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({
    default: m.LearningHistoryPage,
  })),
);
const ManageCoursesPage = lazy(() =>
  import("@/features/academy/authoring").then((m) => ({
    default: m.ManageCoursesPage,
  })),
);
const CourseEditorPage = lazy(() =>
  import("@/features/academy/authoring").then((m) => ({
    default: m.CourseEditorPage,
  })),
);
const AssignLearningPage = lazy(() =>
  import("@/features/academy/authoring").then((m) => ({
    default: m.AssignLearningPage,
  })),
);
const TeamLearningPage = lazy(() =>
  import("@/features/academy/learner").then((m) => ({
    default: m.TeamLearningPage,
  })),
);
const ProfilePage = lazy(() =>
  import("@/features/people").then((m) => ({ default: m.ProfilePage })),
);
const TeamPage = lazy(() =>
  import("@/features/people").then((m) => ({ default: m.TeamPage })),
);
const EmployeePage = lazy(() =>
  import("@/features/people").then((m) => ({ default: m.EmployeePage })),
);

const IntegrationsPage = lazy(() =>
  import("@/features/operations").then((m) => ({
    default: m.IntegrationsPage,
  })),
);
const ExportPage = lazy(() =>
  import("@/features/operations").then((m) => ({ default: m.ExportPage })),
);

function Brand() {
  return (
    <Link className="brand" to="/" aria-label="JanaMen, главная">
      <span className="brand-mark" aria-hidden="true">
        J
      </span>
      <span>
        Jana<span className="brand-suffix">Men</span>
      </span>
    </Link>
  );
}

export function Application() {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: ({ signal }) => readSession(signal),
    staleTime: 0,
    retry: false,
  });
  const location = useLocation();
  if (session.isPending)
    return (
      <main className="session-loading">
        <Brand />
        <LoadingState />
      </main>
    );
  if (session.isError)
    return (
      <main className="session-loading">
        <Brand />
        <ErrorNotice
          error={session.error}
          retry={() => {
            void session.refetch();
          }}
        />
      </main>
    );
  if (!session.data) return <LoginPage />;
  if (location.pathname === "/login") return <Navigate to="/" replace />;
  return (
    <SessionProvider key={session.data.user.id} session={session.data}>
      <AppShell />
    </SessionProvider>
  );
}

function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  const login = useMutation({
    mutationFn: () => signIn(username.trim(), password),
    onSuccess: () => navigate("/", { replace: true }),
  });
  function submit(event: FormEvent) {
    event.preventDefault();
    login.mutate();
  }
  return (
    <main className="login-page">
      <section className="login-story">
        <Brand />
        <div className="login-story-body">
          <p className="eyebrow">ЛИЧНЫЙ КАБИНЕТ СОТРУДНИКА</p>
          <h1>
            Меньше ожидания.
            <br />
            Больше ясности.
          </h1>
          <p>
            Рабочие вопросы, обучение и кадровые заявки. Один следующий шаг,
            понятный результат.
          </p>
          <div className="login-tracks">
            <span>
              <FileCheck2 aria-hidden="true" />
              Заявки с историей
            </span>
            <span>
              <GraduationCap aria-hidden="true" />
              Обучение по делу
            </span>
            <span>
              <ShieldCheck aria-hidden="true" />
              Ответы с основанием
            </span>
          </div>
        </div>
        <p className="login-caption">
          JanaMen · Digital HR · Демонстрационный стенд
        </p>
      </section>
      <section className="login-form-side">
        <div className="login-form-wrap">
          <p className="eyebrow">ДОБРО ПОЖАЛОВАТЬ</p>
          <h2>Войдите в JanaMen</h2>
          <p className="muted">Используйте учётную запись сотрудника.</p>
          <form className="form-stack login-form" onSubmit={submit}>
            <div className="field">
              <label htmlFor="username">Имя пользователя</label>
              <Input
                id="username"
                name="username"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="employee.demo"
              />
            </div>
            <div className="field">
              <label htmlFor="password">Пароль</label>
              <Input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </div>
            {login.isError && (
              <p className="login-error" role="alert">
                Не удалось войти. Проверьте имя и пароль. При сбое сети
                повторите вход.
              </p>
            )}
            <Button
              type="submit"
              loading={login.isPending}
              loadingLabel="Входим в кабинет"
              iconEnd={<ArrowRight aria-hidden="true" />}
            >
              Войти
            </Button>
          </form>
          <details className="demo-accounts">
            <summary>Демонстрационные роли</summary>
            <p>
              Выберите имя. Пароль стенда выдаёт владелец или команда запуска.
            </p>
            <div>
              {[
                { role: "Сотрудник", name: "employee.demo" },
                { role: "Руководитель", name: "manager.demo" },
                { role: "HR", name: "hr.demo" },
              ].map((account) => (
                <Button
                  key={account.name}
                  variant="secondary"
                  size="sm"
                  onClick={() => setUsername(account.name)}
                >
                  {account.role}
                </Button>
              ))}
            </div>
          </details>
          <DemoNote />
        </div>
      </section>
    </main>
  );
}

const personalLinks = [
  { to: "/", label: "Главная", icon: House, end: true },
  { to: "/requests", label: "Мои заявки", icon: FileText },
  { to: "/academy", label: "Jana Academy", icon: GraduationCap },
  { to: "/assistant", label: "AI Jana", icon: Sparkles },
  { to: "/knowledge", label: "Регламенты", icon: BookOpen, end: true },
  { to: "/knowledge/cases", label: "Обращения к HR", icon: CircleHelp },
];
const teamLinks = [
  { to: "/team/requests", label: "На согласовании", icon: FileCheck2 },
  { to: "/team", label: "Сотрудники", icon: Users, end: true },
  { to: "/team/learning", label: "Обучение команды", icon: GraduationCap },
];
const hrLinks = [
  { to: "/hr/courses", label: "Управление курсами", icon: GraduationCap },
  {
    to: "/hr/assignments",
    label: "Назначить обучение",
    icon: BriefcaseBusiness,
  },
  { to: "/hr/policies", label: "Публикации", icon: BookOpen },
  { to: "/hr/integrations", label: "Передача документов", icon: PanelTop },
];

function AppShell() {
  const { user, employee } = useSession();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const mutations = useIsMutating();
  const logout = useMutation({ mutationFn: signOut });
  const main = useRef<HTMLElement>(null);
  const previousPath = useRef(location.pathname);
  useEffect(() => {
    if (previousPath.current !== location.pathname) {
      main.current?.focus();
      window.scrollTo({ top: 0 });
      previousPath.current = location.pathname;
    }
  }, [location.pathname]);
  function navigation(links: typeof personalLinks) {
    return links.map(({ to, label, icon: Icon, end }) => (
      <NavLink key={to} to={to} end={end} onClick={() => setMenuOpen(false)}>
        <Icon size={18} aria-hidden="true" />
        <span>{label}</span>
      </NavLink>
    ));
  }
  return (
    <div className="app-layout">
      <a className="skip-link" href="#main-content">
        Перейти к содержимому
      </a>
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <Brand />
          <span className="product-tag">РАБОТА В ОДНОМ МЕСТЕ</span>
        </div>
        <nav className="sidebar-navigation" aria-label="Основная навигация">
          <p className="nav-group-label">Мой кабинет</p>
          {navigation(personalLinks)}
          {user.role !== "employee" && (
            <>
              <p className="nav-group-label">
                {user.role === "hr" ? "Работа HR" : "Моя команда"}
              </p>
              {navigation(teamLinks)}
            </>
          )}
          {user.role === "hr" && (
            <>
              <p className="nav-group-label">Управление</p>
              {navigation(hrLinks)}
            </>
          )}
        </nav>
        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <ShieldCheck size={18} aria-hidden="true" />
            <p>
              Вы видите данные
              <br />в своей области доступа.
            </p>
          </div>
          <NavLink className="sidebar-profile" to="/profile">
            <span className="avatar">
              {(employee?.full_name ?? user.username).slice(0, 1)}
            </span>
            <span>
              <strong>{employee?.full_name ?? user.username}</strong>
              <small>{roleText(user.role)}</small>
            </span>
            <ChevronRight size={15} aria-hidden="true" />
          </NavLink>
          <Button
            variant="ghost"
            disabled={mutations > 0}
            loading={logout.isPending}
            onClick={() => logout.mutate()}
            iconStart={<LogOut size={16} aria-hidden="true" />}
          >
            Выйти из кабинета
          </Button>
          <ErrorNotice error={logout.error} />
        </div>
      </aside>
      <div className="app-main">
        <header className="app-topbar">
          <div className="mobile-brand">
            <Brand />
          </div>
          <div className="topbar-context">
            <span className="context-dot" />
            {employee?.legal_entity.name ?? "JanaMen"}
          </div>
          <div className="topbar-actions">
            <span className="environment-label">Демо</span>
            <NavLink
              className="topbar-link"
              to="/notifications"
              aria-label="Уведомления"
            >
              <Bell size={19} aria-hidden="true" />
            </NavLink>
            <NavLink
              className="topbar-link"
              to="/profile"
              aria-label="Мой профиль"
            >
              <UserRound size={19} aria-hidden="true" />
            </NavLink>
            <Button
              className="mobile-menu-button"
              variant="ghost"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-expanded={menuOpen}
              aria-controls="mobile-navigation"
              aria-label={menuOpen ? "Закрыть навигацию" : "Открыть навигацию"}
            >
              {menuOpen ? (
                <X aria-hidden="true" />
              ) : (
                <Menu aria-hidden="true" />
              )}
            </Button>
          </div>
        </header>
        {menuOpen && (
          <nav
            id="mobile-navigation"
            className="mobile-navigation"
            aria-label="Навигация на узком экране"
          >
            {navigation(personalLinks)}
            {user.role !== "employee" && navigation(teamLinks)}
            {user.role === "hr" && navigation(hrLinks)}
            <Button
              variant="secondary"
              disabled={mutations > 0}
              loading={logout.isPending}
              onClick={() => logout.mutate()}
            >
              Выйти
            </Button>
          </nav>
        )}
        <main
          id="main-content"
          tabIndex={-1}
          ref={main}
          className="page-content"
        >
          <Suspense fallback={<LoadingState />}>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/notifications" element={<NotificationsPage />} />
              <Route path="/assistant" element={<AssistantPage />} />
              <Route path="/assistant/answers/:id" element={<AnswerPage />} />
              <Route path="/knowledge" element={<DocumentsPage />} />
              <Route
                path="/knowledge/documents/:id"
                element={<DocumentPage />}
              />
              <Route
                path="/knowledge/citations/:id"
                element={<CitationPage />}
              />
              <Route path="/knowledge/cases" element={<CasesPage />} />
              <Route path="/knowledge/cases/:id" element={<CasePage />} />
              <Route
                path="/knowledge/cases/:id/source"
                element={<CaseSourcePage />}
              />
              <Route
                path="/hr/policies"
                element={
                  <RoleGate roles={["hr"]}>
                    <ManagePoliciesPage />
                  </RoleGate>
                }
              />
              <Route
                path="/hr/policies/new"
                element={
                  <RoleGate roles={["hr"]}>
                    <PolicyEditorPage />
                  </RoleGate>
                }
              />
              <Route
                path="/hr/policies/:id"
                element={
                  <RoleGate roles={["hr"]}>
                    <PolicyEditorPage />
                  </RoleGate>
                }
              />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/requests" element={<RequestsPage />} />
              <Route path="/requests/new" element={<RequestCreatePage />} />
              <Route path="/requests/:id" element={<RequestDetailPage />} />
              <Route
                path="/team/requests"
                element={
                  <RoleGate roles={["manager", "hr"]}>
                    <RequestQueuePage />
                  </RoleGate>
                }
              />
              <Route
                path="/team"
                element={
                  <RoleGate roles={["manager", "hr"]}>
                    <TeamPage />
                  </RoleGate>
                }
              />
              <Route
                path="/team/:id"
                element={
                  <RoleGate roles={["manager", "hr"]}>
                    <EmployeePage />
                  </RoleGate>
                }
              />
              <Route
                path="/team/learning"
                element={
                  <RoleGate roles={["manager", "hr"]}>
                    <TeamLearningPage />
                  </RoleGate>
                }
              />
              <Route path="/academy" element={<AcademyPage />} />
              <Route path="/academy/catalog" element={<CatalogPage />} />
              <Route path="/academy/courses/:id" element={<CoursePage />} />
              <Route
                path="/academy/enrollments/:id"
                element={<LearningPage />}
              />
              <Route
                path="/academy/enrollments/:id/quiz"
                element={<QuizPage />}
              />
              <Route path="/academy/attempts/:id" element={<AttemptPage />} />
              <Route
                path="/academy/history"
                element={<LearningHistoryPage />}
              />
              <Route
                path="/hr/courses"
                element={
                  <RoleGate roles={["hr"]}>
                    <ManageCoursesPage />
                  </RoleGate>
                }
              />
              <Route
                path="/hr/courses/new"
                element={
                  <RoleGate roles={["hr"]}>
                    <CourseEditorPage />
                  </RoleGate>
                }
              />
              <Route
                path="/hr/courses/:id"
                element={
                  <RoleGate roles={["hr"]}>
                    <CourseEditorPage />
                  </RoleGate>
                }
              />
              <Route
                path="/hr/assignments"
                element={
                  <RoleGate roles={["hr"]}>
                    <AssignLearningPage />
                  </RoleGate>
                }
              />
              <Route
                path="/hr/integrations"
                element={
                  <RoleGate roles={["hr"]}>
                    <IntegrationsPage />
                  </RoleGate>
                }
              />
              <Route
                path="/hr/integrations/exports/:id"
                element={
                  <RoleGate roles={["hr"]}>
                    <ExportPage />
                  </RoleGate>
                }
              />
              <Route path="*" element={<NotFoundPage />} />
            </Routes>
          </Suspense>
        </main>
        <footer className="app-footer">
          <span>JanaMen</span>
          <span>Рабочие вопросы. Понятные шаги.</span>
          <span>Демонстрационные данные</span>
          <a
            href="https://github.com/Yerlan110110/Jana"
            target="_blank"
            rel="noopener noreferrer"
          >
            Исходный код
          </a>
        </footer>
      </div>
    </div>
  );
}

export function RoleGate({
  roles,
  children,
}: {
  roles: Array<"employee" | "manager" | "hr">;
  children: ReactNode;
}) {
  const { user } = useSession();
  return roles.includes(user.role) ? (
    children
  ) : (
    <EmptyState
      title="Раздел недоступен вашей роли"
      description="Откройте личный кабинет или обратитесь к HR."
      action={<ActionLink to="/">На главную</ActionLink>}
    />
  );
}

function NotFoundPage() {
  return (
    <EmptyState
      title="Страница не найдена"
      description="Проверьте ссылку или перейдите к своим рабочим задачам."
      action={<ActionLink to="/">На главную</ActionLink>}
    />
  );
}
