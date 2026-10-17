import type axe from "axe-core";

declare global {
  interface Window {
    axe: typeof axe;
  }
}

export async function auditPage() {
  const result = await window.axe.run(document, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"] },
    rules: { "target-size": { enabled: true } },
  });
  const symbolicBrands = new Set(
    [...document.querySelectorAll('a.brand[aria-label="JanaMen, главная"]')].filter((brand) => {
      const mark = brand.querySelector(".brand-mark");
      return mark?.getAttribute("aria-hidden") === "true" &&
        mark.textContent?.trim() === "J" &&
        brand.textContent?.replace(/\s/g, "") === "JJanaMen";
    }),
  );
  function describe(items: typeof result.violations) {
    return items.map((item) => ({
      id: item.id,
      impact: item.impact ?? "unknown",
      nodes: item.nodes.map((node) => ({
        target: node.target.join(" "),
        reason: node.failureSummary ?? "",
      })),
    }));
  }
  const unresolved = result.violations.map((item) => ({
    ...item,
    nodes: item.nodes.filter((node) => {
      const selector = node.target.length === 1 ? node.target[0] : null;
      const element = typeof selector === "string" ? document.querySelector(selector) : null;
      return !(item.id === "label-content-name-mismatch" && element && symbolicBrands.has(element));
    }),
  })).filter((item) => item.nodes.length > 0);
  return {
    violations: describe(result.violations),
    unresolved: describe(unresolved),
    incomplete: describe(result.incomplete),
  };
}
