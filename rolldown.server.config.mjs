import { defineConfig } from "rolldown";
import { builtinModules } from "node:module";

const builtins = new Set(builtinModules);

export default defineConfig({
  input: "server/index.ts",
  platform: "node",
  external: (id) => {
    if (builtins.has(id)) return true;
    if (id.startsWith("node:")) return true;
    if (!id.startsWith(".") && !id.startsWith("/")) return true;
    return false;
  },
  output: {
    dir: "dist-server",
    format: "esm",
    entryFileNames: "index.mjs",
    chunkFileNames: "chunks/[name]-[hash].mjs",
  },
  sourcemap: true,
  resolve: {
    extensions: [".mjs", ".js", ".ts", ".json"],
  },
});
