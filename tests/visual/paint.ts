export function paint({ selector, property }: { selector: string; property: "color" | "borderTopColor" }) {
  return [...document.querySelectorAll(selector)].map((element) => {
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Browser cannot measure rendered colors");
    const ancestors = [];
    for (let node: Element | null = element; node; node = node.parentElement) {
      ancestors.unshift(node);
    }
    context.fillStyle = "white";
    context.fillRect(0, 0, 1, 1);
    for (const node of ancestors) {
      context.fillStyle = getComputedStyle(node).backgroundColor;
      context.fillRect(0, 0, 1, 1);
    }
    const background = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    context.fillStyle = getComputedStyle(element)[property];
    context.fillRect(0, 0, 1, 1);
    const foreground = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3);
    return { background, foreground, name: element.getAttribute("name") ?? element.tagName };
  });
}

export function contrast({ background, foreground }: ReturnType<typeof paint>[number]) {
  function luminance(rgb: number[]) {
    const channels = rgb.map((value) => {
      const linear = value / 255;
      return linear <= 0.04045 ? linear / 12.92 : ((linear + 0.055) / 1.055) ** 2.4;
    });
    return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
  }
  const first = luminance(background);
  const second = luminance(foreground);
  return (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
}
