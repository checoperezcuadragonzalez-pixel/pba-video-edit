---
name: pba-video-edit
description: Edit talking-head videos for Project Boy Academy (PBA / Checo) — cut raw footage, add camera overlays, and drop short Remotion motion-graphics cutaways at key moments, always in PBA's Liquid Glass v4 branding. Builds on the generic `video-use` skill for the actual transcribe/cut/render mechanics; this skill supplies PBA's opinions and defaults on top. Trigger this whenever the user wants to edit or produce a video for PBA, add overlays/lower-thirds/motion graphics to their own talking-head footage, hands over a raw OBS/Premiere recording to be edited, mentions "mi branding", "el estilo que ya quedamos", or a "flujo de edición" for their content — even if they don't name the skill directly or don't mention Remotion/brand-pba-code explicitly.
---

# PBA Video Edit

This is a thin, opinionated layer on top of the `video-use` skill. It does not
repeat what `video-use` already covers well — go read that skill for the
actual mechanics (transcription, EDL format, cut craft, render pipeline, the
ask→confirm→execute loop, all twelve Hard Rules). What this skill adds is
*PBA's specific taste* — which brand, which animation engine, how often the
motion-graphics cutaways should appear — plus the pile of Windows-and-Remotion
specifics that several finished videos have shaken out.

Use this skill together with `video-use`, not instead of it. Read `video-use`
first for any session that involves cutting footage; this file only covers
what's different for a PBA video.

Two reference files carry the details. Read them at the moment they apply, not
all upfront:

- [references/cutting-and-render-notes.md](references/cutting-and-render-notes.md)
  — building the cut from raw footage, and every gotcha in the
  transcribe → EDL → extract → composite → loudnorm pipeline. Read before
  writing an EDL.
- [references/remotion-technical-notes.md](references/remotion-technical-notes.md)
  — how the animations get built and wired into the EDL. Read before
  scaffolding any Remotion work.

## Keeping this skill current — do this without being asked

This skill is a living record of corrections. **Every time the user corrects
something, fold it in here and push it.** That is part of the job, not a
follow-up task to offer.

A correction is anything that changes how the next video should be made:

- a **taste call** ("los cutaways deben ser cortos", "quita los subtítulos",
  "quita los zooms") → update the relevant section and say what was rejected,
  so a future session doesn't reintroduce it;
- a **technical gotcha** you hit and solved (a font that renders wrong, a
  helper that breaks on Windows, a timing that drifts) → add it to the right
  reference file with the symptom, the cause, and the fix;
- an **approach that failed** → write down *why*, not just that it failed.
  "5% zoom reads as janky because zoompan's integer rounding exceeds the
  motion" is useful; "user didn't like the zoom" is not.

Write it the way the rest of this file is written: what happened, why it
matters, what to do instead. Prefer concrete numbers and real examples over
general advice — the specifics are what make it usable a month later.

Then commit and push:

```bash
cd <this skill directory>
git add -A
git commit -m "<qué se aprendió, en una línea>"
git push
```

The repo is public, so **never commit** API keys, absolute paths containing
personal directories, client names, or anything from the user's private life
that showed up in raw footage. Describe the *class* of problem instead of the
identifying detail.

If `git push` fails because the remote or auth isn't set up, say so plainly and
give the user the exact commands — don't silently skip the push and don't
leave the correction uncommitted.

## The process

Follow `video-use`'s process. The one thing worth restating because it's easy
to rush past when you already know "the PBA style": **strategy confirmation is
still required every time.** Knowing the house style doesn't mean skipping the
plain-English proposal — it means the proposal can lean on these defaults
instead of inventing them, and reference this file.

Transcribe first, always, and reuse the cached transcript if the source hasn't
changed (`video-use` Hard Rule 9).

Footage has arrived in two shapes, and they need different first steps:

- **Already cut** (a `final_*.mp4` from a previous session or from Premiere).
  Rebuild the output-timeline transcript from the existing EDL + cached
  transcript, then go straight to placing cutaways.
- **Raw** (an OBS capture). You have to make the cut first. That is a real
  editorial pass, not a formality — raw files have contained four takes of the
  same hook, duplicated sentences, dead silences of 5–11s, and in one case
  **65 seconds of off-camera conversation** recorded with the mic still open.
  See the cutting reference for the DROPS-based method and the word-boundary
  traps.

