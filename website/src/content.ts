export type Locale = "en" | "zh";

type CapabilityKey = "sessions" | "dialogue" | "terminal";

export type SiteContent = {
  meta: { title: string; description: string };
  navigation: {
    features: string;
    workflow: string;
    openSource: string;
    github: string;
    language: string;
  };
  hero: {
    eyebrow: string;
    title: string;
    description: string;
    compatibility: string;
    viewGithub: string;
  };
  install: {
    command: string;
    copy: string;
    copied: string;
    copyFailed: string;
    title: string;
    description: string;
  };
  product: {
    label: string;
    workspace: string;
    sessions: string;
    activeSession: string;
    dialogue: string;
    terminal: string;
    thinking: string;
    response: string;
    command: string;
    terminalOutput: string;
  };
  capabilitiesIntro: { eyebrow: string; title: string; description: string };
  capabilities: Array<{
    key: CapabilityKey;
    title: string;
    description: string;
    detail: string;
  }>;
  workflow: {
    eyebrow: string;
    title: string;
    description: string;
    sourceTitle: string;
    sourceDetail: string;
    bridgeTitle: string;
    bridgeDetail: string;
    resultTitle: string;
    resultDetail: string;
  };
  trust: {
    eyebrow: string;
    title: string;
    description: string;
    localTitle: string;
    localDetail: string;
    credentialsTitle: string;
    credentialsDetail: string;
    safeTitle: string;
    safeDetail: string;
  };
  footer: { tagline: string; github: string; npm: string; attribution: string };
};

const command = "npm exec -- pi-workspace";

