export const LOCALE_STORAGE_KEY = "my-pi-locale";

export const localeOptions = [
  { value: "en", label: "English" },
  { value: "zh-CN", label: "简体中文" },
] as const;

export type Locale = (typeof localeOptions)[number]["value"];

const fallbackLocale: Locale = "en";

const translations = {
  en: {
    "actions.archive": "Archive",
    "actions.remove": "Remove",
    "actions.rename": "Rename",
    "actions.restore": "Restore",
    "chat.agentDialogue": "Agent dialogue",
    "chat.assistant": "Assistant",
    "chat.clickToExpand": "Click to expand",
    "chat.error": "Error",
    "chat.localAction": "Local action",
    "chat.myPi": "My Pi",
    "chat.piSession": "Pi Session",
    "chat.piSessionSummary": "Pi session summary",
    "chat.steering": "Steering",
    "chat.streaming": "streaming",
    "chat.thinking": "Thinking",
    "chat.thinkingHistory": "Thinking trace",
    "chat.toolHistory": "Tool activity",
    "chat.toolSummary": "{count} calls",
    "chat.tool": "Tool",
    "chat.user": "User",
    "chat.you": "You",
    "composer.attachmentMeta": "{size} KB · image analysis",
    "composer.contextUsage": "Context: {used} / {total}",
    "composer.contextPercent": "{percent}%",
    "composer.contextNotAvailable": "Context: —",
    "composer.continuePiSession": "Continue this Pi session...",
    "composer.defaultImagePrompt": "Please analyze this image.",
    "composer.followingUp": "Following up",
    "composer.placeholder": "Ask the agent to reason, plan, or draft...",
    "composer.remove": "Remove",
    "errors.imageTooLarge": "Image must be smaller than 5 MB.",
    "errors.noImageSupport":
      "The selected model does not support image input. Choose a vision-capable model.",
    "errors.readImageFailed": "Failed to read image file.",
    "errors.removedImageUnsupported":
      "Removed the attached image because the selected model does not support image input.",
    "errors.streamMissing": "No response stream returned.",
    "errors.unexpectedChat": "Unexpected chat error",
    "errors.uploadSupportedImage": "Upload a PNG, JPEG, WebP, or GIF image.",
    "hotkeys.modeToggleDescription":
      "Switch between Chat and Terminal view without opening Settings.",
    "hotkeys.modeToggleLabel": "Toggle panel mode ({shortcut})",
    "hotkeys.open": "Keyboard shortcuts",
    "hotkeys.sidebarToggleDescription":
      "Toggle the left sidebar without leaving your current Session flow.",
    "hotkeys.sidebarToggleLabel": "Toggle sidebar ({shortcut})",
    "hotkeys.title": "Keyboard shortcuts",
    "launcher.addProject": "Add new project",
    "launcher.body":
      "Pi Agent Desktop now works through Pi Sessions only. Start a new Pi Session or jump back into an existing project.",
    "launcher.newPiSession": "New Pi Session",
    "launcher.newPiSessionBody":
      "Choose an existing project or add a local folder to create its first Pi Session immediately.",
    "launcher.noProjectsFound": "No matching projects found",
    "launcher.searchProjects": "Search projects",
    "launcher.selectPiSession": "Select a Pi Session",
    "launcher.selectPiSessionBody":
      "Search by project name and open that project's most recent Pi Session.",
    "launcher.title": "What should we build in {workspace}?",
    "panel.loadingTerminalBody": "Fetching Pi session details to launch in terminal mode.",
    "panel.loadingTerminalTitle": "Loading terminal…",
    "panel.openEditor": "Open editor",
    "panel.retry": "Retry",
    "panel.terminal": "Terminal",
    "session.archived": "Archived",
    "session.archivedRestore": "Archived · restore",
    "session.newPiBody": "Start a new conversation in this project by typing a message below.",
    "session.newPiTitle": "New Pi session.",
    "session.renamePlaceholder": "Session name",
    "session.renameTitle": "Rename session",
    "session.untitled": "Untitled session",
    "settings.cancel": "Cancel",
    "settings.administratorAuthorization": "Administrator authorization",
    "settings.chatMode": "Chat mode",
    "settings.confirm": "Save",
    "settings.language": "Language",
    "settings.languageHelp": "English is the default. Your preference is saved locally.",
    "settings.model": "Model",
    "settings.panelMode": "Panel mode",
    "settings.systemPrompt": "System prompt",
    "settings.terminalMode": "Terminal mode",
    "settings.thinkingLevel": "Thinking level",
    "settings.thinkingLevelHelp":
      "Controls how much the model thinks before responding. Higher levels may improve reasoning at the cost of latency.",
    "settings.thinkingOff": "Off",
    "settings.thinkingMinimal": "Minimal",
    "settings.thinkingLow": "Low",
    "settings.thinkingMedium": "Medium",
    "settings.thinkingHigh": "High",
    "settings.thinkingXhigh": "XHigh",
    "settings.tabGeneral": "General",
    "settings.tabArchivedChat": "Archived Chat",
    "settings.tabModel": "Model",
    "settings.archivedChatTitle": "Archived chats",
    "settings.archivedChatEmpty": "No archived chats yet.",
    "settings.checkingVersions": "Checking…",
    "settings.close": "Close",
    "settings.currentVersion": "Current version",
    "settings.latestVersion": "Latest version",
    "settings.piCli": "Pi CLI",
    "settings.recheckVersions": "Check again",
    "settings.restartPiWorkspace": "Restart pi-workspace to use the new version.",
    "settings.sudoAuthorizationHelp":
      "Complete the password or Touch ID request in this terminal. Close it when the upgrade finishes.",
    "settings.tabVersion": "Version",
    "settings.title": "Settings",
    "settings.upgrade": "Upgrade",
    "settings.upgradeComplete": "Upgrade completed.",
    "settings.upgradeConfirmBody":
      "The upgrade runs a local CLI command and may modify the installed package or current source tree.",
    "settings.upgradeConfirmTitle": "Upgrade {name}?",
    "settings.upgradeFailed": "Upgrade failed.",
    "settings.upgradePi": "Upgrade Pi",
    "settings.upgradePiWorkspace": "Upgrade pi-workspace",
    "settings.upgrading": "Upgrading…",
    "settings.updateAvailable": "Update available",
    "settings.upToDate": "Up to date",
    "settings.versionCheckFailed": "Failed to check versions.",
    "settings.versionHelp":
      "Check the globally installed Pi CLI and this pi-workspace installation.",
    "settings.versionPermissionMissing": "Reload the version information before upgrading.",
    "settings.versionTitle": "Version management",
    "settings.versionUnknown": "Version status unavailable",
    "sidebar.addWorkspace": "Add workspace",
    "sidebar.archived": "Archived",
    "sidebar.collapse": "Collapse sidebar",
    "sidebar.conversations": "Conversations",
    "sidebar.expand": "Expand sidebar",
    "sidebar.loadingPiSessionBody": "Fetching the active branch from your local Pi session store.",
    "sidebar.loadingPiSessionTitle": "Loading Pi session history…",
    "sidebar.newPiSession": "New Pi Session",
    "sidebar.newSession": "New session",
    "sidebar.piCliUnavailable": "Pi CLI not available",
    "sidebar.piSessions": "Pi Sessions",
    "sidebar.showLess": "Show less",
    "sidebar.showMore": "Show more ({count})",
    "sidebar.projectSettings": "Project settings",
    "sidebar.deleteProject": "Delete project",
    "sidebar.revealProject": "Reveal the project",
    "sidebar.deleteProjectConfirm":
      "Delete all Pi sessions for this project? This cannot be undone.",
    "sidebar.startTitle": "Start with a task or question.",
    "sidebar.startBody":
      "Try asking for a product plan, code review checklist, deployment runbook, or implementation strategy.",
    "slash.changelog": "Show changelog entries",
    "slash.clone": "Duplicate current session branch",
    "slash.compact": "Compact session context",
    "slash.copy": "Copy last assistant message",
    "slash.export": "Export session",
    "slash.fork": "Fork from a previous message",
    "slash.hotkeys": "Show keyboard shortcuts",
    "slash.import": "Import a JSONL session",
    "slash.login": "Configure provider authentication",
    "slash.logout": "Remove provider authentication",
    "slash.model": "Select model",
    "slash.name": "Set session display name",
    "slash.new": "Start a new session",
    "slash.quit": "Quit pi",
    "slash.reload": "Reload resources",
    "slash.resume": "Resume a different session",
    "slash.scoped-models": "Enable or disable model cycling",
    "slash.session": "Show session info and stats",
    "slash.settings": "Open settings menu",
    "slash.share": "Share session as a private gist",
    "slash.tree": "Navigate session tree",
    "terminal.connectionClosed": "[Connection closed. Refresh or switch sessions to reconnect.]",
    "workspace.browse": "Browse…",
    "workspace.description": "Select a project folder to create a new workspace in it.",
    "workspace.newPiSession": "New Pi session in this project",
    "workspace.noneFound": "No Pi sessions found",
    "workspace.resolving": "Resolving path…",
    "workspace.title": "Add workspace",
  },
  "zh-CN": {
    "actions.archive": "归档",
    "actions.remove": "移除",
    "actions.rename": "重命名",
    "actions.restore": "恢复",
    "chat.agentDialogue": "智能体对话",
    "chat.assistant": "助手",
    "chat.clickToExpand": "点击展开",
    "chat.error": "错误",
    "chat.localAction": "本地操作",
    "chat.myPi": "My Pi",
    "chat.piSession": "Pi 会话",
    "chat.piSessionSummary": "Pi 会话摘要",
    "chat.steering": "Steering",
    "chat.streaming": "生成中",
    "chat.thinking": "思考中",
    "chat.thinkingHistory": "思考过程",
    "chat.toolHistory": "工具记录",
    "chat.toolSummary": "{count} 次调用",
    "chat.tool": "工具",
    "chat.user": "用户",
    "chat.you": "你",
    "composer.attachmentMeta": "{size} KB · 图片分析",
    "composer.contextUsage": "上下文: {used} / {total}",
    "composer.contextPercent": "{percent}%",
    "composer.contextNotAvailable": "上下文: —",
    "composer.continuePiSession": "继续这个 Pi 会话...",
    "composer.defaultImagePrompt": "请分析这张图片。",
    "composer.followingUp": "Following up",
    "composer.placeholder": "让智能体帮你推理、规划或起草...",
    "composer.remove": "移除",
    "errors.imageTooLarge": "图片必须小于 5 MB。",
    "errors.noImageSupport": "当前模型不支持图片输入，请选择支持视觉的模型。",
    "errors.readImageFailed": "读取图片文件失败。",
    "errors.removedImageUnsupported": "已移除附件图片，因为当前模型不支持图片输入。",
    "errors.streamMissing": "未收到响应流。",
    "errors.unexpectedChat": "聊天过程中出现意外错误",
    "errors.uploadSupportedImage": "请上传 PNG、JPEG、WebP 或 GIF 图片。",
    "hotkeys.modeToggleDescription": "在对话模式和终端模式间快速切换，无需打开设置。",
    "hotkeys.modeToggleLabel": "切换面板模式（{shortcut}）",
    "hotkeys.open": "键盘快捷键",
    "hotkeys.sidebarToggleDescription": "无需离开当前会话即可切换左侧边栏。",
    "hotkeys.sidebarToggleLabel": "切换侧边栏（{shortcut}）",
    "hotkeys.title": "键盘快捷键",
    "launcher.addProject": "添加新项目",
    "launcher.body":
      "Pi Agent Desktop 现在只围绕 Pi 会话工作。你可以新建 Pi 会话，或回到已有项目中的会话。",
    "launcher.newPiSession": "新建 Pi 会话",
    "launcher.newPiSessionBody": "选择已有项目，或添加本地文件夹，并立即为它创建第一个 Pi 会话。",
    "launcher.noProjectsFound": "未找到匹配的项目",
    "launcher.searchProjects": "搜索项目",
    "launcher.selectPiSession": "选择 Pi 会话",
    "launcher.selectPiSessionBody": "按项目名搜索，并直接打开该项目中最新的 Pi 会话。",
    "launcher.title": "我们要在 {workspace} 里做什么？",
    "panel.loadingTerminalBody": "正在获取 Pi 会话详情，以便在终端模式中启动。",
    "panel.loadingTerminalTitle": "正在加载终端…",
    "panel.openEditor": "打开编辑器",
    "panel.retry": "重试",
    "panel.terminal": "终端",
    "session.archived": "已归档",
    "session.archivedRestore": "已归档 · 点击恢复",
    "session.newPiBody": "在下方输入消息，开始这个项目中的新对话。",
    "session.newPiTitle": "新的 Pi 会话。",
    "session.renamePlaceholder": "会话名称",
    "session.renameTitle": "重命名会话",
    "session.untitled": "未命名会话",
    "settings.cancel": "取消",
    "settings.administratorAuthorization": "管理员授权",
    "settings.chatMode": "对话模式",
    "settings.confirm": "保存",
    "settings.language": "语言",
    "settings.languageHelp": "默认使用英文。你的选择会保存在本地。",
    "settings.model": "模型",
    "settings.panelMode": "面板模式",
    "settings.systemPrompt": "系统提示词",
    "settings.terminalMode": "终端模式",
    "settings.thinkingLevel": "思考深度",
    "settings.thinkingLevelHelp":
      "控制模型在响应前的思考深度。较高的级别可能改善推理能力，但会增加延迟。",
    "settings.thinkingOff": "关闭",
    "settings.thinkingMinimal": "最低",
    "settings.thinkingLow": "低",
    "settings.thinkingMedium": "中",
    "settings.thinkingHigh": "高",
    "settings.thinkingXhigh": "极高",
    "settings.tabGeneral": "通用",
    "settings.tabArchivedChat": "已归档对话",
    "settings.tabModel": "模型",
    "settings.archivedChatTitle": "已归档对话",
    "settings.archivedChatEmpty": "暂时没有已归档对话。",
    "settings.checkingVersions": "正在检查…",
    "settings.close": "关闭",
    "settings.currentVersion": "当前版本",
    "settings.latestVersion": "最新版本",
    "settings.piCli": "Pi CLI",
    "settings.recheckVersions": "重新检查",
    "settings.restartPiWorkspace": "请重启 pi-workspace 以使用新版本。",
    "settings.sudoAuthorizationHelp": "请在此终端中完成密码或 Touch ID 授权。升级结束后关闭窗口。",
    "settings.tabVersion": "版本",
    "settings.title": "设置",
    "settings.upgrade": "升级",
    "settings.upgradeComplete": "升级完成。",
    "settings.upgradeConfirmBody":
      "升级会运行本地 CLI 命令，并可能修改已安装的软件包或当前源码目录。",
    "settings.upgradeConfirmTitle": "升级 {name}？",
    "settings.upgradeFailed": "升级失败。",
    "settings.upgradePi": "升级 Pi",
    "settings.upgradePiWorkspace": "升级 pi-workspace",
    "settings.upgrading": "正在升级…",
    "settings.updateAvailable": "有新版本",
    "settings.upToDate": "已是最新版",
    "settings.versionCheckFailed": "版本检查失败。",
    "settings.versionHelp": "检查全局安装的 Pi CLI 和当前 pi-workspace 安装。",
    "settings.versionPermissionMissing": "升级前请重新加载版本信息。",
    "settings.versionTitle": "版本管理",
    "settings.versionUnknown": "无法确定版本状态",
    "sidebar.addWorkspace": "添加工作区",
    "sidebar.archived": "已归档",
    "sidebar.collapse": "收起侧边栏",
    "sidebar.conversations": "会话",
    "sidebar.expand": "展开侧边栏",
    "sidebar.loadingPiSessionBody": "正在从本地 Pi 会话存储中获取当前分支。",
    "sidebar.loadingPiSessionTitle": "正在加载 Pi 会话历史…",
    "sidebar.newPiSession": "新建 Pi 会话",
    "sidebar.newSession": "新建会话",
    "sidebar.piCliUnavailable": "Pi CLI 不可用",
    "sidebar.piSessions": "Pi 会话",
    "sidebar.showLess": "收起",
    "sidebar.showMore": "显示更多（{count}）",
    "sidebar.projectSettings": "项目设置",
    "sidebar.deleteProject": "删除项目",
    "sidebar.revealProject": "在访达中打开",
    "sidebar.deleteProjectConfirm": "删除该项目所有的 Pi 会话？此操作不可撤销。",
    "sidebar.startTitle": "从一个任务或问题开始。",
    "sidebar.startBody": "可以试着让它生成产品计划、代码审查清单、部署手册或实现策略。",
    "slash.changelog": "查看更新日志",
    "slash.clone": "复制当前会话分支",
    "slash.compact": "压缩会话上下文",
    "slash.copy": "复制上一条助手消息",
    "slash.export": "导出会话",
    "slash.fork": "从之前的消息分叉",
    "slash.hotkeys": "查看快捷键",
    "slash.import": "导入 JSONL 会话",
    "slash.login": "配置提供商认证",
    "slash.logout": "移除提供商认证",
    "slash.model": "选择模型",
    "slash.name": "设置会话显示名称",
    "slash.new": "开始新的会话",
    "slash.quit": "退出 pi",
    "slash.reload": "重新加载资源",
    "slash.resume": "恢复其他会话",
    "slash.scoped-models": "启用或禁用模型轮换",
    "slash.session": "查看会话信息和统计",
    "slash.settings": "打开设置菜单",
    "slash.share": "将会话分享为私有 gist",
    "slash.tree": "浏览会话树",
    "terminal.connectionClosed": "[连接已关闭。请刷新页面或切换会话后重连。]",
    "workspace.browse": "浏览…",
    "workspace.description": "选择一个项目文件夹，在其中创建新的工作区。",
    "workspace.newPiSession": "在这个项目中新建 Pi 会话",
    "workspace.noneFound": "未找到 Pi 会话",
    "workspace.resolving": "正在解析路径…",
    "workspace.title": "添加工作区",
  },
} as const;

