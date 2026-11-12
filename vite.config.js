import { defineConfig } from "vite";
import { cpSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// models/ sits next to index.html so `python -m http.server` and the built
// dist/ both find it at ./models/…; copy it into dist after the build.
const copyModels = () => ({
  name: "copy-models",
  apply: "build",
  closeBundle() {
    const from = resolve(__dirname, "models");
    if (existsSync(from))
      cpSync(from, resolve(__dirname, "dist/models"), { recursive: true });
  },
});

export default defineConfig({
  base: "./",
  plugins: [copyModels()],
  build: {
    chunkSizeWarningLimit: 900,
    rolldownOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("node_modules/three/") || id.includes("/vendor/")
            ? "three"
            : undefined,
      },
    },
  },
});
