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
verbatim plus the source it's extracted from: `remotion/src/cutaways/` in the
sibling Remotion project (see "Where the working code lives" below). They are
working, tested Remotion components, not pseudocode.

## The failure mode, precisely

"Básico" in practice meant: a kicker label, a headline in the brand's white,
and nothing else. No icon. No depth cue (glass, shadow, gradient). One
entrance move (a fade) applied to the whole block at once instead of staggered
per element. That is indistinguishable from a PowerPoint title slide, and it
reads as such at 1x speed no matter how correct the color values are.

The fix has three ingredients that still hold, always together, never just one:

1. **Per-element stagger, not one fade for the whole card.** Kicker dot →
   kicker label → hairline rule → headline (word by word) → whatever else,
   each on its own beat, 60–160ms apart. The eye reads arrival, not appearance.
2. **A material, not a flat color.** Glass panels/badges (fill + blur +
   hairline + inset top highlight), gold *gradient* text with a shimmer
   sweep on hero numbers — never a solid fill where the brand's glass or gold
   recipe applies.
3. **Blur-to-focus on text, not just fade.** Headline words enter at
   `blur(9px) → blur(0)` alongside the opacity/position tween. This alone is
   most of the perceived "cinematic" quality difference — a plain
   opacity/y fade reads like a keynote slide; adding the blur term reads like
   a title sequence.

### Correction, 2026-09-15: bare emoji-as-icon is not the fix, it's what makes it read as generic

The original version of this file had a fourth ingredient — "a real icon or
emoji on every card". The user rejected that outright after seeing the first
Remotion port: bare emoji icons (🧑‍💻, 🚫, 🔔…) read as generic template
filler, and on Windows the emoji font renders visibly worse than on the
platform they were designed on, so the problem is worse there, not incidental.
Piling on ambient film grain as a blanket "premium" texture on every card had
the same effect — it reads as a template stamp, not craft.

What replaces it:

- **A card can be pure centered typography and nothing else** — kicker +
  headline, no icon, no watermark. That is a complete, legitimate look on its
  own, not an unfinished one. Don't force an icon onto a card that doesn't
  need one.
- **When a card genuinely needs imagery** (a person, a product, a specific
  object the line is about), source a real image instead of an emoji:
  generate one (the `generate_image`/Higgsfield tooling is available for
  this) for generic/illustrative needs — a laptop, a rocket, an abstract
  scene — or **ask the user for the actual photo** when the card is about
  something specific or personal (a real client, their own product's
  screenshot, their own face). Don't default to asking for every image; use
  judgment on which is which, and say which choice you made and why when you
  propose the cutaway.
- **Push for real creative variety, not the same five templates on repeat.**
  If the content is about a number climbing, a system with moving parts, or a
  product's own UI, build the actual thing — an animated line chart with a
  spring-driven count-up, a mocked dashboard (a Stripe-style revenue panel
  with the balance ticking up is the example that landed), a UI mockup with
  its own motion — using genuine Remotion craft (SVG path animation, spring
  physics, layered composition), not a kicker-plus-headline formula stretched
  to fit.
- **Brand tokens (`theme.ts`'s colors and fonts) are raw material, not a
  template to imitate.** Pull the right color and the right font, then use
  your own judgment for composition and motion — don't reverse-engineer "what
  would `brand-pba-code` do" as if matching an existing formula were the goal.
  The formula is not the brand; the color and type system is.

The five templates in `remotion/src/cutaways/` (`Statement`, `Stat`,
`ListCard`, `Comparison`, `Diagram`) are still a fine *starting point* for the
common cases they cover, and their `icon` fields are optional — omit them for
a pure-text card. **They do not yet render a real image in place of an
emoji** — `IconBadge`/the hero-icon slot in `Statement.tsx` render whatever
string they're given as text, so a file path or URL would just print as text,
not display as a picture. Swapping an emoji field for a generated or supplied
image is a real code change (an `<Img src={staticFile(...)} />` in place of
the emoji `<div>`), not a drop-in string replacement — do that work when a
specific card actually needs it, don't claim the capability exists until it
does. But treat these five as a starting point, not the ceiling: a video with
strong numeric or systemic content deserves a bespoke scene built for that
video, not
a fifth `stat` card in the same shape as the last four.

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

The engine described above is implemented as real Remotion components,
vendored once in the sibling `remotion/` project (see
`remotion-technical-notes.md` for the project layout) under
`remotion/src/cutaways/`:

- `theme.ts`/`atmosphere.tsx` (in `remotion/src/architect/`, reused as-is —
  same brand tokens, no duplication) — glass/gold/color primitives and film
  grain.
- `Background.tsx`, `Kicker.tsx`, `Headline.tsx`, `IconBadge.tsx`,
  `primitives.tsx` (`FadeUp`, `CenteredLabel`, `CountUpGold`) — the shared
  motion vocabulary (blur-to-focus word stagger, icon pop-in-and-settle, gold
  count-up + shimmer) each template composes from.
- `Statement.tsx`, `Stat.tsx`, `ListCard.tsx`, `Comparison.tsx`,
  `Diagram.tsx` — the five card templates, one component each, driven by
  `useCurrentFrame()`/`interpolate` instead of a GSAP timeline. `easing.ts`
  documents the GSAP→Remotion ease mapping (`expo.out` → `Easing.out(Easing.exp)`,
  etc.) so the timings ported below keep the same feel.
- `CutawayCard.tsx` — picks the right template from a content-object's `type`.

This used to be an HTML+GSAP+Playwright pipeline (a deliberate exception to
"always Remotion for PBA"), replaced in full on 2026-09-15 after the user
pointed out the skill's own header said Remotion while the actual working
engine was GSAP — a real inconsistency, not a misunderstanding. There is no
non-Remotion fallback anymore; if you're producing a handoff for someone who
won't set up a Remotion project, hand them this file plus the `cutaways/`
source, same as any other Remotion work from this skill.

**Per-video wiring**: each video gets its own slot,
`remotion/src/slots/<video-id>/`, holding a `content.json` (same schema as
before — one object per cutaway, `type` selects the template, `start`/`end`
in the *master video's own timeline*, duration derived as `end - start`) and
a tiny `cutaways.entry.tsx` that loops the array into one `<Composition>` per
entry (see `remotion/src/slots/demo/` for the reference — the real 18
cutaways from the shipped VSL this recipe was written for, plus one synthetic
`diagram` entry since that video didn't need one). Preview live with
`npx remotion studio src/slots/<video-id>/cutaways.entry.tsx` — see
"Open Studio in the browser while building" in the technical notes, this is
not optional.

**Rendering a card**: `npx remotion render src/slots/<video-id>/cutaways.entry.tsx <id> out/<id>.mp4`
per entry (or loop over the content array's ids). Opaque h264 is correct —
no `--pixel-format`/ProRes flags needed, cutaways aren't alpha overlays.

**Compositing**: `node ../../scripts/composite-cutaways.mjs content.json MAIN.mp4 OUT.mp4 --run`
(unchanged from the old engine — it only ever consumed `out/<id>.mp4` files
and never cared how they were rendered). Builds one ffmpeg command with
`-itsoffset <start>` on every overlay input (this shifts that stream's PTS to
start at the cutaway's own start time on the main timeline — without it,
`overlay`'s frame-matching has no way to know the clip belongs at t=30s
instead of t=0s) and chains
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
