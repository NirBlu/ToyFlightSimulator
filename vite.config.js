import { defineConfig } from "vite";
export default defineConfig({
  base: "./",
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
