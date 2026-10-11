import { useCallback, useState } from "react";
import { updatePiPlugins } from "../api/plugins";
import type { Translator } from "../i18n/index";
import type { InteractiveSudoUpgrade, PiPluginsResponse } from "../types/index";

export interface UsePiPluginsOptions {
  t: Translator;
  onInteractiveSudo: (upgrade: InteractiveSudoUpgrade) => void;
}

export function usePiPlugins({ t, onInteractiveSudo }: UsePiPluginsOptions) {
  const [piPlugins, setPiPlugins] = useState<PiPluginsResponse | null>(null);
  const [piPluginsLoading, setPiPluginsLoading] = useState(false);
  const [piPluginsReloading, setPiPluginsReloading] = useState(false);
  const [piPluginsError, setPiPluginsError] = useState<string | null>(null);
  const [piPluginsUpdating, setPiPluginsUpdating] = useState(false);
  const [piPluginsUpdateError, setPiPluginsUpdateError] = useState<string | null>(null);
  const [piPluginsUpdateNotice, setPiPluginsUpdateNotice] = useState<string | null>(null);

  const loadPiPlugins = useCallback(async (reload = false) => {
    setPiPluginsError(null);
    if (reload) {
      setPiPluginsReloading(true);
    } else {
      setPiPluginsLoading(true);
    }

    try {
      const response = await fetch(reload ? "/api/pi-plugins/reload" : "/api/pi-plugins", {
        method: reload ? "POST" : "GET",
      });
      const body = (await response.json().catch(() => null)) as PiPluginsResponse & {
        error?: string;
      };
      if (!response.ok) throw new Error(body.error || "Failed to load Pi plugins");
      setPiPlugins(body);
    } catch (loadError) {
      setPiPluginsError(
        loadError instanceof Error ? loadError.message : "Failed to load Pi plugins",
      );
    } finally {
      setPiPluginsLoading(false);
      setPiPluginsReloading(false);
    }
  }, []);

  const updatePiPluginsInSettings = useCallback(async () => {
    if (piPluginsUpdating) return;

    setPiPluginsUpdateError(null);
    setPiPluginsUpdateNotice(null);
    setPiPluginsUpdating(true);

    try {
      const actionToken = piPlugins?.actionToken;
      if (!actionToken) {
        throw new Error(t("settings.pluginsUpdatePermissionMissing"));
      }
      const result = await updatePiPlugins(actionToken);
      if (!result.ok) {
        if (result.requiresInteractiveSudo && result.interactiveCommand) {
          onInteractiveSudo({ target: "extensions", command: result.interactiveCommand });
          return;
        }
        throw new Error(result.error || t("settings.pluginsUpdateFailed"));
      }
      setPiPluginsUpdateNotice(t("settings.pluginsUpdateDone"));
      await loadPiPlugins(true);
    } catch (updateError) {
      setPiPluginsUpdateError(
        updateError instanceof Error ? updateError.message : t("settings.pluginsUpdateFailed"),
      );
    } finally {
      setPiPluginsUpdating(false);
    }
  }, [piPluginsUpdating, piPlugins, loadPiPlugins, t, onInteractiveSudo]);

  return {
    piPlugins,
    piPluginsLoading,
    piPluginsReloading,
    piPluginsError,
    piPluginsUpdating,
    piPluginsUpdateError,
    piPluginsUpdateNotice,
    loadPiPlugins,
    updatePiPluginsInSettings,
  };
}
