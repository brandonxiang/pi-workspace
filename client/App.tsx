import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Modal } from "antd";
import Bubble, { type BubbleItemType, type BubbleListProps } from "@ant-design/x/es/bubble";
import Sender from "@ant-design/x/es/sender";
import Suggestion, { type SuggestionItem } from "@ant-design/x/es/suggestion";
import XProvider from "@ant-design/x/es/x-provider";
import type { AssistantMessage, ChatMessage, ImageAttachment, StreamEvent, UserMessage } from "./types";
import { PiSessionSection } from "./PiSessionSection";

const STORAGE_KEY = "my-pi-chat-session";
const SESSIONS_STORAGE_KEY = "my-pi-chat-sessions";
const ACTIVE_SESSION_KEY = "my-pi-active-session-id";
const supportedImageMimeTypes = ["image/png", "image/jpeg", "image/webp", "image/gif"];
const maxImageBytes = 5 * 1024 * 1024;

const modelPresets = [
  { provider: "openai", model: "gpt-4o-mini", label: "OpenAI GPT-4o mini", supportsImages: true },
  { provider: "openai", model: "gpt-4.1-mini", label: "OpenAI GPT-4.1 mini", supportsImages: true },
  {
    provider: "anthropic",
    model: "claude-3-5-haiku-20241022",
    label: "Claude 3.5 Haiku",
    supportsImages: true
  },
  { provider: "google", model: "gemini-2.5-flash", label: "Gemini 2.5 Flash", supportsImages: true },
  { provider: "mistral", model: "mistral-small-latest", label: "Mistral Small", supportsImages: false }
];

type ModelOption = (typeof modelPresets)[number];
type SlashSuggestionInfo = { query: string };
type ChatSession = {
  id: string;
  title: string;
  archived: boolean;
  createdAt: number;
  updatedAt: number;
  messages: ChatMessage[];
};

const defaultSystemPrompt =
  "You are My Pi, an online agent conversation assistant. Be concise, practical, and explicit about assumptions.";

const slashCommands = [
  { name: "settings", description: "Open settings menu" },
  { name: "model", description: "Select model" },
  { name: "scoped-models", description: "Enable or disable model cycling" },
  { name: "export", description: "Export session" },
  { name: "import", description: "Import a JSONL session" },
  { name: "share", description: "Share session as a private gist" },
  { name: "copy", description: "Copy last assistant message" },
  { name: "name", description: "Set session display name" },
  { name: "session", description: "Show session info and stats" },
  { name: "changelog", description: "Show changelog entries" },
  { name: "hotkeys", description: "Show keyboard shortcuts" },
  { name: "fork", description: "Fork from a previous message" },
  { name: "clone", description: "Duplicate current session branch" },
  { name: "tree", description: "Navigate session tree" },
  { name: "login", description: "Configure provider authentication" },
  { name: "logout", description: "Remove provider authentication" },
  { name: "new", description: "Start a new session" },
  { name: "compact", description: "Compact session context" },
  { name: "resume", description: "Resume a different session" },
  { name: "reload", description: "Reload resources" },
  { name: "quit", description: "Quit pi" }
];

const bubbleRoles: BubbleListProps["role"] = {
  assistant: {
    placement: "start",
    variant: "outlined",
    shape: "default",
    className: "chat-bubble chat-bubble-assistant"
  },
  user: {
    placement: "end",
    variant: "outlined",
    shape: "default",
    className: "chat-bubble chat-bubble-user"
  }
};

const xTheme = {
  token: {
    colorPrimary: "#5645d4",
    borderRadius: 8,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif"
  }
};

function createSessionId() {
  return crypto.randomUUID();
}

function createSession(title = "Untitled session", messages: ChatMessage[] = []): ChatSession {
  const timestamp = Date.now();

  return {
    id: createSessionId(),
    title,
    archived: false,
    createdAt: timestamp,
    updatedAt: timestamp,
    messages
  };
}

function getSessionTitleFromMessages(messages: ChatMessage[]) {
  const firstUserMessage = messages.find((message) => message.role === "user");
  if (!firstUserMessage?.content.trim()) return "Untitled session";
  return firstUserMessage.content.trim().slice(0, 48);
}

