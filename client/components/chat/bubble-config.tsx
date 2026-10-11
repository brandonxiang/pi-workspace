import type { BubbleListProps } from "@ant-design/x/es/bubble";
import { RenderMarkdown } from "../pi/PiHistoryContent";

export const bubbleRoles: BubbleListProps["role"] = {
  assistant: {
    placement: "start",
    variant: "outlined",
    shape: "default",
    className: "chat-bubble chat-bubble-assistant",
    contentRender(content) {
      if (typeof content === "string") {
        return <RenderMarkdown content={content} />;
      }
      return content;
    },
  },
  user: {
    placement: "end",
    variant: "outlined",
    shape: "default",
    className: "chat-bubble chat-bubble-user",
  },
};

export const xTheme = {
  token: {
    colorPrimary: "#0075de",
    borderRadius: 8,
    fontFamily:
      "Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif",
  },
};
