import { IconCode } from "../icon/index";

export interface ChatHeaderProps {
  title: string;
  meta?: string | null;
  openEditorLabel: string;
  onOpenEditor?: () => void;
}

export function ChatHeader({ title, meta, openEditorLabel, onOpenEditor }: ChatHeaderProps) {
  return (
    <header className="chat-header">
      <div className="chat-header-copy">
        <span className="chat-header-title" title={title}>
          {title}
        </span>
        {meta ? (
          <small className="chat-header-meta" title={meta}>
            {meta}
          </small>
        ) : null}
      </div>
      {onOpenEditor ? (
        <button
          className="chat-header-action-btn"
          type="button"
          title={openEditorLabel}
          onClick={onOpenEditor}
        >
          <IconCode />
        </button>
      ) : null}
    </header>
  );
}
