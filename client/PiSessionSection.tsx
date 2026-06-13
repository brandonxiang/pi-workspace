import { useEffect, useState } from "react";
import type { PiSessionProject } from "./types";

function relativeTime(isoString: string): string {
  const date = new Date(isoString);
  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMs / 3_600_000);
  const diffDay = Math.floor(diffMs / 86_400_000);

  if (diffMin < 1) return "just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

interface PiSessionSectionProps {
  isStreaming: boolean;
}

export function PiSessionSection({ isStreaming }: PiSessionSectionProps) {
  const [projects, setProjects] = useState<PiSessionProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;

    async function fetchPiSessions() {
      setLoading(true);
      setError(null);
      try {
        const response = await fetch("/api/pi-sessions");
        if (!response.ok) {
          throw new Error(`Failed to load Pi sessions: ${response.status}`);
        }
        const body = (await response.json()) as { projects: PiSessionProject[] };
        if (cancelled) return;
        setProjects(body.projects);
        // Auto-expand all projects on load
        setExpandedProjects(new Set(body.projects.map((p) => p.path)));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load Pi sessions");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchPiSessions();
    return () => {
      cancelled = true;
    };
  }, []);

  function toggleProject(path: string) {
    setExpandedProjects((prev) => {
      const next = new Set(prev);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }

  if (loading) {
    return (
      <div className="pi-sessions-section">
        <div className="session-section-heading">
          <span>Pi Sessions</span>
        </div>
        <div className="pi-sessions-loading">Loading…</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pi-sessions-section">
        <div className="session-section-heading">
          <span>Pi Sessions</span>
        </div>
        <div className="pi-sessions-error">Pi CLI not available</div>
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="pi-sessions-section">
        <div className="session-section-heading">
          <span>Pi Sessions</span>
        </div>
        <div className="pi-sessions-empty">No Pi sessions found</div>
      </div>
    );
  }

  const totalSessions = projects.reduce((sum, p) => sum + p.sessions.length, 0);

  return (
    <div className="pi-sessions-section">
      <div className="session-section-heading">
        <span>Pi Sessions</span>
        <small>{totalSessions}</small>
      </div>

      <div className="pi-sessions-list">
        {projects.map((project) => {
          const isExpanded = expandedProjects.has(project.path);

          return (
            <div className="pi-project-group" key={project.path}>
              <button
                className="pi-project-header"
                disabled={isStreaming}
                type="button"
                onClick={() => toggleProject(project.path)}
              >
                <span className="pi-project-name">{project.name}</span>
                <small className="pi-project-count">{project.sessions.length}</small>
              </button>

              {isExpanded && (
                <div className="pi-session-list">
                  {project.sessions.map((session) => (
                    <div className="pi-session-row" key={session.id}>
                      <div className="pi-session-info">
                        <span className="pi-session-first-msg">
                          {session.firstMessage}
                        </span>
                        <small className="pi-session-meta">
                          {session.messageCount} messages · {relativeTime(session.modified)}
                        </small>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
