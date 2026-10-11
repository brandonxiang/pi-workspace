import type { Translator } from "../../i18n/index";

export interface LauncherActionsProps {
  t: Translator;
  onNewSession: () => void;
  onSelectSession: () => void;
}

export function LauncherActions({ t, onNewSession, onSelectSession }: LauncherActionsProps) {
  return (
    <div className="launcher-actions">
      <button className="settings-btn settings-btn-confirm" type="button" onClick={onNewSession}>
        {t("launcher.newPiSession")}
      </button>
      <button className="settings-btn settings-btn-cancel" type="button" onClick={onSelectSession}>
        {t("launcher.selectPiSession")}
      </button>
    </div>
  );
}
