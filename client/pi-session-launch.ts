import type { PiSessionProject } from "./types.js";

export type InitialPiSessionSelection =
  | { kind: "pi"; sessionId: string }
  | { kind: "empty" };

interface ResolveInitialPiSessionSelectionInput {
  storedSessionId: string | null;
  storedProjectPath?: string | null;
  projects: PiSessionProject[];
}

export function resolveInitialPiSessionSelection({
  storedSessionId,
  storedProjectPath,
  projects
}: ResolveInitialPiSessionSelectionInput): InitialPiSessionSelection {
  if (!storedSessionId) {
    return { kind: "empty" };
  }

  for (const project of projects) {
    const session = project.sessions.find((candidate) => candidate.id === storedSessionId);
    if (session) {
      return { kind: "pi", sessionId: session.id };
    }
  }

  if (storedProjectPath) {
    const project = projects.find((candidate) => candidate.path === storedProjectPath);
    const fallbackSession = project?.sessions[0];
    if (fallbackSession) {
      return { kind: "pi", sessionId: fallbackSession.id };
    }
  }

  return { kind: "empty" };
}

export function findProjectBySessionId(
  projects: PiSessionProject[],
  sessionId: string
): PiSessionProject | null {
  for (const project of projects) {
    if (project.sessions.some((candidate) => candidate.id === sessionId)) {
      return project;
    }
  }

  return null;
}

export function getNewestProjectSessionId(
  projects: PiSessionProject[],
  projectPath: string
): string | null {
  const project = projects.find((candidate) => candidate.path === projectPath);
  return project?.sessions[0]?.id ?? null;
}
