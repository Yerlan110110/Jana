import { writeFile } from "node:fs/promises";
import type { Browser } from "@e2e-dev/web";

export async function captureNativeViewport(browser: Browser, path: string) {
  const endpoint = new URL(process.env.JANAMEN_ZOOM_CDP ?? "");
  if (endpoint.protocol !== "http:" || endpoint.hostname !== "127.0.0.1") {
    throw new Error("Native screenshots require the owned loopback Chrome");
  }
  const hasPassword = await browser.evaluate(() => Array.from(document.querySelectorAll<HTMLInputElement>('input[type="password"]')).some(input => input.value.length > 0));
  if (hasPassword) throw new Error("Native screenshots refuse populated password fields");
  const url = await browser.url();
  const pages: unknown = await fetch(new URL("/json/list", endpoint), { redirect: "error" }).then(response => response.json());
  if (!Array.isArray(pages)) throw new Error("Chrome target list is invalid");
  const matching = pages.filter((page: unknown) => typeof page === "object" && page !== null && "url" in page && page.url === url);
  if (matching.length !== 1) throw new Error("Expected exactly one test-owned page");
  const page: unknown = matching[0];
  if (typeof page !== "object" || page === null || !("webSocketDebuggerUrl" in page) || typeof page.webSocketDebuggerUrl !== "string") {
    throw new Error("The test-owned page has no debugger endpoint");
  }
  const debuggerUrl = new URL(page.webSocketDebuggerUrl);
  if (debuggerUrl.protocol !== "ws:" || debuggerUrl.host !== endpoint.host) throw new Error("Chrome debugger changed origin");
  const socket = new WebSocket(debuggerUrl);
  const data = await new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => { socket.close(); reject(new Error("Native screenshot timed out")); }, 10_000);
    const finish = (error: Error | null, value = "") => {
      clearTimeout(timeout);
      socket.close();
      if (error) reject(error);
      else resolve(value);
    };
    socket.onerror = () => finish(new Error("Native screenshot connection failed"));
    socket.onopen = () => socket.send(JSON.stringify({
      id: 1, method: "Page.captureScreenshot",
      params: { format: "png", fromSurface: true, captureBeyondViewport: false },
    }));
    socket.onmessage = event => {
      try {
        const message: unknown = JSON.parse(String(event.data));
        if (typeof message !== "object" || message === null || !("id" in message) || message.id !== 1) return;
        if (!("result" in message) || typeof message.result !== "object" || message.result === null || !("data" in message.result) || typeof message.result.data !== "string") {
          finish(new Error("Chrome returned no screenshot"));
          return;
        }
        finish(null, message.result.data);
      } catch {
        finish(new Error("Chrome returned invalid screenshot data"));
      }
    };
  });
  const bytes = Buffer.from(data, "base64");
  if (!bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) throw new Error("Chrome returned no PNG");
  const pixels = { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
  const viewport = await browser.evaluate(() => ({ width: outerWidth, height: innerHeight, dpr: devicePixelRatio }));
  if (pixels.width !== viewport.width || pixels.height < viewport.height * viewport.dpr || pixels.height >= (viewport.height + 1) * viewport.dpr) {
    throw new Error("Native screenshot dimensions do not cover the actual viewport");
  }
  await writeFile(path, bytes, { flag: "wx" });
  return { screenshot: path, pixels };
}
