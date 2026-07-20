import { resolve } from "node:path";
import viteReact from "@vitejs/plugin-react";
import { lazyPlugins } from "vite-plus";

export default {
  root: resolve(import.meta.dirname, "website"),
  base: "/pi-workspace/",
  plugins: lazyPlugins(() => [viteReact()]),
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "dist-website"),
  },
  test: {
    environment: "jsdom",
    environmentOptions: {
      jsdom: {
        url: "https://pi-workspace.test",
      },
    },
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
};
