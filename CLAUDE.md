# Tutorcat Desk (tutor-resource)

Tools for tutors listed on Tutorcat (https://f00di.github.io/tutorcat/, repo `tutorcat`): a schedule they can drag around, blackout times, lesson notes and invoices. An installable web app (PWA): tutors open it in Chrome, Edge or Safari on Windows or macOS (or a phone) and install it, and it then works offline in its own window. **Local-first: every record stays in that browser's IndexedDB. There is no server, account or analytics.** Deployed to GitHub Pages at https://f00di.github.io/tutor-resource/.

## Working rules
- One Claude Code session at a time on this repo; one branch per topic, merged before the next.
- No commit, push or deploy until the owner says so. Pushing `main` deploys (`.github/workflows/deploy-pages.yml`).
- Nothing the tutor types may leave the device. Never add a fetch to an outside service, analytics, error tracking or fonts from a CDN. `npm run test:build` checks the built code for that. WhatsApp only opens through `wa.me` links that the tutor clicks.
- Data about students is about minors: no sample or test data with real names or numbers.

## Stack and commands
- React 19 + Vite 8 + Tailwind v4 + TypeScript. Dexie (IndexedDB) + `dexie-react-hooks` for live data. FullCalendar 6 (MIT plugins only: timegrid, daygrid, list, interaction) on the Schedule page, which is lazy-loaded. `vite-plugin-pwa` (Workbox) for the manifest and service worker (`registerType: "prompt"`: updates wait for the tutor to click Reload).
- `npm install`, then `npm run dev` (http://localhost:5173/tutor-resource/). `npm run build` → `dist/` (vite `base` = `/tutor-resource/`; `BASE_PATH=/` for a custom domain). `npm test` (vitest), `npm run typecheck`, then `npm run test:build` after a build.
- Hash routes (`#/schedule`, `#/students/<id>`, `#/invoices/<id>`) in `src/lib/router.ts`, so GitHub Pages and offline need no server rules.

## Code map
- `src/lib/types.ts`: every stored shape. `db.ts`: Dexie schema (add a new `version()` for schema changes, never edit version 1). `actions.ts`: every write (keeps lessons, invoices and packages in step). `settings.ts`: tutor details and defaults (in the database, so they're in backups).
- `src/lib/time.ts`: time zones without a library. Lessons are UTC instants, and the calendar shows the device's zone. Repeating lessons keep the **student's** wall-clock time (`weeklySeries`, `shiftInZone`), so a tutor abroad sees them move when their own clocks change. The Gulf has no daylight saving.
- `src/lib/money.ts`: minor units everywhere. KWD, BHD and OMR have 3 decimals. `invoices.ts`: totals (lines rounded once, then discount, then tax) and numbering (`INV-2026-007`).
- `src/lib/lessons.ts`: planned lessons count as taught once they end (no ticking off). Billable = taught + cancelled-and-charged. Packages are used up oldest lesson first (`packageUsage`). Lessons already on an invoice are never billed twice.
- `src/lib/blackouts.ts`: one shape for weekly, dated and dated-with-times blackouts, in the tutor's local time. `PRESETS`: Friday prayer, plus Ramadan and Eid dates that are **estimates** (moon sighting) and are labelled that way in the app. Add each new year's dates there.
- `src/lib/messages.ts`: WhatsApp texts in the family's language (`Student.messageLang`). The lesson summary never includes the private note.
- `src/lib/backup.ts`: one JSON file with everything. Restoring replaces all data. Dashboard reminder after 14 days without a backup.
- `src/lib/sample.ts`: "Try it with sample data". Every sample record has `sample: true`, and removing the samples also deletes anything made for sample students.
- Components: `dialog-host.tsx` opens every dialog (plus `ask`/`confirm`/`toast`); dialogs are native `<dialog>`. `invoice-paper.tsx` is the invoice as printed (Tutorcat's example-invoice layout); the invoice page portals a copy into `.print-root` for `window.print()` (Save as PDF).

## Translations and right-to-left
- Same system as Tutorcat: `src/lib/i18n.tsx` + `i18n/en.json` / `i18n/ar.json`, flat keys, plurals keyed one/other (Arabic: zero/one/two/few/many/other). English is bundled and Arabic is a lazy chunk (cached offline). `tests/i18n.test.ts` checks key parity, plural forms, placeholders and that no visible attribute is hard-coded English.
- Western digits in Arabic (`ar-AE-u-nu-latn`), Tutorcat's glossary (`tutorcat/docs/i18n-glossary.md`): مدرّس, حضوريًا, etc. Gulf place names in Arabic come from `zonePlace()` in `time.ts`. `i18n/ar.json` `_meta.lowConfidence` lists what a native speaker should check first.
- Names, notes and topics the tutor types are never translated, and in Arabic they're wrapped in `<bdi>` (or isolated by `t()`) so "Sara A." keeps its full stop on the right side.
- Logical CSS only (`inset-inline-*`, `padding-inline`, `text-align: start`). The invoice and messages can be in a different language from the app (`useTranslator(lang)`).

## Design
- Tutorcat's tokens, fonts (self-hosted DM Sans, Manrope, IBM Plex Sans Arabic in `src/assets/fonts/`, SIL OFL) and logo (`src/components/logo.tsx`). Light and dark themes (system default, toggle remembered in `localStorage["tutorcat-desk.theme"]`). Language in `localStorage["tutorcat-desk.lang"]`, or `?lang=ar` for one visit.
- Icons in `public/` were rendered from `public/favicon.svg` (the cat on a green tile) with headless Edge.
- Sidebar above 900px; top bar and bottom tabs below. Dialogs are full screen under 640px. Check phone width for horizontal overflow after layout changes.
