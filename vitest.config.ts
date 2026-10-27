import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

// Logic tests run in Node. A file that renders components starts with `// @vitest-environment jsdom`.
export default defineConfig({
  plugins: [react()],
  define: { __APP_VERSION__: JSON.stringify("test") },
  resolve: {
    tsconfigPaths: true,
    // The update prompt's service worker hook only exists in real builds.
    alias: { "virtual:pwa-register/react": fileURLToPath(new URL("./tests/stubs/pwa-register.ts", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    setupFiles: ["tests/setup.ts"],
  },
});
