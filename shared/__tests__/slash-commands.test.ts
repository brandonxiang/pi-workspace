import { describe, expect, it } from "vite-plus/test";
import {
  findMatchingSlashCommands,
  getSlashAutocompleteValue,
  type PluginSlashCommand,
} from "../slash-commands.js";

const pluginCommands: PluginSlashCommand[] = [
  {
    name: "deploy-preview",
    description: "Deploy a preview build",
    source: "extension",
    scope: "project",
    origin: "package",
    packageSource: "npm:@acme/pi-preview",
  },
  {
    name: "deployment-plan",
    description: "Draft a deployment plan",
    source: "prompt",
    scope: "user",
    origin: "package",
    packageSource: "npm:@acme/pi-prompts",
  },
  {
    name: "skill:deploy-checklist",
    description: "Run the deployment checklist skill",
    source: "skill",
    scope: "user",
    origin: "package",
    packageSource: "npm:@acme/pi-skills",
  },
];

describe("plugin slash command matching", () => {
  it("supports namespaced skill commands in slash suggestions", () => {
    expect(getSlashAutocompleteValue("/skill:dep", [], pluginCommands)).toBe(
      "/skill:deploy-checklist",
    );
  });

  it("keeps app commands before plugin commands and groups plugin commands deterministically", () => {
    const matches = findMatchingSlashCommands("dep", pluginCommands);

    expect(matches.map((command) => `${command.source}:${command.name}`)).toEqual([
      "extension:deploy-preview",
      "prompt:deployment-plan",
      "skill:skill:deploy-checklist",
    ]);
  });

  it("matches skill command names that include the skill: prefix", () => {
    const matches = findMatchingSlashCommands("skill:dep", pluginCommands);

    expect(matches.map((command) => command.name)).toEqual(["skill:deploy-checklist"]);
  });

  it("still prefers app commands when tab-completing before plugin commands", () => {
    expect(getSlashAutocompleteValue("/co", ["compact-helper"], pluginCommands)).toBe("/copy");
  });

  it("falls back to plugin commands before skills when no app command matches", () => {
    expect(getSlashAutocompleteValue("/dep", ["deploy-helper"], pluginCommands)).toBe(
      "/deploy-preview",
    );
  });
});
