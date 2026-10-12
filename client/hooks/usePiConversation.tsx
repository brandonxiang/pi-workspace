import {
  type ChangeEvent,
  type Dispatch,
  type SetStateAction,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { BubbleItemType } from "@ant-design/x/es/bubble";
import {
  findAppSlashCommand,
  isServerAppSlashCommand,
  parseSlashCommandInput,
} from "../../shared/slash-commands.js";
import type { Translator } from "../i18n/index";
import type { PanelMode } from "../router/index";
import {
  applyPiSessionStreamingEvent,
  createPiSessionStreamingState,
  flushPiSessionThinking,
} from "../api/pi-session-streaming";
import { MessageHeader, StreamingErrorContent } from "../components/pi/PiHistoryContent";
import {
  maxImageBytes,
  supportedImageMimeTypes,
  THINKING_LEVEL_STORAGE_KEY,
} from "../constants/index";
import type {
  ActivePanelView,
  AssistantMessage,
  ComposerSubmitMode,
  ImageAttachment,
  LocalActionResult,
  PiHistoryMessage,
  PiSessionDetailResponse,
  QueuedComposerMessage,
  SessionStatus,
  ThinkingLevel,
  UserMessage,
} from "../types/index";
import {
  readEventStream,
  readFileAsBase64,
  readStoredFollowUpsForSession,
  writeStoredFollowUpsForSession,
} from "../utils/index";

export interface UsePiConversationOptions {
  t: Translator;
  panelMode: PanelMode;
  activePanelView: ActivePanelView;
  selectedModel: { provider: string; model: string };
  selectedModelSupportsImages: boolean;
  piHistoryMessages: PiHistoryMessage[];
  piSessionDetailLoaded: boolean;
  setPiSessionDetail: Dispatch<SetStateAction<PiSessionDetailResponse | null>>;
  setPiLocalMessages: Dispatch<SetStateAction<PiHistoryMessage[]>>;
  setPiPendingMessages: Dispatch<SetStateAction<PiHistoryMessage[]>>;
  setSessionStatusInProjects: (sessionId: string, status: SessionStatus) => void;
  fetchContextUsage: (sessionId: string) => void;
  refreshPiProjects: () => Promise<void>;
  loadPiSessionDetail: (sessionId: string) => Promise<PiSessionDetailResponse>;
  openSettingsPage: () => void;
  openHotkeysModal: () => void;
}

export function usePiConversation(options: UsePiConversationOptions) {
  const {
    t,
    panelMode,
    activePanelView,
    selectedModel,
    selectedModelSupportsImages,
    piHistoryMessages,
    piSessionDetailLoaded,
    setPiSessionDetail,
    setPiLocalMessages,
    setPiPendingMessages,
    setSessionStatusInProjects,
    fetchContextUsage,
    refreshPiProjects,
    loadPiSessionDetail,
    openSettingsPage,
    openHotkeysModal,
  } = options;

  const [input, setInput] = useState("");
  const [selectedImage, setSelectedImage] = useState<ImageAttachment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [draftAssistant, setDraftAssistant] = useState("");
  const [draftError, setDraftError] = useState<string | null>(null);
  const [draftThinking, setDraftThinking] = useState("");
  const [draftThinkingVisible, setDraftThinkingVisible] = useState(false);
  const [draftToolMessages, setDraftToolMessages] = useState<
    Map<string, { toolName: string; arguments: string; content: string; isError: boolean }>
  >(new Map());
  const [queuedFollowUps, setQueuedFollowUps] = useState<QueuedComposerMessage[]>([]);

  const thinkingFlushTimeoutRef = useRef<number | null>(null);
  const streamSessionIdRef = useRef<string | null>(null);
  const followUpDrainAttemptedSessionRef = useRef<string | null>(null);
  const followUpDrainInFlightRef = useRef(false);
  const followUpDrainRequestedRef = useRef(false);

  const selectedPiSessionId = activePanelView.kind === "pi" ? activePanelView.sessionId : null;

  function updateQueuedFollowUps(
    updater: (current: QueuedComposerMessage[]) => QueuedComposerMessage[],
  ) {
    if (!selectedPiSessionId) return;

    setQueuedFollowUps((current) => {
      const nextQueue = updater(current);
      writeStoredFollowUpsForSession(selectedPiSessionId, nextQueue);
      return nextQueue;
    });
  }

  function removeQueuedFollowUp(id: string) {
    updateQueuedFollowUps((current) => current.filter((item) => item.id !== id));
  }

  function clearThinkingFlushTimeout() {
    if (thinkingFlushTimeoutRef.current === null) return;
    window.clearTimeout(thinkingFlushTimeoutRef.current);
    thinkingFlushTimeoutRef.current = null;
  }

  function resetStreamingDraft() {
    clearThinkingFlushTimeout();
    setDraftAssistant("");
    setDraftError(null);
    setDraftThinking("");
    setDraftThinkingVisible(false);
    setDraftToolMessages(new Map());
  }

  const draftToolBubbleItems = useMemo<BubbleItemType[]>(() => {
    if (panelMode !== "terminal" || draftToolMessages.size === 0) return [];

    return Array.from(draftToolMessages.entries()).map(([toolCallId, entry]) => ({
      key: `tool-streaming-${toolCallId}`,
      role: "assistant" as const,
      content: (
        <details className="pi-tool-card" open>
          <summary>
            <span>{entry.toolName}</span>
            <small>{t("chat.streaming")}</small>
          </summary>
          {entry.arguments ? <pre className="pi-tool-args">{entry.arguments}</pre> : null}
          <pre className="pi-tool-result">{entry.content || "…"}</pre>
        </details>
      ),
      header: <MessageHeader label={t("chat.tool")} meta={entry.toolName} />,
    }));
  }, [draftToolMessages, panelMode, t]);

  const thinkingBubbleItem = useMemo<BubbleItemType | null>(() => {
    if (!draftThinkingVisible) return null;

    return {
      key: "assistant-thinking",
      role: "assistant",
      content: (
        <div className="thinking-block thinking-block-static">
          <div className="thinking-block-title">{t("chat.thinking")}</div>
          <div className="thinking-content">{draftThinking}</div>
        </div>
      ),
      streaming: isStreaming,
      status: "updating" as const,
      header: <MessageHeader label={t("chat.myPi")} meta={t("chat.streaming")} />,
    };
  }, [draftThinking, draftThinkingVisible, isStreaming, t]);

  const streamingAssistantBubbleItem = useMemo<BubbleItemType | null>(() => {
    if (!draftAssistant) return null;

    return {
      key: "assistant-streaming",
      role: "assistant",
      content: draftAssistant,
      streaming: isStreaming,
      status: "updating" as const,
      header: <MessageHeader label={t("chat.myPi")} meta={t("chat.streaming")} />,
    };
  }, [draftAssistant, isStreaming, t]);

  const streamingErrorBubbleItem = useMemo<BubbleItemType | null>(() => {
    if (!draftError) return null;

    return {
      key: "assistant-error",
      role: "assistant",
      content: <StreamingErrorContent message={draftError} />,
      header: <MessageHeader label={t("chat.myPi")} meta={t("chat.error")} />,
    };
  }, [draftError, t]);

  useEffect(() => {
    return () => {
      clearThinkingFlushTimeout();
    };
  }, []);

  useEffect(() => {
    if (!selectedPiSessionId) {
      setQueuedFollowUps([]);
      followUpDrainAttemptedSessionRef.current = null;
      followUpDrainRequestedRef.current = false;
      return;
    }

    setQueuedFollowUps(readStoredFollowUpsForSession(selectedPiSessionId));
    followUpDrainAttemptedSessionRef.current = null;
    followUpDrainRequestedRef.current = false;
  }, [selectedPiSessionId]);

  useEffect(() => {
    if (selectedImage && !selectedModelSupportsImages) {
      setSelectedImage(null);
      setError(t("errors.removedImageUnsupported"));
    }
  }, [selectedImage, selectedModelSupportsImages, t]);

  function createLocalUserMessage(content: string): Extract<PiHistoryMessage, { role: "user" }> {
    return {
      id: `local-user-${crypto.randomUUID()}`,
      role: "user",
      content,
      timestamp: Date.now(),
    };
  }

  function createLocalResultMessage(
    result: LocalActionResult,
  ): Extract<PiHistoryMessage, { role: "local_result" }> {
    return {
      id: `local-result-${crypto.randomUUID()}`,
      role: "local_result",
      title: result.title,
      content: result.content,
      status: result.status,
      timestamp: Date.now(),
    };
  }

  function appendPiLocalTurn(
    userMessage: Extract<PiHistoryMessage, { role: "user" }>,
    result: LocalActionResult,
  ) {
    setPiLocalMessages((current) => [...current, userMessage, createLocalResultMessage(result)]);
  }

  async function runClientSlashAction(
    commandName: "settings" | "model" | "copy" | "hotkeys",
  ): Promise<LocalActionResult> {
    if (commandName === "settings") {
      openSettingsPage();
      return {
        title: "Settings",
        content: "Opened the Settings page.",
        status: "success",
      };
    }

    if (commandName === "model") {
      openSettingsPage();
      return {
        title: "Model",
        content: "Opened Settings. Update the model from the Settings page.",
        status: "success",
      };
    }

    if (commandName === "hotkeys") {
      openHotkeysModal();
      return {
        title: "Keyboard shortcuts",
        content: "Opened the keyboard shortcuts help.",
        status: "success",
      };
    }

    const latestAssistant = [...piHistoryMessages]
      .reverse()
      .find(
        (message): message is Extract<PiHistoryMessage, { role: "assistant" }> =>
          message.role === "assistant",
      );

    if (!latestAssistant?.content) {
      return {
        title: "Copy",
        content: "No assistant message is available to copy yet.",
        status: "error",
      };
    }

    try {
      await navigator.clipboard.writeText(latestAssistant.content);
      return {
        title: "Copy",
        content: `Copied the last assistant message to the clipboard (${latestAssistant.content.length} characters).`,
        status: "success",
      };
    } catch (copyError) {
      return {
        title: "Copy",
        content:
          copyError instanceof Error
            ? `Failed to copy the last assistant message: ${copyError.message}`
            : "Failed to copy the last assistant message.",
        status: "error",
      };
    }
  }

  async function runServerSlashAction(
    action: "session" | "export" | "name" | "compact",
    args: string,
  ): Promise<LocalActionResult> {
    const response = await fetch("/api/pi-local-actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pi-session-id": activePanelView.kind === "pi" ? activePanelView.sessionId : "",
      },
      body: JSON.stringify({ action, args }),
    });

    const body = (await response.json().catch(() => null)) as {
      result?: LocalActionResult;
      error?: string;
    } | null;

    if (!response.ok || !body?.result) {
      throw new Error(body?.error || `Request failed with ${response.status}`);
    }

    return body.result;
  }

  async function submitSteeringMessage(messageText: string, image: ImageAttachment | null) {
    if (activePanelView.kind !== "pi") return;

    const response = await fetch("/api/chat/steer", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-pi-session-id": activePanelView.sessionId,
      },
      body: JSON.stringify({
        ...selectedModel,
        prompt: messageText,
        images: image
          ? [
              {
                name: image.name,
                mimeType: image.mimeType,
                size: image.size,
                data: image.data,
              },
            ]
          : undefined,
      }),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      throw new Error(body?.error || `Request failed with ${response.status}`);
    }
  }

  function queueFollowUpMessage(message: QueuedComposerMessage) {
    followUpDrainRequestedRef.current = true;
    updateQueuedFollowUps((current) => [...current, message]);
  }

  async function runPiPrompt(userMessage: UserMessage) {
    if (activePanelView.kind !== "pi") return;

    const sessionId = activePanelView.sessionId;

    setPiPendingMessages([
      {
        id: `pi-user-${userMessage.timestamp}`,
        role: "user",
        content: userMessage.content,
        images: userMessage.images,
        timestamp: userMessage.timestamp,
      },
    ]);

    setInput("");
    setSelectedImage(null);
    resetStreamingDraft();
    setError(null);
    setIsStreaming(true);
    streamSessionIdRef.current = sessionId;
    setSessionStatusInProjects(sessionId, "in_progress");

    let streamState = createPiSessionStreamingState(panelMode);
    setDraftThinkingVisible(streamState.thinkingVisible);

    const syncStreamingDraft = () => {
      setDraftAssistant(streamState.assistant);
      setDraftError(streamState.error);
      setDraftThinkingVisible(streamState.thinkingVisible);
      setDraftThinking(streamState.visibleThinking);
      setDraftToolMessages(new Map(streamState.activeToolMessages));
    };

    const flushThinkingDraft = () => {
      thinkingFlushTimeoutRef.current = null;
      streamState = flushPiSessionThinking(streamState);
      syncStreamingDraft();
    };

    const scheduleThinkingFlush = () => {
      if (thinkingFlushTimeoutRef.current !== null) return;

      thinkingFlushTimeoutRef.current = window.setTimeout(() => {
        flushThinkingDraft();
      }, 75);
    };

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-pi-session-id": sessionId,
        },
        body: JSON.stringify({
          ...selectedModel,
          prompt: userMessage.content,
          thinkingLevel:
            (localStorage.getItem(THINKING_LEVEL_STORAGE_KEY) as ThinkingLevel | null) || "high",
          images: userMessage.images?.map((image) => ({
            name: image.name,
            mimeType: image.mimeType,
            size: image.size,
            data: image.data,
          })),
        }),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || `Request failed with ${response.status}`);
      }

      await readEventStream(response, (streamEvent) => {
        streamState = applyPiSessionStreamingEvent(streamState, streamEvent);

        if (streamEvent.type === "thinking") {
          if (streamState.acceptsThinking && streamState.bufferedThinking) {
            scheduleThinkingFlush();
          }
          return;
        }

        clearThinkingFlushTimeout();
        if (streamEvent.type !== "done" && streamEvent.type !== "error") {
          streamState = flushPiSessionThinking(streamState);
        }
        syncStreamingDraft();

        if (streamEvent.type === "error") {
          setError(streamEvent.error);
        }
      });

      if (streamState.finalMessage && streamSessionIdRef.current === sessionId) {
        fetchContextUsage(sessionId);

        const fm = streamState.finalMessage as AssistantMessage;
        const finalAssistantMsg: AssistantMessage = {
          role: "assistant",
          content: fm.content,
          provider: fm.provider,
          model: fm.model,
          timestamp: fm.timestamp,
        };

        const pendingUserMsg: PiHistoryMessage = {
          id: `pi-user-${Date.now()}`,
          role: "user",
          content: userMessage.content,
          images: userMessage.images,
          timestamp: userMessage.timestamp,
        };
        const thinkingMessage = streamState.completedThinking
          ? ({
              id: `thinking-${Date.now()}`,
              role: "thinking",
              content: streamState.completedThinking,
              timestamp: finalAssistantMsg.timestamp - 1,
            } as Extract<PiHistoryMessage, { role: "thinking" }>)
          : null;
        const toolBaseTimestamp = finalAssistantMsg.timestamp + 1;
        const toolMsgs: Extract<PiHistoryMessage, { role: "tool" }>[] =
          streamState.completedToolMessages.map(
            (tool, index) =>
              ({
                id: `tool-${Date.now()}-${index}`,
                role: "tool",
                toolCallId: tool.toolCallId,
                toolName: tool.toolName,
                arguments: tool.arguments,
                content: tool.content,
                isError: tool.isError,
                expandable: true,
                timestamp: toolBaseTimestamp + index,
              }) as Extract<PiHistoryMessage, { role: "tool" }>,
          );
        setPiSessionDetail((current) =>
          current
            ? {
                ...current,
                session: {
                  ...current.session,
                  modified: new Date(finalAssistantMsg.timestamp).toISOString(),
                },
                messages: [
                  ...current.messages,
                  pendingUserMsg,
                  ...(thinkingMessage ? [thinkingMessage] : []),
                  {
                    id: finalAssistantMsg.content.slice(0, 32),
                    role: "assistant",
                    content: finalAssistantMsg.content,
                    provider: finalAssistantMsg.provider,
                    model: finalAssistantMsg.model,
                    timestamp: finalAssistantMsg.timestamp,
                  } as Extract<PiHistoryMessage, { role: "assistant" }>,
                  ...toolMsgs,
                ],
              }
            : current,
        );
        setPiPendingMessages([]);
      }
      setSessionStatusInProjects(sessionId, "pending_review");
    } catch (err) {
      if (err instanceof Error && err.message === "No response stream returned.") {
        setError(t("errors.streamMissing"));
      } else {
        setError(err instanceof Error ? err.message : t("errors.unexpectedChat"));
      }
      setPiPendingMessages([]);
      throw err;
    } finally {
      if (!streamState.error) {
        resetStreamingDraft();
      }
      setIsStreaming(false);
    }
  }

  async function submitLocalSlashAction(trimmedInput: string): Promise<boolean> {
    const parsed = parseSlashCommandInput(trimmedInput);
    if (!parsed) return false;

    const command = findAppSlashCommand(parsed.normalizedName);
    if (!command) return false;

    const userMessage = createLocalUserMessage(trimmedInput);
    setInput("");
    setSelectedImage(null);
    setError(null);
    setIsStreaming(true);

    let result: LocalActionResult;
    try {
      result = isServerAppSlashCommand(command)
        ? await runServerSlashAction(command.name, parsed.args)
        : await runClientSlashAction(command.name);
    } catch (actionError) {
      appendPiLocalTurn(userMessage, {
        title: command.name,
        content:
          actionError instanceof Error
            ? actionError.message
            : "The local action failed unexpectedly.",
        status: "error",
      });
      setIsStreaming(false);
      return true;
    }

    appendPiLocalTurn(userMessage, result);

    if (result.updatedSessionName) {
      setPiSessionDetail((current) =>
        current
          ? {
              ...current,
              session: {
                ...current.session,
                name: result.updatedSessionName || current.session.name,
              },
            }
          : current,
      );
    }

    try {
      if (result.refreshProjects) {
        try {
          await refreshPiProjects();
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "The command succeeded, but refreshing the project list failed.",
          );
        }
      }

      if (result.refreshSessionDetail && activePanelView.kind === "pi") {
        try {
          const detail = await loadPiSessionDetail(activePanelView.sessionId);
          setPiSessionDetail(detail);
        } catch (refreshError) {
          setError(
            refreshError instanceof Error
              ? refreshError.message
              : "The session updated, but refreshing the latest history failed.",
          );
        }
      }
    } finally {
      setIsStreaming(false);
    }

    return true;
  }

  async function submitMessage(messageText: string, mode: ComposerSubmitMode = "default") {
    const trimmed = messageText.trim();
    if ((!trimmed && !selectedImage) || activePanelView.kind !== "pi") return;

    if (isStreaming) {
      if (mode === "steering") {
        const queuedImage = selectedImage;
        const steeringContent = trimmed || t("composer.defaultImagePrompt");
        const steeringId = `pi-steering-${Date.now()}`;
        setPiLocalMessages((current) => [
          ...current,
          {
            id: steeringId,
            role: "steering",
            content: steeringContent,
            timestamp: Date.now(),
          },
        ]);
        setInput("");
        setSelectedImage(null);
        setError(null);
        void submitSteeringMessage(steeringContent, queuedImage).catch((steerError) => {
          setPiLocalMessages((current) => current.filter((message) => message.id !== steeringId));
          setError(steerError instanceof Error ? steerError.message : t("errors.unexpectedChat"));
        });
        return;
      }
      queueFollowUpMessage({
        id: crypto.randomUUID(),
        content: trimmed || t("composer.defaultImagePrompt"),
        image: selectedImage || undefined,
      });
      setInput("");
      setSelectedImage(null);
      setError(null);
      return;
    }

    if (await submitLocalSlashAction(trimmed)) {
      return;
    }

    if (selectedImage && !selectedModelSupportsImages) {
      setError(t("errors.noImageSupport"));
      return;
    }

    const userMessage: UserMessage = {
      role: "user",
      content: trimmed || t("composer.defaultImagePrompt"),
      images: selectedImage ? [selectedImage] : undefined,
      timestamp: Date.now(),
    };
    try {
      await runPiPrompt(userMessage);
    } catch {
      // Error state is handled inside runPiPrompt.
    }
  }

  async function drainNextQueuedFollowUp() {
    if (
      activePanelView.kind !== "pi" ||
      followUpDrainInFlightRef.current ||
      isStreaming ||
      queuedFollowUps.length === 0
    ) {
      return;
    }

    const [nextFollowUp, ...remainingFollowUps] = queuedFollowUps;
    followUpDrainInFlightRef.current = true;
    writeStoredFollowUpsForSession(activePanelView.sessionId, remainingFollowUps);
    setQueuedFollowUps(remainingFollowUps);

    try {
      await runPiPrompt({
        role: "user",
        content: nextFollowUp.content,
        images: nextFollowUp.image ? [nextFollowUp.image] : undefined,
        timestamp: Date.now(),
      });
      followUpDrainRequestedRef.current = remainingFollowUps.length > 0;
    } catch {
      writeStoredFollowUpsForSession(activePanelView.sessionId, [
        nextFollowUp,
        ...remainingFollowUps,
      ]);
      setQueuedFollowUps([nextFollowUp, ...remainingFollowUps]);
      followUpDrainRequestedRef.current = false;
    } finally {
      followUpDrainInFlightRef.current = false;
    }
  }

  useEffect(() => {
    if (
      activePanelView.kind !== "pi" ||
      !piSessionDetailLoaded ||
      isStreaming ||
      queuedFollowUps.length === 0
    ) {
      return;
    }

    const shouldAttemptHydratedDrain =
      followUpDrainAttemptedSessionRef.current !== activePanelView.sessionId;
    if (!followUpDrainRequestedRef.current && !shouldAttemptHydratedDrain) {
      return;
    }

    followUpDrainAttemptedSessionRef.current = activePanelView.sessionId;
    void drainNextQueuedFollowUp();
  }, [activePanelView, isStreaming, piSessionDetailLoaded, queuedFollowUps.length]);

  function handleSenderSubmit(messageText: string) {
    void submitMessage(messageText);
  }

  function handleSlashSelect(value: string) {
    setInput(`${value} `);
  }

  async function handleImageFile(file: File) {
    if (!selectedModelSupportsImages) {
      setError(t("errors.noImageSupport"));
      return;
    }
    if (!supportedImageMimeTypes.includes(file.type)) {
      setError(t("errors.uploadSupportedImage"));
      return;
    }
    if (file.size > maxImageBytes) {
      setError(t("errors.imageTooLarge"));
      return;
    }

    try {
      const data = await readFileAsBase64(file);
      setSelectedImage({
        id: crypto.randomUUID(),
        name: file.name,
        mimeType: file.type,
        size: file.size,
        data,
      });
      setError(null);
    } catch {
      setError(t("errors.readImageFailed"));
    }
  }

  function handleImageChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) void handleImageFile(file);
  }

  return {
    input,
    setInput,
    selectedImage,
    setSelectedImage,
    error,
    setError,
    draftError,
    isStreaming,
    queuedFollowUps,
    removeQueuedFollowUp,
    resetStreamingDraft,
    draftToolBubbleItems,
    thinkingBubbleItem,
    streamingAssistantBubbleItem,
    streamingErrorBubbleItem,
    submitMessage,
    handleSenderSubmit,
    handleSlashSelect,
    handleImageChange,
    handleImageFile,
  };
}