export const siteContent: Record<Locale, SiteContent> = {
  en: {
    meta: {
      title: "pi-workspace — Your Pi sessions, in one focused workspace",
      description: "A local workspace for Pi Agent sessions, dialogue, and terminal work.",
    },
    navigation: {
      features: "Features",
      workflow: "How it works",
      openSource: "Open source",
      github: "GitHub",
      language: "Language",
    },
    hero: {
      eyebrow: "Local workspace for Pi Agent",
      title: "Your Pi sessions, in one focused workspace.",
      description:
        "Move between streamed agent dialogue, session history, and a live project terminal without losing the thread of your work.",
      compatibility: "Uses your existing Pi credentials, models, and local sessions.",
      viewGithub: "View source on GitHub",
    },
    install: {
      command,
      copy: "Copy command",
      copied: "Copied",
      copyFailed: "Select the command and copy it manually",
      title: "Bring your next session into focus.",
      description: "Install from npm and open the workspace on your machine.",
    },
    product: {
      label: "Live workspace",
      workspace: "pi-workspace",
      sessions: "Sessions",
      activeSession: "Ship the release workflow",
      dialogue: "Dialogue",
      terminal: "Terminal",
      thinking: "Working through the release checks…",
      response: "The build is clean. I found one packaging detail worth checking before publish.",
      command: "$ npm run build",
      terminalOutput: "✓ client  ✓ server  ✓ types",
    },
    capabilitiesIntro: {
      eyebrow: "One working context",
      title: "Stay with the work, not the window switching.",
      description:
        "pi-workspace keeps the three surfaces you use most around the same Session and Workspace.",
    },
    capabilities: [
      {
        key: "sessions",
        title: "Continue Sessions",
        description: "Browse local Pi history and return to the exact Session you were working in.",
        detail: "Deep links keep the active Session and panel state shareable on your machine.",
      },
      {
        key: "dialogue",
        title: "Work in dialogue",
        description:
          "See streaming answers, attach images, choose a model, and steer work as it happens.",
        detail: "Session context stays anchored while responses arrive token by token.",
      },
      {
        key: "terminal",
        title: "Drop into the terminal",
        description: "Open a live terminal in the selected Session's project directory.",
        detail: "The Pi CLI launches against that Session, ready for hands-on work.",
      },
    ],
    workflow: {
      eyebrow: "Fits the Pi workflow",
      title: "Your local Pi setup is already the starting point.",
      description:
        "The workspace presents what Pi already knows instead of asking you to rebuild your setup in another cloud account.",
      sourceTitle: "Your machine",
      sourceDetail: "Pi auth, custom models, Session storage, and Workspace paths",
      bridgeTitle: "pi-workspace",
      bridgeDetail: "A focused browser surface served locally",
      resultTitle: "One active Session",
      resultDetail: "Dialogue, history, and terminal around the same work",
    },
    trust: {
      eyebrow: "Local by design",
      title: "A workspace that respects the boundary of your machine.",
      description:
        "The website explains the product. The installed workspace runs locally and keeps provider credentials on the server side.",
      localTitle: "Local Sessions",
      localDetail: "Read existing Pi session storage without moving it into a hosted account.",
      credentialsTitle: "Existing credentials",
      credentialsDetail: "Reuse Pi authentication and model configuration already on your machine.",
      safeTitle: "Conservative defaults",
      safeDetail: "Online chat starts without shell or file-mutation tools enabled.",
    },
    footer: {
      tagline: "A focused local workspace for Pi Agent.",
      github: "GitHub",
      npm: "npm package",
      attribution: "Customized from the Pi ecosystem by Earendil Works.",
    },
  },
  zh: {
    meta: {
      title: "pi-workspace — 把你的 Pi Sessions，带进一个专注的工作台",
      description: "面向 Pi Agent Session、对话与终端工作的本地工作台。",
    },
    navigation: {
      features: "功能",
      workflow: "工作方式",
      openSource: "开源",
      github: "GitHub",
      language: "语言",
    },
    hero: {
      eyebrow: "Pi Agent 的本地工作台",
      title: "把你的 Pi Sessions，带进一个专注的工作台。",
      description:
        "在流式 Agent 对话、Session 历史和项目终端之间切换，而不丢失正在推进的工作脉络。",
      compatibility: "直接使用已有的 Pi 凭据、模型和本地 Sessions。",
      viewGithub: "在 GitHub 查看源码",
    },
    install: {
      command,
      copy: "复制命令",
      copied: "已复制",
      copyFailed: "请选择命令并手动复制",
      title: "让下一次 Session 更专注。",
      description: "从 npm 安装，然后在你的机器上打开工作台。",
    },
    product: {
      label: "实时工作台",
      workspace: "pi-workspace",
      sessions: "Sessions",
      activeSession: "发布版本工作流",
      dialogue: "对话",
      terminal: "终端",
      thinking: "正在检查发布流程…",
      response: "构建已经通过。我发现一个值得在发布前确认的打包细节。",
      command: "$ npm run build",
      terminalOutput: "✓ 客户端  ✓ 服务端  ✓ 类型",
    },
    capabilitiesIntro: {
      eyebrow: "一个工作上下文",
      title: "专注于工作，而不是来回切窗口。",
      description: "pi-workspace 把你最常用的三个界面放在同一个 Session 与 Workspace 周围。",
    },
    capabilities: [
      {
        key: "sessions",
        title: "继续 Sessions",
        description: "浏览本地 Pi 历史，回到上次正在推进的准确 Session。",
        detail: "深层链接会保留当前 Session 和面板状态，方便在本机直接返回。",
      },
      {
        key: "dialogue",
        title: "通过对话推进工作",
        description: "查看流式回复、添加图片、选择模型，并在执行过程中及时引导。",
        detail: "回复逐步生成时，Session 上下文始终保持稳定。",
      },
      {
        key: "terminal",
        title: "随时进入终端",
        description: "在当前 Session 对应的项目目录中打开实时终端。",
        detail: "Pi CLI 会连接到该 Session，立即开始动手工作。",
      },
    ],
    workflow: {
      eyebrow: "融入 Pi 工作流",
      title: "你的本地 Pi 环境，就是起点。",
      description: "工作台呈现 Pi 已经了解的内容，不要求你在另一个云端账户中重新配置一切。",
      sourceTitle: "你的机器",
      sourceDetail: "Pi 凭据、自定义模型、Session 存储与 Workspace 路径",
      bridgeTitle: "pi-workspace",
      bridgeDetail: "在本地提供的专注浏览器界面",
      resultTitle: "一个活跃 Session",
      resultDetail: "围绕同一项工作的对话、历史与终端",
    },
    trust: {
      eyebrow: "为本地而设计",
      title: "尊重本机边界的工作台。",
      description: "官网负责介绍产品；安装后的工作台在本地运行，并把模型服务商凭据留在服务端。",
      localTitle: "本地 Sessions",
      localDetail: "读取现有 Pi Session 存储，无需迁移到托管账户。",
      credentialsTitle: "已有凭据",
      credentialsDetail: "复用本机已有的 Pi 身份验证与模型配置。",
      safeTitle: "保守的默认设置",
      safeDetail: "在线对话默认不会启用 Shell 或文件修改工具。",
    },
    footer: {
      tagline: "Pi Agent 的专注本地工作台。",
      github: "GitHub",
      npm: "npm 包",
      attribution: "基于 Earendil Works 的 Pi 生态定制。",
    },
  },
};
