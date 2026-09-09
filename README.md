# pba-video-edit

A [Claude Code](https://claude.com/claude-code) skill for editing talking-head
videos: cutting raw footage, adding branded camera overlays, and dropping short
motion-graphics cutaways at key moments.

It is a thin, opinionated layer on top of the generic `video-use` skill, which
handles the actual transcribe → cut → render mechanics. This skill supplies the
house style and the accumulated production knowledge.

## What's in here

| File | What it covers |
|---|---|
| [SKILL.md](SKILL.md) | The process, the brand rules, and the cutaway pattern — how many, how long, how often |
| [references/cutting-and-render-notes.md](references/cutting-and-render-notes.md) | Building a cut from raw footage, and every gotcha in the transcribe → EDL → extract → composite → loudnorm pipeline |
| [references/remotion-technical-notes.md](references/remotion-technical-notes.md) | How the animations get built in Remotion and wired into the EDL |
| [references/cutaway-visual-recipe.md](references/cutaway-visual-recipe.md) | The concrete, numeric motion vocabulary for cutaways — exact timings, the five card types, and the working HTML+GSAP+Playwright engine to hand off to a non-technical editor |

## The one idea worth stealing

If you're doing anything similar, the structural insight is this: **a fully
opaque, full-frame overlay is a full-replacement cutaway.** Because the render
pipeline maps audio from the base with `-map 0:a -c:a copy`, the overlay path
never touches audio — so the narration keeps playing underneath while the
picture is entirely replaced.

That means you never splice graphics into the edit's ranges, never mux audio
per window, and never recalculate timestamps. The cut stays byte-identical and
independently verifiable, and the graphics ship as small h264 files instead of
hundreds of megabytes of ProRes.

The other one: **measure frame-rounding drift and correct for it.** Per-segment
extraction rounds each segment to a frame boundary, which accumulates — around
+0.15s over 18 segments, +0.48s over 81. Overlay start times are evaluated
against the real timeline, so without correction a graphic lands up to half a
second after the word it's meant to hit.

## Installing

Drop the folder into your Claude Code skills directory:

```
~/.claude/skills/pba-video-edit/
```

It expects the `video-use` skill alongside it, and a brand skill supplying
design tokens.

## Note on the brand

The visual specifics (colors, fonts, glass treatment) describe one particular
brand system. The *process* — the cutaway cadence, the drift correction, the
sub-agent briefing checklist, the self-eval contact sheets — is general.

## Maintenance

This skill is a living record of corrections. Every time a real editing session
produces a correction — a taste call, a technical gotcha, an approach that
failed — it gets folded in and pushed. See the "Keeping this skill current"
section in [SKILL.md](SKILL.md).