function readStoredSessions(): ChatSession[] {
  try {
    const rawSessions = localStorage.getItem(SESSIONS_STORAGE_KEY);
    if (rawSessions) {
      const parsed = JSON.parse(rawSessions) as ChatSession[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.some((session) => !session.archived) ? parsed : [createSession(), ...parsed];
      }
    }

    const legacyMessages = readStoredMessages();
    if (legacyMessages.length > 0) {
      return [createSession(getSessionTitleFromMessages(legacyMessages), legacyMessages)];
    }
  } catch {
    // Fall through to a clean session if local storage is unavailable or corrupted.
  }

  return [createSession()];
}

function getMessageText(message: ChatMessage) {
  return message.content;
}

function getImageDataUrl(image: ImageAttachment) {
  return `data:${image.mimeType};base64,${image.data}`;
}

function getModelKey(provider: string, model: string) {
  return `${provider}:${model}`;
}

function parseModelKey(modelKey: string) {
  const separatorIndex = modelKey.indexOf(":");
  if (separatorIndex === -1) return { provider: "openai", model: "gpt-4o-mini" };

  return {
    provider: modelKey.slice(0, separatorIndex),
    model: modelKey.slice(separatorIndex + 1)
  };
}

function MessageHeader({ label, meta }: { label: string; meta: string }) {
  return (
    <div className="message-meta">
      <span>{label}</span>
      <small>{meta}</small>
    </div>
  );
}

function UserMessageContent({ message }: { message: UserMessage }) {
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
      <p>{getMessageText(message)}</p>
    </div>
  );
}

function createBubbleItem(message: ChatMessage, index: number): BubbleItemType {
  const isAssistant = message.role === "assistant";

  return {
    key: `${message.role}-${message.timestamp}-${index}`,
    role: isAssistant ? "assistant" : "user",
    content: isAssistant ? getMessageText(message) : <UserMessageContent message={message} />,
    header: (
      <MessageHeader
        label={isAssistant ? "My Pi" : "You"}
        meta={isAssistant ? `${message.provider}/${message.model}` : "You"}
      />
    )
  };
}

function readFileAsBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve(base64);
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}

function shouldShowSlashSuggestions(value: string) {
  return /^\/[\w-]*$/.test(value);
}

function getSlashSuggestionItems(info?: SlashSuggestionInfo): SuggestionItem[] {
  const query = info?.query.toLowerCase() || "";
  const matchedCommands = slashCommands.filter((command) =>
    command.name.toLowerCase().includes(query)
  );

  return matchedCommands.map((command) => ({
    label: (
      <div className="slash-command-option">
        <span>/{command.name}</span>
        <small>{command.description}</small>
      </div>
    ),
    value: `/${command.name}`,
    extra: <span className="slash-command-source">pi</span>
  }));
}

function readStoredMessages(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function readEventStream(response: Response, onEvent: (event: StreamEvent) => void) {
  if (!response.body) throw new Error("No response stream returned.");

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split("\n\n");
    buffer = chunks.pop() || "";

    for (const chunk of chunks) {
      const line = chunk
        .split("\n")
        .find((item) => item.startsWith("data: "));
      if (!line) continue;
      onEvent(JSON.parse(line.slice(6)) as StreamEvent);
    }
  }
}

