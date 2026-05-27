export type UserMessage = {
  role: "user";
  content: string;
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
