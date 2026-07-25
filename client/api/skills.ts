import type { SkillItem } from "../types";

export interface SkillsResponse {
  skills?: SkillItem[];
  error?: string;
}

export async function fetchSkills(): Promise<SkillsResponse> {
  const response = await fetch("/api/skills");
  const body = (await response.json().catch(() => null)) as SkillsResponse | null;
  if (!response.ok) throw new Error(body?.error || "Failed to load skills");
  return body ?? { skills: [] };
}
