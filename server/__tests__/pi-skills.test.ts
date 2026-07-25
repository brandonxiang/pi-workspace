import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { clearSkillsCache, registerPiSkillRoutes } from "../pi-skills.js";

const mockSkills = [
  {
    name: "code-review",
    description: "Reviews code changes along multiple axes",
    filePath: "/Users/user/.pi/agent/skills/code-review/SKILL.md",
    baseDir: "/Users/user/.pi/agent/skills/code-review",
    sourceInfo: {
      path: "/Users/user/.pi/agent/skills/code-review",
      source: "~/.pi/agent/skills/code-review",
      scope: "user" as const,
      origin: "top-level" as const,
    },
    disableModelInvocation: false,
  },
  {
    name: "project-skill",
    description: "A project-level skill",
    filePath: "/Users/user/project/.agents/skills/project-skill/SKILL.md",
    baseDir: "/Users/user/project/.agents/skills/project-skill",
    sourceInfo: {
      path: "/Users/user/project/.agents/skills/project-skill",
      source: ".agents/skills/project-skill",
      scope: "project" as const,
      origin: "top-level" as const,
    },
    disableModelInvocation: false,
  },
];

describe("pi skill routes", () => {
  const servers: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    clearSkillsCache();
    await Promise.all(servers.map((server) => server.close()));
    servers.splice(0);
  });

  it("GET /api/skills returns enhanced skill objects with scope, origin, baseDir, path", async () => {
    const loadSkills = vi.fn(() => ({ skills: mockSkills, diagnostics: [] }));

    const server = Fastify();
    servers.push(server);
    registerPiSkillRoutes(server, { loadSkills });

    const response = await server.inject({ method: "GET", url: "/api/skills" });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.skills).toHaveLength(2);

    // First skill (user scope) should have all enhanced fields
    const userSkill = body.skills[0];
    expect(userSkill).toEqual({
      name: "code-review",
      description: "Reviews code changes along multiple axes",
      disableModelInvocation: false,
      scope: "user",
      origin: "top-level",
      baseDir: "/Users/user/.pi/agent/skills/code-review",
      path: "/Users/user/.pi/agent/skills/code-review",
    });

    // Second skill (project scope) should also have all fields
    const projectSkill = body.skills[1];
    expect(projectSkill).toEqual({
      name: "project-skill",
      description: "A project-level skill",
      disableModelInvocation: false,
      scope: "project",
      origin: "top-level",
      baseDir: "/Users/user/project/.agents/skills/project-skill",
      path: "/Users/user/project/.agents/skills/project-skill",
    });
  });

  it("GET /api/skills returns empty list when no skills are found", async () => {
    const loadSkills = vi.fn(() => ({ skills: [], diagnostics: [] }));

    const server = Fastify();
    servers.push(server);
    registerPiSkillRoutes(server, { loadSkills });

    const response = await server.inject({ method: "GET", url: "/api/skills" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ skills: [] });
  });

  it("GET /api/skills returns 500 when loadSkills throws", async () => {
    const loadSkills = vi.fn(() => {
      throw new Error("Failed to load skills");
    });

    const server = Fastify();
    servers.push(server);
    registerPiSkillRoutes(server, { loadSkills });

    const response = await server.inject({ method: "GET", url: "/api/skills" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({ error: "Failed to load skills" });
  });
});
