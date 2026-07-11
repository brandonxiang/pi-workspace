import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import CodeHighlighter from "@ant-design/x/es/code-highlighter";
import MarkdownContent, { renderMarkdownCode } from "./MarkdownContent";

describe("renderMarkdownCode", () => {
  it("uses full Prism mode for fenced code blocks", () => {
    const element = renderMarkdownCode({
      className: "language-bash",
      children: "echo hello\n"
    });

    expect(element.type).toBe(CodeHighlighter);
    expect(element.props.lang).toBe("bash");
    expect(element.props.prismLightMode).toBe(false);
    expect(element.props.children).toBe("echo hello");
  });

  it("keeps inline code inline", () => {
    const element = renderMarkdownCode({
      children: "npm run dev"
    });

    expect(element.type).toBe("code");
    expect(element.props.children).toBe("npm run dev");
  });

  it("wraps markdown output in a dedicated container", () => {
    const html = renderToStaticMarkup(
      MarkdownContent({ content: "Summary\n\n1. One\n2. Two" })
    );

    expect(html).toContain('class="markdown-content"');
  });
});
