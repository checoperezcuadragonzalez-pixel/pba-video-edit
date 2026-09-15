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

**Check whether the video is pure talking head before planning any of this.**
One video turned out to be a hybrid: 11 minutes to camera, then **4¼ minutes
of screen-share demo** (installing the tool, pasting a prompt, showing the
result) with a webcam PIP in the corner, then back to camera. Nothing in the
transcript announces the switch — you find it by sampling frames across the
runtime, which is worth doing on every raw file for exactly this reason.

It changes the plan in three ways:

1. **The demo section gets no cutaways.** The screen already *is* the visual
   support; a graphic on top hides the thing the viewer needs to see. Cut only
   dead time there — and expect plenty, since that is where the presenter hunts
   for a folder or waits for the tool to respond.
2. **The cutaway budget is computed over the camera runtime, not the total.**
   Otherwise the one-per-minute cadence silently doubles in the talking-head
   half.
3. **Watch for stretches that are visually flat but content-dense.** In that
   same video the presenter read three six-step prompts aloud *to camera* with
   nothing on screen — two and a half minutes of spoken lists. That is the
   strongest argument for graphics in the whole video, and it's invisible
   unless you cross-check the transcript against the framing.

That last case is a legitimate reason to exceed the usual density. Nine prompt
cards plus three service headers ran that section at roughly one card per
12 seconds, pushing overall cutaway coverage to **14.4%**, above the 9–13.5%
band from the pure talking-head videos. That's fine when the extra density is
confined to a reference section the viewer wants to pause on — but surface it
during propose-strategy instead of discovering it at the end.

Whichever shape it arrives in, **read the transcript of the cut before
building anything on top of it.** Residue at drop boundaries is invisible in
the raw transcript and obvious in the cut one. This check has caught a real
defect on every video so far.

### The presenter may direct the edit from inside the take

Before writing a single drop, scan the transcript for the presenter talking
**to you** rather than to the viewer. On one VSL he did it twice, by name:

> *"Eso quítalo, CloudCode, eso quítalo, lo de: «y por qué esto no es otra
> cosa», lo de que la puerta va a seguir abierta, quítalo."*

> *"Eso también quítalo."*

Those are instructions, not content, and they are binding — the second one
retired a whole "cada semana que no entras es una auditoría que pierdes"
argument he had just finished delivering. Between them they took out 31
seconds that every other signal said to keep: the audio is clean, the delivery
is good, and nothing in the phrase-level transcript looks like a retake.

Three things follow:

1. **The instruction removes the block it points at, *plus itself*.** Draw the
   drop wide enough to swallow the rejected material and the aside — he is not
   narrating for the audience when he says it.
2. **Resolve what "eso" refers to before writing the drop.** It points
   backwards, sometimes past an intervening sentence, and in the case above it
   named two separate blocks in one breath.
3. **Surface it during propose-strategy, quoted.** The user should not discover
   in the finished file that a section he remembers recording is gone — even
   though he is the one who asked for it.

Search terms that have caught these: the assistant's name in any spelling
(Scribe has written "CloudCode", "Cloud Code", "Claude" and **"Claudio"** for
the same word), plus `quítalo`, `córtalo`, `bórralo`, `eso no va`, `edítalo`,
`esto lo quitas`, `esto lo va a quitar`.

The 2026-09-12 VSL had one in the third person — *"Pinche Claudio lo escribió de
la verga, güey."* … *"No, esto lo va a quitar a la verga."* He is talking about
you rather than to you, and the instruction is still binding: it announced a
136-second retake of the whole block he had just delivered. So grep for the name
even when the surrounding sentence is not addressed to anyone.

### Scan for capture failure before planning anything

Sampling frames across the runtime catches the screen-share hybrid described
above. It also catches something worse, so treat it as a separate question:
**did the capture actually record?**

One 25:49 OBS file contained **6:53 of "No Signal"** — a black frame with an
on-screen error, in two blocks totalling **26.7% of the file**. Nothing in the
transcript announces it, and the audio keeps running the whole time.

Find the exact boundaries by classifying every second, not by eyeballing
samples — decode at `fps=1` scaled to 96×54 grayscale and threshold the mean
luma. That turns a vague "something's wrong around minute 17" into
`983.5–1376.0s`, which is what you need to write a drop.

**Make it a three-way classifier, not black/not-black** — the same single pass
then answers the screen-share question too, and screen-share is far more common
than capture failure. Thresholds that have worked on this camera and this room:

