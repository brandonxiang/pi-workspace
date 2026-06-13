/**
 * Session data types and grouping utilities for Pi sessions.
 */

export interface PiSessionSummary {
  id: string;
  firstMessage: string;
  messageCount: number;
  created: string;
  modified: string;
}

export interface PiSessionProject {
  name: string;
  path: string;
  sessions: PiSessionSummary[];
}

interface RawSessionInfo {
  id: string;
  cwd: string;
  name?: string;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
}

const MAX_FIRST_MESSAGE_LENGTH = 120;

function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "…";
}

/** Truncate a session first message for display, appending "…" when cut. */
export function truncateFirstMessage(text: string): string {
  return truncate(text, MAX_FIRST_MESSAGE_LENGTH);
}

function extractProjectName(cwd: string): string {
  if (!cwd) return "(unknown)";
  const parts = cwd.replace(/\/$/, "").split("/");
  return parts[parts.length - 1] || "(unknown)";
}

function toIsoString(date: Date): string {
  return date.toISOString();
}

export function groupSessionsByProject(rawSessions: RawSessionInfo[]): PiSessionProject[] {
  const groups = new Map<string, { path: string; sessions: RawSessionInfo[] }>();

  for (const session of rawSessions) {
    const key = session.cwd || "";
    if (!groups.has(key)) {
      groups.set(key, { path: session.cwd, sessions: [] });
    }
    groups.get(key)!.sessions.push(session);
  }

  const projects: PiSessionProject[] = [];

  for (const [cwd, group] of groups) {
    // Sort sessions within project by modified time descending
    group.sessions.sort((a, b) => b.modified.getTime() - a.modified.getTime());

    projects.push({
      name: extractProjectName(cwd),
      path: group.path,
      sessions: group.sessions.map((s) => ({
        id: s.id,
        firstMessage: truncateFirstMessage(s.firstMessage),
        messageCount: s.messageCount,
        created: toIsoString(s.created),
        modified: toIsoString(s.modified)
      }))
    });
  }

  // Sort projects alphabetically by name
  projects.sort((a, b) => a.name.localeCompare(b.name));

  return projects;
}