export default function App() {
  const initialSessions = useMemo(() => readStoredSessions(), []);
  const [sessions, setSessions] = useState<ChatSession[]>(initialSessions);
  const [activeSessionId, setActiveSessionId] = useState(() => {
    const stored = localStorage.getItem(ACTIVE_SESSION_KEY);
    return initialSessions.some((session) => session.id === stored) ? stored! : initialSessions[0].id;
  });
  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageAttachment | null>(null);
  const [systemPrompt, setSystemPrompt] = useState(defaultSystemPrompt);
  const [modelKey, setModelKey] = useState("openai:gpt-4o-mini");
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(modelPresets);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [renameSessionId, setRenameSessionId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [draftAssistant, setDraftAssistant] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const sessionIdRef = useRef<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeSession = useMemo(() => {
    return sessions.find((session) => session.id === activeSessionId) || sessions[0];
  }, [activeSessionId, sessions]);

  const messages = activeSession?.messages ?? [];

  const visibleSessions = useMemo(() => {
    return sessions
      .filter((session) => !session.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions]);

  const archivedSessions = useMemo(() => {
    return sessions
      .filter((session) => session.archived)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [sessions]);

  const selectedModel = useMemo(() => {
    return parseModelKey(modelKey);
  }, [modelKey]);

  const selectedModelOption = useMemo(() => {
    return modelOptions.find(
      (option) => getModelKey(option.provider, option.model) === modelKey
    );
  }, [modelKey, modelOptions]);

  const selectedModelSupportsImages = selectedModelOption?.supportsImages ?? false;

  const bubbleItems = useMemo<BubbleItemType[]>(() => {
    const storedItems = messages.map(createBubbleItem);
    if (!draftAssistant) return storedItems;

    return [
      ...storedItems,
      {
        key: "assistant-streaming",
        role: "assistant",
        content: draftAssistant,
        streaming: isStreaming,
        status: "updating",
        header: <MessageHeader label="My Pi" meta="streaming" />
      }
    ];
  }, [draftAssistant, isStreaming, messages]);

  useEffect(() => {
    sessionIdRef.current = activeSessionId;
    localStorage.setItem(ACTIVE_SESSION_KEY, activeSessionId);
  }, [activeSessionId]);

  useEffect(() => {
    let cancelled = false;

    async function loadModels() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) return;
        const body = (await response.json()) as { models?: ModelOption[] };
        if (cancelled || !body.models?.length) return;

        setModelOptions(body.models);
        setModelKey((current) => {
          const currentExists = body.models?.some(
            (option) => `${option.provider}:${option.model}` === current
          );
          return currentExists ? current : getModelKey(body.models![0].provider, body.models![0].model);
        });
      } catch {
        // Keep static presets when the model registry endpoint is unavailable.
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
  }, [sessions]);

  useEffect(() => {
    if (selectedImage && !selectedModelSupportsImages) {
      setSelectedImage(null);
      setError("Removed the attached image because the selected model does not support image input.");
    }
  }, [selectedImage, selectedModelSupportsImages]);

  function updateSession(sessionId: string, updater: (session: ChatSession) => ChatSession) {
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...updater(session),
              updatedAt: Date.now()
            }
          : session
      )
    );
  }

  function createNewSession() {
    const nextSession = createSession();
    setSessions((current) => [nextSession, ...current]);
    setActiveSessionId(nextSession.id);
    setInput("");
    setSelectedImage(null);
    setDraftAssistant("");
    setError(null);
  }

  function beginRenameSession(session: ChatSession) {
    setRenameSessionId(session.id);
    setRenameDraft(session.title);
  }

  function saveSessionName(sessionId: string) {
    const nextTitle = renameDraft.trim() || "Untitled session";
    updateSession(sessionId, (session) => ({ ...session, title: nextTitle }));
    setRenameSessionId(null);
    setRenameDraft("");
  }

  function archiveSession(sessionId: string) {
    updateSession(sessionId, (session) => ({ ...session, archived: true }));
    if (activeSessionId === sessionId) {
      const nextActive = visibleSessions.find((session) => session.id !== sessionId) || createSession();
      if (!sessions.some((session) => session.id === nextActive.id)) {
        setSessions((current) => [nextActive, ...current]);
      }
      setActiveSessionId(nextActive.id);
      setDraftAssistant("");
      setInput("");
      setSelectedImage(null);
    }
  }

  function restoreSession(sessionId: string) {
    updateSession(sessionId, (session) => ({ ...session, archived: false }));
    setActiveSessionId(sessionId);
  }

  async function submitMessage(messageText: string) {
    const trimmed = messageText.trim();
    if ((!trimmed && !selectedImage) || isStreaming || !activeSession) return;

    if (selectedImage && !selectedModelSupportsImages) {
      setError("The selected model does not support image input. Choose a vision-capable model.");
      return;
    }

    const userMessage: UserMessage = {
      role: "user",
      content: trimmed || "Please analyze this image.",
      images: selectedImage ? [selectedImage] : undefined,
      timestamp: Date.now()
    };
    const conversationId = activeSession.id;
    const nextMessages = [...activeSession.messages, userMessage];

    updateSession(conversationId, (session) => ({
      ...session,
      title: session.messages.length === 0 ? getSessionTitleFromMessages([userMessage]) : session.title,
      messages: nextMessages
    }));
    setInput("");
    setSelectedImage(null);
    setDraftAssistant("");
    setError(null);
    setIsStreaming(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-session-id": conversationId
        },
        body: JSON.stringify({
          ...selectedModel,
          systemPrompt,
          prompt: userMessage.content,
          images: userMessage.images?.map((image) => ({
            name: image.name,
            mimeType: image.mimeType,
            size: image.size,
            data: image.data
          }))
        })
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Request failed with ${response.status}`);
      }

      let finalMessage: AssistantMessage | null = null;
      await readEventStream(response, (streamEvent) => {
        if (streamEvent.type === "delta") {
          setDraftAssistant((current) => current + streamEvent.delta);
        }

        if (streamEvent.type === "done") {
          finalMessage = streamEvent.message;
        }

        if (streamEvent.type === "error") {
          finalMessage = streamEvent.message || null;
          setError(streamEvent.error);
        }
      });

      if (finalMessage) {
        updateSession(conversationId, (session) => ({
          ...session,
          messages: [...session.messages, finalMessage as AssistantMessage]
        }));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unexpected chat error");
    } finally {
      setDraftAssistant("");
      setIsStreaming(false);
    }
  }

  function clearConversation() {
    if (!activeSession) return;
    updateSession(activeSession.id, (session) => ({ ...session, messages: [] }));
    setDraftAssistant("");
    setError(null);
  }

  function handleSlashSelect(value: string) {
    setInput(`${value} `);
  }

  async function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!selectedModelSupportsImages) {
      setError("The selected model does not support image input. Choose a vision-capable model.");
      return;
    }
    if (!supportedImageMimeTypes.includes(file.type)) {
      setError("Upload a PNG, JPEG, WebP, or GIF image.");
      return;
    }
    if (file.size > maxImageBytes) {
      setError("Image must be smaller than 5 MB.");
      return;
    }

    try {
      const data = await readFileAsBase64(file);
      setSelectedImage({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type,
        size: file.size,
        data
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to read image file");
    }
  }

  return (
    <XProvider theme={xTheme}>
      <main className="app-shell">
        <aside className="sidebar">
          <div className="brand-block">
            <p className="eyebrow">Online agent console</p>
            <h1>My Pi Agent</h1>
            <p className="sidebar-copy">
              A browser-based conversation layer powered by the pi AI provider runtime.
            </p>
          </div>

          <div className="sidebar-actions">
            <button className="secondary-button" disabled={isStreaming} type="button" onClick={createNewSession}>
              New session
            </button>
            <button className="secondary-button" type="button" onClick={() => setIsSettingsOpen(true)}>
              Settings
            </button>
          </div>

          <div className="session-manager">
            <div className="session-section-heading">
              <span>Conversations</span>
              <small>{visibleSessions.length}</small>
            </div>

            <div className="session-list">
              {visibleSessions.map((session) => (
                <div
                  className={session.id === activeSessionId ? "session-row session-row-active" : "session-row"}
                  key={session.id}
                >
                  {renameSessionId === session.id ? (
                    <input
                      autoFocus
                      className="session-rename-input"
                      value={renameDraft}
                      onBlur={() => saveSessionName(session.id)}
                      onChange={(event) => setRenameDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") saveSessionName(session.id);
                        if (event.key === "Escape") {
                          setRenameSessionId(null);
                          setRenameDraft("");
                        }
                      }}
                    />
                  ) : (
                    <button
                      className="session-select"
                      disabled={isStreaming}
                      type="button"
                      onClick={() => setActiveSessionId(session.id)}
                    >
                      <span>{session.title}</span>
                      <small>{session.messages.length} messages</small>
                    </button>
                  )}

                  <div className="session-row-actions">
                    <button
                      disabled={isStreaming}
                      type="button"
                      onClick={() => beginRenameSession(session)}
                    >
                      Rename
                    </button>
                    <button
                      disabled={isStreaming}
                      type="button"
                      onClick={() => archiveSession(session.id)}
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {archivedSessions.length > 0 ? (
              <div className="archived-sessions">
                <div className="session-section-heading">
                  <span>Archived</span>
                  <small>{archivedSessions.length}</small>
                </div>
                {archivedSessions.map((session) => (
                  <div className="session-row session-row-archived" key={session.id}>
                    <button
                      className="session-select"
                      disabled={isStreaming}
                      type="button"
                      onClick={() => restoreSession(session.id)}
                    >
                      <span>{session.title}</span>
                      <small>Archived · restore</small>
                    </button>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          <PiSessionSection isStreaming={isStreaming} />

          <div className="status-panel">
            <span className="status-dot" />
            <p>Backend streams through `@earendil-works/pi-coding-agent`; API keys stay server-side.</p>
          </div>
        </aside>

        <section className="chat-panel" aria-label="Agent conversation">
          <header className="chat-header">
            <div>
              <p className="eyebrow">Session</p>
              <h2>{activeSession?.title || "Agent dialogue"}</h2>
            </div>
            <div className="chat-header-actions">
              <button className="ghost-button" type="button" onClick={clearConversation}>
                Clear
              </button>
              <span className={isStreaming ? "pill pill-live" : "pill"}>{isStreaming ? "Streaming" : "Ready"}</span>
            </div>
          </header>

          {bubbleItems.length === 0 ? (
            <div className="messages messages-empty">
              <div className="empty-state">
                <h3>Start with a task or question.</h3>
                <p>
                  Try asking for a product plan, code review checklist, deployment runbook, or
                  implementation strategy.
                </p>
              </div>
              {error && <div className="error-banner">{error}</div>}
            </div>
          ) : (
            <div className="messages">
              <Bubble.List
                autoScroll
                className="chat-bubble-list"
                items={bubbleItems}
                role={bubbleRoles}
              />
              {error && <div className="error-banner">{error}</div>}
            </div>
          )}

          <div className="composer">
            {selectedImage ? (
              <div className="attachment-preview">
                <img alt={selectedImage.name} src={getImageDataUrl(selectedImage)} />
                <div>
                  <strong>{selectedImage.name}</strong>
                  <span>{Math.ceil(selectedImage.size / 1024)} KB · image analysis</span>
                </div>
                <button type="button" onClick={() => setSelectedImage(null)}>
                  Remove
                </button>
              </div>
            ) : null}
            <Suggestion<SlashSuggestionInfo>
              block
              className="slash-command-suggestion"
              items={getSlashSuggestionItems}
              onSelect={handleSlashSelect}
            >
              {({ onKeyDown, onTrigger }) => (
                <Sender
                  autoSize={{ minRows: 2, maxRows: 8 }}
                  className="chat-sender"
                  disabled={isStreaming}
                  footer={
                    <div className="composer-footer">
                      <input
                        ref={fileInputRef}
                        accept={supportedImageMimeTypes.join(",")}
                        onChange={handleImageChange}
                        type="file"
                      />
                      <button
                        disabled={isStreaming || !selectedModelSupportsImages}
                        title={
                          selectedModelSupportsImages
                            ? "Upload image"
                            : "Selected model does not support image input"
                        }
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                      >
                        Upload image
                      </button>
                    </div>
                  }
                  loading={isStreaming}
                  onChange={(value) => {
                    setInput(value);
                    onTrigger(
                      shouldShowSlashSuggestions(value)
                        ? { query: value.slice(1) }
                        : false
                    );
                  }}
                  onKeyDown={onKeyDown}
                  onSubmit={submitMessage}
                  placeholder="Ask the agent to reason, plan, or draft..."
                  submitType="enter"
                  value={input}
                />
              )}
            </Suggestion>
          </div>
        </section>
      </main>
      <Modal
        centered
        open={isSettingsOpen}
        title="Settings"
        footer={null}
        onCancel={() => setIsSettingsOpen(false)}
      >
        <div className="settings-modal-content">
          <label className="field">
            <span>Model</span>
            <select value={modelKey} onChange={(event) => setModelKey(event.target.value)}>
              {modelOptions.map((preset) => (
                <option key={getModelKey(preset.provider, preset.model)} value={getModelKey(preset.provider, preset.model)}>
                  {preset.label}{preset.supportsImages ? " · vision" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="field">
            <span>System prompt</span>
            <textarea
              value={systemPrompt}
              rows={7}
              onChange={(event) => setSystemPrompt(event.target.value)}
            />
          </label>
        </div>
      </Modal>
    </XProvider>
  );
}
