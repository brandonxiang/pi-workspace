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
    // The only chunk above Vite's 500 kB default is the lazily-loaded
    // MarkdownContent bundle (~780 kB): `@ant-design/x`'s CodeHighlighter uses
    // the full Prism bundle (`refractor`), which is a deliberate choice there.
    // It never loads on the initial path, so allow it instead of fragmenting it.
    chunkSizeWarningLimit: 800,
    rollupOptions: {
      output: {
        // Rolldown's `codeSplitting` groups produced circular chunks here: antd
        // and @ant-design/x depend on each other (XProvider wraps antd's
        // ConfigProvider), so splitting them broke module init at runtime
        // ("Class extends value undefined"). `manualChunks` retains Rollup's
        // execution-order guarantees, so the coupled packages stay together.
        manualChunks(id: string) {
          if (!id.includes("node_modules")) {
            return;
          }

          if (id.includes("@xterm")) {
            return "terminal";
          }

          // Code highlighting is reached only from the lazily-imported
          // MarkdownContent. Leaving it (and refractor) unassigned keeps the
          // ~600 kB Prism bundle in that dynamic chunk, off the initial load.
          if (id.includes("@ant-design/x/es/code-highlighter")) {
            return;
          }

          // rc-* is imported by antd and @ant-design/x but depends on neither.
          if (id.includes("@rc-component") || id.includes("/rc-")) {
            return "rc";
          }

          // antd and @ant-design/* are mutually dependent: keep them together.
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
