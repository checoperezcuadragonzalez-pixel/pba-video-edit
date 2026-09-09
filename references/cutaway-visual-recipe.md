# The cutaway visual recipe — concrete, copy-paste level

Everything in the main skill file about cutaways describes *cadence and
structure* (how many, how long, how often, opaque-overlay-not-spliced-range).
This file is the other half: what actually has to be on screen for a cutaway
to read as premium instead of "básico". It exists because prose alone did not
transmit this — a session handed a non-technical editor the cadence rules and
the brand color/font tokens, and the editor built cutaways that were
technically correct (right length, right cadence, right colors, right font)
and still read as flat: plain white text on black, no iconography, no depth,
no sense of things arriving. **"Follow the brand tokens" is necessary and not
sufficient.** What's missing every time is *motion vocabulary* — and that only
transmits through exact numbers and real code, not adjectives like "smooth" or
"premium".

If you are handing this off to someone who is not going to read the whole
skill (an editor, a junior agent, a different tool), give them this file
verbatim plus the two source files it's extracted from:
`assets/cutaway-engine/engine.css` and `assets/cutaway-engine/build.mjs`
(vendor those alongside this skill — see "Where the working code lives"
below). They are a working, tested Playwright + GSAP renderer, not
pseudocode.

## The failure mode, precisely

"Básico" in practice meant: a kicker label, a headline in the brand's white,
and nothing else. No icon. No depth cue (glass, shadow, gradient). One
entrance move (a fade) applied to the whole block at once instead of staggered
per element. That is indistinguishable from a PowerPoint title slide, and it
reads as such at 1x speed no matter how correct the color values are.

The fix has four ingredients, always together, never just one:

1. **A real icon or emoji on every card**, not just cards that are
   conceptually "about" an object. A single-sentence claim still gets a
   large, very-low-opacity emoji watermark in the corner (see below) — it is
   the difference between a caption and a graphic.
2. **Per-element stagger, not one fade for the whole card.** Kicker dot →
   kicker label → hairline rule → headline (word by word) → icon, each on
   its own beat, 60–160ms apart. The eye reads arrival, not appearance.
3. **A material, not a flat color.** Glass panels/badges (fill + blur +
   hairline + inset top highlight), gold *gradient* text with a shimmer
   sweep on hero numbers — never a solid fill where the brand's glass or gold
   recipe applies.
4. **Blur-to-focus on text, not just fade.** Headline words enter at
   `blur(9px) → blur(0)` alongside the opacity/position tween. This alone is
   most of the perceived "cinematic" quality difference — a plain
   opacity/y fade reads like a keynote slide; adding the blur term reads like
   a title sequence.

## The five element types and their exact timing

All times are seconds into the cutaway's own GSAP timeline (`tl`), which is
seeked frame-by-frame by the renderer — nothing here depends on wall-clock
speed. Ease is `expo.out` for entrances (matches the brand's calm-but-decisive
feel better than the token file's UI-chrome `cubic-bezier(0.32,0.72,0,1)`,
which reads too slow at cutaway durations) and `sine.inOut` for
shimmer/settle moves. No bounce/elastic anywhere — one `scale:1.04→1` settle
after an icon lands is the only overshoot, and it is subtle by design.

**Kicker** (dot + mono label + hairline rule): dot scales `0→1` at t=0
(0.32s), label slides `x:-14→0` fading in at t=0.04 (0.36s), hairline scales
`scaleX:0→1` at t=0.1 (0.5s). Total kicker land time ≈0.5s, and it must start
at t=0 — it is the first thing the eye should register on the hard cut.

**Headline** (word-by-word): split into `<span>` per word, each animates
`opacity:0→1, y:26→0, filter:blur(9px)→blur(0)`, duration 0.46s, staggered
0.03–0.06s per word (shorter stagger for longer headlines so a 10-word line
still lands inside ~1s). Start it at t≈0.14 if a kicker precedes it (so the
kicker is visually "done" before the headline starts, not simultaneous
clutter), or t≈0.05 if there's no kicker. **This is the element the
"substantially opaque by 0.35s" rule in the main skill file is about** — with
a kicker at t=0.14 and a 3–6-word headline, the first two words are fully
landed by 0.35s, which is what makes the hard cut not read as a stutter.

**Icon / icon-badge** (emoji, either bare as a background watermark or inside
a glass circle badge): `opacity:0→1, y:46→0, scale:0.6→1`, 0.55s, then a
tiny settle `scale→1.04` (0.22s) `→1` (0.24s). A bare background watermark
(no badge) sits at low opacity permanently — 0.14 is the number that reads as
"present but not competing with the headline" at 1920×1080; test at 0.10 and
0.18 if the emoji itself is very busy or very plain, respectively. Emoji
render in full color via the OS's own color-emoji font — on Windows that's
`"Segoe UI Emoji"` in the font-family list, no image assets needed.
**Position it before you set opacity: an icon-badge element needs
`position: absolute` in its own CSS rule** — if it only carries inline
`left`/`top` without a positioned ancestor's sibling `position: absolute` on
the *class itself*, it renders in normal document flow at the top-left
corner instead of where you placed it. This exact bug shipped once already;
it is a one-line CSS fix but silent until you look at a real frame.

**Hero number (count-up)**: a plain JS object `{v:0}` tweened to the target
integer over ~0.95s with `power2.out`, writing
`Math.round(v).toLocaleString('en-US')` into a `<span>` on every `onUpdate`.
Layer a **gradient shimmer** on top — the text sits on `background: <gold
gradient>` with `background-size: 220% 100%`, `-webkit-background-clip:
text`, and a separate tween slides `background-position` from `0% 0%` to
`-120% 0%` over ~1.5s starting slightly after the count-up begins. The
shimmer is what makes a gold number read as "liquid" instead of "a number
that happens to be yellow" — this is the brand's own distinction between
"amarillo evidencia" (flat, UI) and "oro líquido" (gradient, reserved for
hero numbers), made kinetic.

