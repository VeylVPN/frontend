import { defineConfig } from "vite";

export default defineConfig({
  server: {
    proxy: { "/v1": process.env.VEYL_API || "http://127.0.0.1:8080" },
  },
  build: { outDir: "dist", sourcemap: false },
});
