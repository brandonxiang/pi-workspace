import type { SuggestionItem } from "@ant-design/x/es/suggestion";
import { findMatchingSlashCommands } from "../shared/slash-commands";
import type { TranslationKey, Translator } from "./i18n";
import type { SkillItem } from "./types";
import type { PluginSlashCommand } from "../shared/slash-commands";

export function getSlashCommandDescription(
  command: ReturnType<typeof findMatchingSlashCommands>[number],
  t: Translator,
) {
  return "descriptionKey" in command
    ? t(command.descriptionKey as TranslationKey)
    : command.description || command.packageSource || "";
}

export function getSlashSuggestionItems(
  t: Translator,
  skills: SkillItem[],
  pluginCommands: PluginSlashCommand[],
  query?: string,
): SuggestionItem[] {
  const lowerQuery = query?.toLowerCase() || "";
  const matchedCommands = findMatchingSlashCommands(lowerQuery, pluginCommands);
  const matchedSkills = skills.filter((skill) => skill.name.toLowerCase().includes(lowerQuery));

  return [
    ...matchedCommands.map((command) => ({
      label: (
        <div className="slash-command-option">
          <span>/{command.name}</span>
          <small>{getSlashCommandDescription(command, t)}</small>
        </div>
      ),
      value: `/${command.name}`,
      extra: (
        <span className={`slash-command-source slash-command-badge-${command.source}`}>
          {"descriptionKey" in command ? command.source : `${command.source} · ${command.scope}`}
        </span>
      ),
    })),
    ...matchedSkills.map((skill) => ({
      label: (
        <div className="slash-command-option">
          <span>/{skill.name}</span>
          <small>{skill.description}</small>
        </div>
      ),
      value: `/${skill.name}`,
      extra: (
        <span
          className={`slash-command-source ${skill.scope === "user" ? "slash-command-badge-skill" : "slash-command-badge-project-skill"}`}
        >
          {skill.scope === "user" ? "skill" : "skill · project"}
        </span>
      ),
    })),
  ];
}
