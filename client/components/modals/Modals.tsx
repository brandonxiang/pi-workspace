import { Suspense, lazy } from "react";
import Input from "antd/es/input";
import Modal from "antd/es/modal";
import type { Locale, Translator } from "../../i18n/index";
import type {
  InteractiveSudoUpgrade,
  LauncherMode,
  QueuedComposerMessage,
  VersionUpgradeTarget,
} from "../../types/index";
import type { PiSessionProject } from "../../types/index";

const TerminalPanel = lazy(async () => {
  const module = await import("../TerminalPanel");
  return { default: module.TerminalPanel };
});

export interface ModalState {
  isHotkeysOpen: boolean;
  renameTargetId: string | null;
  renameDraft: string;
  launcherMode: LauncherMode;
  versionUpgradeTarget: VersionUpgradeTarget | null;
  interactiveSudoUpgrade: InteractiveSudoUpgrade | null;
}

export interface ModalsProps {
  t: Translator;
  locale: Locale;
  serverCwd: string;
  modalState: ModalState;
  launcherError: string | null;
  newSessionQuery: string;
  selectSessionQuery: string;
  workspaceBrowseName: string | null;
  workspaceResolvedPath: string | null;
  workspaceResolving: boolean;
  filteredNewProjects: PiSessionProject[];
  filteredSelectableProjects: PiSessionProject[];
  sidebarShortcutLabel: string;
  panelModeShortcutLabel: string;
  onCloseHotkeys: () => void;
  onCloseRename: () => void;
  onRenameDraftChange: (value: string) => void;
  onConfirmRename: () => void;
  onCloseLauncher: () => void;
  onNewSessionQueryChange: (value: string) => void;
  onSelectSessionQueryChange: (value: string) => void;
  onCreateSession: (projectPath: string) => void;
  onOpenNewestSession: (projectPath: string) => void;
  onBrowseProject: () => void;
  onCancelUpgrade: () => void;
  onConfirmUpgrade: () => void;
  onCloseSudo: () => void;
}

