import type { FastifyInstance } from "fastify";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
  getAgentDir,
  loadSkills as sdkLoadSkills,
  loadSkillsFromDir,
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
 * Load skills from a `.agents/skills/` directory if it exists.
 */
function loadAgentsSkills(dir: string, scope: "user" | "project"): Skill[] {
  const agentsSkillsDir = path.join(dir, ".agents", "skills");
  if (!existsSync(agentsSkillsDir)) return [];

  const result = loadSkillsFromDir({ dir: agentsSkillsDir, source: scope });
  // Override scope on sourceInfo since loadSkillsFromDir uses the source label
  // as-is but we need proper scope values.
  return result.skills.map((skill) => ({
    ...skill,
    sourceInfo: { ...skill.sourceInfo, scope },
  }));
}

/**
 * Create the default skills dependencies.
 * Loads skills from:
 *  - `.pi/` directories via SDK (global + project)
 *  - `.agents/skills/` directories (user/global + project + ancestor dirs)
 */
export function createSkillsDependencies(): SkillsDependencies {
  return {
    loadSkills: () => {
      const result = sdkLoadSkills({
        cwd: process.cwd(),
        agentDir: getAgentDir(),
        skillPaths: [],
        includeDefaults: true,
      });

      // Also load from .agents/skills/ directories (not scanned by loadSkills)
      const userAgentsSkills = loadAgentsSkills(homedir(), "user");
      const projectAgentsSkills = loadAgentsSkills(process.cwd(), "project");

      // Merge — project skills override user skills with same name
      const skillMap = new Map<string, Skill>();

      // Add SDK-loaded skills first
      for (const skill of result.skills) {
        skillMap.set(skill.name, skill);
      }

      // Add user .agents/skills/ (won't override SDK user skills due to dedup)
      for (const skill of userAgentsSkills) {
        if (!skillMap.has(skill.name)) {
          skillMap.set(skill.name, skill);
        }
      }

      // Add project .agents/skills/ — overrides any user/global skill with same name
      for (const skill of projectAgentsSkills) {
        skillMap.set(skill.name, skill);
      }

      return {
        skills: [...skillMap.values()],
        diagnostics: result.diagnostics,
      };
    },
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
