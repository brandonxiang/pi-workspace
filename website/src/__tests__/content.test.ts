import { describe, expect, it } from "vite-plus/test";
import { siteContent } from "../content";

function sortedKeys(value: object) {
  return Object.keys(value).sort();
}

describe("siteContent", () => {
  it("keeps the English and Chinese page structures aligned", () => {
    expect(sortedKeys(siteContent.zh)).toEqual(sortedKeys(siteContent.en));
    expect(sortedKeys(siteContent.zh.navigation)).toEqual(sortedKeys(siteContent.en.navigation));
    expect(sortedKeys(siteContent.zh.hero)).toEqual(sortedKeys(siteContent.en.hero));
    expect(sortedKeys(siteContent.zh.trust)).toEqual(sortedKeys(siteContent.en.trust));
  });

  it("describes three real product capabilities in both locales", () => {
    expect(siteContent.en.capabilities).toHaveLength(3);
    expect(siteContent.zh.capabilities).toHaveLength(3);
    expect(siteContent.en.capabilities.map((item) => item.key)).toEqual([
      "sessions",
      "dialogue",
      "terminal",
    ]);
    expect(siteContent.zh.capabilities.map((item) => item.key)).toEqual([
      "sessions",
      "dialogue",
      "terminal",
    ]);
  });

  it("uses the curl installer as the primary install action", () => {
    expect(siteContent.en.install.command).toBe(
      "curl -fsSL https://pi-workspace.brandonxiang.top/install.sh | bash",
    );
    expect(siteContent.en.install.altCommand).toBe("npm install -g pi-workspace");
    expect(siteContent.zh.install.command).toBe(siteContent.en.install.command);
    expect(siteContent.zh.install.altCommand).toBe(siteContent.en.install.altCommand);
  });
});
