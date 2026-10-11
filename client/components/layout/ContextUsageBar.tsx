import type { Translator } from "../../i18n/index";
import type { ContextUsage } from "../../types/index";

export interface ContextUsageBarProps {
  usage: ContextUsage | null;
  showUnavailable: boolean;
  t: Translator;
}

export function ContextUsageBar({ usage, showUnavailable, t }: ContextUsageBarProps) {
  const hasUsage = Boolean(usage && usage.tokens !== null && usage.contextWindow > 0);

  if (!hasUsage) {
    if (!showUnavailable) return null;
    return (
      <div className="context-usage-bar">
        <span className="context-usage-label">{t("composer.contextNotAvailable")}</span>
      </div>
    );
  }

  const percent = usage?.percent ?? null;
  const fillModifier =
    percent !== null && percent >= 80 ? "high" : percent !== null && percent >= 50 ? "mid" : "";

  return (
    <div className="context-usage-bar">
      <span className="context-usage-label">
        {t("composer.contextUsage", {
          used: usage!.tokens!.toLocaleString(),
          total: usage!.contextWindow.toLocaleString(),
        })}
      </span>
      <div className="context-usage-track">
        <div
          className={`context-usage-fill${fillModifier ? ` context-usage-fill-${fillModifier}` : ""}`}
          style={{ width: `${Math.min(percent ?? 0, 100)}%` }}
        />
      </div>
      <span className="context-usage-percent">
        {percent !== null ? t("composer.contextPercent", { percent: Math.round(percent) }) : null}
      </span>
    </div>
  );
}