Whichever shape it arrives in, **read the transcript of the cut before
building anything on top of it.** Residue at drop boundaries is invisible in
the raw transcript and obvious in the cut one. This check has caught a real
defect on every video so far.

## Brand

Every color, font, glass panel, and icon comes from the `brand-pba-code` skill
(PBA Liquid Glass v4) — invoke it to pull the actual token values rather than
guessing, since the design system does evolve. The translation to video:

- Black is the stage (`#050505` / `#0A0A0A`), always. Amarillo evidencia
  (`#FACC15`) is the one accent. Liquid gold (the gradient) is reserved for
  hero numbers and remates, never general UI.
- Inter for everything text, sentence case — headlines are never ALL CAPS in
  v4. Perezcuadra mono only for kickers and technical labels.
- Glass panels (blur + hairline + top highlight) for lower-thirds and any
  card-like overlay. Emoji as iconography, never an SVG icon library.
- Voice for on-screen copy: español mexicano, tú directo, frases cortas que
  pegan como golpe.

**Two Perezcuadra font traps**, both found the hard way and both worth
memorizing:

1. It renders **accented uppercase** (Ñ, Ó, Á) as a detached accent floating
   next to a broken glyph. A mono kicker reading `AÑOS EN LA ESCUELA` shipped
   as `AкOS EN LA ESCUELA`.
2. Its **zero is slashed**, and at kicker size the slash reads as a **Q** —
   in *any* position, not just leading. `PREGUNTA 01` looks like
   `PREGUNTA Q1`; `90 DIAS` looks like `9Q DIAS`. Confirmed by zooming into
   the rendered frame, not a thumbnail artifact.

So: mono kickers are **unaccented ASCII with no digits at all**. Write
`PREGUNTA 1`, `BLOQUE 2`, `NOVENTA DIAS`, `DIA TREINTA` — spell numbers out or
drop them. Digits are fine in Inter, so `$250`, `$37 al mes` and `Día 1 – 30`
belong in body copy, never in a mono kicker. All accented Spanish goes in Inter
sentence case, which renders it correctly.

A first pass at this rule said "no leading zero", which was too narrow and let
`90 DIAS` through. Tell sub-agents the strict version.

If a specific video has a reason to deviate from the brand (a sponsor's
palette, a one-off collab), that's a conversation for the propose-strategy
step — don't silently default away from it.

## Animation engine: Remotion

Build every motion graphic and animated overlay in Remotion — not HyperFrames,
not PIL/PNG sequences, even though `video-use` lists those as valid in
general. For PBA specifically, Remotion wins because the brand's components
are React and compose directly into Remotion instead of needing to be
re-implemented.

**Match the source's fps.** This is not cosmetic and it is easy to get wrong:
the videos so far have been 60, 60, 24, 60. When you tell a sub-agent to read a
sibling slot for house style, tell it explicitly *not* to copy the fps from
that sibling — it may belong to a different video.

Everything else about wiring Remotion into the pipeline is in the technical
notes.

## The cutaway pattern — the important part

When a talking-head video needs a moment to go from "camera + overlay" to
"pure motion graphics, no camera at all," default to a **short cutaway**:
roughly **5 seconds**, then straight back to camera. Do this at *every* moment
worth visualizing — every important point, technical explanation, or quotable
line, however many times that happens across the whole video — not just at two
or three pre-selected "technical sections."

This is a correction from a real session, not a guess. The first pass on a
video built three long motion-graphics blocks (62s, 118s, 70s) covering the
three most technical sections, on the theory that "technical content = full
animation replacement." The user's reaction, paraphrased: that's backwards.
Losing the presenter's face for over a minute at a time breaks the
talking-head feel, no matter how good the graphics look. What works is the
presenter staying visible almost the whole time, with short animated
punctuation dropping in and out — closer to how a well-edited YouTube video
uses b-roll than to a slide deck with a narrator.

So: many short cutaways beat few long ones, even if the "few long ones" target
the objectively most technical parts.

**Calibration from three shipped videos:** 18 cutaways each, landing at
9–13.5% of total runtime, which works out to roughly **one per minute**. The
per-minute cadence is the number that matters; the percentage follows from it.
One cutaway per video may run ~8s if it's a genuine recap or table that can't
be chunked — flag that as a deviation during propose-strategy.

If a strategy conversation surfaces a real reason for a longer block (the user
explicitly asks, or a segment genuinely can't be chunked — a full worked
example, say), that's fine to build, but it's a deviation to confirm, not the
default.

