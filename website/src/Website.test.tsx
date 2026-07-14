import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { Website } from "./Website";
import { LOCALE_STORAGE_KEY } from "./locale";

describe("Website", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
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
    expect(container.textContent).toContain("npm exec -- pi-workspace");
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