**List rows**: a thin `rgba(250,204,21,0.35)` vertical rail scales up
(`scaleY:0→1`, `power1.inOut`, duration = `items×0.16 + 0.35`) as a spine
behind the icon badges, drawing the connection between them. Each row's icon
badge and text enter on the icon-entrance timing above, staggered 0.16s per
row, first row starting at t≈0.08 (not later — with 4+ rows you cannot afford
to wait, or row 1 isn't landed by the 0.35s mark either). A row can be
**dimmed** (`opacity` final value ~0.55, icon badge `opacity:0.55` on its
resting state, text color muted gray) to show "this item matters less" —
used for a de-emphasized last item in a list (e.g., the least important perk
in a "what's included" card) without deleting it.

**Comparison / contrast cards**: two sides, each independently a big stat
value *or* a stack of body lines — never mix a single side between the two
without a reason. Each side has a **tone**: `muted` (enters at
`color:#D9D9D9`, i.e. body brightness, *not* the resting muted gray — see
next paragraph — settles to ~0.75–0.78 opacity once the other side lands),
`bold` (white, full opacity throughout), or `gold` (gradient text, full
opacity, gets the shimmer sweep). The muted side starts second-to-last of the
two, the "winning" side lands last and brightest — the reveal order should
match which side the sentence resolves to.

**Do not let the muted side enter already muted.** This is a documented
defect from a previous video (see the "third variant" section in
`remotion-technical-notes.md`) and it recurs because it is intuitive to do
it wrong: if a side is *conceptually* the lesser one, it's tempting to make
it dim from frame 0. But the hard cut needs *something* bright in the first
half-second, and if the "lesser" side is the only thing on screen and it's
dim, the whole frame reads as a dip even though every element is exactly the
brightness the design calls for. Enter the muted side at body brightness,
recede it ~0.4s after the other side lands, not before.

## Where the working code lives

The engine described above is implemented and tested in two files, built for
the 2026-09 VSL cutaway rebuild:

- `edit/animations/vsl2/brand/engine.css` — the CSS: glass panel/badge
  recipe, kicker, gold-text gradient, ambient background glow + grain.
- `edit/animations/vsl2/build.mjs` — the JS: five template functions
  (`tplStatement`, `tplStat`, `tplList`, `tplComparison`, `tplDiagram`) that
  take a plain content object and return a complete self-contained HTML file
  wired to the `window.__init/seek/ready` contract the Playwright renderer
  expects (`edit/animations/renderer.mjs` — pre-existing, unchanged).

This is an HTML+GSAP+Playwright pipeline, not Remotion — a deliberate
exception to "always Remotion for PBA" (see `remotion-technical-notes.md`).
The reason: this file's whole point is to be handed to someone who is not
going to set up a React/Remotion project. A self-contained HTML file per card
plus one CSS file plus one renderer script is copy-paste-able by a
non-engineer editor or a lightweight tool; a Remotion project is not. If
you (Claude) are the one building the video end-to-end, either engine
produces the same on-screen result — use whichever is already scaffolded in
the project you're in. If you're producing a handoff for someone else to
build cutaways from, hand them this file plus the two source files, not a
description of Remotion components they'd have to translate themselves.

**Rendering a card**: `node render_all.mjs content.json` reads a JSON array
of card specs (one object per cutaway, `type` selects the template, plus
`start`/`end` in the *master video's own timeline* — the duration is derived
as `end - start`, so cards are never a fixed length), builds each card's
HTML, renders it to a PNG sequence via the existing renderer at the source's
own fps, and encodes an opaque h264 clip per card whose frame count exactly
matches the window duration.

**Compositing**: `node composite.mjs content.json MAIN.mp4 OUT.mp4 --run`
builds one ffmpeg command with `-itsoffset <start>` on every overlay input
(this shifts that stream's PTS to start at the cutaway's own start time on
the main timeline — without it, `overlay`'s frame-matching has no way to know
the clip belongs at t=30s instead of t=0s) and chains
`overlay=0:0:eof_action=pass:enable='between(t,<start>,<end>)'` across all of
them, mapping `[vout]` for video and `0:a` (untouched) for audio. This is the
same opaque-overlay-not-spliced-range structure the main skill file
describes, just operating directly on a finished master file instead of a
`base.mp4` + EDL — appropriate when you're upgrading cutaways on an
already-cut video rather than building the cut from raw footage.

## Real numbers, one shipped video

18 cutaways, all of them `statement`/`stat`/`list`/`comparison` types (no
`diagram` was needed — content that looked like it might need one was
actually inside a screen-share section and correctly excluded, see below),
totaling 95.4s against a 1526.7s master with a 636s mid-video screen-share
section. That's **10.7% of camera runtime** (890.7s) at **1.21 cutaways per
minute of camera** — both inside the established 9–13.5%-and-~1/min band from
the main skill file, on a video that wasn't built with that band as a target.

The mid-video screen-share (587–1223s, a webpage/curriculum walkthrough with
a camera PIP) got zero cutaways, correctly — a single frame from inside it
can look exactly like a cutaway card (dark background, a diagram-like
element, no camera visible) and cost real time to rule out. Sample 2–3
frames across any suspicious window before deciding it's a discrete cutaway
rather than a moment inside a longer screen-share: a screen-share's content
changes shape between frames (scrolling, cursor movement) where a cutaway
card's does not (it's a fixed composition animating in place).
