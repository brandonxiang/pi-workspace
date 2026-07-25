import type { Locale } from "./content";

export const LOCALE_STORAGE_KEY = "pi-workspace-website-locale";
export const THEME_STORAGE_KEY = "pi-workspace-website-theme";

export type Theme = "light" | "dark";

function isTheme(value: string | null): value is Theme {
  return value === "light" || value === "dark";
}

function isLocale(value: string | null): value is Locale {
  return value === "en" || value === "zh";
}

export function resolveInitialLocale(
  storedLocale: string | null,
  _browserLanguage: string,
): Locale {
  if (isLocale(storedLocale)) return storedLocale;
  return "en";
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

export function readInitialTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(stored)) return stored;
  } catch {
    // storage unavailable, fall through to system preference
  }
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function persistTheme(storage: Pick<Storage, "setItem">, theme: Theme): void {
  storage.setItem(THEME_STORAGE_KEY, theme);
}
