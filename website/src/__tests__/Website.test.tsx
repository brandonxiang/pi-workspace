import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Website } from "../Website";
import { LOCALE_STORAGE_KEY } from "../locale";

describe("Website", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    history.replaceState(null, "", "/");
    localStorage.clear();
    Object.defineProperty(navigator, "language", {
      configurable: true,
      value: "en-US",
    });
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    localStorage.clear();
  });

  it("renders every required website section with one page heading", async () => {
    await act(async () => root.render(<Website />));

    expect(container.querySelectorAll("h1")).toHaveLength(1);
    expect(container.querySelector("main")).not.toBeNull();
    expect(container.querySelector("#features")).not.toBeNull();
    expect(container.querySelector("#workflow")).not.toBeNull();
    expect(container.querySelector("#open-source")).not.toBeNull();
    expect(container.querySelectorAll("[data-capability]")).toHaveLength(3);
    expect(container.textContent).toContain(
      "curl -fsSL https://pi-workspace.brandonxiang.top/install.sh",
    );
  });

  it("opens the comparison tab and returns to a landing page section", async () => {
    await act(async () => root.render(<Website />));

    async function navigate(link: HTMLAnchorElement | null) {
      expect(link).not.toBeNull();
      await act(async () => {
        const changed = new Promise<void>((resolve) => {
          window.addEventListener("hashchange", () => resolve(), { once: true });
        });
        link?.click();
        await changed;
      });
    }

    const about = container.querySelector<HTMLAnchorElement>('nav a[href="#compare"]');
    await navigate(about);

    expect(about?.getAttribute("aria-current")).toBe("page");
    expect(container.querySelector("main:not([hidden]) h1")?.textContent).toBe(
      "Visual coding tools for Pi",
    );
    expect(document.title).toContain("Visual coding tools for Pi");
    expect(
      Array.from(container.querySelectorAll("[data-tool] h3"), (tool) => tool.textContent),
    ).toEqual(["pi-workspace", "Pi Web", "Pi Desktop", "FrostPi"]);
    expect(container.querySelector('[data-tool="frostpi"] a')?.getAttribute("href")).toBe(
      "https://github.com/frostime/pi-vscode-ui",
    );

    await navigate(container.querySelector<HTMLAnchorElement>('#compare a[href="#workflow"]'));

    expect(location.hash).toBe("#workflow");
    expect(container.querySelector("main:not([hidden]) #workflow")).not.toBeNull();
    expect(about?.hasAttribute("aria-current")).toBe(false);
  });

  it("loads a direct comparison link and localizes it without leaving the tab", async () => {
    history.replaceState(null, "", "/#compare");
    await act(async () => root.render(<Website />));
    expect(container.querySelector("#compare h1")?.textContent).toBe("Visual coding tools for Pi");

    await act(async () =>
      container.querySelector<HTMLButtonElement>('[data-locale="zh"]')?.click(),
    );

    expect(location.hash).toBe("#compare");
    expect(container.querySelector("#compare h1")?.textContent).toBe("Pi 的可视化编程工具");
    expect(container.querySelector("#compare dt")?.textContent).toBe("优点");
  });

  it("switches to Chinese in place and persists the preference", async () => {
    await act(async () => root.render(<Website />));

    const chineseButton = container.querySelector<HTMLButtonElement>('[data-locale="zh"]');
    await act(async () => chineseButton?.click());

    expect(document.documentElement.lang).toBe("zh-CN");
    expect(document.title).toContain("把你的 Pi Sessions");
    expect(container.querySelector("h1")?.textContent).toContain("把你的 Pi Sessions");
    expect(localStorage.getItem(LOCALE_STORAGE_KEY)).toBe("zh");
  });
});
