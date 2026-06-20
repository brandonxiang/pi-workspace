import Dropdown from "antd/es/dropdown";
import type { MenuProps } from "antd";
import {
  createTranslator,
  formatMessageCount,
  formatRelativeTime,
  type Locale,
  type Translator
} from "./i18n";
import type { PiSessionProject } from "./types";

interface PiSessionSectionProps {
  isStreaming: boolean;
  locale: Locale;
  projects: PiSessionProject[];
  loading: boolean;
  error: string | null;
  selectedSessionId: string | null;
  onSelectSession: (sessionId: string) => void;
  onRename: (sessionId: string) => void;
  archivedSessionIds: Set<string>;
  onArchive: (sessionId: string) => void;
  onRestore: (sessionId: string) => void;
  onOpenNewSession: () => void;
}

function buildMenuItems(
  sessionKey: string,
  isArchived: boolean,
  onRename: (id: string) => void,
  onArchive: (id: string) => void,
  onRestore: (id: string) => void,
  t: Translator
): MenuProps["items"] {
  if (isArchived) {
    return [{ key: "restore", label: t("actions.restore"), onClick: () => onRestore(sessionKey) }];
  }

  return [
    { key: "rename", label: t("actions.rename"), onClick: () => onRename(sessionKey) },
    { key: "archive", label: t("actions.archive"), onClick: () => onArchive(sessionKey) }
  ];
}

export function PiSessionSection({
  isStreaming,
  locale,
  projects,
  loading,
  error,
  selectedSessionId,
  onSelectSession,
  onRename,
  archivedSessionIds,
  onArchive,
  onRestore,
  onOpenNewSession
}: PiSessionSectionProps) {
  const t = createTranslator(locale);

  function stopPropagation(event: React.MouseEvent) {
    event.stopPropagation();
  }

  if (loading) {
    return (
      <div className="pi-sessions-section">
        <div className="session-section-heading">
          <span>{t("sidebar.piSessions")}</span>
        </div>
        <div className="pi-sessions-empty">{t("sidebar.loadingPiSessionTitle")}</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pi-sessions-section">
        <div className="session-section-heading">
          <span>{t("sidebar.piSessions")}</span>
          <div className="sidebar-actions">
            <button
              className="icon-button"
              disabled={isStreaming}
              type="button"
              title={t("sidebar.newPiSession")}
              onClick={onOpenNewSession}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
            </button>
          </div>
        </div>
        <div className="pi-sessions-error">{error}</div>
      </div>
    );
  }

  const totalSessions = projects.reduce((sum, project) => sum + project.sessions.length, 0);

  return (
    <div className="pi-sessions-section">
      <div className="session-section-heading">
        <span>{t("sidebar.piSessions")}</span>
        <div className="pi-sessions-heading-actions">
          <small>{totalSessions}</small>
          <button
            className="icon-button"
            disabled={isStreaming}
            type="button"
            title={t("sidebar.newPiSession")}
            onClick={onOpenNewSession}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
          </button>
        </div>
      </div>

      {projects.length === 0 ? (
        <div className="pi-sessions-empty">{t("workspace.noneFound")}</div>
      ) : (
        <div className="pi-sessions-list">
          {projects.map((project) => (
            <div className="pi-project-group" key={project.path}>
              <div className="pi-project-header-row">
                <div className="pi-project-header">
                  <span className="pi-project-name">{project.name}</span>
                  <small className="pi-project-count">{project.sessions.length}</small>
                </div>
              </div>

              <div className="pi-session-list">
                {project.sessions.map((session) => {
                  const isArchived = archivedSessionIds.has(session.id);

                  return (
                    <button
                      className={
                        "pi-session-row" +
                        (selectedSessionId === session.id ? " pi-session-row-active" : "") +
                        (isArchived ? " pi-session-row-archived" : "")
                      }
                      key={session.id}
                      disabled={isStreaming}
                      type="button"
                      onClick={() => onSelectSession(session.id)}
                    >
                      <div className="pi-session-info">
                        <span className="pi-session-first-msg">
                          {session.name || session.firstMessage}
                        </span>
                        <small className="pi-session-meta">
                          {formatMessageCount(locale, session.messageCount)} · {formatRelativeTime(locale, session.modified)}
                        </small>
                      </div>
                      <span className="pi-session-menu-trigger" onClick={stopPropagation}>
                        <Dropdown
                          menu={{
                            items: buildMenuItems(
                              session.id,
                              isArchived,
                              onRename,
                              onArchive,
                              onRestore,
                              t
                            )
                          }}
                          placement="bottomRight"
                          trigger={["click"]}
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="5" r="2" />
                            <circle cx="12" cy="12" r="2" />
                            <circle cx="12" cy="19" r="2" />
                          </svg>
                        </Dropdown>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
