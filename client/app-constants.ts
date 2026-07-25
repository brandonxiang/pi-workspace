export const PANEL_MODE_STORAGE_KEY = "my-pi-panel-mode";
export const ACTIVE_SESSION_KEY = "my-pi-active-session-id";
export const ACTIVE_PI_PROJECT_KEY = "my-pi-active-pi-project-path";
export const FOLLOW_UP_QUEUES_STORAGE_KEY = "my-pi-follow-up-queues";
export const ARCHIVED_PI_SESSIONS_KEY = "my-pi-archived-pi-sessions";
export const THINKING_LEVEL_STORAGE_KEY = "my-pi-thinking-level";
export const SIDEBAR_SHORTCUT_KEY = "b";
export const PANEL_MODE_SHORTCUT_KEYS = ["'", "j"];

export const supportedImageMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
export const maxImageBytes = 5 * 1024 * 1024;

export const modelPresets = [
  { provider: "openai", model: "gpt-4o-mini", label: "OpenAI GPT-4o mini", supportsImages: true },
  { provider: "openai", model: "gpt-4.1-mini", label: "OpenAI GPT-4.1 mini", supportsImages: true },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku",
    supportsImages: true,
  },
  {
    provider: "google",
    model: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash",
    supportsImages: true,
  },
  {
    provider: "mistral",
    model: "mistral-small-latest",
    label: "Mistral Small",
    supportsImages: false,
  },
];

export type ModelOption = (typeof modelPresets)[number];

export const defaultSystemPrompt =
  "You are My Pi, an online agent conversation assistant. Be concise, practical, and explicit about assumptions.";
