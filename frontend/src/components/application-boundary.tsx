import { Component, type ReactNode } from "react";

export class ApplicationBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <main className="fatal-error">
          <h1>Страница не открылась</h1>
          <p>Обновите страницу. Подтверждённые сервером изменения сохранены.</p>
          <a className="text-link" href="/">
            Открыть главную
          </a>
        </main>
      );
    return this.props.children;
  }
}
