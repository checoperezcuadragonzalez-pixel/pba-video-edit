# Cutaway engine — HTML + GSAP + Playwright

A working, tested implementation of the motion vocabulary described in
[../../references/cutaway-visual-recipe.md](../../references/cutaway-visual-recipe.md).
Five card types (`statement`, `stat`, `list`, `comparison`, `diagram`), one
content schema, one command to render, one command to composite onto a
master video. No React, no Remotion project, no build step — this is the
version meant to be handed to a non-technical editor or a lightweight tool.

## Setup (once)

```bash
npm init -y
npm install gsap playwright
npx playwright install chromium
```

## Content schema

One JSON array, one object per cutaway. `start`/`end` are seconds **in the
master video's own timeline** — duration is always `end - start`, cards are
never a fixed length. See `content.example.json` for a full real example
(18 cutaways from a shipped VSL) covering every field every type uses.

```json
{ "id": "descargo", "type": "statement", "start": 59.8, "end": 65.5,
  "kicker": "DESCARGO", "icon": "⚠️",
  "headline": "No te garantizo dinero." }
```

Field reference per `type` is in `build.mjs` — each `tpl*` function's opening
comment lists what it reads off the object.

## Render

```bash
node render_all.mjs content.json
```

Builds `cards/<id>.html` for every entry, renders each to a PNG sequence at
60fps via Playwright (`renderer.mjs` — seeks a paused GSAP timeline frame by
frame, so output is frame-accurate regardless of render speed), then encodes
`out/<id>.mp4` (opaque h264, exact frame count = `duration × fps`).

Pass a third argument to render a single card while iterating:
`node render_all.mjs content.json descargo`.

**Match the fps to your source video.** `FPS` is hardcoded near the top of
`render_all.mjs` — change it before rendering if your master isn't 60fps.

## Composite

```bash
node composite.mjs content.json MASTER.mp4 OUTPUT.mp4 --run
```

Drops every rendered clip onto `MASTER.mp4` at its exact `start`/`end` as an
**opaque overlay** — the original audio track passes through untouched
(`-map 0:a -c:a copy`), so narration never needs to be re-synced or re-cut.
Uses `-itsoffset <start>` per overlay input so ffmpeg's frame-matching lines
up the clip's own t=0 with its intended position on the master timeline, and
`enable='between(t,start,end)'` to gate it to just that window.

Omit `--run` to only write `filter_complex.txt` / `composite_args.json` and
inspect the command before spending the time on a full re-encode.

## Checking your work before the full composite

Don't wait for the finished video. Pull a frame near the end of each
rendered clip (~88% in) and look at it — this is the cheapest gate in the
whole pipeline and it's what the main skill's "inspect every graphic before
you composite" section is about:

```bash
ffmpeg -y -sseof -1 -i out/descargo.mp4 -update 1 check.png
```

If you have several clips, tile them into one contact sheet instead of
opening each individually — much faster to scan:

```bash
ffmpeg -y -i "check_%02d.png" -filter_complex "scale=480:270,tile=4x3" -frames:v 1 sheet.png
```