| mean luma | is |
|---|---|
| `< 12` | black — capture failure or an OBS scene transition |
| `12–52` | screen-share (a dark IDE/browser, letterboxed, webcam PIP) |
| `≥ 52` | lit camera |

On a 23:13 VSL that one command printed `0–701 CAM · 701–805 SCREEN · 805–807
BLACK · 807–810 SCREEN · 810–1393 CAM`, which is the whole structural map of the
video before reading a word of the transcript.

Note the 2-second black *inside* the screen-share. **A short black bounded by
screen-share on both sides is an OBS scene transition, not a capture failure** —
the failure mode runs for minutes and the audio keeps going over it. Judge by
duration and by what sits on either side, and don't let a 2s transition
scare you into treating a working demo as damaged.

Smooth that classification (a 9-second median) so one dark frame doesn't invent
a region — **and then run a second, unsmoothed scan later**, because the
smoothing hides short blacks from OBS scene transitions, which are their own
failure mode and land *inside* cuts. That check belongs against the EDL, right
before rendering; see the cutting notes.

Then decide whether the dead region has content, and **use words-per-minute to
decide it**. In that file the No Signal block held 39 words in 6:32 — **6/min
against the video's 124/min**. That is not lost material, it is the presenter
talking to someone off-camera with the mic open. It goes in one drop.

Had the density come back near 124/min, the whole job changes: you would have
audio with no picture and a real conversation to have with the user about it.
Run the number before assuming either way.

### When the ask is "just cut it"

Sometimes the user wants no graphics at all — *"sin motion graphics, solo
córtalo y ya"*. Take it literally: no cutaways, no alpha overlays, no burned
subtitles, no grade, no zoom. Steps 5–7 of the pipeline below drop out entirely
and the job is transcribe → DROPS → extract → concat → loudnorm.

Confirmation is still required, but the useful question is no longer *what* to
build — it's **how hard to cut**. Offer two levels and let them pick:

- **Limpieza** — only mistakes: false starts, duplicated phrases, stutters with
  enough room to cut cleanly, and dead silences ≥1s trimmed to ~0.3s. Breathing
  pauses of 0.5–0.8s stay. On a 9:36 talking head this was 18 drops, −26s (4.5%).
- **Agresivo** — additionally squeeze every pause >0.6s to ~0.35s. Roughly −70s
  on that same video, and it costs the punchlines their air.

Default to **limpieza** and say why. The material is usually tighter than it
feels, and on a face-to-camera video the pauses *are* the delivery.

**When they do pick agresivo, generate the pause pass — don't hand-write it.**
Squeezing every pause on a 25-minute video is 90-odd drops and hand-placing them
is both slow and worse: the envelope already knows where every valley is and how
long it runs. Two passes in one builder, kept separate in the source:

```python
DROPS_EDIT = [...]                       # retakes, interruptions, false starts
for v0, v1 in valleys(db):               # generated
    if v1 - v0 <= 0.60: continue
    if any(v0 < b and v1 > a for a, b, _ in DROPS_EDIT): continue
    squeeze.append((v0 + 0.175, v1 - 0.175, ...))     # deja 0.35s
```

Skipping valleys that overlap a hand-placed drop matters: otherwise the
generated pass moves a boundary you reasoned about. And it keeps the join table
readable — print only the editorial joins, since the squeezed ones are 0.35s by
construction and don't change a word.

**Exclude the file-tail valley.** It is not a pause between phrases, and the
generated rule ends the video 0.15s after the last syllable — which reads as the
file being cut off rather than the video ending. On the 2026-09-12 VSL the
trailing valley ran from 1521.0 to EOF and the squeeze left the last range at
1521.155 against a final `'DM.'` whose audio stops at 1521.0. Declaring
`(1521.70, SRC_DUR)` as an editorial drop fixes it in one line: the squeeze pass
skips it (it overlaps a hand drop) and the video rests on 0.70s of air.

That fix costs one segment, not a re-extraction — see the single-segment
recovery in the cutting notes.

**Check for retakes before quoting either number.** A raw VSL turned out to
have five attempts at one line (one of them wrong — the negation dropped out),
plus four other lines recorded twice, plus a beat split across a capture
failure. That is take *selection*, not cleanup: for each repeated line you have
to pick which one ships, and the level question becomes secondary. Say so
explicitly during propose-strategy and list the repeats you found, because the
user may want a specific take. On that video the honest scope was three
options, not two — the third being "cut only what's broken and leave every
duplicate in for me to choose later."

And re-estimate the runtime after mapping the damage rather than before: an
early "~17:30" guess on that file became **13:35** once the dead capture,
the interruption and the retakes were all counted. Give the number once it is
real, and flag that it moved.

