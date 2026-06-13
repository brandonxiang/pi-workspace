export type ImageAttachment = {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  data: string;
};

export type UserMessage = {
  role: "user";
  content: string;
  images?: ImageAttachment[];
  timestamp: number;
};

export type AssistantMessage = {
  role: "assistant";
  content: string;
  provider: string;
  model: string;
  timestamp: number;
};

export type ChatMessage = UserMessage | AssistantMessage;

export type StreamEvent =
  | { type: "delta"; delta: string }
  | { type: "thinking"; delta: string }
  | { type: "done"; message: AssistantMessage }
  | { type: "error"; message?: AssistantMessage; error: string };

/* ───── Pi session types ───── */

export interface PiSessionSummary {
  id: string;
  firstMessage: string;
  messageCount: number;
  created: string;
  modified: string;
}

export interface PiSessionProject {
  name: string;
  path: string;
  sessions: PiSessionSummary[];
}

export interface PiSessionsResponse {
  projects: PiSessionProject[];
}
