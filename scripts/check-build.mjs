// After `npm run build`: checks dist/ is the information page plus a working, installable app at
// app/, and that nothing but the built site ships. Run with `npm run test:build`.
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

// Two pages: the information page with the sign-up form at the root, and the app at app/.
const appBase = `${base}app/`;
const pages = { "index.html": readFileSync(join(dist, "index.html"), "utf8"), "app/index.html": readFileSync(join(dist, "app/index.html"), "utf8") };
for (const [name, html] of Object.entries(pages)) {
  check(html.includes(`src="${base}assets/`), `${name} loads its script from ${base}assets/`);
  check(html.includes(`href="${base}favicon.svg"`), `${name}: the favicon is under ${base}`);
  check(html.includes("<script>") && html.includes("tutorcat-desk.theme"), `${name}: the boot script (theme and language before first paint) is inline`);
  check(/<style>html\{background:#[0-9a-f]{6}\}html\.dark\{background:#[0-9a-f]{6}\}<\/style>/.test(html), `${name}: the page colour is inline, so opening it never flashes`);
  // Unlisted: search engines are told not to index the site or follow its links, and there's no sitemap.
  check(/<meta name="robots" content="noindex, nofollow"\s*\/?>/.test(html), `${name} has <meta name="robots" content="noindex, nofollow">`);
}
check(pages["app/index.html"].includes(`href="${base}manifest.webmanifest"`), "the app links the web app manifest");
check(!pages["index.html"].includes("manifest.webmanifest"), "the information page doesn't offer to install itself");

// The sign-up details go to the Tutorcat team's email and WhatsApp, and nowhere else.
const info = files.filter((file) => file.endsWith(".js") && file.startsWith("assets/")).map((file) => readFileSync(join(dist, file), "utf8")).join("\n");
check(info.includes("tutorcatsupport@gmail.com") && info.includes("971563784048"), "the sign-up form sends to tutorcatsupport@gmail.com and WhatsApp +971 56 378 4048");
const emails = new Set(info.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+\.[A-Za-z]{2,}/g) ?? []);
emails.delete("tutorcatsupport@gmail.com");
check(emails.size === 0, `no other email address ships (found: ${[...emails].join(", ")})`);
const robots = existsSync(join(dist, "robots.txt")) ? readFileSync(join(dist, "robots.txt"), "utf8") : "";
check(/^User-agent: \*\s*$/m.test(robots) && /^Disallow: \/\s*$/m.test(robots), "robots.txt disallows everything");
check(!files.some((file) => /sitemap/i.test(file)), "no sitemap ships");

const manifest = JSON.parse(readFileSync(join(dist, "manifest.webmanifest"), "utf8"));
check(manifest.start_url === appBase && manifest.scope === appBase, `the manifest's start_url and scope are the app (${appBase})`);
check(manifest.id === base, "the manifest id is unchanged, so copies installed before the move update instead of duplicating");
check(manifest.display === "standalone", "the app opens in its own window when installed");
for (const icon of manifest.icons) check(existsSync(join(dist, icon.src)), `icon ${icon.src} exists`);
check(manifest.icons.some((icon) => icon.purpose === "maskable"), "there is a maskable icon");

const sw = readFileSync(join(dist, "sw.js"), "utf8");
check(sw.includes('"app/index.html"') || sw.includes("app/index.html"), "the service worker caches the app for offline use");
check(sw.includes(`${appBase}index.html`), "offline, app addresses fall back to the app (not the information page)");
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
