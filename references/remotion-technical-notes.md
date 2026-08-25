# Remotion + video-use — technical notes

Everything here was learned the hard way building motion graphics for real PBA
videos. Read this before scaffolding Remotion work, not after hitting the same
wall.

## Cutaways are opaque overlays, NOT spliced ranges

This is the most important thing in this file. An earlier version of these
notes described splicing each cutaway into the EDL's `ranges` and muxing the
narration audio onto the silent Remotion render. **Don't do that.** It works,
but it is strictly worse than the alternative for short cutaways.

`render.py`'s `build_final_composite` ends with:

```
"-map", "[outv]", "-map", "0:a",
... "-c:a", "copy",
```

It maps audio from input 0 (the base) and stream-copies it. **The overlay path
never touches audio.** Therefore a *fully opaque, full-frame* overlay IS a
full-replacement cutaway: it hides the camera completely while the narration
underneath keeps playing, untouched.

What that buys you, versus splicing:

- **No per-window audio muxing**, so no chance of drift or desync.
- **No timestamp recalculation** — `ranges` stays byte-identical to the cut
  EDL, so the cut can be re-verified independently of the graphics.
- **No ProRes for cutaways.** They're opaque, so plain h264 is fine: ~0.5 MB
  per clip instead of hundreds of MB.

So the EDL for a PBA video looks like: `ranges` = the cut, untouched;
`overlays` = every graphic. Put the **alpha overlays first in the array and
the opaque cutaways last**, because `render.py` chains overlays in array order
and you want a cutaway to win wherever the two overlap.

Transparent overlays (lower-thirds, hook text) use the same `overlays` array —
they just have real alpha and don't cover the frame.

## Frame-rounding drift — correct it, every time

`render.py` re-encodes each segment during extraction and each one lands on a
frame boundary, so every segment is a few ms longer than its nominal EDL
duration. That accumulates:

| segments | measured drift |
|---|---|
| 11 | +0.157s |
| 18 | +0.145s |
| 81 | +0.484s |

Overlay `start_in_output` is evaluated against the **real** base PTS, so a
cutaway placed at a nominal timestamp lands late — by up to half a second at
the end of a long video, which is very visible when a graphic is supposed to
hit a spoken word.

The fix is mechanical: after extraction, `ffprobe` every segment in
`clips_graded/`, build a cumulative (nominal_offset, real_offset) table, and
map each overlay time through it by locating the segment and interpolating
within it. Then write the EDL.

**The hard rule that follows:** any change to `grade` (or anything else that
alters extraction) means **re-extract → rebuild the EDL → then compose.**
Skipping the rebuild is what put cutaways 0.27s late on one video; catching it
required comparing the EDL's stored `start_in_output` values against freshly
computed ones. That comparison is worth running as a sanity check before every
final composite — it should come out at ~0.000s.

## Alpha channel: ProRes 4444, not VP8/WebM

Any overlay that needs transparency needs a real alpha channel. **VP8/WebM
alpha does not survive on this machine** — the container reports
`alpha_mode=1` and the encode log claims `yuva420p`, but decoding a frame back
out shows uniform alpha=255 everywhere. This is not visible from `ffprobe`'s
`pix_fmt` alone; you have to decode a frame and check the alpha bytes:

```bash
ffmpeg -y -ss 2 -i overlay.mov -vframes 1 -f rawvideo -pix_fmt rgba frame.raw
python -c "
d = open('frame.raw','rb').read()
print('distinct alpha:', len(set(d[3::4])))   # 1 = broken, many = real
print('corner rgba:', tuple(d[:4]))           # must be (0,0,0,0)
"
```

Use **ProRes 4444**:

```bash
npx remotion render entry.tsx CompId out.mov \
  --codec=prores --prores-profile=4444 --pixel-format=yuva444p10le \
  --image-format=png
```

`--image-format=png` matters independently of the codec: if the project's
`remotion.config.ts` sets `Config.setVideoImageFormat("jpeg")` (a reasonable
default for opaque renders), JPEG frame capture never produces a transparent
background — Chrome's `omitBackground` only activates for PNG/WebP. CLI flags
override the config file, so pass it on every alpha render regardless.

Verifying the `.mov` in isolation is necessary but not sufficient. **Also
confirm the alpha survived compositing**, by looking at the finished video (or
a cheap test composite over a few seconds of footage). If it didn't, the
overlay reads as a black rectangle sitting on the camera — unmistakable once
you look, invisible if you only check ffprobe.

