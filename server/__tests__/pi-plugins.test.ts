import { describe, expect, it, vi } from "vite-plus/test";
import { listPiPlugins, type PiPluginDependencies } from "../pi-plugins.js";

function createSourceInfo(
  source: string,
  path: string,
  scope: "user" | "project" | "temporary" = "user",
) {
  return {
    path,
    source,
    scope,
    origin: "package" as const,
    baseDir: `/packages/${source}`,
  };
}

describe("listPiPlugins", () => {
  it("summarizes configured packages, resources, diagnostics, and commands", async () => {
    const dependencies: PiPluginDependencies = {
      packageManager: {
        listConfiguredPackages: () => [
          {
            source: "npm:@acme/pi-preview",
            scope: "project",
            filtered: true,
            installedPath: "/packages/npm:@acme/pi-preview",
          },
        ],
        resolve: vi.fn(async () => ({
          extensions: [
            {
              path: "/packages/npm:@acme/pi-preview/extensions/preview.ts",
              enabled: true,
              metadata: createSourceInfo(
                "npm:@acme/pi-preview",
                "/packages/npm:@acme/pi-preview/extensions/preview.ts",
                "project",
              ),
            },
          ],
          skills: [
            {
              path: "/packages/npm:@acme/pi-preview/skills/deploy/SKILL.md",
              enabled: true,
              metadata: createSourceInfo(
                "npm:@acme/pi-preview",
                "/packages/npm:@acme/pi-preview/skills/deploy/SKILL.md",
                "project",
              ),
            },
          ],
          prompts: [],
          themes: [],
        })),
      },
      resourceLoader: {
        reload: vi.fn(async () => {}),
        getExtensions: () => ({
          extensions: [
            {
              path: "/packages/npm:@acme/pi-preview/extensions/preview.ts",
              sourceInfo: createSourceInfo(
                "npm:@acme/pi-preview",
                "/packages/npm:@acme/pi-preview/extensions/preview.ts",
                "project",
              ),
              commands: new Map([
                [
                  "deploy-preview",
                  {
                    name: "deploy-preview",
                    description: "Deploy a preview build",
                    sourceInfo: createSourceInfo(
                      "npm:@acme/pi-preview",
                      "/packages/npm:@acme/pi-preview/extensions/preview.ts",
                      "project",
                    ),
                    handler: async () => {},
                  },
                ],
              ]),
            },
          ],
          errors: [],
          runtime: {},
        }),
        getSkills: () => ({
          skills: [
            {
              name: "deploy-checklist",
              description: "Run the deployment checklist",
              sourceInfo: createSourceInfo(
                "npm:@acme/pi-preview",
                "/packages/npm:@acme/pi-preview/skills/deploy/SKILL.md",
                "project",
              ),
            },
          ],
          diagnostics: [],
        }),
        getPrompts: () => ({
          prompts: [],
          diagnostics: [
            {
              type: "warning",
              message: "Duplicate prompt skipped",
              path: "/packages/npm:@acme/pi-preview/prompts/deploy.md",
            },
          ],
        }),
        getThemes: () => ({ themes: [], diagnostics: [] }),
      },
    };

    const result = await listPiPlugins(dependencies);

    expect(result.plugins).toEqual([
      {
        source: "npm:@acme/pi-preview",
        scope: "project",
        sourceType: "npm",
        status: "installed",
        filtered: true,
        installedPath: "/packages/npm:@acme/pi-preview",
        resources: {
          extensions: 1,
          skills: 1,
          prompts: 0,
          themes: 0,
        },
        diagnostics: ["Duplicate prompt skipped"],
      },
    ]);
    expect(result.commands).toEqual([
      {
        name: "deploy-preview",
        description: "Deploy a preview build",
        source: "extension",
        scope: "project",
        origin: "package",
        path: "/packages/npm:@acme/pi-preview/extensions/preview.ts",
        packageSource: "npm:@acme/pi-preview",
      },
      {
        name: "skill:deploy-checklist",
        description: "Run the deployment checklist",
        source: "skill",
        scope: "project",
        origin: "package",
        path: "/packages/npm:@acme/pi-preview/skills/deploy/SKILL.md",
        packageSource: "npm:@acme/pi-preview",
      },
    ]);
    expect(result.diagnostics).toEqual([
      {
        type: "warning",
        message: "Duplicate prompt skipped",
        path: "/packages/npm:@acme/pi-preview/prompts/deploy.md",
        packageSource: "npm:@acme/pi-preview",
      },
    ]);
  });

  it("keeps missing configured packages visible without installing them", async () => {
    const resolve = vi.fn(async (onMissing: (source: string) => Promise<"skip">) => {
      await onMissing("git:github.com/acme/pi-tools");
      return { extensions: [], skills: [], prompts: [], themes: [] };
    });
    const dependencies: PiPluginDependencies = {
      packageManager: {
        listConfiguredPackages: () => [
          {
            source: "git:github.com/acme/pi-tools",
            scope: "user",
            filtered: false,
          },
        ],
        resolve,
      },
      resourceLoader: {
        reload: vi.fn(async () => {}),
        getExtensions: () => ({ extensions: [], errors: [], runtime: {} }),
        getSkills: () => ({ skills: [], diagnostics: [] }),
        getPrompts: () => ({ prompts: [], diagnostics: [] }),
        getThemes: () => ({ themes: [], diagnostics: [] }),
      },
    };

    const result = await listPiPlugins(dependencies);

    expect(resolve).toHaveBeenCalledOnce();
    expect(result.plugins).toEqual([
      {
        source: "git:github.com/acme/pi-tools",
        scope: "user",
        sourceType: "git",
        status: "missing",
        filtered: false,
        resources: {
          extensions: 0,
          skills: 0,
          prompts: 0,
          themes: 0,
        },
        diagnostics: ["Package is configured but not installed."],
      },
    ]);
  });

  it("exposes temporary package commands only through the active session resource set", async () => {
    const dependencies: PiPluginDependencies = {
      packageManager: {
        listConfiguredPackages: () => [],
        resolve: vi.fn(async () => ({ extensions: [], skills: [], prompts: [], themes: [] })),
      },
      resourceLoader: {
        reload: vi.fn(async () => {}),
        getExtensions: () => ({
          extensions: [
            {
              path: "/tmp/pi-temporary/extensions/review.ts",
              sourceInfo: createSourceInfo(
                "npm:@acme/pi-review",
                "/tmp/pi-temporary/extensions/review.ts",
                "temporary",
              ),
              commands: new Map([
                [
                  "review",
                  {
                    name: "review",
                    description: "Review the current change",
                    sourceInfo: {
                      ...createSourceInfo(
                        "npm:@acme/pi-review",
                        "/tmp/pi-temporary/extensions/review.ts",
                        "temporary",
                      ),
                      origin: "package" as const,
                    },
                  },
                ],
              ]),
            },
          ],
          errors: [],
        }),
        getSkills: () => ({ skills: [], diagnostics: [] }),
        getPrompts: () => ({ prompts: [], diagnostics: [] }),
        getThemes: () => ({ themes: [], diagnostics: [] }),
      },
    };

    const result = await listPiPlugins(dependencies);

    expect(result.plugins).toEqual([]);
    expect(result.commands).toEqual([
      {
        name: "review",
        description: "Review the current change",
        source: "extension",
        scope: "temporary",
        origin: "package",
        path: "/tmp/pi-temporary/extensions/review.ts",
        packageSource: "npm:@acme/pi-review",
      },
    ]);
  });
});
