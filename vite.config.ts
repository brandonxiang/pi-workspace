import { resolve } from "node:path";
import viteFastify from "@fastify/vite/plugin";
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
  plugins: lazyPlugins(() => [viteFastify({ spa: true }), viteReact()]),
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "dist"),
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
  // Vitest config — relative to vite root (client/)
  test: {
    include: ["**/*.test.ts", "**/*.test.tsx", "../server/**/*.test.ts", "../shared/**/*.test.ts"],
  },
};
