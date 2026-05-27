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
