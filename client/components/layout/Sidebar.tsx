import type { Locale, Translator } from "../../i18n/index";
import type { PiSessionProject, SessionStatus } from "../../types/index";
import { PiSessionSection } from "../PiSessionSection";
import { PiLogo, IconPlus, IconKeyboard, IconSettings, IconChevronLeft } from "../icon/index";

export interface SidebarProps {
  t: Translator;
  locale: Locale;
  projects: PiSessionProject[];
  selectedSessionId: string | null;
  archivedSessionIds: Set<string>;
  loading: boolean;
  error: string | null;
  isStreaming: boolean;
  shortcutLabel: string;
  onCreateSessionInProject: (projectPath: string) => void;
  onSelectSession: (sessionId: string) => void;
  onRename: (sessionId: string) => void;
  onArchive: (sessionId: string) => void;
  onRestore: (sessionId: string) => void;
  onStatusChange: (sessionId: string, status: SessionStatus) => void;
  onDeleteProject: (projectPath: string) => void;
  onRevealProject: (projectPath: string) => void;
  onOpenNewSession: () => void;
  onOpenHotkeys: () => void;
  onOpenSettings: () => void;
  onCollapse: () => void;
}

export function Sidebar({
  t,
  locale,
  projects,
  selectedSessionId,
  archivedSessionIds,
  loading,
  error,
  isStreaming,
  shortcutLabel,
  onCreateSessionInProject,
  onSelectSession,
  onRename,
  onArchive,
  onRestore,
  onStatusChange,
  onDeleteProject,
  onRevealProject,
  onOpenNewSession,
  onOpenHotkeys,
  onOpenSettings,
  onCollapse,
}: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="sidebar-inner">
        <div className="sidebar-top-row">
          <div className="sidebar-brand-icon">
            <PiLogo />
          </div>
          <div className="sidebar-actions">
            <button
              className="icon-button"
              type="button"
              title={t("sidebar.newPiSession")}
              onClick={onOpenNewSession}
            >
              <IconPlus />
            </button>
            <button
              className="icon-button"
              type="button"
              title={t("hotkeys.open")}
              onClick={onOpenHotkeys}
            >
              <IconKeyboard />
            </button>
            <button
              className="icon-button"
              type="button"
              title={t("settings.title")}
              onClick={onOpenSettings}
            >
              <IconSettings />
            </button>
            <button
              className="sidebar-collapse-btn"
              type="button"
              onClick={onCollapse}
              title={`${t("sidebar.collapse")} (${shortcutLabel})`}
            >
              <IconChevronLeft />
            </button>
          </div>
        </div>

        <PiSessionSection
          error={error}
          isStreaming={isStreaming}
          locale={locale}
          loading={loading}
          onCreateSessionInProject={onCreateSessionInProject}
          projects={projects}
          selectedSessionId={selectedSessionId}
          onSelectSession={onSelectSession}
          onRename={onRename}
          archivedSessionIds={archivedSessionIds}
          onArchive={onArchive}
          onRestore={onRestore}
          onStatusChange={onStatusChange}
          onDeleteProject={onDeleteProject}
          onRevealProject={onRevealProject}
        />
      </div>
    </aside>
  );
}
