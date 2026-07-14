import type { Locale } from "./content";

export const LOCALE_STORAGE_KEY = "pi-workspace-website-locale";

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "zh";
}

export function resolveInitialLocale(storedLocale: string | null, browserLanguage: string): Locale {
  if (isLocale(storedLocale)) return storedLocale;
  return browserLanguage.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function readInitialLocale(): Locale {
  try {
    return resolveInitialLocale(localStorage.getItem(LOCALE_STORAGE_KEY), navigator.language);
  } catch {
    return resolveInitialLocale(null, navigator.language);
  }
}

export function persistLocale(storage: Pick<Storage, "setItem">, locale: Locale): void {
  storage.setItem(LOCALE_STORAGE_KEY, locale);
}
