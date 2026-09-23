# CLAUDE.md

A scripted marketing animation, "Claude vs Claude + FinanceOS" (Datarails). It's plain HTML/CSS/JS with no build step and no dependencies apart from Google Fonts (Poppins, Lora). It was exported from a claude.ai artifact.

## Run / preview
- `python3 -m http.server 8420`, then open http://localhost:8420 (also set up in `.claude/launch.json` as `animation`).
- Recording: `?rec=1` hides the controls. The final videos are rendered at 60fps and edited in Premiere in the parent folder (`../`), with VO tracks `../1.mp3`–`../11.mp3`.

## Architecture
- `#stage` is a fixed 1920×1080 canvas, and `fit()` scales it to the window. Position everything in stage pixels.
- Two panels: `#L` (Claude alone) and `#R` (Claude + FinanceOS). Each one holds a mock Claude chat UI (`.msgs`, `.composer`), a mock Excel (`.excel`, built by `buildExcel`), and a `.card` overlay.
- Full-stage overlays: `#intro`, `#hood` (under the hood), `#drift`, `#tokens`, `#end`, `#dim`. `#cap` holds the VO captions and `#cur` is the fake cursor.
- `js/main.js`:
  - Engine: `sleep()` respects pause and speed. `beat(n,label)` sets `beatT0`, and `untilV(ms)` waits until `ms` after the current beat starts. **Beat timings are synced to the VO audio.** When you change content, keep the `untilV` marks, or retime them against the matching mp3.
  - Helpers: `type`, `send`, `files`, `newAssistant`, `stream`, `table`, `tool`/`toolDone`, `line`, `caption`, `click`, `moveCursorTo`, `xselect`/`xsheet`/`xbtn` (Excel).
  - `run(tok)` is the whole script, beat by beat. `guard(tok)` stops a stale run after a restart.
  - Token counters are estimates: text length/4, file rows × `TOK_PER_ROW`, and tool definitions counted once (1200).
- The data is fictional (the "Vandelay" entities). Left and right numbers differ on purpose (for example DE 52.8% vs 54.3%). Keep the tables, the drift box, the lineage panel and the Excel sheets consistent with each other.

## Brand
- Datarails tokens are on `:root`: navy `#0C142B`, pink `#FA3576`, yellow `#FFA30F`, cream `#FFF9F1`. Claude UI tokens use the `--c-*` prefix.
- For Datarails brand rules, use the `dr-marketing:datarails-design-official` skill. For customer-facing copy, use `positioning-guard`.
- `assets/financeos-badge.png` is the pill-shaped logo used on light UI. `assets/financeos-wordmark.png` is used in the panel label and the end card.
