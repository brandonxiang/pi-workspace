import { resolve } from "node:path";
import viteFastify from "@fastify/vite/plugin";
import viteReact from "@vitejs/plugin-react";

export default {
  root: resolve(import.meta.dirname, "client"),
  plugins: [viteFastify({ spa: true }), viteReact()],
  build: {
    emptyOutDir: true,
    outDir: resolve(import.meta.dirname, "dist")
  },
  // Vitest config — relative to vite root (client/)
  test: {
    include: ["../server/**/*.test.ts"]
  }
};
