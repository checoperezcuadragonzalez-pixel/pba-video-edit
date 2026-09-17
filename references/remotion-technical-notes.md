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
confirm the alpha survived compositing.** If it didn't, the overlay reads as a
black rectangle sitting on the camera — unmistakable once you look, invisible
if you only check ffprobe.

### Test-composite every alpha overlay over `base.mp4` — as a gate, before the real composite

Do not wait for the finished video to look at this. Once `base.mp4` exists, one
frame per overlay costs seconds:

```bash
# t = the overlay's start_in_output + an offset into the overlay
ffmpeg -y -v error -ss 60.808 -i base.mp4 -ss 5.0 -i out_v7/ovbio7.mov \
  -filter_complex "[0:v][1:v]overlay=0:0" -frames:v 1 alphatest_bio.png
```

Then **read the PNG and look at it.** Sample two moments per overlay, at
different background brightness — the whole point is the interaction with the
footage, and one frame does not represent it.

On the 2026-09-05 VSL this gate paid for itself immediately. All three alphas
passed every isolated check — `distinct alpha` in the 240s, transparent corner,
correct bounding box — and two of the three were **unreadable over the
footage**. The composite was already running; it had to be killed at 10% and
restarted, and catching it here instead of at the end saved about an hour.

**You cannot hot-swap an overlay while the composite runs.** ffmpeg opens all
inputs at start and reads them progressively, so overwriting a `.mov` mid-render
corrupts the output. Stop the composite, fix, restart.

### `GlassPanel` alone is not enough over lit footage — it needs a dark scrim

This is what those two overlays got wrong, and it is a trap built into the brand
kit. `GlassPanel`'s fill is `rgba(255,255,255,0.06)` — it **adds light**. On the
black stage of an opaque cutaway that reads as a soft-tinted card, which is the
intended look. Over live camera footage of a lit room it adds nothing but haze,
and small text on top of it has no contrast to sit against.

The failure is graduated, which is why it survives a sub-agent's self-check: the
big line reads fine and the agent honestly reports "the card is legible". On the
identity lower-third, `Checo` at 44px was crisp while `+$2,000 por cliente` and
`+70 personas en la academia` were invisible. On the CTA card the wordmark was
crisp and `+ el documento gratis: los 5 cuellos de botella` was gone.

Fix: put a **dark backing under the sheen**, inside the panel only, so it still
reads as brand glass rather than a flat black box:

```jsx
background: `${GLASS.sheen}, rgba(5,5,5,0.62)`   // en vez de GLASS.fill
```

`0.50` was still marginal against lamp-lit cymbals; **`0.62` is the number that
worked**, on both cards, and it does not kill the glass character — the drum kit
is still visible through it. Bump the small lines from `COLOR.textBody` to
`COLOR.white` and one weight step while you are there.

Also swap `GLASS.shadow` (60px blur) for `GLASS.shadowSm` (30px) on any card
with a tight safe area: the wide halo counts against the box and has twice now
bled onto the presenter's face.

Tell the sub-agent this up front for any alpha overlay. The brief should say
"over live footage, `GlassPanel`'s default fill will not carry small text — put
a `rgba(5,5,5,0.6)` scrim under the sheen", or you will be fixing it afterwards.

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

### The ghost-opacity variant: "visible" depends on what the element is

Cards that build a list use a "ghost" pattern — every item present from frame 0
at low opacity, each *landing* to full on its own beat. That's the right shape,
because the hard cut can then never hit an empty frame. But the floor opacity
has to be chosen per element type, and the brief's usual phrasing ("present at
~0.22") does not port between them:

- **Real text** at 0.22 reads fine. Two cards — four labels, and three numbered
  sentences — both passed at that floor.
- **Abstract shapes** at the same number do not. A card representing eight
  rewritten drafts used thin 9px gray bars already coloured
  `rgba(255,255,255,0.42)`; times a 0.24 ghost floor that is an **effective
  alpha of 0.10**, and the finished frame read as black in the boundary sheet.
  `0.42 × 0.72 = 0.30` fixed it.

