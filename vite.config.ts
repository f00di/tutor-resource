import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";

import pkg from "./package.json" with { type: "json" };

// GitHub Pages serves the site from /tutor-resource/. For a custom domain, build with BASE_PATH=/
// Two pages: the information page with the sign-up form at the root (index.html), and the app at app/.
const base = process.env["BASE_PATH"] ?? "/tutor-resource/";
const appBase = `${base}app/`;

// The information page isn't the app, so browsers shouldn't offer to install it: drop the manifest
// link the PWA plugin adds to every page. It's added late, so this edits the finished file (listed
// after VitePWA below, so it runs after it).
function noManifestOnInfoPage(): Plugin {
  return {
    name: "tutorcat-desk-no-manifest-on-info-page",
    apply: "build",
    enforce: "post",
    generateBundle(_options, bundle) {
      const page = bundle["index.html"];
      if (page?.type === "asset" && typeof page.source === "string") page.source = page.source.replace(/\s*<link rel="manifest"[^>]*>/g, "");
    },
  };
}

export default defineConfig({
  base,
  define: { __APP_VERSION__: JSON.stringify(pkg.version) },
  resolve: { tsconfigPaths: true },
  build: {
    rollupOptions: { input: { main: "index.html", app: "app/index.html" } },
  },
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
        // The id stays the root it was first installed from, so copies installed before the app moved
        // to app/ update to the new start_url instead of becoming a second app.
        id: base,
        name: "Tutorcat Desk",
        short_name: "Tutorcat Desk",
        description: "Schedule, blackout times, lesson notes and invoices for tutors. Everything stays on your device.",
        start_url: appBase,
        scope: appBase,
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
        // Offline, any app address opens the app; the information page is cached as its own page.
        navigateFallback: `${appBase}index.html`,
        navigateFallbackAllowlist: [new RegExp(`^${appBase.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&")}`)],
      },
    }),
    noManifestOnInfoPage(),
  ],
});