export function Modals({
  t,
  locale,
  serverCwd,
  modalState,
  newSessionQuery,
  selectSessionQuery,
  workspaceBrowseName,
  workspaceResolvedPath,
  workspaceResolving,
  filteredNewProjects,
  filteredSelectableProjects,
  sidebarShortcutLabel,
  panelModeShortcutLabel,
  onCloseHotkeys,
  onCloseRename,
  onRenameDraftChange,
  onConfirmRename,
  onCloseLauncher,
  onNewSessionQueryChange,
  onSelectSessionQueryChange,
  onCreateSession,
  onOpenNewestSession,
  onBrowseProject,
  launcherError,
  onCancelUpgrade,
  onConfirmUpgrade,
  onCloseSudo,
}: ModalsProps) {
  return (
    <>
      <Modal
        centered
        open={modalState.versionUpgradeTarget !== null}
        title={t("settings.upgradeConfirmTitle", {
          name: modalState.versionUpgradeTarget === "pi" ? "Pi" : "pi-workspace",
        })}
        footer={
          <div className="settings-footer">
            <button
              className="settings-btn settings-btn-cancel"
              type="button"
              onClick={onCancelUpgrade}
            >
              {t("settings.cancel")}
            </button>
            <button
              className="settings-btn settings-btn-confirm"
              type="button"
              onClick={onConfirmUpgrade}
            >
              {t("settings.upgrade")}
            </button>
          </div>
        }
        onCancel={onCancelUpgrade}
      >
        <p>{t("settings.upgradeConfirmBody")}</p>
      </Modal>

      <Modal
        centered
        width={820}
        open={modalState.interactiveSudoUpgrade !== null}
        title={t("settings.administratorAuthorization")}
        footer={
          <div className="settings-footer">
            <button
              className="settings-btn settings-btn-cancel"
              type="button"
              onClick={onCloseSudo}
            >
              {t("settings.close")}
            </button>
          </div>
        }
        onCancel={onCloseSudo}
      >
        <p className="field-note">{t("settings.sudoAuthorizationHelp")}</p>
        {modalState.interactiveSudoUpgrade ? (
          <Suspense fallback={<div>{t("panel.loadingTerminalTitle")}</div>}>
            <div className="settings-sudo-terminal">
              <TerminalPanel
                cwd={serverCwd || "."}
                initialCommand={modalState.interactiveSudoUpgrade.command}
                locale={locale}
              />
            </div>
          </Suspense>
        ) : null}
      </Modal>

      <Modal
        centered
        open={modalState.isHotkeysOpen}
        title={t("hotkeys.title")}
        footer={null}
        onCancel={onCloseHotkeys}
      >
        <div className="settings-tab-content">
          <div className="field">
            <span>{t("hotkeys.sidebarToggleLabel", { shortcut: sidebarShortcutLabel })}</span>
            <small className="field-note">{t("hotkeys.sidebarToggleDescription")}</small>
          </div>
          <div className="field">
            <span>{t("hotkeys.modeToggleLabel", { shortcut: panelModeShortcutLabel })}</span>
            <small className="field-note">{t("hotkeys.modeToggleDescription")}</small>
          </div>
        </div>
      </Modal>

      <Modal
        centered
        open={modalState.renameTargetId !== null}
        title={t("session.renameTitle")}
        okText={t("actions.rename")}
        cancelText={t("settings.cancel")}
        onOk={onConfirmRename}
        onCancel={onCloseRename}
      >
        <Input
          autoFocus
          value={modalState.renameDraft}
          placeholder={t("session.renamePlaceholder")}
          onChange={(event) => onRenameDraftChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") onConfirmRename();
            if (event.key === "Escape") onCloseRename();
          }}
        />
      </Modal>

      <Modal
        centered
        open={modalState.launcherMode === "new"}
        title={t("launcher.newPiSession")}
        footer={null}
        onCancel={onCloseLauncher}
      >
        <div className="launcher-modal-body">
          <p className="workspace-description">{t("launcher.newPiSessionBody")}</p>
          <Input
            value={newSessionQuery}
            placeholder={t("launcher.searchProjects")}
            onChange={(event) => onNewSessionQueryChange(event.target.value)}
          />
          <div className="launcher-project-list">
            {filteredNewProjects.map((project) => (
              <button
                className="launcher-project-button"
                key={project.path}
                type="button"
                onClick={() => onCreateSession(project.path)}
              >
                <span>{project.name}</span>
                <small>{project.sessions.length}</small>
              </button>
            ))}
            {filteredNewProjects.length === 0 ? (
              <div className="pi-sessions-empty">{t("launcher.noProjectsFound")}</div>
            ) : null}
          </div>
          <div className="launcher-add-project">
            <button
              className="workspace-browse-btn launcher-add-project-button"
              type="button"
              onClick={onBrowseProject}
            >
              {t("launcher.addProject")}
            </button>
            {workspaceResolving ? (
              <span className="workspace-resolving-label">{t("workspace.resolving")}</span>
            ) : null}
            {workspaceResolvedPath && !workspaceResolving ? (
              <span className="workspace-resolved-label">
                ✓ <strong>{workspaceBrowseName}</strong>
                <small>{workspaceResolvedPath}</small>
              </span>
            ) : null}
          </div>
          {launcherError ? <div className="workspace-error">{launcherError}</div> : null}
        </div>
      </Modal>

      <Modal
        centered
        open={modalState.launcherMode === "select"}
        title={t("launcher.selectPiSession")}
        footer={null}
        onCancel={onCloseLauncher}
      >
        <div className="launcher-modal-body">
          <p className="workspace-description">{t("launcher.selectPiSessionBody")}</p>
          <Input
            value={selectSessionQuery}
            placeholder={t("launcher.searchProjects")}
            onChange={(event) => onSelectSessionQueryChange(event.target.value)}
          />
          <div className="launcher-project-list">
            {filteredSelectableProjects.map((project) => (
              <button
                className="launcher-project-button"
                key={project.path}
                type="button"
                onClick={() => onOpenNewestSession(project.path)}
              >
                <span>{project.name}</span>
                <small>
                  {project.sessions[0]?.name ||
                    project.sessions[0]?.firstMessage ||
                    t("chat.piSession")}
                </small>
              </button>
            ))}
            {filteredSelectableProjects.length === 0 ? (
              <div className="pi-sessions-empty">{t("launcher.noProjectsFound")}</div>
            ) : null}
          </div>
          {launcherError ? <div className="workspace-error">{launcherError}</div> : null}
        </div>
      </Modal>
    </>
  );
}
