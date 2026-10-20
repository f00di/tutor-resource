import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import pkg from "./package.json" with { type: "json" };

// GitHub Pages serves the app from /tutor-resource/. For a custom domain, build with BASE_PATH=/
const base = process.env["BASE_PATH"] ?? "/tutor-resource/";

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { tsconfigPaths: true },
  plugins: [
    react(),
    tailwindcss(),
    // Installable and offline: the service worker caches the whole app, so it opens with no
    // connection. "prompt": a new version waits until the tutor clicks Reload (src/components/update-toast.tsx),
    // so an update never reloads the page in the middle of typing.
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["favicon.svg", "apple-touch-icon.png"],
      manifest: {
        id: base,
        name: "Tutorcat Desk",
        short_name: "Tutorcat Desk",
        description: "Schedule, blackout times, lesson notes and invoices for tutors. Everything stays on your device.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#fcfcf9",
        theme_color: "#154834",
        icons: [
          { src: "icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,woff2,png,svg,webmanifest}"],
        navigateFallback: `${base}index.html`,
      },
    }),
  ],
});
