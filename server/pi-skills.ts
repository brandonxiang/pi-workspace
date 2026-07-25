import type { FastifyInstance } from "fastify";
import {
  getAgentDir,
  loadSkills as sdkLoadSkills,
  type Skill,
} from "@earendil-works/pi-coding-agent";

export interface SkillItem {
  name: string;
  description: string;
  disableModelInvocation: boolean;
  scope: "user" | "project" | "temporary";
  origin: "package" | "top-level";
  baseDir: string | undefined;
  path: string;
}

export interface SkillsDependencies {
  loadSkills: () => { skills: Skill[]; diagnostics: unknown[] };
}

/**
 * Create the default skills dependencies (no caching — handled by route).
 */
export function createSkillsDependencies(): SkillsDependencies {
  return {
    loadSkills: () =>
      sdkLoadSkills({
        cwd: process.cwd(),
        agentDir: getAgentDir(),
        skillPaths: [],
        includeDefaults: true,
      }),
  };
}

function skillToItem(skill: Skill): SkillItem {
  return {
    name: skill.name,
    description: skill.description,
    disableModelInvocation: skill.disableModelInvocation,
    scope: skill.sourceInfo.scope,
    origin: skill.sourceInfo.origin,
    baseDir: skill.baseDir,
    path: skill.sourceInfo.path,
  };
}

const SKILLS_CACHE_TTL_MS = 60_000;

let skillsCache: { skills: SkillItem[] } | null = null;
let skillsCacheTime = 0;

/** Clears the skills cache (used in tests). */
export function clearSkillsCache() {
  skillsCache = null;
  skillsCacheTime = 0;
}

export function registerPiSkillRoutes(server: FastifyInstance, deps: SkillsDependencies) {
  server.get("/api/skills", async (_request, reply) => {
    try {
      const now = Date.now();
      if (skillsCache && now - skillsCacheTime < SKILLS_CACHE_TTL_MS) {
        return skillsCache;
      }

      const result = deps.loadSkills();
      const skills = result.skills.map(skillToItem);

      skillsCache = { skills };
      skillsCacheTime = now;

      return { skills };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to load skills",
      };
    }
  });
}
