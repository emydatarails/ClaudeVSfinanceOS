# Claude vs Claude + FinanceOS

A 1920×1080 scripted, browser-based animation comparing Claude alone (left panel) with Claude connected to Datarails FinanceOS (right panel). It plays through 10 beats: setup, connector, data access, consolidation, context, drift, Excel/DR.GET, control, token cost, and the close.

## Run

```bash
python3 -m http.server 8420
```

Then open http://localhost:8420. Serve it over HTTP instead of opening `index.html` directly, so the asset paths resolve the same way every time.

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
assets/           logos (Claude, FinanceOS, Datarails, Google Drive, Slack)
audio/            narration, one Despina VO clip per beat (v4 final, 12 lines)
```
