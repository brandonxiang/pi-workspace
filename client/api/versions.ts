import type { VersionsResponse } from "../types/index";

export async function fetchVersions(): Promise<VersionsResponse> {
  const response = await fetch("/api/versions");
  const body = (await response.json()) as VersionsResponse & { error?: string };
  if (!response.ok) throw new Error(body.error || "Failed to check versions");
  return body;
}

export async function upgradePackage(
  target: "pi" | "pi-workspace",
  actionToken: string,
): Promise<{ result: { status: string; message: string } }> {
  const response = await fetch("/api/upgrade", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ target, actionToken }),
  });
  const body = (await response.json()) as {
    result?: { status: string; message: string };
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || "Upgrade failed");
  return body as { result: { status: string; message: string } };
}
