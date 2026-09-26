import { resolve } from "node:path";
import viteReact from "@vitejs/plugin-react";
import { lazyPlugins } from "vite-plus";

export default {
  root: resolve(import.meta.dirname, "website"),
  base: "/",
  plugins: lazyPlugins(() => [viteReact()]),
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "dist-website"),
  },
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://pi-workspace.test",
      },
    },
    setupFiles: ["src/__tests__/setup.ts"],
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
};
