import { useMemo } from "react";
import Select from "antd/es/select";
import Tabs from "antd/es/tabs";
import type { Locale, Translator } from "../../i18n";
import { localeOptions } from "../../i18n";
import type { PiPluginsResponse, PiSessionProject, SkillItem } from "../../types";
import type {
  SettingsDraft,
  ThinkingLevel,
  VersionUpgradeTarget,
  VersionsResponse,
} from "../../types/index";
import type { PanelMode } from "../../router/index";
import { getModelKey } from "../../utils/index";

export interface SettingsPageProps {
  t: Translator;
  settingsDraft: SettingsDraft;
  onSettingsDraftChange: (updater: (prev: SettingsDraft) => SettingsDraft) => void;
  modelOptions: Array<{ provider: string; model: string; label: string; supportsImages: boolean }>;
  piPlugins: PiPluginsResponse | null;
  piPluginsLoading: boolean;
  piPluginsReloading: boolean;
  piPluginsError: string | null;
  onRefreshPlugins: () => void;
  skills: SkillItem[];
  skillsLoading: boolean;
  skillsReloading: boolean;
  skillsError: string | null;
  onRefreshSkills: () => void;
  versions: VersionsResponse | null;
  versionsLoading: boolean;
  versionError: string | null;
  versionNotice: string | null;
  versionUpgradeRunning: VersionUpgradeTarget | null;
  onCheckVersions: () => void;
  onUpgrade: (target: VersionUpgradeTarget) => void;
  archivedSettingsProjects: PiSessionProject[];
  onRestoreSession: (sessionId: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
}

export function SettingsPage({
  t,
  settingsDraft,
  onSettingsDraftChange,
  modelOptions,
  piPlugins,
  piPluginsLoading,
  piPluginsReloading,
  piPluginsError,
  onRefreshPlugins,
  skills,
  skillsLoading,
  skillsReloading,
  skillsError,
  onRefreshSkills,
  versions,
  versionsLoading,
  versionError,
  versionNotice,
  versionUpgradeRunning,
  onCheckVersions,
  onUpgrade,
  archivedSettingsProjects,
  onRestoreSession,
  onCancel,
  onConfirm,
}: SettingsPageProps) {
  const set = onSettingsDraftChange;

  const visibleVersions = useMemo(
    () =>
      [
        ["pi" as const, t("settings.piCli"), versions?.pi, t("settings.upgradePi")],
        [
          "pi-workspace" as const,
          "pi-workspace",
          versions?.piWorkspace,
          t("settings.upgradePiWorkspace"),
        ],
      ] as const,
    [t, versions],
  );

  return (
    <section
      className="settings-page-panel"
      aria-label={t("settings.title")}
      data-testid="settings-page"
      tabIndex={-1}
    >
      <header className="chat-header settings-page-header">
        <button
          className="settings-page-back"
          data-testid="settings-back-button"
          type="button"
          title={t("settings.cancel")}
          onClick={onCancel}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </button>
        <div className="chat-header-copy">
          <span className="chat-header-title">{t("settings.title")}</span>
        </div>
      </header>
      <div className="settings-page-body">
        <div className="settings-page-card">
          <Tabs
            tabPosition="left"
            items={[
              {
                key: "general",
                label: t("settings.tabGeneral"),
                children: (
                  <div className="settings-tab-content">
                    <label className="field">
                      <span>{t("settings.language")}</span>
                      <Select
                        value={settingsDraft.locale}
                        onChange={(value) => set((prev) => ({ ...prev, locale: value as Locale }))}
                        options={localeOptions.map((option: (typeof localeOptions)[number]) => ({
                          value: option.value,
                          label: option.label,
                        }))}
                      />
                      <small className="field-note">{t("settings.languageHelp")}</small>
                    </label>

                    <label className="field">
                      <span>{t("settings.panelMode")}</span>
                      <Select
                        value={settingsDraft.panelMode}
                        onChange={(value) =>
                          set((prev) => ({ ...prev, panelMode: value as PanelMode }))
                        }
                        options={[
                          { value: "chat", label: t("settings.chatMode") },
                          { value: "terminal", label: t("settings.terminalMode") },
                        ]}
                      />
                    </label>
                  </div>
                ),
              },
              {
                key: "plugins",
                label: t("settings.tabPlugins"),
                children: (
                  <div
                    className="settings-tab-content settings-plugins-tab"
                    data-testid="plugins-settings"
                  >
                    <div className="settings-plugins-header">
                      <div>
                        <div className="settings-version-title">{t("settings.pluginsTitle")}</div>
                        <small className="field-note">{t("settings.pluginsHelp")}</small>
                      </div>
                      <button
                        className="settings-btn settings-btn-cancel"
                        type="button"
                        disabled={piPluginsLoading || piPluginsReloading}
                        onClick={onRefreshPlugins}
                      >
                        {piPluginsReloading
                          ? t("settings.pluginsRefreshing")
                          : t("settings.pluginsRefresh")}
                      </button>
                    </div>

                    {piPluginsError ? (
                      <div className="error-banner" role="alert">
                        {piPluginsError}
                      </div>
                    ) : null}

                    {piPluginsLoading ? (
                      <div className="settings-plugins-empty">{t("settings.pluginsLoading")}</div>
                    ) : piPlugins?.plugins.length ? (
                      <div className="settings-plugins-list">
                        {piPlugins.plugins.map((plugin: import("../../types").PiPluginSummary) => (
                          <article
                            className="settings-plugin-item"
                            data-testid="pi-plugin-item"
                            key={`${plugin.scope}:${plugin.source}`}
                          >
                            <div className="settings-plugin-copy">
                              <div className="settings-plugin-title">
                                <strong>{plugin.source}</strong>
                                <span className="settings-plugin-badge">{plugin.scope}</span>
                                <span
                                  className={`settings-plugin-status settings-plugin-status-${plugin.status}`}
                                >
                                  {plugin.status}
                                </span>
                              </div>
                              <div className="settings-plugin-meta">
                                {plugin.sourceType} ·{" "}
                                {plugin.filtered
                                  ? t("settings.pluginsFiltered")
                                  : t("settings.pluginsEnabled")}
                              </div>
                              <div className="settings-plugin-resources">
                                {Object.entries(plugin.resources).map(
                                  ([resource, count]: [string, number]) => (
                                    <span key={resource}>
                                      {resource}: {count}
                                    </span>
                                  ),
                                )}
                              </div>
                              {plugin.diagnostics.map((message: string) => (
                                <div className="settings-plugin-diagnostic" key={message}>
                                  {message}
                                </div>
                              ))}
                            </div>
                          </article>
                        ))}
                      </div>
                    ) : (
                      <div className="settings-plugins-empty">{t("settings.pluginsEmpty")}</div>
                    )}

                    {piPlugins?.diagnostics.length ? (
                      <section className="settings-plugins-diagnostics">
                        <div className="settings-plugin-diagnostics-title">
                          {t("settings.pluginsDiagnostics")}
                        </div>
                        {piPlugins.diagnostics.map(
                          (diagnostic: import("../../types").PiPluginDiagnostic, index) => (
                            <div
                              className="settings-plugin-diagnostic"
                              key={`${diagnostic.message}-${index}`}
                            >
                              <strong>{diagnostic.type}</strong> {diagnostic.message}
                            </div>
                          ),
                        )}
                      </section>
                    ) : null}
                  </div>
                ),
              },
              {
                key: "skills",
                label: t("settings.tabSkills"),
                children: (
                  <div
                    className="settings-tab-content settings-skills-tab"
                    data-testid="skills-settings"
                  >
                    <div className="settings-skills-header">
                      <div>
                        <div className="settings-version-title">{t("settings.skillsTitle")}</div>
                        <small className="field-note">{t("settings.skillsHelp")}</small>
                      </div>
                      <button
                        className="settings-btn settings-btn-cancel"
                        type="button"
                        disabled={skillsLoading || skillsReloading}
                        onClick={onRefreshSkills}
                      >
                        {skillsReloading
                          ? t("settings.skillsRefreshing")
                          : t("settings.skillsRefresh")}
                      </button>
                    </div>

                    {skillsError ? (
                      <div className="error-banner" role="alert">
                        {skillsError}
                      </div>
                    ) : null}

                    {skillsLoading ? (
                      <div className="settings-skills-empty">{t("settings.skillsLoading")}</div>
                    ) : skills.filter((s) => s.scope === "user").length ? (
                      <div className="settings-skills-list">
                        {skills
                          .filter((s) => s.scope === "user")
                          .map((skill) => (
                            <article
                              className="settings-skill-item"
                              data-testid="skill-item"
                              key={skill.name}
                            >
                              <div className="settings-skill-copy">
                                <div className="settings-skill-title">
                                  <strong>{skill.name}</strong>
                                  <span className="settings-skill-badge">
                                    {t("settings.skillsScopeUser")}
                                  </span>
                                  <span className="settings-skill-origin">
                                    {skill.origin === "package"
                                      ? t("settings.skillsOriginPackage")
                                      : t("settings.skillsOriginTopLevel")}
                                  </span>
                                </div>
                                <div className="settings-skill-description">
                                  {skill.description}
                                </div>
                                <div className="settings-skill-path">{skill.path}</div>
                              </div>
                            </article>
                          ))}
                      </div>
                    ) : (
                      <div className="settings-skills-empty">{t("settings.skillsEmpty")}</div>
                    )}
                  </div>
                ),
              },
              {
                key: "model",
                label: t("settings.tabModel"),
                children: (
                  <div className="settings-tab-content">
                    <label className="field">
                      <span>{t("settings.model")}</span>
                      <Select
                        value={settingsDraft.modelKey}
                        onChange={(value) => set((prev) => ({ ...prev, modelKey: value }))}
                        options={modelOptions.map((preset) => ({
                          value: getModelKey(preset.provider, preset.model),
                          label: `${preset.label}${preset.supportsImages ? " · vision" : ""}`,
                        }))}
                      />
                    </label>

                    <label className="field">
                      <span>{t("settings.thinkingLevel")}</span>
                      <Select
                        value={settingsDraft.thinkingLevel}
                        onChange={(value) =>
                          set((prev) => ({
                            ...prev,
                            thinkingLevel: value as ThinkingLevel,
                          }))
                        }
                        options={[
                          { value: "off", label: t("settings.thinkingOff") },
                          { value: "minimal", label: t("settings.thinkingMinimal") },
                          { value: "low", label: t("settings.thinkingLow") },
                          { value: "medium", label: t("settings.thinkingMedium") },
                          { value: "high", label: t("settings.thinkingHigh") },
                          { value: "xhigh", label: t("settings.thinkingXhigh") },
                        ]}
                      />
                      <small className="field-note">{t("settings.thinkingLevelHelp")}</small>
                    </label>

                    <label className="field">
                      <span>{t("settings.systemPrompt")}</span>
                      <textarea
                        value={settingsDraft.systemPrompt}
                        rows={7}
                        onChange={(event) =>
                          set((prev) => ({
                            ...prev,
                            systemPrompt: event.target.value,
                          }))
                        }
                      />
                    </label>
                  </div>
                ),
              },
              {
                key: "archived-chat",
                label: t("settings.tabArchivedChat"),
                children: (
                  <div className="settings-tab-content settings-archived-tab">
                    <div className="settings-archived-header">
                      <span className="settings-archived-title">
                        {t("settings.archivedChatTitle")}
                      </span>
                    </div>
                    {archivedSettingsProjects.length === 0 ? (
                      <div className="settings-archived-empty">
                        {t("settings.archivedChatEmpty")}
                      </div>
                    ) : (
                      <div className="settings-archived-groups">
                        {archivedSettingsProjects.map((project) => (
                          <section className="settings-archived-group" key={project.path}>
                            <div className="settings-archived-group-name">{project.name}</div>
                            <div className="settings-archived-list">
                              {project.sessions.map(
                                (session: import("../../types").PiSessionSummary) => (
                                  <article className="settings-archived-item" key={session.id}>
                                    <div className="settings-archived-copy">
                                      <div className="settings-archived-item-title">
                                        {session.name || session.firstMessage}
                                      </div>
                                      <div className="settings-archived-item-meta">
                                        {session.firstMessage}
                                      </div>
                                    </div>
                                    <button
                                      className="settings-btn settings-btn-cancel"
                                      type="button"
                                      onClick={() => onRestoreSession(session.id)}
                                    >
                                      {t("actions.restore")}
                                    </button>
                                  </article>
                                ),
                              )}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                ),
              },
              {
                key: "version",
                label: t("settings.tabVersion"),
                children: (
                  <div className="settings-tab-content settings-version-tab">
                    <div className="settings-version-header">
                      <div>
                        <div className="settings-version-title">{t("settings.versionTitle")}</div>
                        <small className="field-note">{t("settings.versionHelp")}</small>
                      </div>
                      <button
                        className="settings-btn settings-btn-cancel"
                        type="button"
                        disabled={versionsLoading || versionUpgradeRunning !== null}
                        onClick={onCheckVersions}
                      >
                        {versionsLoading
                          ? t("settings.checkingVersions")
                          : t("settings.recheckVersions")}
                      </button>
                    </div>

                    {versionError ? (
                      <div className="error-banner" role="alert">
                        {versionError}
                      </div>
                    ) : null}
                    {versionNotice ? (
                      <div className="settings-version-notice" role="status">
                        {versionNotice}
                      </div>
                    ) : null}

                    <div className="settings-version-list">
                      {visibleVersions.map(([target, label, status, buttonLabel]) => (
                        <section className="settings-version-item" key={target}>
                          <div className="settings-version-copy">
                            <div className="settings-version-component">{label}</div>
                            <div className="settings-version-numbers">
                              <span>
                                {t("settings.currentVersion")}:{" "}
                                <strong>{status?.currentVersion || "—"}</strong>
                              </span>
                              <span>
                                {t("settings.latestVersion")}:{" "}
                                <strong>{status?.latestVersion || "—"}</strong>
                              </span>
                            </div>
                            <div
                              className={`settings-version-status settings-version-status-${status?.error ? "error" : status?.updateAvailable ? "available" : "current"}`}
                            >
                              {versionsLoading && !status
                                ? t("settings.checkingVersions")
                                : status?.error ||
                                  (status?.updateAvailable === true
                                    ? t("settings.updateAvailable")
                                    : status?.updateAvailable === false
                                      ? t("settings.upToDate")
                                      : t("settings.versionUnknown"))}
                            </div>
                          </div>
                          <button
                            className="settings-btn settings-btn-confirm"
                            type="button"
                            disabled={
                              status?.updateAvailable !== true ||
                              versionsLoading ||
                              versionUpgradeRunning !== null
                            }
                            onClick={() => onUpgrade(target)}
                          >
                            {versionUpgradeRunning === target
                              ? t("settings.upgrading")
                              : buttonLabel}
                          </button>
                        </section>
                      ))}
                    </div>
                  </div>
                ),
              },
            ]}
          />
        </div>
      </div>
      <div className="settings-footer settings-page-footer">
        <button className="settings-btn settings-btn-cancel" type="button" onClick={onCancel}>
          {t("settings.cancel")}
        </button>
        <button
          className="settings-btn settings-btn-confirm"
          data-testid="settings-save-button"
          type="button"
          onClick={onConfirm}
        >
          {t("settings.confirm")}
        </button>
      </div>
    </section>
  );
}
