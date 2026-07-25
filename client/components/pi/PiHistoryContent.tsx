import { Suspense, lazy } from "react";
import type { BubbleItemType, BubbleListProps } from "@ant-design/x/es/bubble";
import type { Locale, Translator, TranslationKey } from "../../i18n/index";
import type { PiHistoryMessage } from "../../types/index";
import type { PiHistoryTranscriptEntry } from "../../services/pi-session-transcript";
import { getImageDataUrl } from "../../utils/index";

const MarkdownContent = lazy(() => import("../MarkdownContent"));

function MarkdownFallback({ content }: { content: string }) {
  return <p>{content}</p>;
}

export function RenderMarkdown({ content }: { content: string }) {
  return (
    <Suspense fallback={<MarkdownFallback content={content} />}>
      <MarkdownContent content={content} />
    </Suspense>
  );
}

export function MessageHeader({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="message-meta">
      <span>{label}</span>
      <small>{meta}</small>
    </div>
  );
}

function PiHistoryUserMessageContent({
  message,
}: {
  message: Extract<PiHistoryMessage, { role: "user" }>;
}) {
  return (
    <div className="message-content">
      {message.images?.length ? (
        <div className="message-images">
          {message.images.map((image) => (
            <figure className="message-image" key={image.id}>
              <img alt={image.name} src={getImageDataUrl(image)} />
              <figcaption>{image.name}</figcaption>
            </figure>
          ))}
        </div>
      ) : null}
      {message.content ? <p>{message.content}</p> : null}
    </div>
  );
}

function PiToolMessageContent({
  t,
  message,
}: {
  t: Translator;
  message: Extract<PiHistoryMessage, { role: "tool" }>;
}) {
  return (
    <details className={message.isError ? "pi-tool-card pi-tool-card-error" : "pi-tool-card"}>
      <summary>
        <span>{message.toolName}</span>
        <small>{t("chat.clickToExpand")}</small>
      </summary>
      <pre>{message.content}</pre>
    </details>
  );
}

function PiThinkingDisclosureContent({
  t,
  message,
}: {
  t: Translator;
  message: Extract<PiHistoryMessage, { role: "thinking" }>;
}) {
  return (
    <details className="thinking-block">
      <summary>
        <span>{t("chat.thinkingHistory")}</span>
        <small>{t("chat.clickToExpand")}</small>
      </summary>
      <div className="thinking-content">{message.content}</div>
    </details>
  );
}

function PiPreviousAssistantMessagesContent({
  t,
  messages,
}: {
  t: Translator;
  messages: Extract<PiHistoryMessage, { role: "assistant" }>[];
}) {
  return (
    <details className="pi-assistant-history-card">
      <summary>
        <span>{t("chat.previousAssistantUpdates")}</span>
        <small>{t("chat.clickToExpand")}</small>
      </summary>
      <div className="pi-assistant-history-list">
        {messages.map((message) => (
          <section className="pi-assistant-history-item" key={message.id}>
            <RenderMarkdown content={message.content} />
          </section>
        ))}
      </div>
    </details>
  );
}

function PiToolGroupContent({
  t,
  messages,
}: {
  t: Translator;
  messages: Extract<PiHistoryMessage, { role: "tool" }>[];
}) {
  const hasError = messages.some((message) => message.isError);

  return (
    <details
      className={hasError ? "pi-tool-group-card pi-tool-group-card-error" : "pi-tool-group-card"}
    >
      <summary>
        <span>{t("chat.toolHistory")}</span>
        <small>{t("chat.clickToExpand")}</small>
      </summary>
      <div className="pi-tool-group-list">
        {messages.map((message) => (
          <section className="pi-tool-group-item" key={message.id}>
            <header>
              <strong>{message.toolName}</strong>
            </header>
            <pre>{message.content}</pre>
          </section>
        ))}
      </div>
    </details>
  );
}

function PiAssistantTurnContent({
  t,
  entry,
}: {
  t: Translator;
  entry: Extract<PiHistoryTranscriptEntry, { role: "assistant-turn" }>;
}) {
  return (
    <div className="pi-assistant-turn">
      <div className="pi-assistant-turn-response">
        <RenderMarkdown content={entry.finalMessage.content} />
      </div>
      {entry.previousMessages.length > 0 ? (
        <PiPreviousAssistantMessagesContent t={t} messages={entry.previousMessages} />
      ) : null}
      {entry.thinking ? <PiThinkingDisclosureContent t={t} message={entry.thinking} /> : null}
      {entry.tools.length > 0 ? <PiToolGroupContent t={t} messages={entry.tools} /> : null}
    </div>
  );
}