Two details change, both in the cutting notes: the padding logic has to be
inverted so hand-placed pause lengths actually survive to the output, and the
self-eval swaps its three contact sheets for a join-level pop check plus a
re-transcribed reading of every seam.

### The pipeline, in order

Each step has a gate. The gates are not optional — every one of them has caught
a shipped-quality defect at least once.

1. `ffprobe` the source. **Note the fps** — it decides every composition.
2. Transcribe (cached). Build a phrase-level view of the **raw** transcript to
   find false starts, duplicates and silences.
3. Write the cut as DROPS → `edl_<name>.json`.
   **Gate:** run the boundary diagnostic (which words does each range edge cut
   through?) and read the transcript **of the cut**.
4. Extract + concat → `base.mp4`.
   **Gate:** `ffprobe base.mp4` and confirm the duration matches the cut. Only
   now is it safe to pull a framing frame for the overlay briefs.
5. Choose cutaway windows against the cut's output timeline.
   **Gate:** the inside-vs-after word check (see the payoff-anchoring section).
6. Build the graphics with parallel sub-agents into versioned dirs
   (`src/slots/vN/` → `out_vN/`), never overwriting a previous video's renders.
   **Gate:** see "Inspect every graphic before you composite" below. This one
   is new and it is the cheapest gate in the whole pipeline.
7. Measure segment drift, then write the final EDL with corrected overlay times.
   **Gate:** re-derived times must match the stored ones to ~0.000s.
8. Composite → loudnorm → **measure true peak** → limiter if needed.
9. Self-eval contact sheets on the rendered output. Fix, re-composite, repeat.
10. Append to `project.md`; fold any correction into this skill and push.

## Brand

Every color, font, glass panel, and icon comes from the `brand-pba-code` skill
(Liquid Glass v4.1) — invoke it to pull the actual token values rather than
guessing, since the design system does evolve.

> **The academy is called `Architect Academy`.** It was renamed from *Project
> Boy Academy / PBA* in September 2026. **Never put "Project Boy Academy" or
> "PBA" on screen in a new public-facing piece** — not in a CTA card, not in a
> lower-third — even when the recorded audio still says the old name, which it
> does on anything shot before the rename. Put the current name on the card and
> let the audio be what it is; that mismatch is the intended trade.
>
> This is only about *display text*. The CSS custom properties keep their
> `--pba-*` prefix and the classes keep `.pba-*` — do **not** rename those, and
> the vendored Remotion kit directory (`animations/pba_kit/`) stays as it is.
> The skill's own name and this repo also keep the old slug.
>
> The design system does evolve, so re-invoke `brand-pba-code` at the start of
> every video instead of trusting this paragraph. It changed under a delivered
> video once: the previous session shipped a CTA card reading "Project Boy
> Academy" hours before the rename surfaced.

The translation to video:

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
notes — including **opening Remotion Studio in the browser while building**
each slot, not just handing back rendered stills. That's a correction from a
real session: the user reacted much better to seeing the animation live than
to receiving finished files, and generic-feeling output has traced back to
skipping this step, not to wrong brand tokens.

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

**Calibration from five shipped videos:** 18 cutaways each, landing at
9–13.5% of total runtime, which works out to roughly **one per minute**. The
per-minute cadence is the number that matters; the percentage follows from it.
One cutaway per video may run ~8s if it's a genuine recap or table that can't
be chunked — flag that as a deviation during propose-strategy.

That "18" is remarkably stable, and it is a coincidence worth not reading too
much into: **derive the count from the camera runtime, don't reach for 18.** On
a 15:12 VSL with a 1:17 screen-share, 835s of camera at one per minute gives
14 — and 18 only became right because four card *families* (three creencias,
three pasos, three preguntas del filtro, plus the singles) each wanted all
three members for the repetition to land. That came to 92.9s, **10.2% of total
and 1.29 per minute of camera**, both in band. Count the beats the material
actually has, then check the cadence; don't pick the number first.

If a strategy conversation surfaces a real reason for a longer block (the user
explicitly asks, or a segment genuinely can't be chunked — a full worked
example, say), that's fine to build, but it's a deviation to confirm, not the
default.

### Cadence and brand tokens are not enough — the cards still read as "básico" without a motion vocabulary

A session handed an editor the cadence rules above plus the brand's color and
font tokens, and the editor built technically-correct cutaways — right
length, right cadence, right colors — that still read flat: plain text
fading in on black, no icon, one motion for the whole card. Getting the
*rules* right and the *palette* right is not sufficient; what transmits the
"premium" quality is a specific, numeric motion vocabulary — per-element
stagger, blur-to-focus text entrances, glass/gold materials instead of flat
fills, real icon or emoji on every single card — and that only survives being
handed off as exact numbers and working code, not adjectives.

