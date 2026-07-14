import { describe, expect, it } from "vite-plus/test";
import { LOCALE_STORAGE_KEY, persistLocale, resolveInitialLocale } from "./locale";

describe("website locale", () => {
  it("prefers a supported stored locale over the browser language", () => {
    expect(resolveInitialLocale("zh", "en-US")).toBe("zh");
  });

  it("uses Simplified Chinese for Chinese browser languages", () => {
    expect(resolveInitialLocale(null, "zh-CN")).toBe("zh");
    expect(resolveInitialLocale(null, "zh-Hans")).toBe("zh");
  });

  it("falls back to English for invalid stored values and other browser languages", () => {
    expect(resolveInitialLocale("de", "de-DE")).toBe("en");
    expect(resolveInitialLocale(null, "ja-JP")).toBe("en");
  });

  it("persists a supported locale", () => {
    const values = new Map<string, string>();
    const storage = {
      setItem(key: string, value: string) {
        values.set(key, value);
      },
    };

    persistLocale(storage, "zh");

    expect(values.get(LOCALE_STORAGE_KEY)).toBe("zh");
  });
});
