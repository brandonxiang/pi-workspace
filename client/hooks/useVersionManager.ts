import { useCallback, useState } from "react";
import type { Translator } from "../i18n/index";
import type {
  InteractiveSudoUpgrade,
  VersionUpgradeTarget,
  VersionsResponse,
} from "../types/index";

export interface UseVersionManagerOptions {
  t: Translator;
  onInteractiveSudo: (upgrade: InteractiveSudoUpgrade) => void;
}

export function useVersionManager({ t, onInteractiveSudo }: UseVersionManagerOptions) {
  const [versions, setVersions] = useState<VersionsResponse | null>(null);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [versionError, setVersionError] = useState<string | null>(null);
  const [versionNotice, setVersionNotice] = useState<string | null>(null);
  const [versionUpgradeTarget, setVersionUpgradeTarget] = useState<VersionUpgradeTarget | null>(
    null,
  );
  const [versionUpgradeRunning, setVersionUpgradeRunning] = useState<VersionUpgradeTarget | null>(
    null,
  );

  const loadVersions = useCallback(async () => {
    setVersionsLoading(true);
    setVersionError(null);

    try {
      const response = await fetch("/api/versions");
      const body = (await response.json()) as VersionsResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || t("settings.versionCheckFailed"));
      setVersions(body);
    } catch (loadError) {
      setVersions(null);
      setVersionError(
        loadError instanceof Error ? loadError.message : t("settings.versionCheckFailed"),
      );
    } finally {
      setVersionsLoading(false);
    }
  }, [t]);

  const confirmVersionUpgrade = useCallback(async () => {
    const target = versionUpgradeTarget;
    if (!target || versionUpgradeRunning) return;

    setVersionUpgradeTarget(null);
    setVersionUpgradeRunning(target);
    setVersionError(null);
    setVersionNotice(null);

    try {
      const actionToken = versions?.actionToken;
      if (!actionToken) throw new Error(t("settings.versionPermissionMissing"));
      const response = await fetch(`/api/versions/${target}/upgrade`, {
        method: "POST",
        headers: { "x-pi-workspace-action-token": actionToken },
      });
      const body = (await response.json()) as {
        error?: string;
        interactiveCommand?: string;
        message?: string;
        requiresInteractiveSudo?: boolean;
        restartRequired?: boolean;
      };
      if (!response.ok) {
        if (body.requiresInteractiveSudo && body.interactiveCommand) {
          onInteractiveSudo({ target, command: body.interactiveCommand });
          return;
        }
        throw new Error(body.error || t("settings.upgradeFailed"));
      }
      setVersionNotice(
        body.restartRequired
          ? t("settings.restartPiWorkspace")
          : body.message || t("settings.upgradeComplete"),
      );
      await loadVersions();
    } catch (upgradeError) {
      setVersionError(
        upgradeError instanceof Error ? upgradeError.message : t("settings.upgradeFailed"),
      );
    } finally {
      setVersionUpgradeRunning(null);
    }
  }, [versionUpgradeTarget, versionUpgradeRunning, versions, loadVersions, t, onInteractiveSudo]);

  return {
    versions,
    versionsLoading,
    versionError,
    versionNotice,
    versionUpgradeTarget,
    versionUpgradeRunning,
    setVersionUpgradeTarget,
    loadVersions,
    confirmVersionUpgrade,
  };
}
