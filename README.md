# Claude vs Claude + FinanceOS

A 1920×1080 scripted, browser-based animation comparing Claude alone (left panel) with Claude connected to Datarails FinanceOS (right panel). It plays through 13 chapters: intro, connector, under the hood, the question, data access, consolidation, definitions, tracing, the CFO pack, next month, audit trail, token cost, and the close. A hover menu on the left edge jumps between them.

## Run

```bash
python3 -m http.server 8420
```

Then open http://localhost:8420. Serve it over HTTP instead of opening `index.html` directly, so the asset paths resolve the same way every time.

## Deploy to Vercel

It's a static site with no build step. `vercel.json` sets the framework to none, turns on clean URLs, and adds cache headers. `.vercelignore` leaves the dev-only files out of the deployment.

- **Dashboard:** import this repo at vercel.com/new, keep the preset on **Other**, and leave the build command and output directory empty. Vercel serves the repo root.
- **CLI:** `npx vercel` for a preview deploy, `npx vercel --prod` for production.

Audio clips are cached for a year (`immutable`). They're loaded as `audio/<clip>.wav?v=VO_REV`, so when you replace a clip, bump `VO_REV` in `js/main.js` and browsers will fetch the new file.

## Controls

- **Space**: play or pause · **R**: restart · **H**: hide the control bar (clean frame for recording)
- Speed selector (0.75×–2×), plus toggles for the VO audio and the VO captions

## URL parameters

| Param | Effect |
|---|---|
| `?speed=1.5` | Playback speed |
| `?rec=1` | Hides the control bar for screen recording |
| `?cap=1` | Shows the VO captions |
| `?vo=0` | Mutes the narration |
| `?anim=<rate>` | Forces the CSS/Web Animations playback rate |

## Layout

```
index.html        markup for the stage, panels and overlays
css/styles.css    all styles (design tokens are on :root)
js/main.js        engine (sleep/clock, cursor, typing, Excel mock) + the beat script in run()
vercel.json       Vercel config (static, clean URLs, cache headers)
assets/           logos (Claude, FinanceOS, Datarails, Google Drive, Slack)
audio/            narration, one Despina VO clip per beat (v4 final; beat 8 re-recorded with Gemini 2.5 Pro)
```
