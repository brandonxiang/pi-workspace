import type { AgentSession } from "@earendil-works/pi-coding-agent";

export interface ChatRequest {
  provider?: string;
  model?: string;
  systemPrompt?: string;
  prompt?: string;
  thinkingLevel?: "off" | "minimal" | "low" | "medium" | "high" | "xhigh";
  images?: ChatImage[];
}

export interface LocalActionRequest {
  action?: string;
  args?: string;
}

export interface AgentSessionRecord {
  session: AgentSession;
  provider: string;
  model: string;
  systemPrompt: string;
}

export interface PiAgentSessionRecord {
  session: AgentSession;
  provider: string;
  modelId: string;
}

export interface ChatImage {
  name?: string;
  mimeType?: string;
  data?: string;
  size?: number;
}

export interface CommandCodeApiModel {
  id: string;
  name: string;
  context_length: number;
}
