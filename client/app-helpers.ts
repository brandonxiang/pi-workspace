import type { StreamEvent } from "./types";
import type { QueuedComposerMessage, ThinkingLevel } from "./app-types";
import {
  FOLLOW_UP_QUEUES_STORAGE_KEY,
  PANEL_MODE_SHORTCUT_KEYS,
  SIDEBAR_SHORTCUT_KEY,
  THINKING_LEVEL_STORAGE_KEY,
} from "./app-constants";

export function readStoredThinkingLevel(): ThinkingLevel {
  try {
    return (localStorage.getItem(THINKING_LEVEL_STORAGE_KEY) as ThinkingLevel | null) || "high";
  } catch {
    return "high";
  }
}

export function getImageDataUrl(image: { mimeType: string; data: string }) {
  return `data:${image.mimeType};base64,${image.data}`;
}

export function getModelKey(provider: string, model: string) {
  return `${provider}:${model}`;
}

export function parseModelKey(modelKey: string) {
  const separatorIndex = modelKey.indexOf(":");
  if (separatorIndex === -1) return { provider: "openai", model: "gpt-4o-mini" };
  return {
    provider: modelKey.slice(0, separatorIndex),
    model: modelKey.slice(separatorIndex + 1),
  };
}

export function isSidebarToggleShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
) {
  return (
    event.key.toLowerCase() === SIDEBAR_SHORTCUT_KEY &&
    !event.altKey &&
    !event.shiftKey &&
    (event.metaKey || event.ctrlKey)
  );
}

export function isPanelModeShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey" | "altKey" | "shiftKey">,
) {
  return (
    PANEL_MODE_SHORTCUT_KEYS.includes(event.key.toLowerCase()) &&
    !event.altKey &&
    !event.shiftKey &&
    (event.metaKey || event.ctrlKey)
  );
}

export function hasOpenDialog() {
  return Boolean(document.querySelector('[role="dialog"], .ant-modal-root'));
}

export function isSteeringSubmitShortcut(
  event: Pick<KeyboardEvent, "key" | "metaKey" | "ctrlKey">,
) {
  return event.key === "Enter" && (event.metaKey || event.ctrlKey);
}

export function getWorkspaceName(cwd: string) {
  const normalized = cwd.replace(/\/$/, "");
  if (!normalized) return "workspace";
  const parts = normalized.split("/");
  return parts[parts.length - 1] || "workspace";
}

export function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

export function readStoredFollowUpQueues(): Record<string, QueuedComposerMessage[]> {
  try {
    const raw = localStorage.getItem(FOLLOW_UP_QUEUES_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, QueuedComposerMessage[]>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function readStoredFollowUpsForSession(sessionId: string): QueuedComposerMessage[] {
  return readStoredFollowUpQueues()[sessionId] ?? [];
}

export function writeStoredFollowUpsForSession(sessionId: string, queue: QueuedComposerMessage[]) {
  try {
    const nextQueues = readStoredFollowUpQueues();
    if (queue.length === 0) {
      delete nextQueues[sessionId];
    } else {
      nextQueues[sessionId] = queue;
    }
    localStorage.setItem(FOLLOW_UP_QUEUES_STORAGE_KEY, JSON.stringify(nextQueues));
  } catch {
    // Ignore storage failures and keep queue state in memory.
  }
}

export async function readEventStream(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.body) throw new Error("No response stream returned.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const line = chunk.split("\n").find((item) => item.startsWith("data: "));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(6)) as StreamEvent);
    }
  }
}