**[references/cutaway-visual-recipe.md](references/cutaway-visual-recipe.md)
is that handoff.** Read it before building or briefing any cutaway, and give
it verbatim (with its two source files) to anyone who isn't going to read
this whole skill — it's the concrete, copy-paste version of everything this
section describes in the abstract.

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

**Sample the frame at each overlay's own timestamp, not one frame for the
whole video — the presenter's hands move.** Two videos shot in the same room on
the same day wanted opposite halves of the screen. In the morning take the
bottom-left band was clear and all three overlays went there; in the evening
take he gesticulates constantly, and at both lower-third moments his hand
occupied roughly `x 120–460, y 760–1080` — precisely the safe area from the
earlier video. Everything moved to `x 1290–1870, y 780–1020` instead.

So the hazard list is per-overlay: pull a still at each window's start, and
give each sub-agent the coordinates for *its* moment. A single "the framing is
the same as last time" is how you brief an agent to draw a card underneath a
hand.

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

## Delivery: loudness

Two-pass loudnorm to −14 LUFS, video stream-copied. **Then measure the finished
file.** loudnorm's dynamic mode is imprecise on true peak even with
`linear=true` — outputs have landed anywhere from −0.15 to −0.62 dBTP, and
twice at **+0.07 dBTP**, i.e. clipping. If TP comes out above about −0.2, run a
limiter over it (video stream-copied, so it's quick) and re-measure. Sources
have arrived both clipping (+2.16 dBTP) and 16 dB too quiet, so this step
always earns its keep. Exact commands are in the cutting-and-render notes.

## Inspect every graphic before you composite

The composite is the expensive step, and **you cannot shorten the loop by
swapping a file mid-render**: ffmpeg opens all inputs at start and reads them
progressively, so overwriting an overlay while the render is running corrupts
the output. The only recovery is stop → fix → restart from zero.

Budget it properly, and **do not estimate the rate from the first few minutes**
— the setup where 20-odd inputs are opened drags the early average down by 4×.
On a 15:12 1080p60 video with 21 overlays (three of them ProRes 4444 alpha) an
early sample read 12% in 9 minutes, implying 75 minutes; the steady-state rate
was **~51 fps, so about 18 minutes**. Large ProRes 4444 inputs turn out not to
cost much. Sample twice with a known gap, after the first minute.

So spend five minutes first. Two checks, both on the renders themselves:

1. **One contact sheet of every opaque cutaway near its end frame** (~88% in,
   where everything has landed). Six across reads fine for 18 cards. This is
   where a family that drifted apart becomes obvious, and where you notice the
   one card that is merely OK.
2. **A test composite of every alpha overlay over `base.mp4`**, two moments
   each — see the Remotion notes. Isolated alpha checks pass on overlays that
   are unreadable over footage.

Then **read the weakest three or four at ~900px** rather than trusting the
tiled thumbnails. On the 2026-09-05 VSL the sheet looked uniformly fine and a
full-size still showed the one genuine defect: a two-column contrast card whose
right line wrapped to an orphaned word, which broke exactly the symmetry the
card existed to create.

Sub-agents are honest but they grade their own card in isolation. They cannot
see that card six drifted from card five, and they cannot see their overlay
against the footage. Both of those are your job and neither survives being
skipped — that session restarted the composite twice, and both restarts were
avoidable by doing this first.

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

**Read it at thumbnail size, and trust that reading.** Its power is that a cell
which looks black in the tile is a cell that reads as a dip at 1× — even when
the full-size frame turns out to be perfectly legible. On the 2026-09-05 VSL
exactly one of eighteen middle cells read black; pulled at full size it showed
readable text, and it was still a real defect (see the "element that enters is
deliberately dim" case in the Remotion notes). Don't let a full-size still talk
you out of what the sheet showed you.

A fourth, cheap check is worth adding to the same helper: sample every cutaway
midpoint and boundary frame and assert the frame is not **empty**. Use the
**peak** luma, never the mean — a brand card is black by construction and its
mean sits at 5–8/255, so a mean threshold flags all eighteen and tells you
nothing. Measured on this video: a healthy card peaks at 76–255, a true black
or an OBS transition peaks under 30. A first version used mean luma and
reported 11 defects where there were none; a second added "percent of pixels
above 90" and still flagged two healthy frames. Peak alone was the signal.