**Do not splice cutaways into the EDL's `ranges`.** They go in `overlays` as
opaque full-frame clips. This is the single most important structural decision
in this skill, and the technical notes explain why in detail.

### Anchor each window to the payoff word, not the start of the phrase

The most common way to get this wrong — and it looks like a sync bug even when
the timing math is perfect. Pick the window by asking **"when does he SAY the
thing this graphic DRAWS?"**, then place the window so the graphic's payoff
lands on those words.

On one video, ten of eighteen cutaways were anchored to the start of the
relevant sentence. Every timestamp was correct to within 0.04s and the drift
was properly corrected — and the user still reported the animations as
*desfasadas*, because the graphics were consistently running **3–10 seconds
ahead of the narration**. A card listing a five-step sequence played while he
was still setting it up; he named the five steps after the cutaway had already
returned to camera. A remate reading "tres meses más viejo" appeared on screen
before he said "viejo".

The check that catches it, run against the cut's output timeline before
building the EDL: for each window, print the words spoken **inside** it and the
words in the **7 seconds after**. If the graphic's own copy shows up in the
"after" column, the window is too early — move it later.

`video-use` states this as the "animation payoff timing" rule (start the reveal
`reveal_duration` earlier so the landing frame coincides with the payoff word).
It is easy to skip when you are placing eighteen windows at once. Don't.

## Camera overlays

For stretches that stay on camera, text/icon/lower-third overlays follow the
same glass-and-amarillo treatment. Density is not uniform:

- **The hook (first ~20s):** dense — kinetic text synced to nearly every
  phrase. This is where retention is won or lost.
- **Everywhere else:** light — reserve on-screen text for genuine punchlines
  and remates, not a running caption of everything said. If in doubt, cut a
  planned overlay rather than add one; "Apple calm, PBA punch" means restraint
  reads as more premium, not less produced.

Three alpha overlays per video has been the settled shape: a kinetic hook, an
identity lower-third near the start, and a CTA card at the end carrying the
single gold remate.

**Always look at a real frame of the footage before placing overlays.** Every
video has had a different hazard: a bright lamp, a mic boom, a silver laptop
that swallows white text, a red Coca-Cola machine that fights the
single-accent rule, a blown-out softbox. Grab a frame, identify the face box
and the hazards, and hand the sub-agent explicit safe-area coordinates.

**Grab that frame only after extraction finishes.** `base.mp4` is overwritten
per video, so sampling it while the new extraction is still running hands you
the *previous* video's frame — and you'll brief the overlay agent with hazards
that don't exist and miss the ones that do. It happened once and only went
unnoticed because both setups happened to have a dark left side. Check
`ffprobe`'s duration on `base.mp4` against the cut's expected length before
trusting any frame you pull from it.

## Subtitles

**Default: none.** The user tried burned-in subtitles and removed them. Ship
the `.srt` alongside the video instead — it uploads to YouTube as a selectable
track and costs nothing to generate.

If they're ever wanted again: the house `bold-overlay` style (2-word chunks,
uppercase) fights motion graphics that carry their own text, and `render.py`
cannot burn subtitles on Windows at all without a workaround. Both problems,
and the libass sizing surprise behind them, are in the cutting-and-render
notes.

## Grade and zoom

**Grade: `none`.** Every video has shipped ungraded and the user has never
asked for one.

**Zoom: none.** A per-cut ease-out push-in was built and tested at 5% and at
130%, and the user rejected it. Do not add it back on your own initiative. If
it comes up again, the working expression and the two hard-won facts about it
(why 5% reads as *janky* rather than subtle, and why changing it forces a full
re-extraction) are in the cutting-and-render notes.

## Before you show the user anything

Run the self-eval on the **rendered output**, not on the source clips. Three
contact sheets have proven to be the right coverage — a helper that builds
them is worth writing once per project:

1. **Every cutaway at its midpoint**, tiled in order. Confirms each one landed
   on the timeline, in the right place, in the right order.
2. **Each alpha overlay over camera.** The critical check: if ProRes alpha
   didn't survive compositing, these read as black rectangles instead of text
   floating on footage.
3. **Boundaries** — camera before / cutaway at +0.45s / camera after, for a
   sample of windows. This catches both bad sync and slow entrances.

That third sheet is the one that keeps finding real defects. Budget for at
least one fix-and-re-render cycle; the composite step is cheap to repeat
because the expensive extraction is already cached.
