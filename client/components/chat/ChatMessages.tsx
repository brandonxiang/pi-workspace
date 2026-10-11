import type { ReactNode } from "react";
import Bubble, { type BubbleItemType, type BubbleListProps } from "@ant-design/x/es/bubble";
import Minimap from "../Minimap";
import type { Translator } from "../../i18n/index";
import type { ActivePanelView, PiSessionDetailResponse } from "../../types/index";

export interface ChatMessagesProps {
  view: ActivePanelView;
  t: Translator;
  launcherWorkspaceName: string;
  launcherActions: ReactNode;
  projectsError: string | null;
  piSessionError: string | null;
  piSessionLoading: boolean;
  piSessionDetail: PiSessionDetailResponse | null;
  historyItems: BubbleItemType[];
  roles: BubbleListProps["role"];
  userBubbleCount: number;
  userPreviews: string[];
  scrollContainer: HTMLElement | null;
  onMinimapNavigate: (userIndex: number) => void;
  messagesRef: (element: HTMLElement | null) => void;
  error: string | null;
  draftError: string | null;
  onRetry: () => void;
}

export function ChatMessages({
  view,
  t,
  launcherWorkspaceName,
  launcherActions,
  projectsError,
  piSessionError,
  piSessionLoading,
  piSessionDetail,
  historyItems,
  roles,
  userBubbleCount,
  userPreviews,
  scrollContainer,
  onMinimapNavigate,
  messagesRef,
  error,
  draftError,
  onRetry,
}: ChatMessagesProps) {
  if (view.kind === "empty") {
    return (
      <div className="messages messages-empty">
        <div className="empty-state">
          <h3>{t("launcher.title", { workspace: launcherWorkspaceName })}</h3>
          <p>{t("launcher.body")}</p>
          {launcherActions}
          {projectsError ? <div className="error-banner">{projectsError}</div> : null}
        </div>
      </div>
    );
  }

  if (piSessionError && !piSessionDetail) {
    return (
      <div className="messages messages-empty">
        <div className="error-banner">
          <p>{piSessionError}</p>
          <button className="inline-action-button" type="button" onClick={onRetry}>
            {t("panel.retry")}
          </button>
        </div>
      </div>
    );
  }

  if (!piSessionDetail) {
    return <div className="messages messages-empty" aria-busy={piSessionLoading} />;
  }

  if (historyItems.length === 0) {
    return (
      <div className="messages messages-empty">
        <div className="empty-state">
          <h3>{t("session.newPiTitle")}</h3>
          <p>{t("session.newPiBody")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="messages" ref={messagesRef}>
      <Bubble.List autoScroll className="chat-bubble-list" items={historyItems} role={roles} />
      {userBubbleCount >= 2 && (
        <Minimap
          userCount={userBubbleCount}
          userPreviews={userPreviews}
          scrollContainer={scrollContainer}
          onNavigate={onMinimapNavigate}
        />
      )}
      {piSessionError ? <div className="error-banner">{piSessionError}</div> : null}
      {error && !draftError ? <div className="error-banner">{error}</div> : null}
    </div>
  );
}