So specify the **effective** alpha (floor × the element's own colour alpha),
not just the floor, and aim for ~0.30 when the placeholder carries no readable
text. The sub-agent will report "the block is visible as a shape at 0.35s" and
be telling the truth either way — only the boundary contact sheet on the
finished render settles it. This was the one defect that survived to the final
render on this video, which is a good reminder that the sheet earns its place.

### The third variant: when the element that ENTERS is deliberately dim

Both cases above are about a placeholder being too faint. There is a nastier
one where every element is exactly as bright as intended and the entrance still
dips — because the *design* puts the muted element first.

A two-sided contrast card (`SOBRAN` in muted gray / `FALTAN` in white plus
amarillo) enters with the left column only; the right is ghosted until its beat
at 2.8s. That is correct anchoring and correct hierarchy. But it means that for
the first three seconds the brightest pixel in the frame is muted gray —
measured at **76/255** — and the hard cut from lit camera reads as a dip.

Neither the ghost-floor rule nor "the headline must be opaque by 0.35s" catches
it: the headline *was* opaque, it was just dark. The sub-agent reported "the
left line is clearly readable" and was right. **Only the boundary contact sheet
settles it** — at thumbnail size the cell reads black, which is exactly the
viewer's impression at 1×.

Fix without abandoning the hierarchy: enter at body brightness and **recede**
when the other side lands.

```jsx
color: COLOR.textBody,                        // en vez de textMuted
opacity: lineL * (0.92 - 0.30 * land),        // entra a 0.92, baja a 0.62
```

Peak went 76 → 132 at 0.45s and the final frame is unchanged. It also tells the
story better: the two sides start equal and then one wins, instead of one
arriving pre-defeated.

So when briefing a contrast card, say it explicitly: **whatever is on screen
during the first second has to carry the frame, even if it is the side you
intend to devalue.** Devalue it on the landing beat, not on the entrance.

Also universal: hold the final composed frame completely still for the last
~1s, and **do not fade to black at the end** — the hard cut back to camera
does that work, and a fade just reads as a dip.

## Grain: `mixBlendMode: "overlay"` is invisible on a near-black stage

A film-grain layer (SVG `feTurbulence`, desaturated, low opacity) shipped for
several sessions with **zero visible effect**, and it went unnoticed because
nobody looked at a full-resolution still — Remotion Studio's embedded preview
canvas is scaled down enough to hide texture this subtle, and the code
*looked* correct.

The cause is the blend math. `overlay` darkens on a base below 0.5 luma and
lightens above it, scaled by *how far* the base already is from mid-gray.
On the stage's `#050505`/`#0A0A0A` black, the base is close enough to 0 that
`overlay` converges to black regardless of what the noise layer contains —
the grain is mathematically present and visually absent at the same time.

Fix: use **`mixBlendMode: "screen"`** instead. Screen's formula on a black
base reduces to `result = blend`, so the noise shows at exactly its own
opacity — no darkening term to cancel it out.

```jsx
<AbsoluteFill style={{ opacity, mixBlendMode: "screen", pointerEvents: "none" }}>
```

`overlay` is still the right choice over a *lit* background (live camera
footage, a bright photo) where it's meant to modulate existing contrast
rather than add texture to near-black. The trap is specifically: **grain
sitting on top of a brand-black stage needs `screen`, not `overlay`.**

**Verify with a real rendered still, not the Studio panel.** `npx remotion
still entry.tsx CompId out.png --frame=N` and reading the PNG at native
resolution is what actually caught both the bug and the fix — the Studio
canvas at its default panel size was too small to show the difference either
way, even when scrubbed to a frame that should have made it obvious.

## Continuous hold motion: a slow sine wave beats a linear drift

The scene wrapper that keeps a held card from reading as a frozen still
originally used a one-directional drift: `scale = 1 + 0.03 * (frame /
durationInFrames)`. That reads as smooth for a 5s card, but it has two real
problems — it always moves the same way (in, never out, so a family of
cards all "zoom forward" identically instead of feeling alive independently),
and on anything longer than a few seconds it visibly walks the frame off its
starting composition.

Replaced with a continuous sine oscillation on both scale and vertical
position, phase-offset a quarter cycle apart so the sway peaks as the
breathing crosses its resting scale:

```jsx
const WAVE_PERIOD_SEC = 4.2;
const wavePhase = ((frame / fps) / WAVE_PERIOD_SEC) * Math.PI * 2;
const waveScale = 1 + 0.015 * Math.sin(wavePhase);
const waveY = 8 * Math.sin(wavePhase + Math.PI / 2);
```

`0.015` (±1.5%) and `8px` are subtle enough not to fight the punch-in-and-
settle open (still a separate, one-shot tween at the start of the card); the
wave only takes over once the open eases out. A period of 3.5–5s reads as
"breathing," not as an oscillation the eye can clock — much shorter and it
starts to look like judder, much longer and it's indistinguishable from the
old linear drift over a 5s card.

Confirm it with two or three stills spaced across the hold (not the start and
end alone — those can land near the same phase by coincidence) and check the
whole composition — title, number, image block — has visibly shifted between
them.

## Structuring a shared Remotion project for parallel builds

When several cutaways are being built at once, don't scaffold an isolated
Remotion project per animation — `npm install` plus the Chrome Headless Shell
download is ~600MB and a minute-plus each time, and it duplicates the vendored
brand kit N times for no benefit.

Instead: one shared project with the brand kit vendored once. This project is
`remotion/` (sibling to this skill), and the brand kit is
`remotion/src/architect/` (`theme.ts`, `atmosphere.tsx`) — the same tokens
the channel's Intro/LowerThird/SubscribeInsert pack uses, imported directly
rather than re-ported. The cutaway templates themselves live in
`remotion/src/cutaways/` (`Statement.tsx`, `Stat.tsx`, `ListCard.tsx`,
`Comparison.tsx`, `Diagram.tsx`, plus shared primitives) — see
`cutaway-visual-recipe.md` for what each one does. That module is generic
across videos; a specific video's *content* lives separately:

- `remotion/src/slots/<video-id>/content.json` — the cutaway specs for this
  video (schema unchanged from the pre-Remotion engine).
- `remotion/src/slots/<video-id>/cutaways.entry.tsx` — a self-contained
  Remotion entry point (its own `registerRoot`, one `<Composition>` per
  `content.json` entry) used only for this video:
  `npx remotion render src/slots/<video-id>/cutaways.entry.tsx <id> out/<id>.mp4`
  or `npx remotion studio src/slots/<video-id>/cutaways.entry.tsx` to preview.
  `remotion/src/slots/demo/` is the reference to copy — the real 18 cutaways
  from a shipped VSL, plus one synthetic `diagram` entry.

The entry file is what makes this safe for parallel work: nobody touches the
shared `Root.tsx`/`index.ts`, so parallel writers can't race.

**Version the slot and output directories per video** (`src/slots/<video-id>/`,
`out_<video-id>/`). Earlier videos' EDLs still reference their own renders,
and overwriting `out/` breaks the ability to re-render an older video.

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

### Two families, when the video has a structural split

A listicle of ten that divides into "six you buy" and "four you can't" wants
the split to be *visible*, not just spoken. Build it as two families rather
than one: reference A, then reference B derived from A with **exactly one**
deliberate difference, then copy each family from its own reference.

One difference is the whole trick. On the video that did this, family B's
kicker gained a small amarillo dot with a glow and nothing else changed —
same sizes, same rhythm, same landing frames. The viewer feels the block
change without being able to name it. Give the B agent A's path and tell it to
read A first, pick one marker, and hold everything else identical; listing two
or three candidate markers and saying "choose one, not both" works better than
prescribing the marker yourself.

Order matters: A must exist before B starts, and both must exist before their
copies. That's three waves, not two.

## Open Studio in the browser while building — don't only hand back stills

The pipeline above (render → contact sheet → look at the PNG) is right for
**verification gates**, but it is not a substitute for letting the user
actually see the animation while it's being built. A session shipped several
slots using only headless `npx remotion render` + stills, and the user called
this out: when he asks for a motion graphic and gets shown a live, scrubbable
Remotion Studio in the browser, he can react to it immediately (timing, color,
a word that reads wrong); when he only gets rendered files, he can't, and it
reads as "generic" even when the brand tokens are correct.

So: after scaffolding a slot's `.tsx`/`.entry.tsx` pair, open Remotion Studio
against that **entry file directly** — not the shared `Root.tsx` — so it stays
parallel-safe:

```bash
npx remotion studio src/slots/vN/<Name>.entry.tsx
```

Register it as a preview server (same pattern as any other local dev server in
this project) and open it in the browser for the user to scrub, rather than
only sending a rendered `.mp4`/`.mov`. Do this **every time** a new cutaway or
overlay is scaffolded or meaningfully revised — it's part of the build step,
not an optional extra to offer.

This is additive, not a replacement: the contact-sheet and alpha-over-footage
gates later in the pipeline still run before the final composite. Studio shows
the animation in isolation on its own transparent/black canvas; it cannot
catch "unreadable over this specific footage" or alpha-survival-through-
compositing defects, which is why those gates exist separately.

## Sub-agent brief checklist

Each brief must be self-contained. Include, every time:

1. Absolute project path, and "deps installed, do NOT npm install".
2. Exactly which two files to create, and "touch nothing else — parallel
   agents share this project".
3. The entry-file shape, inline.
4. Resolution, **fps (matched to the source, and don't copy it from a
   sibling or from `tokens.ts`)**, exact `durationInFrames`. The vendored
   `tokens.ts` still exports a stale `FPS` constant from an older video —
   every slot must declare its own.
5. Opaque-vs-transparent, and the exact render command including
   `--image-format=png` for alpha. For a transparent overlay, add the scrim
   rule — `GlassPanel`'s default fill will not carry small text over lit
   footage, put `rgba(5,5,5,0.6)` under the sheen — and `GLASS.shadowSm`
   rather than `GLASS.shadow` when the safe area is tight.
6. Import depth (`../` vs `../../`).
7. Brand rules, including both Perezcuadra traps (accented uppercase renders
   broken; the slashed zero reads as a Q **in any position** — so mono kickers
   carry no digits at all, spell numbers out).
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
