import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import CodeHighlighter from "@ant-design/x/es/code-highlighter";
import type { Components } from "react-markdown";

type RenderMarkdownCodeArgs = {
  className?: string;
  children: React.ReactNode;
  props?: React.ComponentProps<"code">;
};

export function renderMarkdownCode({ className, children, props = {} }: RenderMarkdownCodeArgs) {
  const codeText = String(children).replace(/\n$/, "");
  const match = /language-(\w+)/.exec(className ?? "");
  const lang = match?.[1];

  // Use the full Prism bundle to avoid dev-time dynamic import warnings.
  if (lang || codeText.includes("\n")) {
    return (
      <CodeHighlighter lang={lang} prismLightMode={false}>
        {codeText}
      </CodeHighlighter>
    );
  }

  return (
    <code className={className} {...props}>
      {children}
    </code>
  );
}

const components: Components = {
  code({ className, children, ...props }) {
    return renderMarkdownCode({ className, children, props });
  },
  // CodeHighlighter already provides its own wrapper, strip outer <pre>
  pre({ children }) {
    return <>{children}</>;
  },
};

function MarkdownContent({ content }: { content: string }) {
  return (
    <div className="markdown-content">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}

export default MarkdownContent;
