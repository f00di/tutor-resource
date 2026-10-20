# Tutorcat Desk

Free tools for tutors listed on [Tutorcat](https://f00di.github.io/tutorcat/): a weekly schedule you can drag around, blackout times, lesson notes and invoices, in English and Arabic.

It's a web app you install from the browser (Chrome, Edge or Safari, on Windows, macOS or a phone). Once installed it opens in its own window and works offline. **Everything stays on your device**: there is no account, and nothing is sent to Tutorcat or anyone else.

## What it does
- **Schedule:** day, 3-day, week, month and list views. Drag a lesson to move it, or drag its edge to change its length. Lessons can repeat weekly or every two weeks, and moving one asks whether to move the later ones too. Each lesson shows the family's time as well as yours, and repeats keep the family's time when your clocks change.
- **Blackouts:** weekly (e.g. Friday prayer) or on dates (travel, Eid, exam season), optionally only for certain hours. They're shaded on the calendar, and you're warned before booking into one. Quick-add Ramadan and Eid dates are labelled as estimates.
- **Notes:** a plan for each lesson ("what to teach") that you tick off, notes on what you covered, homework, a private note, and day notes ("print the past paper"). Unfinished topics move to the next lesson in one click. You can send the family a summary on WhatsApp (never the private note).
- **Invoices:** built from taught lessons (and cancellations you charge for), by month or by dates. They support prepaid packages, discounts, an optional VAT line, Gulf currencies (KWD, BHD and OMR with 3 decimals), and English or Arabic. Print or save as PDF, send the total on WhatsApp, and mark invoices paid.
- **Today:** today's lessons, the next 7 days, hours this week, unpaid totals, lessons ready to invoice, leftover topics, packages running low and upcoming blackouts.
- **Your data:** back up to one file and restore it on another laptop. Sample data lets you try the app first.

## Development
```sh
npm install
npm run dev        # http://localhost:5173/tutor-resource/
npm test           # vitest: time zones, money, packages, blackouts, storage, translations, app
npm run typecheck
npm run build && npm run test:build
```
Pushing `main` deploys to GitHub Pages (`.github/workflows/deploy-pages.yml`; the repo's Settings → Pages → Source must be **GitHub Actions**). The app is unlisted (noindex, `robots.txt`, no sitemap). See `docs/hosting.md` for hosting and `CLAUDE.md` for how it's put together.
