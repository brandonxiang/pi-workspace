import {
  Suspense,
  lazy,
  useCallback,
  type ChangeEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import XProvider from "@ant-design/x/es/x-provider";
import type { BubbleItemType } from "@ant-design/x/es/bubble";
import { createTranslator, LOCALE_STORAGE_KEY, readStoredLocale, type Locale } from "./i18n/index";
import type { PluginSlashCommand } from "../shared/slash-commands.js";
import type {
  ActivePanelView,
  ContextUsage,
  HistoryWriteMode,
  InteractiveSudoUpgrade,
  LauncherMode,
  PiHistoryMessage,
  PiPluginCommand,
  PiSessionDetailResponse,
  PiSessionProject,
  SessionStatus,
  SettingsDraft,
} from "./types/index";
import { filterProjectsByArchiveState } from "./components/PiSessionSection";
import {
  findProjectBySessionId,
  getNewestProjectSessionId,
  resolveInitialPiSessionSelection,
} from "./api/pi-session-launch";
import {
  buildHomeUrl,
  buildPiSessionUrl,
  buildSettingsUrl,
  parseAppRoute,
  resolvePanelMode,
  type AppRoute,
  type PanelMode,
} from "./router/index";
import { groupPiHistoryMessages } from "./services/pi-session-transcript";
import {
  createPiSessionDetailCache,
  getCachedPiSessionDetailForSelection,
} from "./api/pi-session-detail-cache";
import {
  defaultSystemPrompt,
  modelPresets,
  PANEL_MODE_STORAGE_KEY,
  ACTIVE_SESSION_KEY,
  ACTIVE_PI_PROJECT_KEY,
  ARCHIVED_PI_SESSIONS_KEY,
  THINKING_LEVEL_STORAGE_KEY,
  type ModelOption,
} from "./constants/index";
import {
  getModelKey,
  getWorkspaceName,
  hasOpenDialog,
  isPanelModeShortcut,
  isSidebarToggleShortcut,
  parseModelKey,
  readStoredThinkingLevel,
  toPluginSlashCommand,
} from "./utils/index";
import { createPiHistoryBubbleItem } from "./components/pi/PiHistoryContent";
import { SettingsPage } from "./components/settings/SettingsPage";
import { IconChevronRight } from "./components/icon/index";
import { Modals } from "./components/modals/Modals";
import { bubbleRoles, xTheme } from "./components/chat/bubble-config";
import { Composer } from "./components/chat/Composer";
import { ChatMessages } from "./components/chat/ChatMessages";
import { LauncherActions } from "./components/chat/LauncherActions";
import { ChatHeader } from "./components/layout/ChatHeader";
import { ContextUsageBar } from "./components/layout/ContextUsageBar";
import { Sidebar } from "./components/layout/Sidebar";
import { useSkillLibrary } from "./hooks/useSkillLibrary";
import { usePiPlugins } from "./hooks/usePiPlugins";
import { useVersionManager } from "./hooks/useVersionManager";
import { usePiConversation } from "./hooks/usePiConversation";

const TerminalPanel = lazy(async () => {
  const module = await import("./components/TerminalPanel");
  return { default: module.TerminalPanel };
});

export default function App() {
  const [locale, setLocale] = useState<Locale>(() => readStoredLocale());
  const t = useMemo(() => createTranslator(locale), [locale]);
  const [interactiveSudoUpgrade, setInteractiveSudoUpgrade] =
    useState<InteractiveSudoUpgrade | null>(null);

  const { skills, skillsLoading, skillsReloading, skillsError, loadSkills } = useSkillLibrary();
  const {
    piPlugins,
    piPluginsLoading,
    piPluginsReloading,
    piPluginsError,
    piPluginsUpdating,
    piPluginsUpdateError,
    piPluginsUpdateNotice,
    loadPiPlugins,
    updatePiPluginsInSettings,
  } = usePiPlugins({ t, onInteractiveSudo: setInteractiveSudoUpgrade });
  const {
    versions,
    versionsLoading,
    versionError,
    versionNotice,
    versionUpgradeTarget,
    versionUpgradeRunning,
    setVersionUpgradeTarget,
    loadVersions,
    confirmVersionUpgrade,
  } = useVersionManager({ t, onInteractiveSudo: setInteractiveSudoUpgrade });

  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [modelKey, setModelKey] = useState(() => {
    try {
      return localStorage.getItem("my-pi-model") || "openai:gpt-4o-mini";
    } catch {
      return "openai:gpt-4o-mini";
    }
  });
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(modelPresets);
  const [panelMode, setPanelMode] = useState<PanelMode>(() => {
    let storedPanel: string | null = null;
    try {
      storedPanel = localStorage.getItem(PANEL_MODE_STORAGE_KEY);
    } catch {}

    if (typeof window === "undefined") {
      return resolvePanelMode(null, storedPanel);
    }

    return resolvePanelMode(parseAppRoute(new URL(window.location.href)).panel, storedPanel);
  });
  const [routeKind, setRouteKind] = useState<AppRoute["kind"]>(() => {
    if (typeof window === "undefined") return "home";
    return parseAppRoute(new URL(window.location.href)).kind;
  });
  const [isHotkeysOpen, setIsHotkeysOpen] = useState(false);
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState<SettingsDraft>({
    modelKey,
    panelMode,
    systemPrompt,
    locale,
    thinkingLevel: readStoredThinkingLevel(),
  });
  const [renameDraft, setRenameDraft] = useState("");
  const [archivedPiSessionIds, setArchivedPiSessionIds] = useState<Set<string>>(() => {
    try {
      const raw = localStorage.getItem(ARCHIVED_PI_SESSIONS_KEY);
      return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
    } catch {
      return new Set();
    }
  });
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [serverCwd, setServerCwd] = useState("");
  const [projects, setProjects] = useState<PiSessionProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [activePanelView, setActivePanelView] = useState<ActivePanelView>({ kind: "empty" });
  const [piSessionDetail, setPiSessionDetail] = useState<PiSessionDetailResponse | null>(null);
  const [piLocalMessages, setPiLocalMessages] = useState<PiHistoryMessage[]>([]);
  const [piPendingMessages, setPiPendingMessages] = useState<PiHistoryMessage[]>([]);
  const [piSessionError, setPiSessionError] = useState<string | null>(null);
  const [piSessionLoading, setPiSessionLoading] = useState(false);
  const [launcherMode, setLauncherMode] = useState<LauncherMode>(null);
  const [newSessionQuery, setNewSessionQuery] = useState("");
  const [selectSessionQuery, setSelectSessionQuery] = useState("");
  const [launcherError, setLauncherError] = useState<string | null>(null);
  const [workspaceBrowseName, setWorkspaceBrowseName] = useState<string | null>(null);
  const [workspaceResolvedPath, setWorkspaceResolvedPath] = useState<string | null>(null);
  const [workspaceResolving, setWorkspaceResolving] = useState(false);
  const [scrollContainer, setScrollContainer] = useState<HTMLElement | null>(null);
  const [messagesEl, setMessagesEl] = useState<HTMLElement | null>(null);
  const [contextUsage, setContextUsage] = useState<ContextUsage | null>(null);
  const [pluginCommands, setPluginCommands] = useState<PluginSlashCommand[]>([]);

  const didHydrateSelectionRef = useRef(false);
  const piSessionRequestIdRef = useRef(0);
  const piSessionDetailCacheRef = useRef(createPiSessionDetailCache());
  const projectFileInputRef = useRef<HTMLInputElement>(null);
  const chatPanelRef = useRef<HTMLElement | null>(null);

  /** Patch a single session's status in the projects state without a full re-fetch. */
  function setSessionStatusInProjects(sessionId: string, status: SessionStatus) {
    setProjects((prev) =>
      prev.map((project) => ({
        ...project,
        sessions: project.sessions.map((session) =>
          session.id === sessionId ? { ...session, status } : session,
        ),
      })),
    );
  }

  const piHistoryMessages = piSessionDetail?.messages ?? [];
  const selectedPiSessionId = activePanelView.kind === "pi" ? activePanelView.sessionId : null;

  const terminalCwd = useMemo(() => {
    if (activePanelView.kind === "pi" && piSessionDetail) {
      return piSessionDetail.session.cwd;
    }
    return serverCwd || "";
  }, [activePanelView, piSessionDetail, serverCwd]);

  const terminalInitialCommand = useMemo(() => {
    if (activePanelView.kind === "pi") {
      return `pi --session ${activePanelView.sessionId}`;
    }
    return undefined;
  }, [activePanelView]);

  const selectedModel = useMemo(() => parseModelKey(modelKey), [modelKey]);
  const selectedModelOption = useMemo(() => {
    return modelOptions.find((option) => getModelKey(option.provider, option.model) === modelKey);
  }, [modelKey, modelOptions]);
  const selectedModelSupportsImages = selectedModelOption?.supportsImages ?? false;

  const {
    input,
    setInput,
    selectedImage,
    setSelectedImage,
    error,
    setError,
    draftError,
    isStreaming,
    queuedFollowUps,
    removeQueuedFollowUp,
    resetStreamingDraft,
    draftToolBubbleItems,
    thinkingBubbleItem,
    streamingAssistantBubbleItem,
    streamingErrorBubbleItem,
    submitMessage,
    handleSenderSubmit,
    handleSlashSelect,
    handleImageChange,
    handleImageFile,
  } = usePiConversation({
    t,
    panelMode,
    activePanelView,
    selectedModel,
    selectedModelSupportsImages,
    piHistoryMessages,
    piSessionDetailLoaded: Boolean(piSessionDetail),
    setPiSessionDetail,
    setPiLocalMessages,
    setPiPendingMessages,
    setSessionStatusInProjects,
    fetchContextUsage,
    refreshPiProjects,
    loadPiSessionDetail,
    openSettingsPage,
    openHotkeysModal,
  });

  const launcherWorkspaceName = getWorkspaceName(serverCwd);
  const filteredNewProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(newSessionQuery.trim().toLowerCase()),
  );
  const filteredSelectableProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(selectSessionQuery.trim().toLowerCase()),
  );
  const visibleSidebarProjects = useMemo(
    () => filterProjectsByArchiveState(projects, archivedPiSessionIds, "visible"),
    [projects, archivedPiSessionIds],
  );
  const archivedSettingsProjects = useMemo(
    () => filterProjectsByArchiveState(projects, archivedPiSessionIds, "archived"),
    [projects, archivedPiSessionIds],
  );
  const isMacLikePlatform = useMemo(() => {
    if (typeof navigator === "undefined") return true;
    return /Mac|iPhone|iPad|iPod/.test(navigator.platform);
  }, []);
  const sidebarShortcutLabel = isMacLikePlatform ? "⌘B" : "Ctrl+B";
  const panelModeShortcutLabel = isMacLikePlatform ? "⌘' / ⌘J" : "Ctrl+' / Ctrl+J";
  const isSettingsPage = routeKind === "settings";
  const isAnyModalOpen =
    isHotkeysOpen ||
    renameTargetId !== null ||
    launcherMode !== null ||
    versionUpgradeTarget !== null ||
    interactiveSudoUpgrade !== null;

  const piHistoryBubbleItems = useMemo<BubbleItemType[]>(() => {
    const items = groupPiHistoryMessages([
      ...piHistoryMessages,
      ...piLocalMessages,
      ...piPendingMessages,
    ]).map((entry, index) => createPiHistoryBubbleItem(entry, index, locale, t));
    if (
      !thinkingBubbleItem &&
      !streamingAssistantBubbleItem &&
      !streamingErrorBubbleItem &&
      draftToolBubbleItems.length === 0
    ) {
      return items;
    }

    return [
      ...items,
      ...draftToolBubbleItems,
      ...(thinkingBubbleItem ? [thinkingBubbleItem] : []),
      ...(streamingAssistantBubbleItem ? [streamingAssistantBubbleItem] : []),
      ...(streamingErrorBubbleItem ? [streamingErrorBubbleItem] : []),
    ];
  }, [
    draftToolBubbleItems,
    locale,
    piHistoryMessages,
    piLocalMessages,
    piPendingMessages,
    streamingAssistantBubbleItem,
    streamingErrorBubbleItem,
    t,
    thinkingBubbleItem,
  ]);

  const userBubbleCount = useMemo(
    () => piHistoryBubbleItems.filter((item) => item.role === "user").length,
    [piHistoryBubbleItems],
  );

  const userPreviews: string[] = useMemo(() => {
    const allMessages = [...piHistoryMessages, ...piLocalMessages, ...piPendingMessages];
    return allMessages
      .filter((m): m is typeof m & { role: "user" } => m.role === "user")
      .map((m) => (m.content.length > 80 ? m.content.slice(0, 80) + "…" : m.content));
  }, [piHistoryMessages, piLocalMessages, piPendingMessages]);

  const panelTitle = selectedPiSessionId
    ? piSessionDetail?.session.name || t("chat.piSession")
    : t("launcher.title", { workspace: launcherWorkspaceName });
  const panelMeta =
    selectedPiSessionId && piSessionDetail
      ? `${piSessionDetail.session.projectName} · ${piSessionDetail.session.cwd}`
      : null;

  useEffect(() => {
    localStorage.setItem(PANEL_MODE_STORAGE_KEY, panelMode);
  }, [panelMode]);

  useEffect(() => {
    if (!isSettingsPage) return;
    void loadVersions();
  }, [isSettingsPage, loadVersions]);

  useEffect(() => {
    let cancelled = false;

    async function loadActiveSessionCommands() {
      setPluginCommands([]);
      if (!selectedPiSessionId) return;

      try {
        const response = await fetch(
          `/api/pi-sessions/${encodeURIComponent(selectedPiSessionId)}/commands`,
        );
        const body = (await response.json().catch(() => null)) as {
          commands?: PiPluginCommand[];
        } | null;
        if (!cancelled && response.ok) {
          setPluginCommands((body?.commands || []).map(toPluginSlashCommand));
        }
      } catch {
        if (!cancelled) setPluginCommands([]);
      }
    }

    void loadActiveSessionCommands();
    return () => {
      cancelled = true;
    };
  }, [selectedPiSessionId]);

  useEffect(() => {
    function focusMainPanel() {
      window.setTimeout(() => {
        chatPanelRef.current?.focus();
      }, 0);
    }

    function handleSidebarShortcut(event: KeyboardEvent) {
      if (!isSidebarToggleShortcut(event)) return;
      if (isAnyModalOpen || hasOpenDialog()) return;

      const activeElement = document.activeElement;
      const targetElement =
        event.target instanceof Element
          ? event.target
          : activeElement instanceof Element
            ? activeElement
            : null;

      if (targetElement?.closest(".terminal-panel")) {
        return;
      }

      const focusedInsideSidebar =
        activeElement instanceof HTMLElement && Boolean(activeElement.closest(".sidebar"));

      event.preventDefault();
      setSidebarCollapsed((current) => !current);

      if (!sidebarCollapsed && focusedInsideSidebar) {
        focusMainPanel();
      }
    }

    document.addEventListener("keydown", handleSidebarShortcut, true);
    return () => {
      document.removeEventListener("keydown", handleSidebarShortcut, true);
    };
  }, [isAnyModalOpen, sidebarCollapsed]);

  useEffect(() => {
    function handlePanelModeShortcut(event: KeyboardEvent) {
      if (!isPanelModeShortcut(event)) return;
      if (isAnyModalOpen || hasOpenDialog()) return;
      if (isSettingsPage) return;

      event.preventDefault();
      applyPanelMode(panelMode === "chat" ? "terminal" : "chat");
    }

    document.addEventListener("keydown", handlePanelModeShortcut, true);
    return () => {
      document.removeEventListener("keydown", handlePanelModeShortcut, true);
    };
  }, [isAnyModalOpen, isSettingsPage, panelMode]);

  useEffect(() => {
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    } catch {
      // Ignore storage errors and keep the current in-memory preference.
    }
    document.documentElement.lang = locale;
  }, [locale]);

  useEffect(() => {
    localStorage.setItem("my-pi-model", modelKey);
  }, [modelKey]);

  function persistSelectedPiSession(sessionId: string, projectPath: string | null) {
    localStorage.setItem(ACTIVE_SESSION_KEY, sessionId);
    if (projectPath) {
      localStorage.setItem(ACTIVE_PI_PROJECT_KEY, projectPath);
    } else {
      localStorage.removeItem(ACTIVE_PI_PROJECT_KEY);
    }
  }

  // Sync scroll container ref when messages element mounts
  useEffect(() => {
    if (!messagesEl) {
      setScrollContainer(null);
      return;
    }
    const el = messagesEl.querySelector<HTMLElement>(".ant-bubble-list-scroll-box");
    setScrollContainer(el);
  }, [messagesEl]);

  const handleMinimapNavigate = useCallback(
    (userIndex: number) => {
      if (!scrollContainer) return;
      const userBubbles = scrollContainer.querySelectorAll<HTMLElement>(
        ".ant-bubble-list-scroll-content > .chat-bubble-user",
      );
      const target = userBubbles[userIndex];
      if (!target) return;
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    },
    [scrollContainer],
  );

  function fetchContextUsage(sessionId: string) {
    fetch(`/api/sessions/${encodeURIComponent(sessionId)}/context-usage`)
      .then((res) => {
        if (!res.ok) return null;
        return res.json() as Promise<{ contextUsage: ContextUsage | null }>;
      })
      .then((data) => {
        setContextUsage(data?.contextUsage ?? null);
      })
      .catch(() => {
        setContextUsage(null);
      });
  }

  async function loadPiSessionDetail(sessionId: string): Promise<PiSessionDetailResponse> {
    const response = await fetch(`/api/pi-sessions/${encodeURIComponent(sessionId)}`);
    const body = (await response.json().catch(() => null)) as
      | PiSessionDetailResponse
      | { error?: string }
      | null;

    if (!response.ok) {
      throw new Error(
        body && "error" in body && body.error
          ? body.error
          : `Request failed with ${response.status}`,
      );
    }

    return body as PiSessionDetailResponse;
  }

  function createSettingsDraftFromState(nextPanelMode: PanelMode = panelMode): SettingsDraft {
    return {
      modelKey,
      panelMode: nextPanelMode,
      systemPrompt,
      locale,
      thinkingLevel: readStoredThinkingLevel(),
    };
  }

  function buildUrlForState(
    nextRouteKind: AppRoute["kind"],
    view: ActivePanelView,
    nextPanelMode: PanelMode,
  ) {
    if (nextRouteKind === "settings") {
      return buildSettingsUrl(nextPanelMode);
    }

    return view.kind === "pi"
      ? buildPiSessionUrl(view.sessionId, nextPanelMode)
      : buildHomeUrl(nextPanelMode);
  }

  function writeRouteForState(
    nextRouteKind: AppRoute["kind"],
    view: ActivePanelView,
    nextPanelMode: PanelMode,
    historyMode: HistoryWriteMode,
  ) {
    if (historyMode === "skip" || typeof window === "undefined") return;

    const nextUrl = buildUrlForState(nextRouteKind, view, nextPanelMode);
    const currentUrl = `${window.location.pathname}${window.location.search}`;
    if (currentUrl === nextUrl) return;

    if (historyMode === "replace") {
      window.history.replaceState({}, "", nextUrl);
      return;
    }

    window.history.pushState({}, "", nextUrl);
  }

  function applyPanelMode(nextPanelMode: PanelMode, historyMode: HistoryWriteMode = "push") {
    setPanelMode(nextPanelMode);
    writeRouteForState(routeKind, activePanelView, nextPanelMode, historyMode);
  }

  function clearSelectedPiSession(options?: {
    history?: HistoryWriteMode;
    routeKind?: AppRoute["kind"];
    panelMode?: PanelMode;
  }) {
    const nextRouteKind = options?.routeKind ?? "home";
    const nextPanelMode = options?.panelMode ?? panelMode;
    piSessionRequestIdRef.current += 1;
    setRouteKind(nextRouteKind);
    setActivePanelView({ kind: "empty" });
    setPiSessionDetail(null);
    setPiLocalMessages([]);
    setPiSessionLoading(false);
    setPiSessionError(null);
    setPiPendingMessages([]);
    resetStreamingDraft();
    setError(null);
    setContextUsage(null);
    writeRouteForState(nextRouteKind, { kind: "empty" }, nextPanelMode, options?.history ?? "push");
    localStorage.removeItem(ACTIVE_SESSION_KEY);
    localStorage.removeItem(ACTIVE_PI_PROJECT_KEY);
  }

  async function selectPiSession(
    sessionId: string,
    options?: { persist?: boolean; projectPath?: string | null; history?: HistoryWriteMode },
  ) {
    const cachedDetail = getCachedPiSessionDetailForSelection({
      currentDetail: piSessionDetail,
      cache: piSessionDetailCacheRef.current,
      sessionId,
    });
    const requestId = piSessionRequestIdRef.current + 1;
    piSessionRequestIdRef.current = requestId;
    setRouteKind("pi-session");
    setActivePanelView({ kind: "pi", sessionId });
    setPiSessionDetail(cachedDetail);
    setPiLocalMessages([]);
    setPiSessionLoading(true);
    setPiSessionError(null);
    setError(null);
    resetStreamingDraft();
    setPiPendingMessages([]);
    setContextUsage(null);
    writeRouteForState(
      "pi-session",
      { kind: "pi", sessionId },
      panelMode,
      options?.history ?? "push",
    );

    if (options?.persist !== false) {
      const projectPath =
        options?.projectPath ?? findProjectBySessionId(projects, sessionId)?.path ?? null;
      persistSelectedPiSession(sessionId, projectPath);
    }

    try {
      const detail = await loadPiSessionDetail(sessionId);
      if (piSessionRequestIdRef.current !== requestId) return;
      setPiSessionDetail(detail);
      fetchContextUsage(sessionId);
    } catch (err) {
      if (piSessionRequestIdRef.current !== requestId) return;
      setPiSessionError(err instanceof Error ? err.message : "Failed to load Pi session");
    } finally {
      if (piSessionRequestIdRef.current === requestId) {
        setPiSessionLoading(false);
      }
    }
  }

  async function refreshPiProjects(options?: { hydrateSelection?: boolean }) {
    setProjectsLoading(true);
    setProjectsError(null);

    try {
      const response = await fetch("/api/pi-sessions");
      if (!response.ok) {
        throw new Error(`Failed to load Pi sessions: ${response.status}`);
      }

      const body = (await response.json()) as { projects: PiSessionProject[] };
      setProjects(body.projects);

      if (options?.hydrateSelection && !didHydrateSelectionRef.current) {
        didHydrateSelectionRef.current = true;
        const route = parseAppRoute(
          typeof window !== "undefined"
            ? new URL(window.location.href)
            : new URL("http://localhost/"),
        );
        const storedSessionId = localStorage.getItem(ACTIVE_SESSION_KEY);
        const storedProjectPath = localStorage.getItem(ACTIVE_PI_PROJECT_KEY);
        if (route.kind === "pi-session") {
          await selectPiSession(route.sessionId, {
            persist: true,
            projectPath: findProjectBySessionId(body.projects, route.sessionId)?.path ?? null,
            history: "skip",
          });
        } else if (route.kind === "settings") {
          setSettingsDraft(createSettingsDraftFromState());
          clearSelectedPiSession({ history: "skip", routeKind: "settings" });
        } else {
          const initialSelection = resolveInitialPiSessionSelection({
            storedSessionId,
            storedProjectPath,
            projects: body.projects,
          });

          if (initialSelection.kind === "pi") {
            const projectPath =
              findProjectBySessionId(body.projects, initialSelection.sessionId)?.path ||
              storedProjectPath;
            await selectPiSession(initialSelection.sessionId, {
              persist: true,
              projectPath,
              history: "skip",
            });
          } else {
            clearSelectedPiSession({ history: "skip" });
          }
        }
      }
    } catch (err) {
      setProjectsError(err instanceof Error ? err.message : t("sidebar.piCliUnavailable"));
      if (options?.hydrateSelection && !didHydrateSelectionRef.current) {
        didHydrateSelectionRef.current = true;
        clearSelectedPiSession({
          history: "skip",
          routeKind: routeKind === "settings" ? "settings" : "home",
        });
      }
    } finally {
      setProjectsLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) return;
        const body = (await response.json()) as { models?: ModelOption[] };
        if (cancelled || !body.models?.length) return;

        setModelOptions(body.models);
        setModelKey((current) => {
          const currentExists = body.models?.some(
            (option) => `${option.provider}:${option.model}` === current,
          );
          return currentExists
            ? current
            : getModelKey(body.models![0].provider, body.models![0].model);
        });
      } catch {
        // Keep static presets when the model registry endpoint is unavailable.
      }
    }

    void loadSkills();
    void loadPiPlugins();
    void loadModels();
    fetch("/api/cwd")
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && data.cwd) {
          setServerCwd(data.cwd);
        }
      })
      .catch(() => {});
    void refreshPiProjects({ hydrateSelection: true });

    return () => {
      cancelled = true;
    };
  }, [loadPiPlugins]);

  useEffect(() => {
    if (piSessionDetail) {
      piSessionDetailCacheRef.current.set(piSessionDetail);
    }
  }, [piSessionDetail]);

  useEffect(() => {
    function handlePopState() {
      const route = parseAppRoute(new URL(window.location.href));
      const nextPanelMode = resolvePanelMode(
        route.panel,
        localStorage.getItem(PANEL_MODE_STORAGE_KEY),
      );

      applyPanelMode(nextPanelMode, "skip");

      if (route.kind === "pi-session") {
        if (activePanelView.kind === "pi" && activePanelView.sessionId === route.sessionId) {
          return;
        }

        void selectPiSession(route.sessionId, {
          persist: true,
          projectPath: findProjectBySessionId(projects, route.sessionId)?.path ?? null,
          history: "skip",
        });
        return;
      }

      if (route.kind === "settings") {
        setSettingsDraft(createSettingsDraftFromState(nextPanelMode));
        clearSelectedPiSession({
          history: "skip",
          routeKind: "settings",
          panelMode: nextPanelMode,
        });
        return;
      }

      clearSelectedPiSession({ history: "skip", panelMode: nextPanelMode });
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [activePanelView, isStreaming, panelMode, projects, routeKind]);

  function openNewSessionLauncher() {
    setLauncherMode("new");
    setNewSessionQuery("");
    setLauncherError(null);
    setWorkspaceBrowseName(null);
    setWorkspaceResolvedPath(null);
    setWorkspaceResolving(false);
  }

  function openSelectSessionLauncher() {
    setLauncherMode("select");
    setSelectSessionQuery("");
    setLauncherError(null);
  }

  function closeLauncher() {
    setLauncherMode(null);
    setLauncherError(null);
    setWorkspaceBrowseName(null);
    setWorkspaceResolvedPath(null);
    setWorkspaceResolving(false);
  }

  function openRenameModal(sessionId: string) {
    const piName =
      piSessionDetail && piSessionDetail.session.id === sessionId
        ? piSessionDetail.session.name
        : findProjectBySessionId(projects, sessionId)?.sessions.find(
            (session) => session.id === sessionId,
          )?.name;
    setRenameTargetId(sessionId);
    setRenameDraft(piName || "");
  }

  function closeRenameModal() {
    setRenameTargetId(null);
    setRenameDraft("");
  }

  async function confirmRename() {
    const targetId = renameTargetId;
    if (!targetId) return;

    const newName = renameDraft.trim() || t("session.untitled");

    if (
      piSessionDetail &&
      activePanelView.kind === "pi" &&
      activePanelView.sessionId === targetId
    ) {
      setPiSessionDetail({
        ...piSessionDetail,
        session: { ...piSessionDetail.session, name: newName },
      });
    }

    try {
      await fetch(`/api/sessions/${encodeURIComponent(targetId)}/name`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });
    } catch {
      // Keep optimistic UI update when rename persistence fails.
    }

    await refreshPiProjects();
    closeRenameModal();
  }

  function archivePiSession(sessionId: string) {
    setArchivedPiSessionIds((prev) => {
      const next = new Set(prev);
      next.add(sessionId);
      localStorage.setItem(ARCHIVED_PI_SESSIONS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  function restorePiSession(sessionId: string) {
    setArchivedPiSessionIds((prev) => {
      const next = new Set(prev);
      next.delete(sessionId);
      localStorage.setItem(ARCHIVED_PI_SESSIONS_KEY, JSON.stringify([...next]));
      return next;
    });
  }

  async function handleStatusChange(sessionId: string, status: SessionStatus) {
    try {
      const response = await fetch(`/api/pi-sessions/${encodeURIComponent(sessionId)}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        void refreshPiProjects();
      } else {
        const body = (await response.json()) as { error?: string };
        console.error("Failed to update session status:", body.error || response.statusText);
      }
    } catch (statusError) {
      console.error("Failed to update session status:", statusError);
    }
  }

  async function handleDeleteProject(projectPath: string) {
    const encodedPath = encodeURIComponent(projectPath);

    try {
      const response = await fetch(`/api/pi-sessions/${encodedPath}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed with ${response.status}`);
      }

      // Clear selection if it was in the deleted project
      if (selectedPiSessionId) {
        const deletedProject = projects.find((p) => p.path === projectPath);
        if (deletedProject?.sessions.some((s) => s.id === selectedPiSessionId)) {
          clearSelectedPiSession();
        }
      }

      await refreshPiProjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete project");
    }
  }

  async function handleRevealProject(projectPath: string) {
    try {
      const response = await fetch("/api/reveal-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: projectPath }),
      });

      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(body?.error || `Request failed with ${response.status}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reveal project");
    }
  }

  async function createPiSessionInProject(projectPath: string) {
    if (isStreaming) return;
    setLauncherError(null);

    try {
      const response = await fetch("/api/pi-sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cwd: projectPath }),
      });
      if (!response.ok) {
        const err = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(err?.error || `Request failed with ${response.status}`);
      }

      const body = (await response.json()) as { projects: PiSessionProject[] };
      setProjects(body.projects);
      const nextSessionId = getNewestProjectSessionId(body.projects, projectPath);
      closeLauncher();

      if (nextSessionId) {
        if (panelMode === "terminal") {
          window.open(buildPiSessionUrl(nextSessionId, "terminal"), "_blank");
          return;
        }
        await selectPiSession(nextSessionId, { projectPath });
      } else {
        clearSelectedPiSession();
      }
    } catch (err) {
      setLauncherError(err instanceof Error ? err.message : t("workspace.newPiSession"));
    }
  }

  function handleBrowseClick() {
    projectFileInputRef.current?.click();
  }

  async function handleBrowseChange(event: ChangeEvent<HTMLInputElement>) {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    const path = files[0].webkitRelativePath;
    const folderName = path.split("/")[0];
    setWorkspaceBrowseName(folderName);
    setWorkspaceResolvedPath(null);
    setLauncherError(null);
    event.target.value = "";

    setWorkspaceResolving(true);
    try {
      const response = await fetch("/api/resolve-workspace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: folderName }),
      });
      const body = (await response.json()) as {
        found: boolean;
        path?: string;
        error?: string;
      };

      if (body.found && body.path) {
        setWorkspaceResolvedPath(body.path);
        await createPiSessionInProject(body.path);
      } else {
        setLauncherError(body.error || `Could not find directory "${folderName}"`);
      }
    } catch (err) {
      setLauncherError(err instanceof Error ? err.message : t("workspace.resolving"));
    } finally {
      setWorkspaceResolving(false);
    }
  }

  async function openNewestSessionForProject(projectPath: string) {
    const sessionId = getNewestProjectSessionId(projects, projectPath);
    if (!sessionId) {
      setLauncherError(t("workspace.noneFound"));
      return;
    }

    closeLauncher();
    if (panelMode === "terminal") {
      window.open(buildPiSessionUrl(sessionId, "terminal"), "_blank");
      return;
    }
    await selectPiSession(sessionId, { projectPath });
  }

  function handleSettingsConfirm() {
    const nextPanelMode = settingsDraft.panelMode;
    setModelKey(settingsDraft.modelKey);
    setPanelMode(nextPanelMode);
    setSystemPrompt(settingsDraft.systemPrompt);
    setLocale(settingsDraft.locale);
    localStorage.setItem(THINKING_LEVEL_STORAGE_KEY, settingsDraft.thinkingLevel);
    clearSelectedPiSession({ panelMode: nextPanelMode });
  }

  function handleSettingsCancel() {
    clearSelectedPiSession({ routeKind: "home" });
  }

  function openSettingsPage() {
    setSettingsDraft(createSettingsDraftFromState());
    setRouteKind("settings");
    writeRouteForState("settings", activePanelView, panelMode, "push");
  }

  function openHotkeysModal() {
    setIsHotkeysOpen(true);
  }

  const openEditor = piSessionDetail
    ? () => {
        const cwd = piSessionDetail.session.cwd;
        if (cwd) window.open(`vscode://file/${encodeURIComponent(cwd)}`);
      }
    : undefined;

  const launcherActions = (
    <LauncherActions
      t={t}
      onNewSession={openNewSessionLauncher}
      onSelectSession={openSelectSessionLauncher}
    />
  );

  return (
    <XProvider theme={xTheme}>
      {isSettingsPage ? (
        <SettingsPage
          t={t}
          settingsDraft={settingsDraft}
          onSettingsDraftChange={setSettingsDraft}
          modelOptions={modelOptions}
          piPlugins={piPlugins}
          piPluginsLoading={piPluginsLoading}
          piPluginsReloading={piPluginsReloading}
          piPluginsError={piPluginsError}
          piPluginsUpdating={piPluginsUpdating}
          piPluginsUpdateError={piPluginsUpdateError}
          piPluginsUpdateNotice={piPluginsUpdateNotice}
          onRefreshPlugins={() => void loadPiPlugins(true)}
          onUpdatePlugins={() => void updatePiPluginsInSettings()}
          skills={skills}
          skillsLoading={skillsLoading}
          skillsReloading={skillsReloading}
          skillsError={skillsError}
          onRefreshSkills={() => void loadSkills(true)}
          versions={versions}
          versionsLoading={versionsLoading}
          versionError={versionError}
          versionNotice={versionNotice}
          versionUpgradeRunning={versionUpgradeRunning}
          onCheckVersions={() => void loadVersions()}
          onUpgrade={setVersionUpgradeTarget}
          archivedSettingsProjects={archivedSettingsProjects}
          onRestoreSession={restorePiSession}
          onCancel={handleSettingsCancel}
          onConfirm={handleSettingsConfirm}
        />
      ) : (
        <main className={`app-shell${sidebarCollapsed ? " app-shell-collapsed" : ""}`}>
          <Sidebar
            t={t}
            locale={locale}
            projects={visibleSidebarProjects}
            selectedSessionId={selectedPiSessionId}
            archivedSessionIds={archivedPiSessionIds}
            loading={projectsLoading}
            error={projectsError}
            isStreaming={isStreaming}
            shortcutLabel={sidebarShortcutLabel}
            onCreateSessionInProject={(projectPath) => {
              void createPiSessionInProject(projectPath);
            }}
            onSelectSession={(sessionId) => {
              if (panelMode === "terminal") {
                window.open(buildPiSessionUrl(sessionId, "terminal"), "_blank");
                return;
              }
              void selectPiSession(sessionId);
            }}
            onRename={openRenameModal}
            onArchive={archivePiSession}
            onRestore={restorePiSession}
            onStatusChange={handleStatusChange}
            onDeleteProject={handleDeleteProject}
            onRevealProject={handleRevealProject}
            onOpenNewSession={openNewSessionLauncher}
            onOpenHotkeys={openHotkeysModal}
            onOpenSettings={openSettingsPage}
            onCollapse={() => setSidebarCollapsed(true)}
          />

          {sidebarCollapsed && (
            <button
              className="sidebar-expand-btn"
              type="button"
              onClick={() => setSidebarCollapsed(false)}
              title={`${t("sidebar.expand")} (${sidebarShortcutLabel})`}
            >
              <IconChevronRight />
            </button>
          )}

          {panelMode === "terminal" ? (
            <section
              ref={chatPanelRef}
              className="chat-panel"
              aria-label={t("panel.terminal")}
              tabIndex={-1}
            >
              <ChatHeader
                title={t("panel.terminal")}
                meta={terminalCwd}
                openEditorLabel={t("panel.openEditor")}
                onOpenEditor={openEditor}
              />
              {activePanelView.kind === "empty" ? (
                <div className="messages messages-empty">
                  <div className="empty-state">
                    <h3>{t("launcher.title", { workspace: launcherWorkspaceName })}</h3>
                    <p>{t("launcher.body")}</p>
                    {launcherActions}
                  </div>
                </div>
              ) : activePanelView.kind === "pi" && !piSessionDetail ? (
                <div className="messages messages-empty">
                  <div className="empty-state">
                    <h3>{t("panel.loadingTerminalTitle")}</h3>
                    <p>{t("panel.loadingTerminalBody")}</p>
                  </div>
                </div>
              ) : (
                <Suspense
                  fallback={
                    <div className="messages messages-empty">
                      <div className="empty-state">
                        <h3>{t("panel.loadingTerminalTitle")}</h3>
                      </div>
                    </div>
                  }
                >
                  <TerminalPanel
                    cwd={terminalCwd}
                    initialCommand={terminalInitialCommand}
                    locale={locale}
                    sessionId={selectedPiSessionId ?? undefined}
                  />
                </Suspense>
              )}
            </section>
          ) : (
            <section
              ref={chatPanelRef}
              className="chat-panel"
              aria-label={t("chat.agentDialogue")}
              tabIndex={-1}
            >
              <ChatHeader
                title={panelTitle}
                meta={panelMeta}
                openEditorLabel={t("panel.openEditor")}
                onOpenEditor={openEditor}
              />

              <ChatMessages
                view={activePanelView}
                t={t}
                launcherWorkspaceName={launcherWorkspaceName}
                launcherActions={launcherActions}
                projectsError={projectsError}
                piSessionError={piSessionError}
                piSessionLoading={piSessionLoading}
                piSessionDetail={piSessionDetail}
                historyItems={piHistoryBubbleItems}
                roles={bubbleRoles}
                userBubbleCount={userBubbleCount}
                userPreviews={userPreviews}
                scrollContainer={scrollContainer}
                onMinimapNavigate={handleMinimapNavigate}
                messagesRef={setMessagesEl}
                error={error}
                draftError={draftError}
                onRetry={() => {
                  if (activePanelView.kind === "pi")
                    void selectPiSession(activePanelView.sessionId);
                }}
              />

              {activePanelView.kind === "pi" ? (
                <ContextUsageBar
                  usage={contextUsage}
                  showUnavailable={Boolean(piSessionDetail)}
                  t={t}
                />
              ) : null}

              {activePanelView.kind === "pi" ? (
                <Composer
                  t={t}
                  input={input}
                  onInputChange={setInput}
                  onSlashSelect={handleSlashSelect}
                  selectedImage={selectedImage}
                  onRemoveImage={() => setSelectedImage(null)}
                  onImageChange={handleImageChange}
                  onImageFile={handleImageFile}
                  skills={skills}
                  pluginCommands={pluginCommands}
                  disabled={piSessionLoading || Boolean(piSessionError)}
                  queuedFollowUps={queuedFollowUps}
                  onRemoveQueuedFollowUp={removeQueuedFollowUp}
                  onSubmit={handleSenderSubmit}
                  onSubmitSteering={(messageText) => void submitMessage(messageText, "steering")}
                />
              ) : null}
            </section>
          )}
        </main>
      )}
      <input
        ref={projectFileInputRef}
        type="file"
        className="workspace-file-input"
        {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
        onChange={handleBrowseChange}
      />
      <Modals
        t={t}
        locale={locale}
        serverCwd={serverCwd}
        modalState={{
          isHotkeysOpen,
          renameTargetId,
          renameDraft,
          launcherMode,
          versionUpgradeTarget,
          interactiveSudoUpgrade,
        }}
        launcherError={launcherError}
        newSessionQuery={newSessionQuery}
        selectSessionQuery={selectSessionQuery}
        workspaceBrowseName={workspaceBrowseName}
        workspaceResolvedPath={workspaceResolvedPath}
        workspaceResolving={workspaceResolving}
        filteredNewProjects={filteredNewProjects}
        filteredSelectableProjects={filteredSelectableProjects}
        sidebarShortcutLabel={sidebarShortcutLabel}
        panelModeShortcutLabel={panelModeShortcutLabel}
        onCloseHotkeys={() => setIsHotkeysOpen(false)}
        onCloseRename={() => setRenameTargetId(null)}
        onRenameDraftChange={setRenameDraft}
        onConfirmRename={() => void confirmRename()}
        onCloseLauncher={closeLauncher}
        onNewSessionQueryChange={setNewSessionQuery}
        onSelectSessionQueryChange={setSelectSessionQuery}
        onCreateSession={(projectPath) => void createPiSessionInProject(projectPath)}
        onOpenNewestSession={(projectPath) => void openNewestSessionForProject(projectPath)}
        onBrowseProject={handleBrowseClick}
        onCancelUpgrade={() => setVersionUpgradeTarget(null)}
        onConfirmUpgrade={() => void confirmVersionUpgrade()}
        onCloseSudo={() => {
          setInteractiveSudoUpgrade(null);
          void loadVersions();
          void loadPiPlugins(true);
        }}
      />
    </XProvider>
  );
}
