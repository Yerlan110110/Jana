import type { Browser } from "@e2e-dev/web";

export async function focusedControl(browser: Browser) {
  return browser.evaluate(() => {
    const element = document.activeElement;
    if (!(element instanceof HTMLElement) || element === document.body || element === document.documentElement) return null;
    const path: string[] = [];
    let node: Element | null = element;
    while (node && node !== document.body) {
      if (node.id) { path.push(`#${CSS.escape(node.id)}`); break; }
      const position = node.parentElement
        ? Array.from(node.parentElement.children).filter(sibling => sibling.tagName === node?.tagName).indexOf(node) + 1
        : 1;
      path.push(`${node.tagName.toLowerCase()}:nth-of-type(${position})`);
      node = node.parentElement;
    }
    const style = getComputedStyle(element);
    const rectangle = element.getBoundingClientRect();
    const left = Math.max(0, rectangle.left);
    const right = Math.min(innerWidth, rectangle.right);
    const top = Math.max(0, rectangle.top);
    const bottom = Math.min(innerHeight, rectangle.bottom);
    const exposed = right > left && bottom > top && [0.2, 0.5, 0.8].some(x => [0.2, 0.5, 0.8].some(y => {
      const hit = document.elementFromPoint(left + (right - left) * x, top + (bottom - top) * y);
      return hit === element || (hit !== null && element.contains(hit));
    }));
    const labels = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement
      ? Array.from(element.labels ?? []).map(label => label.textContent ?? "").join(" ")
      : element.textContent ?? "";
    return {
      path: path.reverse().join(" > "),
      labelHint: (element.getAttribute("aria-label") ?? labels).replace(/\s+/g, " ").trim().slice(0, 160),
      tag: element.tagName,
      name: element.getAttribute("name"),
      focusVisible: element.matches(":focus-visible"),
      focusWithin: element.matches(":focus-within"),
      inputType: element instanceof HTMLInputElement ? element.type : null,
      exposed,
      outline: style.outlineStyle,
      outlineWidth: Number.parseFloat(style.outlineWidth),
      outlineColor: style.outlineColor,
      rectangle: { x: rectangle.x, y: rectangle.y, width: rectangle.width, height: rectangle.height },
    };
  });
}

export async function tabTo(browser: Browser, labelHint: string) {
  for (let index = 0; index < 120; index += 1) {
    await browser.keyboard.press("Tab");
    const focus = await focusedControl(browser);
    if (focus?.labelHint === labelHint) return focus;
  }
  throw new Error(`Tab did not reach ${labelHint}`);
}

export async function tabCycle(browser: Browser) {
  const stops: NonNullable<Awaited<ReturnType<typeof focusedControl>>>[] = [];
  let first: string | null = null;
  for (let index = 0; index < 400; index += 1) {
    await browser.keyboard.press("Tab");
    const focus = await focusedControl(browser);
    if (!focus) continue;
    if (focus.path === first) return stops;
    first ??= focus.path;
    stops.push(focus);
  }
  throw new Error("Tab navigation did not complete a cycle within 400 steps");
}
