export type AppSlashCommandScope = "client" | "server";
export type AppSlashCommandSource = "app" | "pi";
export type PluginSlashCommandSource = "extension" | "prompt" | "skill";
export type PluginSlashCommandScope = "user" | "project" | "temporary";
export type PluginSlashCommandOrigin = "package" | "top-level";

export const appSlashCommands = [
  { name: "settings", descriptionKey: "slash.settings", scope: "client", source: "app" },
  { name: "hotkeys", descriptionKey: "slash.hotkeys", scope: "client", source: "app" },
  { name: "model", descriptionKey: "slash.model", scope: "client", source: "app" },
  { name: "copy", descriptionKey: "slash.copy", scope: "client", source: "app" },
  { name: "session", descriptionKey: "slash.session", scope: "server", source: "pi" },
  { name: "export", descriptionKey: "slash.export", scope: "server", source: "pi" },
  { name: "name", descriptionKey: "slash.name", scope: "server", source: "pi" },
  { name: "compact", descriptionKey: "slash.compact", scope: "server", source: "pi" },
] as const;

export type AppSlashCommand = (typeof appSlashCommands)[number];
export type AppSlashCommandName = AppSlashCommand["name"];
export type PluginSlashCommand = {
  name: string;
  description?: string;
  source: PluginSlashCommandSource;
  scope: PluginSlashCommandScope;
  origin: PluginSlashCommandOrigin;
  path?: string;
  packageSource?: string;
};
export type SlashCommandMatch = AppSlashCommand | PluginSlashCommand;

export type ParsedSlashCommand = {
  name: string;
  normalizedName: string;
  args: string;
};

export function parseSlashCommandInput(input: string): ParsedSlashCommand | null {
  const trimmed = input.trim();
  if (!trimmed.startsWith("/") || trimmed.includes("\n")) return null;

  const commandText = trimmed.slice(1).trim();
  if (!commandText) {
    return {
      name: "",
      normalizedName: "",
      args: "",
    };
  }

  const [name, ...rest] = commandText.split(/\s+/);
  return {
    name,
    normalizedName: name.toLowerCase(),
    args: rest.join(" ").trim(),
  };
}

export function shouldShowSlashSuggestions(input: string): boolean {
  return /^\/[\w:-]*$/.test(input);
}

export function findMatchingAppSlashCommands(query: string): AppSlashCommand[] {
  const normalizedQuery = query.trim().toLowerCase();
  return appSlashCommands.filter((command) => command.name.toLowerCase().includes(normalizedQuery));
}

function matchesSlashQuery(name: string, query: string) {
  return name.toLowerCase().includes(query);
}

export function findMatchingPluginSlashCommands(
  query: string,
  pluginCommands: PluginSlashCommand[],
): PluginSlashCommand[] {
  const normalizedQuery = query.trim().toLowerCase();
  const sourceOrder: Record<PluginSlashCommandSource, number> = {
    extension: 0,
    prompt: 1,
    skill: 2,
  };

  return pluginCommands
    .filter((command) => matchesSlashQuery(command.name, normalizedQuery))
    .sort((left, right) => sourceOrder[left.source] - sourceOrder[right.source]);
}

export function findMatchingSlashCommands(
  query: string,
  pluginCommands: PluginSlashCommand[] = [],
): SlashCommandMatch[] {
  return [
    ...findMatchingAppSlashCommands(query),
    ...findMatchingPluginSlashCommands(query, pluginCommands),
  ];
}

export function getSlashAutocompleteValue(
  input: string,
  skillNames: string[],
  pluginCommands: PluginSlashCommand[] = [],
): string | null {
  if (!shouldShowSlashSuggestions(input)) return null;

  const query = input.slice(1).trim().toLowerCase();
  const firstCommand = findMatchingAppSlashCommands(query)[0];
  if (firstCommand) return `/${firstCommand.name}`;

  const firstPluginCommand = findMatchingPluginSlashCommands(query, pluginCommands)[0];
  if (firstPluginCommand) return `/${firstPluginCommand.name}`;

  const firstSkill = skillNames.find((name) => matchesSlashQuery(name, query));
  return firstSkill ? `/${firstSkill}` : null;
}

export function findAppSlashCommand(name: string): AppSlashCommand | null {
  const normalizedName = name.toLowerCase();
  return appSlashCommands.find((command) => command.name === normalizedName) || null;
}

export function isServerAppSlashCommand(
  command: AppSlashCommand,
): command is Extract<AppSlashCommand, { scope: "server" }> {
  return command.scope === "server";
}
