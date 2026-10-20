# Hosting Tutorcat Desk

Tutorcat Desk is a static app (`dist/` after `npm run build`). Tutors' data never touches the host: it lives in each tutor's browser. The host only serves the app's files.

## Now: GitHub Pages, public repo, unlisted

- Address: https://f00di.github.io/tutor-resource/. Pushing `main` runs `.github/workflows/deploy-pages.yml`: tests, typecheck, build, `npm run test:build`, then deploy `dist/`.
- **One-time switch:** repo **Settings → Pages → Build and deployment → Source: GitHub Actions**. Without it, the "Configure Pages" step fails with `Get Pages site failed ... Not Found` and nothing is published (the site is a 404).
- Unlisted: `<meta name="robots" content="noindex, nofollow">` in `index.html`, `public/robots.txt` with `Disallow: /`, and no sitemap. `npm run test:build` fails if any of these is missing.
  - Crawlers only read `robots.txt` at the root of a domain (`f00di.github.io/robots.txt`), so on a project site the file under `/tutor-resource/` has no effect. The noindex tag is what keeps the app out of search results here.
  - The repo itself is public: anyone can find and read the source code on GitHub. Tutors' data is never in it.

## Option, not done: private repo + Cloudflare Pages or Netlify

**Ask Hassan before doing any of this.** On GitHub's Free plan, Pages only publishes public repos. A private repo needs either GitHub Pro (paid per month; check the current price at github.com/pricing) or another host. Both hosts below build straight from a private GitHub repo on their free plans.

### Know before switching
1. **The address changes, and tutors' data is tied to the address.** Each browser keeps the data per site address. A tutor who used `f00di.github.io/tutor-resource/` would see an empty app at the new address and would have to use **Back up now** on the old one, then **Restore from a backup** on the new one (and reinstall the app). Switch before the link goes to tutors.
2. **The app moves to the root of the new address**, so it's built with `BASE_PATH=/`. `vite.config.ts` and `scripts/check-build.mjs` already read it.
3. **`robots.txt` starts to count at a root address.** With `Disallow: /`, crawlers never fetch the page, so they never see the noindex tag. If another site links to the app, a search engine can still list the bare address with no description. To keep it out completely, allow crawling and send a noindex header instead: change `public/robots.txt` to `User-agent: *` with an empty `Disallow:` line, and add `public/_headers` (both hosts read this file):
   ```
   /*
     X-Robots-Tag: noindex, nofollow
   ```
   Keep the meta tag either way. Add `_headers` only when switching: GitHub Pages would just serve it as a file.
4. **The Pages deploy job has to go.** On a private Free repo, `actions/configure-pages` fails. Delete the `Configure Pages` and `Upload artifact` steps and the whole `deploy` job from `deploy-pages.yml`, rename it (e.g. `checks.yml`, "Checks"), and keep the build job as a check on pull requests and `main`. Actions on private repos use the free 2,000 minutes a month (GitHub Free); one run takes about a minute.
5. **The desktop app (the `desktop-app` branch, if it's merged) depends on public releases.** Installed apps fetch updates from `https://github.com/f00di/tutor-resource/releases/latest/download/latest.json`, and tutors download installers from the same Releases. On a private repo those files need a GitHub sign-in, so updates and downloads stop. You'd need a separate public, release-only repo (point `tauri.conf.json`'s updater endpoint and the release workflow at it), or serve `latest.json` and the installers from the new host. Decide this before going private.
6. **What going private does on GitHub:** stars and watchers are erased, and any forks stay public (detached). Anything already cloned or forked stays out there. Private hides the code from now on; it doesn't take back what was public.

### Steps: Cloudflare Pages (recommended)
Free plan (from Cloudflare's docs): 500 builds a month, one build at a time (20-minute limit), up to 20,000 files per site, 25 MiB per file, 100 custom domains per project. Static traffic isn't charged on Pages, and third-party comparisons say Free has no bandwidth cap. Check cloudflare.com's plans page before relying on that. This app is 24 files, about 1.1 MB.

1. Cloudflare dashboard → **Workers & Pages → Create → Pages → Connect to Git**. Authorise the Cloudflare GitHub app for **only** `f00di/tutor-resource`.
2. Settings:
   - Production branch: `main`
   - Framework preset: None
   - Build command: `npm test && npm run typecheck && npm run build && npm run test:build`
   - Build output directory: `dist`
   - Environment variables (production and preview): `BASE_PATH` = `/`, `NODE_VERSION` = `22`
   - Project name: e.g. `tutorcat-desk` → `https://tutorcat-desk.pages.dev`
   Cloudflare installs packages from `package-lock.json` on its own. A failing test fails the build, and the last good version stays live.
3. Preview builds: Cloudflare also publishes every other branch at a public `*.tutorcat-desk.pages.dev` address. Turn them off under **Settings → Builds → Branch control → Preview branches: None**, or put them behind Cloudflare Access (free for up to 50 users).
4. Open the new address and check: the app loads, it installs, it opens offline, `/robots.txt` is served, and the page source has the noindex tag.
5. Make the robots/`_headers` change from point 3 above, and the workflow change from point 4, on a branch. Merge it.
6. Repo **Settings → Pages → Unpublish site**, then **Settings → General → Danger Zone → Change visibility → Make private**.
7. Update the address in `CLAUDE.md`, `README.md`, and anywhere Tutorcat links to the Desk.

### Steps: Netlify
Free plan: since 2025 Netlify bills in credits. 300 credits a month, each production deploy costs 15, and bandwidth and requests also use credits. When the credits run out, sites pause until the next month. These figures come from third-party summaries in October 2026, not Netlify's own pricing page, so check that page first. That's roughly 20 deploys a month with no traffic at all. Netlify suits this less well than Cloudflare.

1. Netlify → **Add new project → Import an existing project → GitHub**. Authorise the Netlify app for only this repo.
2. Branch to deploy `main`. Build command and publish directory as for Cloudflare (`dist`). Environment variables: `BASE_PATH` = `/`, `NODE_VERSION` = `22`. You get `https://<name>.netlify.app`.
3. **Project configuration → Build & deploy → Branches and deploy contexts**: deploy previews off, branch deploys none. Each deploy uses credits and publishes a public address.
4. Then steps 4–7 from Cloudflare.
