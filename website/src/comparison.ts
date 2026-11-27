import type { Locale } from "./content";

export const codingTools = [
  { id: "workspace", name: "pi-workspace", url: "https://github.com/brandonxiang/pi-workspace" },
  { id: "web", name: "Pi Web", url: "https://github.com/agegr/pi-web" },
  { id: "desktop", name: "Pi Desktop", url: "https://github.com/FaqFirebase/pi-desktop" },
  { id: "frostpi", name: "FrostPi", url: "https://github.com/frostime/pi-vscode-ui" },
] as const;

type ToolId = (typeof codingTools)[number]["id"];
type ComparisonContent = {
  eyebrow: string;
  title: string;
  description: string;
  comparisonTitle: string;
  comparisonDescription: string;
  strengths: string;
  tradeoffs: string;
  docs: string;
  tools: Record<ToolId, { surface: string; fit: string; strengths: string; tradeoffs: string }>;
  workspace: { title: string; description: string; link: string };
};

export const comparisonContent: Record<Locale, ComparisonContent> = {
  en: {
    eyebrow: "A guide to the Pi ecosystem",
    title: "Visual coding tools for Pi",
    description:
      "Pi is a terminal coding agent. Its ecosystem also offers browser workspaces, desktop clients, and editor extensions that bring a graphical interface to Pi. Here's how those tools differ.",
    comparisonTitle: "Which Pi interface fits your workflow?",
    comparisonDescription:
      "The differences here are in how you resume sessions, work with files, and switch to a terminal or editor—not in the quality of the underlying model.",
    strengths: "Strengths",
    tradeoffs: "Trade-offs",
    docs: "Project docs",
    tools: {
      workspace: {
        surface: "Local browser workspace",
        fit: "Best for continuing an existing Pi session in the browser or terminal.",
        strengths:
          "Reuses your local Pi sessions, credentials, and models. Open a session by link, chat with streaming responses, or switch to a live terminal that starts Pi in the same session and project directory.",
        tradeoffs:
          "There is no built-in code editor or Git diff view. Browser chat does not run shell commands or edit files by default; use the terminal for hands-on work.",
      },
      web: {
        surface: "Local browser workspace",
        fit: "Best for managing Pi projects and settings from the browser.",
        strengths:
          "Browse or branch existing Pi sessions, preview project files and Git diffs, switch worktrees, and manage models, packages, and skills from the web interface.",
        tradeoffs:
          "To reuse existing sessions, the server needs access to both the Pi data directory and the recorded project directories. A separate host will not automatically see files or sessions on your laptop.",
      },
      desktop: {
        surface: "Desktop app",
        fit: "Best if you want chat, code editing, and diff review in one desktop window.",
        strengths:
          "Supports Pi and oh-my-pi. Includes a code editor, file tree, Git diff viewer, project terminal, and workspace tabs for switching between sessions.",
        tradeoffs:
          "Requires a separate desktop app. The project documents its current status as alpha, so expect rough edges.",
      },
      frostpi: {
        surface: "VS Code extension",
        fit: "Best if you want Pi next to the files you're editing in VS Code.",
        strengths:
          "Uses your existing Pi configuration, extensions, and sessions. You can reference workspace files in prompts, navigate the session tree, and see tool output and diffs in the editor.",
        tradeoffs:
          "The extension requires VS Code and a working Pi installation in the same environment as the extension host. With Remote SSH, WSL, or a dev container, that means installing Pi there.",
      },
    },
    workspace: {
      title: "Already using Pi in the terminal?",
      description:
        "Try pi-workspace if you want to reopen an existing session in a browser and return to the same session in the terminal without switching to a different editor.",
      link: "See how pi-workspace works",
    },
  },
  zh: {
    eyebrow: "Pi 生态工具选型指南",
    title: "Pi 的可视化编程工具",
    description:
      "Pi 本身是在终端运行的编程助手。Pi 生态里还有浏览器工作台、独立桌面客户端和编辑器插件，为 Pi 提供图形界面。这里比较的是这些界面的使用体验。",
    comparisonTitle: "哪种 Pi 界面适合你？",
    comparisonDescription:
      "重点看怎么续接会话、查看代码和切换到终端或编辑器，而不是比较底层模型的能力。",
    strengths: "优点",
    tradeoffs: "取舍",
    docs: "项目文档",
    tools: {
      workspace: {
        surface: "本地浏览器工作台",
        fit: "适合在浏览器和终端之间继续同一个 Pi 会话。",
        strengths:
          "复用本机 Pi 的会话、凭据和模型。可以通过链接打开会话、查看流式对话，也可以切到终端，在对应项目目录里继续同一个 Pi 会话。",
        tradeoffs:
          "没有内置代码编辑器或 Git 差异视图。浏览器对话默认不执行 Shell 命令或修改文件；要实际操作，可以切到终端。",
      },
      web: {
        surface: "本地浏览器工作台",
        fit: "适合想在浏览器内管理 Pi 项目和配置的人。",
        strengths:
          "可以浏览、续接或分支已有会话，预览项目文件和 Git 差异，切换 worktree，还能在网页里管理模型、扩展包和技能。",
        tradeoffs:
          "要复用已有会话，服务端必须能访问 Pi 数据目录及会话记录里的项目目录；部署到另一台机器不会自动带上本机的文件和会话。",
      },
      desktop: {
        surface: "独立桌面应用",
        fit: "适合想在一个桌面窗口里对话、编辑代码和审查改动的人。",
        strengths:
          "同时支持 Pi 和 oh-my-pi，集成代码编辑器、文件树、Git 差异视图和项目终端，也能通过工作区标签切换会话。",
        tradeoffs: "需要单独安装桌面应用。项目文档目前标注为 Alpha，使用中可能遇到未完善的地方。",
      },
      frostpi: {
        surface: "VS Code 插件",
        fit: "适合主力用 VS Code，想边看代码边用 Pi 的人。",
        strengths:
          "复用现有 Pi 配置、扩展和会话。可以在提示里引用工作区文件、浏览会话树，并在编辑器内查看工具输出与代码差异。",
        tradeoffs:
          "需要 VS Code，且 Pi 必须装在插件运行的同一个环境里。用 Remote SSH、WSL 或开发容器时，要在对应环境里安装 Pi。",
      },
    },
    workspace: {
      title: "已经在终端用 Pi？",
      description:
        "如果你想用浏览器打开已有会话，再回到终端继续，又不想为了用 Pi 换编辑器，可以试试 pi-workspace。",
      link: "了解 pi-workspace 的工作方式",
    },
  },
};
