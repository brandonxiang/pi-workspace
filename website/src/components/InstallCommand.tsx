import { useRef, useState } from "react";

type InstallCommandProps = {
  command: string;
  copyLabel: string;
  copiedLabel: string;
  failedLabel: string;
};

type CopyState = "idle" | "copied" | "failed";

export function InstallCommand({
  command,
  copyLabel,
  copiedLabel,
  failedLabel,
}: InstallCommandProps) {
  const [copyState, setCopyState] = useState<CopyState>("idle");
  const commandRef = useRef<HTMLElement>(null);

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setCopyState("copied");
    } catch {
      const selection = window.getSelection();
      if (selection && commandRef.current) {
        const range = document.createRange();
        range.selectNodeContents(commandRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setCopyState("failed");
    }
  }

  const statusLabel =
    copyState === "copied" ? copiedLabel : copyState === "failed" ? failedLabel : copyLabel;

  return (
    <div className="install-command-wrap">
      <button className="install-command" type="button" onClick={copyCommand}>
        <span className="terminal-prompt" aria-hidden="true">
          $
        </span>
        <code ref={commandRef}>{command}</code>
        <span className="copy-icon" aria-hidden="true">
          {copyState === "copied" ? "✓" : "↗"}
        </span>
      </button>
      <span className={`copy-status copy-status-${copyState}`} role="status" aria-live="polite">
        {statusLabel}
      </span>
    </div>
  );
}
