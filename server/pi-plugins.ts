import {
  DefaultPackageManager,
  DefaultResourceLoader,
  getAgentDir,
  SettingsManager,
  type PathMetadata,
  type ResourceDiagnostic,
  type SourceInfo,
} from "@earendil-works/pi-coding-agent";
import type { FastifyInstance } from "fastify";
import type { PluginSlashCommand } from "../shared/slash-commands.js";

export type PiPluginScope = "user" | "project" | "temporary";
export type PiPluginStatus = "installed" | "missing" | "error";
export type PiPluginSourceType = "npm" | "git" | "local path";

export interface PiPluginSummary {
  source: string;
  scope: Exclude<PiPluginScope, "temporary">;
  sourceType: PiPluginSourceType;
  status: PiPluginStatus;
  filtered: boolean;
  installedPath?: string;
  resources: {
    extensions: number;
    skills: number;
    prompts: number;
    themes: number;
  };
  diagnostics: string[];
}

export interface PiPluginDiagnostic {
  type: "warning" | "error" | "collision";
  message: string;
  path?: string;
  packageSource?: string;
}

export interface PiPluginsResponse {
  plugins: PiPluginSummary[];
  commands: PluginSlashCommand[];
  diagnostics: PiPluginDiagnostic[];
}

type ConfiguredPackage = {
  source: string;
  scope: Exclude<PiPluginScope, "temporary">;
  filtered: boolean;
  installedPath?: string;
};

type ResolvedResource = {
  path: string;
  enabled: boolean;
  metadata: PathMetadata;
};

type ResolvedPaths = {
  extensions: ResolvedResource[];
  skills: ResolvedResource[];
  prompts: ResolvedResource[];
  themes: ResolvedResource[];
};

type ExtensionLike = {
  path: string;
  sourceInfo: SourceInfo;
  commands?: Map<
    string,
    {
      name: string;
      description?: string;
      sourceInfo: SourceInfo;
    }
  >;
};

type SkillLike = {
  name: string;
  description: string;
  sourceInfo: SourceInfo;
};

type PromptLike = {
  name: string;
  description?: string;
  sourceInfo: SourceInfo;
};

type ThemeLike = {
  sourceInfo?: SourceInfo;
};

type PackageManagerLike = {
  listConfiguredPackages(): ConfiguredPackage[];
  resolve(
    onMissing?: (source: string) => Promise<"install" | "skip" | "error">,
  ): Promise<ResolvedPaths>;
};

type ResourceLoaderLike = {
  reload(): Promise<void>;
  getExtensions(): {
    extensions: ExtensionLike[];
    errors: Array<{ path: string; error: string }>;
  };
  getSkills(): { skills: SkillLike[]; diagnostics: ResourceDiagnostic[] };
  getPrompts(): { prompts: PromptLike[]; diagnostics: ResourceDiagnostic[] };
  getThemes(): { themes: ThemeLike[]; diagnostics: ResourceDiagnostic[] };
};

type SessionSlashCommandLike = {
  name: string;
  description?: string;
  source: PluginSlashCommand["source"];
  sourceInfo: {
    path: string;
    source: string;
    scope: PluginSlashCommand["scope"];
    origin: PluginSlashCommand["origin"];
  };
};

export interface PiPluginDependencies {
  packageManager: PackageManagerLike;
  resourceLoader: ResourceLoaderLike;
}

export type PiPluginDependencyFactory = (cwd?: string) => PiPluginDependencies;

function detectSourceType(source: string): PiPluginSourceType {
  if (source.startsWith("git:")) return "git";
  if (
    source.startsWith("/") ||
    source.startsWith("./") ||
    source.startsWith("../") ||
    source.startsWith("file:")
  ) {
    return "local path";
  }

  return "npm";
}

function createEmptyResourceCounts(): PiPluginSummary["resources"] {
  return {
    extensions: 0,
    skills: 0,
    prompts: 0,
    themes: 0,
  };
}

function toCommandSourceInfo(sourceInfo: SourceInfo) {
  return {
    scope: sourceInfo.scope,
    origin: sourceInfo.origin,
    path: sourceInfo.path,
    packageSource: sourceInfo.source,
  };
}

export function toPluginSlashCommands(
  commands: readonly SessionSlashCommandLike[],
): PluginSlashCommand[] {
  return commands.map((command) => ({
    name: command.name,
    description: command.description,
    source: command.source,
    scope: command.sourceInfo.scope,
    origin: command.sourceInfo.origin,
    path: command.sourceInfo.path,
    packageSource: command.sourceInfo.source,
  }));
}

function toDiagnostic(diagnostic: ResourceDiagnostic, packageSource?: string): PiPluginDiagnostic {
  return {
    type: diagnostic.type,
    message: diagnostic.message,
    path: diagnostic.path,
    packageSource,
  };
}

function findDiagnosticPackageSource(diagnostic: ResourceDiagnostic) {
  return diagnostic.collision?.winnerSource || diagnostic.collision?.loserSource;
}

function findPackageSourceByPath(
  diagnosticPath: string | undefined,
  plugins: Iterable<PiPluginSummary>,
) {
  if (!diagnosticPath) return undefined;

  return Array.from(plugins).find(
    (candidate) => candidate.installedPath && diagnosticPath.startsWith(candidate.installedPath),
  )?.source;
}

