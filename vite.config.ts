import { readFileSync } from "node:fs"
import tailwindcss from "@tailwindcss/vite"
import vue from "@vitejs/plugin-vue"
import { defineConfig } from "vitest/config"

const PACKAGE = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")) as { version: string }

export default defineConfig({
    plugins: [vue(), tailwindcss()],
    clearScreen: false,
    define: {
        __APP_VERSION__: JSON.stringify(PACKAGE.version),
    },
    server: {
        port: 5173,
        strictPort: true,
        proxy: { "/v1": process.env.VEYL_API || "http://127.0.0.1:8080" },
    },
    build: {
        outDir: "dist",
        target: "es2022",
        assetsInlineLimit: 0,
        sourcemap: false,
    },
    test: {
        environment: "happy-dom",
        include: ["tests/**/*.test.ts"],
    },
})
