# CLAUDE.md

A scripted marketing animation, "Claude vs Claude + FinanceOS" (Datarails). It's plain HTML/CSS/JS with no build step and no dependencies apart from Google Fonts (Poppins, Lora). It was exported from a claude.ai artifact.

## Run / preview
- `python3 -m http.server 8420`, then open http://localhost:8420 (also set up in `.claude/launch.json` as `animation`).
- Recording: `?rec=1` hides the controls. The final videos are rendered at 60fps and edited in Premiere in the parent folder (`../`).
- Narration: `audio/VO_*.wav` holds 12 clips, one per beat. `VO` in `js/main.js` maps `"<beat n>|<label>"` to a clip basename, and `beat()` starts it (beat 7b calls `vo('7b|Refresh')` directly). The audio follows play/pause and speed. Every clip ends at least 0.5s before the next clip's beat starts on the timeline. If you replace a clip with a longer one, extend that beat's timings to keep that margin. All clips are preloaded as blob URLs when the page loads (`voPreload`). `beat()` is async: before a beat with its own clip, `voWait()` holds the script until the previous clip has really finished (+`VO_TAIL`), so a clip that starts late on a slow connection is never cut off. Seek passes skip the wait, so the timeline values stay exact. After editing any clip, bump `VO_REV` so browsers fetch the new file.
- `VO_00` and `VO_01` were trimmed to drop "Watch what the foundation does to the answer." and "That's the whole setup." The originals are in `../../VO_Despina_v4_final_12_lines.zip`.
- Re-recording a line: use the Magnific connector's `audio_tts` with `model: gemini_v2_5_pro`, `voiceId: 703` (Despina), a `systemInstruction` performance note ("calm, confident product narrator for a finance audience: unhurried, warm, precise"), and inline `[pause 0.5s]` tags. Trim the edges with ffmpeg `silenceremove`, convert to 24 kHz mono 16-bit, then get the sentence marks from `silencedetect` and time the beat's `untilV` calls to them. `VO_08_beat8_audit_Despina_v4` was made this way (in git history). `v5` is that take with the left-side lines cut out (1.30s → 22.94s, plus 0.25s of silence), leaving "Now, the audit." + the right-side lines. Direction matters: a per-sentence cue like `[dry]`, `[bright], [confident]`, `[assured]` before each line plus an energetic performance note gave a lively 42s read; a bare script with an "unhurried" note came out flat and 46s.

## Architecture
- `#stage` is a fixed 1920×1080 canvas, and `fit()` scales it to the window. Position everything in stage pixels.
- Two panels: `#L` (Claude alone) and `#R` (Claude + FinanceOS). Each one holds a mock Claude chat UI (`.msgs`, `.composer`), a mock Excel (`.excel`, built by `buildExcel`), and a `.card` overlay.
- Full-stage overlays: `#intro`, `#hood` (under the hood), `#drift`, `#tokens`, `#end`, `#dim`. `#cap` holds the VO captions and `#cur` is the fake cursor.
- `js/main.js`:
  - Engine: a virtual clock (`vnow()`) advances only while playing, scaled by speed. Always change state through `setPaused()` and `setSpeed()` so the clock stays exact. `sleep()` waits on the virtual clock. `beat(n,label)` sets `beatT0`, and `untilV(ms)` waits until `ms` after the current beat starts. **Beat timings are synced to the VO audio.** When you change content, keep the `untilV` marks, or retime them against the matching clip in `audio/`.
  - Helpers: `type`, `send`, `files`, `newAssistant`, `stream`, `table`, `tool`/`toolDone`, `line`, `caption`, `click`, `moveCursorTo`, `xselect`/`xsheet`/`xbtn` (Excel).
  - `run(tok)` is the whole script, beat by beat. `guard(tok)` stops a stale run after a restart.
  - Token counters are estimates: text length/4, file rows × `TOK_PER_ROW`, and tool definitions counted once (1200).
- The data is fictional (the "Vandelay" entities). Left and right numbers differ on purpose (for example DE 52.8% vs 54.3%). Keep the tables, the drift box, the lineage panel and the Excel sheets consistent with each other.

- Control bar (`#ctl`): Datarails-branded (navy card, yellow pills, Poppins, logos). It shows chapter names from `CHAPTERS` (keyed like `VO`), not the internal beat labels. If you add a beat, add it to `CHAPTERS` too. The timeline uses `RUN_MS` for its length and `CH_MS` for the chapter ticks and hover labels. Both are measured by hand. If you retime the run, re-measure them: seek to `10|Close` with `chapter()` wrapped to log `vnow()`. Seek passes run on the exact timeline, so the values come out exact.
- Timeline scrub (`#scrub`, top of the control bar): hover shows the time and chapter, drag-and-release or click seeks, and ←/→ step 5s when it's focused. `seekTo(ms)` restarts the run in seek mode with `seekT` set, and the seek ends just before the first sleep that would pass `ms`. A paused run stays paused. The current beat's clip resumes part-way through (`voResume`) from a cached blob URL, because `python3 -m http.server` has no range requests and Chrome won't seek a plain wav from it.
- Chapter menu (`#chap`, left edge, opens on hover): `jumpTo(key)` restarts the run in seek mode. While `seeking` is set, sleeps are drained in virtual-time order through a MessageChannel, with the narration muted and transitions off behind `#seekov`. The seek ends when `chapter(key)` reaches the target. So:
  - Anything time-based must go through `sleep`/`untilV`/`tween`, never `setTimeout` or `performance.now`, or it won't fast-forward.
  - `run()`'s reset must clear everything the script creates, or leftovers from an earlier run show up after a jump or Restart. Jumps were checked against a normal run: the screen matches at every chapter start.
- Static stretches are filled with visuals timed to the VO phrase: consolidation steps in beat 4, lineage rows in beat 5, estimate marks in beat 6. Beat 8 (Audit Trail) is all about traceability, not permissions, and it covers the right side only: an activity-log card, then a lineage drill-down in a new chat. The left panel sits dimmed. Their `untilV` marks come from pauses in the clips (`ffmpeg ... silencedetect`).
- Testing in a hidden browser pane: Chrome throttles timers in hidden tabs, so the script crawls. That's the test environment, not a bug.

## Brand
- Datarails tokens are on `:root`: navy `#0C142B`, pink `#FA3576`, yellow `#FFA30F`, cream `#FFF9F1`. Claude UI tokens use the `--c-*` prefix.
- For Datarails brand rules, use the `dr-marketing:datarails-design-official` skill. For customer-facing copy, use `positioning-guard`.
- `assets/financeos-badge.png` is the pill-shaped logo used on light UI. `assets/financeos-wordmark.png` is used in the panel label and the end card.
