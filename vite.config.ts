import { resolve } from "node:path";
import viteReact from "@vitejs/plugin-react";
import { lazyPlugins } from "vite-plus";

export default {
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ignorePatterns: [
      "dist/**",
      "dist-server/**",
      "dist-website/**",
      "node_modules/**",
      ".env",
      ".env.*",
    ],
  },
  lint: {
    ignorePatterns: [
      "dist/**",
      "dist-server/**",
      "dist-website/**",
      "node_modules/**",
      ".env",
      ".env.*",
    ],
    options: {
      typeAware: true,
      typeCheck: true,
    },
    jsPlugins: [
      {
        name: "vite-plus",
        specifier: "vite-plus/oxlint-plugin",
      },
    ],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
    },
  },
  root: resolve(import.meta.dirname, "client"),
  // NOTE: @fastify/vite's client plugin used to set this environment's outDir to
  // `<root>/dist/client` and to enable `manifest`. Nothing consumed the manifest,
  // so only the output directory is kept, set explicitly here.
  plugins: lazyPlugins(() => [viteReact()]),
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "dist", "client"),
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (id.includes("@xterm")) {
            return "terminal";
          }

          if (id.includes("antd") || id.includes("@ant-design")) {
            return "ui-vendor";
          }
        },
      },
    },
  },
  // `vp pack` (tsdown) builds the Node server bundle into dist-server/.
  // `deps.neverBundle: true` externalizes every bare import, so the dev-only
  // `import("vite")` stays a runtime import instead of being inlined into the
  // published bundle.
  pack: {
    entry: ["server/index.ts"],
    outDir: "dist-server",
    format: "esm",
    platform: "node",
    sourcemap: true,
    deps: { neverBundle: true },
  },
  // Vitest config — relative to vite root (client/)
  test: {
    // Vitest v4 compatibility: preserve mock call history.
    // Remove after tests no longer rely on calls from setup or earlier tests.
    // https://viteplus.dev/guide/vitest-v5#remove-unneeded-compatibility-settings
    // https://vitest.dev/guide/migration/#clearmocks-is-enabled-by-default
    clearMocks: false,
    env: { NODE_ENV: "development" },
    include: ["**/*.test.ts", "**/*.test.tsx", "../server/**/*.test.ts", "../shared/**/*.test.ts"],
  },
};
