import type { PanelMode } from "./app-routing";
import type { Locale } from "./i18n";
import type { ImageAttachment } from "./types";

export type { PanelMode, Locale, ImageAttachment };

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
  target: VersionUpgradeTarget;
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