## Entrances must be fast, and "fast" means the headline

A cutaway hard-cuts in from lit camera footage. If the frame is still near
black 0.35s later, the cut reads as a flash or a stutter — and on a 5s card
you've also wasted a fifth of the runtime.

The subtle version of this failure: sub-agents were told "content visible by
0.35s", built a card whose 15px mono kicker appeared at frame 8, and honestly
reported "kicker visible at 0.35s". It was true, and the frame still read as
black, because a 15px kicker cannot carry a 1920x1080 frame.

**The criterion is: the main element — the headline — must be substantially
opaque by ~0.35s.** Concretely, on the rule/block cards that means kicker
0→12, hairline 8→28, headline 5→40 at 60fps, with the kicker at ~26px. Say
this explicitly in every sub-agent brief, and make the agent verify it by
extracting a real still and *looking at it*, not by trusting ffprobe.

Also universal: hold the final composed frame completely still for the last
~1s, and **do not fade to black at the end** — the hard cut back to camera
does that work, and a fade just reads as a dip.

## Structuring a shared Remotion project for parallel builds

When several cutaways are being built at once, don't scaffold an isolated
Remotion project per animation — `npm install` plus the Chrome Headless Shell
download is ~600MB and a minute-plus each time, and it duplicates the vendored
brand kit N times for no benefit.

Instead: one shared project with the brand kit vendored once (`tokens.ts`
ported from `brand-pba-code`'s CSS custom properties, the two brand fonts in
`public/fonts/`, and `GlassPanel`/`KickerLabel`/`GoldText` primitives). Each
animation gets its own pair of files:

- `<Name>.tsx` — the component, the real deliverable.
- `<Name>.entry.tsx` — a self-contained Remotion entry point (its own
  `registerRoot` + `<Composition>`) used only to render that one composition:
  `npx remotion render src/slots/<Name>.entry.tsx <CompId> out/<name>.mp4`

The entry file is what makes this safe for parallel work: nobody touches the
shared `Root.tsx`/`index.ts`, so parallel writers can't race.

**Version the slot and output directories per video** (`src/slots/v3/`,
`out_v3/`). Earlier videos' EDLs still reference their own renders, and
overwriting `out/` breaks the ability to re-render an older video. Note that
nesting a slot folder one level deeper changes the import depth — `../brand/`
becomes `../../brand/`. Tell the sub-agent which one to use; it's a common
first-try failure.

## Families of cards: one reference, then verbatim copies

Videos have recurring devices — three rule cards, three block cards, three
test-question cards. The viewer must read them as the same object returning.

What works: have **one** agent build the reference implementation with every
layout value as a **plain literal** (no computed constants), then have another
agent copy it verbatim, changing only the number and the sentence. State
explicitly that matching is the whole job and that "improving" spacing or
timing is a failure. Agents follow this well and report the diff honestly.

What doesn't work: briefing three agents independently from the same
description. They diverge in font size and rhythm in ways that are obvious
once the cards appear minutes apart.

## Sub-agent brief checklist

Each brief must be self-contained. Include, every time:

1. Absolute project path, and "deps installed, do NOT npm install".
2. Exactly which two files to create, and "touch nothing else — parallel
   agents share this project".
3. The entry-file shape, inline.
4. Resolution, **fps (matched to the source, and don't copy it from a
   sibling)**, exact `durationInFrames`.
5. Opaque-vs-transparent, and the exact render command including
   `--image-format=png` for alpha.
6. Import depth (`../` vs `../../`).
7. Brand rules, including both Perezcuadra traps (accented uppercase, slashed
   zero — no leading zeros in kickers).
8. The fast-entrance criterion, phrased as "the headline, not the kicker".
9. Narration text that plays underneath, with timings, so reveals can be
   synced.
10. An anti-list ("no chrome, no logos, no watermark, no captions, no emoji…").
11. Verification: ffprobe **and** extract stills at 0.35s and near the end and
    *actually look at them*.
12. "Do not ask questions. If anything is ambiguous, pick the most obvious
    interpretation and proceed."

Remotion muxes a silent AAC track into every h264 render. It's harmless — the
overlay path only maps `[N:v]` — so there's no need to strip it.