export type TranslationKey = keyof (typeof translations)["en"];
export type TranslationParams = Record<string, number | string>;
export type Translator = (key: TranslationKey, params?: TranslationParams) => string;

function interpolate(template: string, params?: TranslationParams) {
  if (!params) return template;

  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const value = params[key];
    return value === undefined ? `{${key}}` : String(value);
  });
}

export function isLocale(value: string | null | undefined): value is Locale {
  return value === "en" || value === "zh-CN";
}

export function readStoredLocale() {
  try {
    const stored = localStorage.getItem(LOCALE_STORAGE_KEY);
    return isLocale(stored) ? stored : fallbackLocale;
  } catch {
    return fallbackLocale;
  }
}

export function createTranslator(locale: Locale): Translator {
  return (key, params) => interpolate(translations[locale][key], params);
}

export function formatMessageCount(locale: Locale, count: number) {
  if (locale === "zh-CN") {
    return `${count} 条消息`;
  }

  return `${count} message${count === 1 ? "" : "s"}`;
}

export function formatRelativeTime(locale: Locale, isoString: string) {
  const date = new Date(isoString);
  const diffMs = date.getTime() - Date.now();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHr = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);
  const rtf = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });

  if (Math.abs(diffMin) < 1) return rtf.format(0, "minute");
  if (Math.abs(diffMin) < 60) return rtf.format(diffMin, "minute");
  if (Math.abs(diffHr) < 24) return rtf.format(diffHr, "hour");
  if (Math.abs(diffDay) < 7) return rtf.format(diffDay, "day");

  return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
}
