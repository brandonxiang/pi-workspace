import type { PanelMode } from "../router/index";
import type { Locale } from "../i18n/index";

export type ImageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
};

export type UserMessage = {
  role: "user";
  content: string;
  images?: ImageAttachment[];
  timestamp: number;
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
  provider: string;
  model: string;
  timestamp: number;
};

export type ChatMessage = UserMessage | AssistantMessage;

export type StreamEvent =
  | { type: "delta"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "tool_start"; toolName: string; toolCallId: string; args?: string }
  | { type: "tool_delta"; toolName: string; toolCallId: string; delta: string }
  | { type: "tool_end"; toolName: string; toolCallId: string; content: string; isError: boolean }
  | { type: "done"; message: AssistantMessage }
  | { type: "error"; message?: AssistantMessage; error: string };

/* ───── Pi session types ───── */

export type SessionStatus = "initializing" | "in_progress" | "pending_review" | "completed";

export interface PiSessionSummary {
  id: string;
  name?: string;
  firstMessage: string;
  messageCount: number;
  created: string;
  modified: string;
  status: SessionStatus;
}

export interface PiSessionProject {
  name: string;
  path: string;
  sessions: PiSessionSummary[];
}

export interface PiSessionsResponse {
  projects: PiSessionProject[];
}

export interface PiHistoryImage {
  id: string;
  name: string;
  mimeType: string;
  data: string;
}

export type PiHistoryMessage =
  | {
      id: string;
      role: "user";
      content: string;
      images?: PiHistoryImage[];
      timestamp: number;
    }
  | {
      id: string;
      role: "steering";
      content: string;
      timestamp: number;
    }
  | {
      id: string;
      role: "assistant";
      content: string;
      provider?: string;
      model?: string;
      timestamp: number;
    }
  | {
      id: string;
      role: "thinking";
      content: string;
      timestamp: number;
    }
  | {
      id: string;
      role: "tool";
      toolName: string;
      content: string;
      isError: boolean;
      expandable: true;
      timestamp: number;
    }
  | {
      id: string;
      role: "local_result";
      title: string;
      content: string;
      status: "success" | "info" | "error";
      timestamp: number;
    }
  | {
      id: string;
      role: "summary";
      summaryType: "compaction" | "branch" | "custom";
      title: string;
      content: string;
      timestamp: number;
    };

export interface PiSessionDetail {
  id: string;
  name: string;
  cwd: string;
  projectName: string;
  created: string;
  modified: string;
}

export interface PiSessionDetailResponse {
  session: PiSessionDetail;
  messages: PiHistoryMessage[];
}

export interface ContextUsage {
  tokens: number | null;
  contextWindow: number;
  percent: number | null;
}

export type PiPluginCommandSource = "extension" | "prompt" | "skill";
export type PiPluginScope = "user" | "project" | "temporary";
export type PiPluginOrigin = "package" | "top-level";

export interface PiPluginCommand {
  name: string;
  description?: string;
  source: PiPluginCommandSource;
  scope: PiPluginScope;
  origin: PiPluginOrigin;
  path?: string;
  packageSource?: string;
}

export interface PiPluginSummary {
  source: string;
  scope: Exclude<PiPluginScope, "temporary">;
  sourceType: "npm" | "git" | "local path";
  status: "installed" | "missing" | "error";
  filtered: boolean;
  installedPath?: string;
  resources: {
    extensions: number;
    skills: number;
    prompts: number;
    themes: number;
  };
  diagnostics: string[];
}

export interface SkillItem {
  name: string;
  description: string;
  disableModelInvocation: boolean;
  scope: "user" | "project" | "temporary";
  origin: "package" | "top-level";
  baseDir: string | undefined;
  path: string;
}

export interface PiPluginDiagnostic {
  type: "warning" | "error" | "collision";
  message: string;
  path?: string;
  packageSource?: string;
}

export interface PiPluginsResponse {
  plugins: PiPluginSummary[];
  commands: PiPluginCommand[];
  diagnostics: PiPluginDiagnostic[];
  actionToken?: string;
}

/* ───── App types (from app-types.ts) ───── */

export type SlashSuggestionInfo = { query: string };

export type LocalResultStatus = "success" | "info" | "error";

export type LocalActionResult = {
  title: string;
  content: string;
  status: LocalResultStatus;
  updatedSessionName?: string;
  refreshProjects?: boolean;
  refreshSessionDetail?: boolean;
};

export type VersionStatus = {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  error?: string;
};

export type VersionsResponse = {
  pi: VersionStatus;
  piWorkspace: VersionStatus;
  actionToken: string;
};

export type VersionUpgradeTarget = "pi" | "pi-workspace";

export type InteractiveSudoUpgrade = {
  target: VersionUpgradeTarget | "extensions";
  command: string;
};

export type ActivePanelView = { kind: "empty" } | { kind: "pi"; sessionId: string };

export type LauncherMode = "new" | "select" | null;

export type ThinkingLevel = "off" | "minimal" | "low" | "medium" | "high" | "xhigh";

export type SettingsDraft = {
  modelKey: string;
  panelMode: PanelMode;
  systemPrompt: string;
  locale: Locale;
  thinkingLevel: ThinkingLevel;
};

export type QueuedComposerMessage = {
  id: string;
  content: string;
  image?: ImageAttachment;
};

export type ComposerSubmitMode = "default" | "steering";

export type HistoryWriteMode = "push" | "replace" | "skip";
