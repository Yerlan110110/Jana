import { EmptyState } from "@/components/ui";
import { type Model } from "@/lib/api";
import { Link } from "react-router";

export function HrOnly() {
  return (
    <EmptyState
      title="Управление доступно HR"
      description="Учебные материалы, публикации и назначения доступны HR в разрешённом юридическом лице."
      action={
        <Link className="text-link" to="/academy">
          К моему обучению
        </Link>
      }
    />
  );
}

export type Draft = Model<"CourseDraftRequest">;

export const emptyDraft: Draft = {
  title: "",
  title_kk: "",
  summary: "",
  summary_kk: "",
  category: "hr",
  content_language: "ru",
  passing_percent: 80,
  max_attempts: 3,
  estimated_minutes: null,
  lessons: [],
  questions: [],
};

export function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = [...items];
  const target = index + direction;
  if (target < 0 || target >= next.length) return next;
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