function PiSummaryMessageContent({
  message,
}: {
  message: Extract<PiHistoryMessage, { role: "summary" }>;
}) {
  return (
    <div className={`pi-summary-card pi-summary-card-${message.summaryType}`}>
      <strong>{message.title}</strong>
      <p>{message.content}</p>
    </div>
  );
}

function PiLocalResultContent({
  message,
}: {
  message: Extract<PiHistoryMessage, { role: "local_result" }>;
}) {
  return (
    <div className={`pi-local-result-card pi-local-result-card-${message.status}`}>
      <RenderMarkdown content={message.content} />
    </div>
  );
}

export function StreamingErrorContent({ message }: { message: string }) {
  return (
    <div className="pi-local-result-card pi-local-result-card-error">
      <p>{message}</p>
    </div>
  );
}

export function PiSteeringMessageContent({
  locale,
  message,
  t,
}: {
  locale: Locale;
  message: Extract<PiHistoryMessage, { role: "steering" }>;
  t: Translator;
}) {
  return (
    <div className="pi-steering-marker">
      <span className="pi-steering-marker-label">{t("chat.steering")}</span>
      <span className="pi-steering-marker-text">{message.content}</span>
      <time
        className="pi-steering-marker-time"
        dateTime={new Date(message.timestamp).toISOString()}
      >
        {new Date(message.timestamp).toLocaleTimeString(locale)}
      </time>
    </div>
  );
}

export function createPiHistoryBubbleItem(
  entry: PiHistoryTranscriptEntry,
  index: number,
  locale: Locale,
  t: Translator,
): BubbleItemType {
  if (entry.role === "assistant-turn") {
    return {
      key: `${entry.role}-${entry.timestamp}-${index}`,
      role: "assistant",
      content: <PiAssistantTurnContent t={t} entry={entry} />,
      header: (
        <MessageHeader
          label={t("chat.piSession")}
          meta={
            entry.finalMessage.provider && entry.finalMessage.model
              ? `${entry.finalMessage.provider}/${entry.finalMessage.model}`
              : t("chat.assistant")
          }
        />
      ),
    };
  }

  if (entry.role === "user") {
    return {
      key: `${entry.role}-${entry.timestamp}-${index}`,
      role: "user",
      content: <PiHistoryUserMessageContent message={entry} />,
      header: <MessageHeader label={t("chat.piSession")} meta={t("chat.user")} />,
    };
  }

  if (entry.role === "assistant") {
    return {
      key: `${entry.role}-${entry.timestamp}-${index}`,
      role: "assistant",
      content: entry.content,
      header: (
        <MessageHeader
          label={t("chat.piSession")}
          meta={
            entry.provider && entry.model ? `${entry.provider}/${entry.model}` : t("chat.assistant")
          }
        />
      ),
    };
  }

  if (entry.role === "thinking") {
    return {
      key: `${entry.role}-${entry.timestamp}-${index}`,
      role: "assistant",
      content: <PiThinkingDisclosureContent t={t} message={entry} />,
      header: <MessageHeader label={t("chat.piSession")} meta={t("chat.thinkingHistory")} />,
    };
  }

  if (entry.role === "steering") {
    return {
      key: `${entry.role}-${entry.timestamp}-${index}`,
      role: "divider",
      content: <PiSteeringMessageContent locale={locale} message={entry} t={t} />,
      className: "chat-bubble-divider",
      dividerProps: { plain: true },
    };
  }

  if (entry.role === "tool") {
    return {
      key: `${entry.role}-${entry.timestamp}-${index}`,
      role: "assistant",
      content: <PiToolMessageContent t={t} message={entry} />,
      header: <MessageHeader label={t("chat.tool")} meta={entry.toolName} />,
    };
  }

  if (entry.role === "local_result") {
    return {
      key: `${entry.role}-${entry.timestamp}-${index}`,
      role: "assistant",
      content: <PiLocalResultContent message={entry} />,
      header: <MessageHeader label={t("chat.localAction")} meta={entry.title} />,
    };
  }

  return {
    key: `${entry.role}-${entry.timestamp}-${index}`,
    role: "assistant",
    content: <PiSummaryMessageContent message={entry} />,
    header: <MessageHeader label={entry.title} meta={t("chat.piSessionSummary")} />,
  };
}
