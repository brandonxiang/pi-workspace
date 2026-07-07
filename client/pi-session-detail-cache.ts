import type { PiSessionDetailResponse } from "./types";

export interface PiSessionDetailCache {
  get(sessionId: string): PiSessionDetailResponse | null;
  set(detail: PiSessionDetailResponse): void;
}

export function createPiSessionDetailCache(): PiSessionDetailCache {
  const cache = new Map<string, PiSessionDetailResponse>();

  return {
    get(sessionId: string) {
      return cache.get(sessionId) ?? null;
    },
    set(detail: PiSessionDetailResponse) {
      cache.set(detail.session.id, detail);
    }
  };
}

export function getCachedPiSessionDetailForSelection({
  currentDetail,
  cache,
  sessionId
}: {
  currentDetail: PiSessionDetailResponse | null;
  cache: PiSessionDetailCache;
  sessionId: string;
}) {
  if (currentDetail?.session.id === sessionId) {
    return currentDetail;
  }

  return cache.get(sessionId);
}
