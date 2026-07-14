import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { InstallCommand } from "./InstallCommand";

describe("InstallCommand", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it("copies the command and announces success", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    await act(async () => {
      root.render(
        <InstallCommand
          command="npm exec -- pi-workspace"
          copyLabel="Copy command"
          copiedLabel="Copied"
          failedLabel="Copy manually"
        />,
      );
    });

    const button = container.querySelector("button");
    await act(async () => button?.click());

    expect(writeText).toHaveBeenCalledWith("npm exec -- pi-workspace");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Copied");
  });

  it("keeps the command selectable and announces clipboard failure", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    await act(async () => {
      root.render(
        <InstallCommand
          command="npm exec -- pi-workspace"
          copyLabel="Copy command"
          copiedLabel="Copied"
          failedLabel="Copy manually"
        />,
      );
    });

    await act(async () => container.querySelector("button")?.click());

    expect(container.querySelector("code")?.textContent).toBe("npm exec -- pi-workspace");
    expect(container.querySelector('[role="status"]')?.textContent).toBe("Copy manually");
  });
});
