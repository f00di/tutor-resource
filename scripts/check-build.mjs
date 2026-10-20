// After `npm run build`: checks dist/ is a working, installable app at its base path, and that
// nothing but the built app ships. Run with `npm run test:build`.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const base = process.env.BASE_PATH ?? "/tutor-resource/";
// DIST_DIR checks a build made elsewhere (vite build --outDir ...) without touching dist/.
const dist = process.env.DIST_DIR ?? "dist";
const failures = [];
const check = (ok, message) => ok || failures.push(message);

const files = [];
(function walk(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else files.push(relative(dist, path).split(sep).join("/"));
  }
})(dist);

const html = readFileSync(join(dist, "index.html"), "utf8");
check(html.includes(`src="${base}assets/`), `index.html loads its script from ${base}assets/`);
check(html.includes(`href="${base}manifest.webmanifest"`), "index.html links the web app manifest");
check(html.includes(`href="${base}favicon.svg"`), `the favicon is under ${base}`);
check(html.includes('<script>') && html.includes("tutorcat-desk.theme"), "the boot script (theme and language before first paint) is inline");
check(/<style>html\{background:#[0-9a-f]{6}\}html\.dark\{background:#[0-9a-f]{6}\}<\/style>/.test(html), "the page colour is inline, so opening the app never flashes");

const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
check(manifest.start_url === base && manifest.scope === base, "the manifest's start_url and scope are the base path");
check(manifest.display === "standalone", "the app opens in its own window when installed");
for (const icon of manifest.icons) check(existsSync(join(dist, icon.src)), `icon ${icon.src} exists`);
check(manifest.icons.some((icon) => icon.purpose === "maskable"), "there is a maskable icon");

const sw = readFileSync(join(dist, "sw.js"), "utf8");
check(sw.includes("index.html"), "the service worker caches index.html for offline use");
const arabicChunk = files.find((file) => /^assets\/ar-.*\.js$/.test(file));
check(arabicChunk && sw.includes(arabicChunk), "the Arabic text is cached for offline use");
const scheduleChunk = files.find((file) => /^assets\/schedule-.*\.js$/.test(file));
check(scheduleChunk && sw.includes(scheduleChunk), "the calendar is cached for offline use");

check(!files.some((file) => file.endsWith(".map")), "no source maps ship");
check(!files.some((file) => /^(src|tests|docs|scripts)\//.test(file) || file.endsWith(".tsx") || file.endsWith(".ts")), "no source files ship");
check(!files.some((file) => /backup.*\.json$/i.test(file)), "no backup files ship");

// The app never talks to a server: no fetch/XHR to outside URLs in the built code.
const js = files.filter((file) => file.endsWith(".js") && file.startsWith("assets/")).map((file) => readFileSync(join(dist, file), "utf8")).join("\n");
check(!/fetch\(\s*["'`]https?:/.test(js), "no fetch() to an outside URL");
check(!/googleapis|google-analytics|googletagmanager|sentry\.io/.test(js), "no analytics or outside services");

if (failures.length) {
  console.error(`Build check failed:\n- ${failures.join("\n- ")}`);
  process.exit(1);
}
console.log(`Build check passed (${files.length} files under ${base}).`);
