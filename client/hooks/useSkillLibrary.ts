import { useCallback, useState } from "react";
import type { SkillItem } from "../types/index";

export function useSkillLibrary() {
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [skillsLoading, setSkillsLoading] = useState(false);
  const [skillsReloading, setSkillsReloading] = useState(false);
  const [skillsError, setSkillsError] = useState<string | null>(null);

  const loadSkills = useCallback(async (reload = false) => {
    setSkillsError(null);
    if (reload) {
      setSkillsReloading(true);
    } else {
      setSkillsLoading(true);
    }

    try {
      const response = await fetch("/api/skills");
      const body = (await response.json().catch(() => null)) as {
        skills?: SkillItem[];
        error?: string;
      };
      if (!response.ok) throw new Error(body?.error || "Failed to load skills");
      setSkills(body?.skills || []);
    } catch (loadError) {
      setSkillsError(loadError instanceof Error ? loadError.message : "Failed to load skills");
    } finally {
      setSkillsLoading(false);
      setSkillsReloading(false);
    }
  }, []);

  return { skills, skillsLoading, skillsReloading, skillsError, loadSkills };
}
