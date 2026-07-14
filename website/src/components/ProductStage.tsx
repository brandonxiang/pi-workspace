import type { SiteContent } from "../content";

type ProductStageProps = {
  content: SiteContent["product"];
};

export function ProductStage({ content }: ProductStageProps) {
  return (
    <div className="product-stage" aria-label={content.label}>
      <div className="stage-path stage-path-top" aria-hidden="true" />
      <div className="stage-path stage-path-bottom" aria-hidden="true" />
      <div className="product-window">
        <div className="window-bar">
          <span className="window-brand-mark" aria-hidden="true">
            π
          </span>
          <strong>{content.workspace}</strong>
          <span className="window-status">
            <i aria-hidden="true" /> {content.label}
          </span>
        </div>
        <div className="workspace-preview">
          <aside className="preview-sidebar">
            <span className="preview-label">{content.sessions}</span>
            <div className="preview-session preview-session-active">
              <span className="session-glyph" aria-hidden="true">
                ↳
              </span>
              <span>{content.activeSession}</span>
            </div>
            <div className="preview-session preview-session-muted" aria-hidden="true">
              <span>↳</span>
              <span />
            </div>
            <div className="preview-session preview-session-muted" aria-hidden="true">
              <span>↳</span>
              <span />
            </div>
          </aside>
          <div className="preview-main">
            <div className="preview-tabs">
              <span className="preview-tab preview-tab-active">{content.dialogue}</span>
              <span className="preview-tab">{content.terminal}</span>
            </div>
            <div className="preview-dialogue">
              <p className="thinking-line">
                <span className="thinking-pulse" aria-hidden="true" />
                {content.thinking}
              </p>
              <div className="assistant-line">
                <span className="assistant-mark" aria-hidden="true">
                  π
                </span>
                <p>{content.response}</p>
              </div>
            </div>
            <div className="preview-terminal">
              <code>{content.command}</code>
              <code>{content.terminalOutput}</code>
            </div>
          </div>
        </div>
      </div>
      <div className="stage-node stage-node-local">
        <span aria-hidden="true">●</span> local Pi
      </div>
      <div className="stage-node stage-node-session">
        <span aria-hidden="true">●</span> active Session
      </div>
    </div>
  );
}
