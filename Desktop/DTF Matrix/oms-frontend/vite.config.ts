import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.ico"],
      manifest: {
        name: "DTF Matrix — OMS",
        short_name: "DTF Matrix",
        description: "Order Management System DTF Matrix",
        theme_color: "#0B1F51",
        background_color: "#FFFFFF",
        display: "standalone",
        start_url: "/",
        icons: [],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ttf,woff2,svg,png,ico}"],
        // Bumped to 10 MB: the `pdf` chunk (pdf-lib + pdfjs-dist + fontkit)
        // can exceed 5 MB on some builds, which would silently skip it from
        // the precache and break offline PDF preview. The chunk is still
        // lazy-loaded at runtime; this only governs precache eligibility.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    port: 5173,
    host: true,
  },
  optimizeDeps: {
    include: ["lucide-react"],
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          if (id.includes("node_modules")) {
            if (id.includes("react-router-dom") || id.includes("/react/") || id.includes("/react-dom/")) {
              return "vendor";
            }
            if (id.includes("@tanstack/react-query")) return "tanstack";
            if (id.includes("@dnd-kit")) return "dnd";
            if (id.includes("konva") || id.includes("react-konva")) return "konva";
            if (id.includes("pdf-lib") || id.includes("pdfjs-dist") || id.includes("@pdf-lib/fontkit")) {
              return "pdf";
            }
            if (id.includes("lucide-react")) return "icons";
            if (id.includes("fuse.js")) return "search";
          }
          return undefined;
        },
      },
    },
  },
});