export async function listPiPlugins({
  packageManager,
  resourceLoader,
}: PiPluginDependencies): Promise<PiPluginsResponse> {
  const configuredPackages = packageManager.listConfiguredPackages();
  const missingPackages = new Set<string>();
  const resolvedPaths = await packageManager.resolve(async (source) => {
    missingPackages.add(source);
    return "skip";
  });

  await resourceLoader.reload();

  const pluginBySource = new Map<string, PiPluginSummary>();
  for (const configuredPackage of configuredPackages) {
    pluginBySource.set(configuredPackage.source, {
      source: configuredPackage.source,
      scope: configuredPackage.scope,
      sourceType: detectSourceType(configuredPackage.source),
      status:
        configuredPackage.installedPath && !missingPackages.has(configuredPackage.source)
          ? "installed"
          : "missing",
      filtered: configuredPackage.filtered,
      installedPath: configuredPackage.installedPath,
      resources: createEmptyResourceCounts(),
      diagnostics: missingPackages.has(configuredPackage.source)
        ? ["Package is configured but not installed."]
        : [],
    });
  }

  for (const [resourceType, resources] of Object.entries(resolvedPaths) as Array<
    [keyof ResolvedPaths, ResolvedResource[]]
  >) {
    for (const resource of resources) {
      if (!resource.enabled) continue;
      const plugin = pluginBySource.get(resource.metadata.source);
      if (!plugin) continue;
      plugin.resources[resourceType] += 1;
      if (plugin.status === "missing") {
        plugin.status = "installed";
      }
    }
  }

  const extensionsResult = resourceLoader.getExtensions();
  const skillsResult = resourceLoader.getSkills();
  const promptsResult = resourceLoader.getPrompts();
  const themesResult = resourceLoader.getThemes();
  const rawDiagnostics: PiPluginDiagnostic[] = [
    ...extensionsResult.errors.map((error) => ({
      type: "error" as const,
      message: error.error,
      path: error.path,
    })),
    ...skillsResult.diagnostics.map((diagnostic) =>
      toDiagnostic(diagnostic, findDiagnosticPackageSource(diagnostic)),
    ),
    ...promptsResult.diagnostics.map((diagnostic) =>
      toDiagnostic(diagnostic, findDiagnosticPackageSource(diagnostic)),
    ),
    ...themesResult.diagnostics.map((diagnostic) =>
      toDiagnostic(diagnostic, findDiagnosticPackageSource(diagnostic)),
    ),
  ];
  const diagnostics = rawDiagnostics.map((diagnostic) => ({
    ...diagnostic,
    packageSource:
      diagnostic.packageSource || findPackageSourceByPath(diagnostic.path, pluginBySource.values()),
  }));

  for (const diagnostic of diagnostics) {
    const plugin =
      (diagnostic.packageSource && pluginBySource.get(diagnostic.packageSource)) ||
      Array.from(pluginBySource.values()).find(
        (candidate) =>
          candidate.installedPath && diagnostic.path?.startsWith(candidate.installedPath),
      );
    plugin?.diagnostics.push(diagnostic.message);
    if (plugin && diagnostic.type === "error") {
      plugin.status = "error";
    }
  }

  const extensionCommands = extensionsResult.extensions.flatMap((extension) =>
    Array.from(extension.commands?.values() ?? []).map(
      (command): PluginSlashCommand => ({
        name: command.name,
        description: command.description,
        source: "extension",
        ...toCommandSourceInfo(command.sourceInfo),
      }),
    ),
  );
  const promptCommands = promptsResult.prompts.map(
    (prompt): PluginSlashCommand => ({
      name: prompt.name,
      description: prompt.description,
      source: "prompt",
      ...toCommandSourceInfo(prompt.sourceInfo),
    }),
  );
  const skillCommands = skillsResult.skills.map(
    (skill): PluginSlashCommand => ({
      name: `skill:${skill.name}`,
      description: skill.description,
      source: "skill",
      ...toCommandSourceInfo(skill.sourceInfo),
    }),
  );

  return {
    plugins: Array.from(pluginBySource.values()),
    commands: [...extensionCommands, ...promptCommands, ...skillCommands].filter(
      (command) => command.origin === "package",
    ),
    diagnostics,
  };
}

export function createPiPluginDependencies(cwd = process.cwd()): PiPluginDependencies {
  const agentDir = getAgentDir();
  const settingsManager = SettingsManager.create(cwd, agentDir);
  const packageManager = new DefaultPackageManager({ cwd, agentDir, settingsManager });
  const resourceLoader = new DefaultResourceLoader({ cwd, agentDir, settingsManager });

  return { packageManager, resourceLoader };
}

export function registerPiPluginRoutes(
  server: FastifyInstance,
  options: {
    createDependencies?: PiPluginDependencyFactory;
    resolveSessionCwd?: (sessionId: string) => Promise<string | null>;
    resolveSessionCommands?: (sessionId: string) => Promise<PluginSlashCommand[] | null>;
  } = {},
) {
  const createDependencies = options.createDependencies || createPiPluginDependencies;

  server.get("/api/pi-plugins", async (_request, reply) => {
    try {
      return await listPiPlugins(createDependencies());
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to load Pi plugins",
      };
    }
  });

  server.post("/api/pi-plugins/reload", async (_request, reply) => {
    try {
      return await listPiPlugins(createDependencies());
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to reload Pi plugins",
      };
    }
  });

  server.get("/api/pi-sessions/:sessionId/commands", async (request, reply) => {
    const { sessionId } = request.params as { sessionId?: string };
    if (!sessionId?.trim()) {
      reply.code(400);
      return { error: "sessionId is required" };
    }

    try {
      if (options.resolveSessionCommands) {
        const commands = await options.resolveSessionCommands(sessionId);
        if (!commands) {
          reply.code(404);
          return { error: "Pi session not found" };
        }
        return { commands };
      }

      const cwd = options.resolveSessionCwd
        ? await options.resolveSessionCwd(sessionId)
        : process.cwd();
      if (!cwd) {
        reply.code(404);
        return { error: "Pi session not found" };
      }

      const { commands } = await listPiPlugins(createDependencies(cwd));
      return { commands };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to load Pi session commands",
      };
    }
  });
}
