# Cutting from raw + render-pipeline notes

Everything in this file was learned by shipping PBA videos on Windows. Read it
before writing an EDL.

## Express the cut as DROPS, not keeps

For a talking-head video, almost all of the raw footage is wanted. Listing what
to *remove* is far easier to audit and adjust than listing what to keep:

```python
DROPS = [
    (0.00,   7.70,  "ruido antes de empezar, no es parte del video"),
    (41.30,  45.30, "arranque falso 'Dos, por que una habilidad no es--'"),
    (362.75, 428.07,"conversacion fuera de camara + silencios"),
]
```

Take the complement to get the keep windows, then snap each keep edge to word
boundaries from the transcript. Every drop carries a written reason — that
comment is what lets you (or the user) re-audit the cut later.

Typical haul: 12–18 drops removing 11–13% of runtime. What has actually been in
them: four takes of the same hook, an interjection that broke the take,
duplicated sentences where he restated an idea better the second time,
trailing-off sentences abandoned mid-thought, dead silences of 3–11s, a whole
regrabbed section, and once **65 seconds of off-camera conversation** recorded
with the mic still open.

That last one is worth expecting rather than being surprised by: on a raw OBS
capture the recording often starts before and runs past the actual take, so
scan the whole transcript for stretches that simply aren't the video.

## Snapping to word boundaries — two traps

The basic rule is `video-use` Hard Rule 6/7: a keep range contains only words
*fully inside* it, then gets 50ms of head padding and 80ms of tail padding.
Two things break that in practice.

### Trap 1: Scribe pads the last word of a phrase with trailing silence

Word `'joven.'` came back as `20.34–27.41` — **seven seconds**. Scribe attaches
the following silence to the last word of a phrase. That destroys the
"fully inside" test: with a drop starting at 27.40, `joven.` is not fully
inside, so it's excluded and the sentence ships decapitated ("...cuando eres").
Move the drop later to include it and you swallow 6s of silence instead.

Fix: compute a clamped effective end used **only** for boundary math.

```python
MAX_WORD = 2.5
for w in words:
    w["wend"] = min(w["end"], w["start"] + MAX_WORD)
```

**Pick this number per video — do not hardcode 1.0.** An earlier version of
this note said "no real word lasts longer than a second", and that was wrong.
In a video with a screen-share demo the presenter elongates words while he
types: `'vender'` genuinely ran **1.86s** of speech. With `MAX_WORD = 1.0` the
boundary math clamped `wend` to `start + 1.0`, the segment ended there, and the
word shipped decapitated — the exact failure the clamp exists to prevent, just
caused by the clamp itself.

The two cases are easy to tell apart because they differ by an order of
magnitude: elongated speech tops out around 2s, while Scribe's silence padding
shows up as 3s+ outliers. So dump the distribution first and set the tope above
the longest genuine word:

```python
long = [(w["end"] - w["start"], w["text"]) for w in words
        if w["end"] - w["start"] > 1.0]
for d, t in sorted(long, reverse=True)[:20]:
    print(f"{d:6.2f}  {t!r}")
```

If the top of the list is ~1.9s and there are no 3s+ entries, the transcript has
no Scribe padding artefacts at all and a generous `MAX_WORD` costs nothing.

### Trap 1b: Scribe emits three decimals, and rounding them decapitates words

Related and nastier, because it looks like the code is right. Scribe returns
two decimals for most words but **three for some** (`'primero.'` ends at
`849.612`, `'mierda.'` at `967.772`). If your inspection helper prints rounded
values and you paste one straight into a `DROPS` boundary, the drop starts
**2ms before** the word actually ends, the word fails the `wend <= b` test, and
the phrase ships cut short — `"Vamos a ponerle Stripe cliente"` instead of
`"...cliente primero."`, and `"...nuestra reputación a la"` with the last word
gone.

Two fixes, apply both:

```python
EPS = 0.01                       # covers 2-decimal rounding (max error 0.005)
inside = [w for w in words
          if w["start"] >= a - EPS and w["wend"] <= b + EPS]
```

and make the peek/inspect helper print `{t:.3f}`, never `{t:.2f}`.

This one is invisible in the raw transcript and invisible in the boundary
diagnostic below (the boundary doesn't cut *through* a word — the word is
simply excluded). **Only reading the transcript of the cut catches it**, which
is why that step is non-negotiable.

### Trap 1c: a drop must end *before* the first word you want to keep

The mirror image of 1b, and just as easy to type. Ending a drop exactly at the
start timestamp of the first word you want back keeps that word — but throws
away the one before it, which you probably also wanted.

A drop written to end at `97.30` (where `'prometo'` starts) silently swallowed
`'te'` at `97.200–97.280`, and the cut read *"...es una lista real. **prometo**
que al final..."*. The drop should have ended at `97.19`.

Rule: read the peek output for the words on **both** sides of the boundary and
place it in the gap between them, not on top of either one. The containment test
(`start >= a - EPS`) uses the word's start, so a boundary sitting mid-gap is
unambiguous while one sitting on a start timestamp is a coin flip.

### Trap 2: padding bites the neighbouring word

`PAD_OUT = 0.08` pushes the segment end forward, and if the next word (from the
take you just dropped) starts 40ms later, you get half a phoneme of discarded
audio at the seam. Clamp the padding against the neighbours:

```python
if i0 > 0:
    s = max(s, words[i0 - 1]["wend"])
if i1 + 1 < len(words):
    e = min(e, words[i1 + 1]["start"])
```

### The diagnostic that finds both

After building the EDL, list every word that a range boundary cuts through:

```python
for i, r in enumerate(edl["ranges"]):
    for w in words:
        if w["start"] < r["start"] < w["end"]:
            print(f"r{i} INICIO parte de {w['text']!r}")
        if w["start"] < r["end"] < w["end"]:
            print(f"r{i} FIN parte de {w['text']!r}")
```

The only acceptable hits are the `MAX_WORD`-clamped ones. Anything else is a
clipped word — fix the drop boundary.

## Cuts-only edits: the padding re-snap flattens every pause

The snap-and-pad logic above computes each range edge as
`first_word.start - PAD_IN` / `last_word.wend + PAD_OUT`, clamped to the
neighbours. The consequence is easy to miss: **the drop boundaries you wrote by
hand never reach the output.** They decide *which words fall out* and nothing
else. Every trimmed pause, wherever you put the cut, collapses to
`PAD_IN + PAD_OUT` = **0.13s** of silence.

On a video full of cutaways that is invisible — the graphics carry the rhythm.
On a **cuts-only or light-cleanup pass it is the whole edit**, and it reads as
breathless. It was caught on the 2026-09-03 video by printing the surviving air
at each join: a drop written to leave 0.62s of hold after the punchline *"¿qué
puta estoy haciendo?"* was delivering 0.13s, cutting the line off at the knees.

The fix is to invert the roles. Every drop boundary is already hand-placed
inside a silence, so the window `[a, b]` **is** the editorial intent — use it
directly, and demote padding from a transformation to a *gate*:

```python
s, e = max(0.0, a), min(total, b)      # el borde de la drop ES el borde del rango
```

then assert clearance instead of manufacturing it:

```python
PAD_FLOOR = 0.030          # piso de Hard Rule 7
# para cada borde: no parte palabra, y >= PAD_FLOOR a la palabra que se queda
```

and print what actually survives, which is the number you were reasoning about
all along:

```
join 03   0.80s   'haciendo?"' | 'Recuerdo'      <- el remate respira
join 11   0.17s   'cliente,'   | '250'           <- quitar un tartamudeo, pegado a proposito
join 14   0.08s   'paso'       | 'para'
```

Two joins per video legitimately want 0.07–0.17s (removing a stutter should be
seamless) and the rest want 0.25–0.50s. If that table reads 0.13 all the way
down, the re-snap is still in charge.

Exempt the first range's start and the last range's end from the clearance gate
— those are file edges, not cuts, and they always report 0ms.

## The `< 0.35s` minimum-duration filter deletes words silently

`if e - s < 0.35: continue` exists to kill slivers, but combined with the
padding above it quietly removes **real content**. On the 2026-09-03 video, a
deliberately-kept `"Sí,"` sat between two trimmed pauses; padding gave it a
0.29s segment, the filter dropped it, and the word vanished from the cut with
no warning anywhere in the output.

It happened to be the right editorial call, which is exactly why it's
dangerous — a silent deletion that looks like good taste. Either log every
range the filter discards, or (better) author such moments as an explicit drop
so the intent is in the DROPS list with a reason attached.

## Removing a stutter can leave a duplicated word

`"una desconexión con la p-- con mi público"` → drop `"la p--"` and you ship
`"desconexión con con mi público"`. The stutter was a *restart*, so the word
before it repeats after it.

Check the words on **both sides** of a stutter drop, not just the stutter. And
before extending the drop to swallow the duplicate, check the clearance: here
the gaps around the first `"con"` were 24–40ms, under the 30ms floor, so the
honest call was to leave the whole stumble in. Same reasoning retires the
`"n-no ... que-- ... yo--"` cluster in that video: when every clean cut point is
under the padding floor, the cut is more audible than the stutter.

This is invisible in the raw transcript — it only appears when you read the
transcript of the cut.

## Always read the transcript OF THE CUT

Build a phrase-level transcript on the **output timeline**
(`output_time = word.start - segment_start + segment_offset`, Hard Rule 5) and
read it before building anything on top. Then scan it for phrases shorter than
~0.5s: legitimate interjections ("¿ok?", "Entonces,", "Dos:") are fine, but
0.01–0.09s fragments are residue from a drop boundary.

Residue found this way, across videos: a 0.01s `"pasa."`, slivers of
`"Entonces,"` and `"por...?"`, a decapitated `"Dos:"` that left a sentence
starting mid-phrase, a `"comentario,"` cut in half, and a `"y escala."` clipped
because a drop started 20ms too early.

**Every video has had at least one of these.** It is the single highest-value
check in the whole pipeline and it costs one file read.

## Windows: force UTF-8 when invoking render.py

```bash
PYTHONUTF8=1 PYTHONIOENCODING=utf-8 python render.py edl.json -o out.mp4 ...
```

Without it, two failures, both from Python defaulting to cp1252:

1. Any `print()` with a non-cp1252 character (there's a `→` in one of
   `render.py`'s log lines) raises `UnicodeEncodeError` and kills the run.
2. `json.loads(edl_path.read_text())` reads the EDL as cp1252. Accented source
   filenames (very likely for Spanish titles) turn to mojibake and produce a
   path that doesn't exist, failing deep inside `extract_segment`.

Belt and braces: keep an ASCII-only source key in the EDL (`src_v2` →
`C:\...\src_v2.mkv`) and the mojibake path disappears entirely.

`transcribe.py` has a related trap: it resolves its cache directory **relative
to the input path**, not to the edit directory. Calling it from `Videos/` with
`edit/final.mp4` writes to `edit/edit/transcripts/`, and the next tool that
looks in `edit/transcripts/` fails with `FileNotFoundError`. Pass paths whose
parent is already the edit directory, or move the JSON afterwards.

## render.py cannot burn subtitles on Windows

`build_final_composite` builds the subtitle path as:

```python
str(subtitles_path.resolve()).replace(":", r"\:")
```

It escapes the drive colon but leaves the backslashes, which the filtergraph
parser then eats as escape characters. ffmpeg fails with "No such file or
directory". This only bites when subtitles are actually requested — EDLs
without them never touch the code path.

Workaround without patching the shared helper: reimplement **only** the
composite step, run ffmpeg with `cwd` = the edit directory, and pass the SRT as
a bare relative filename — no colon, no backslash, nothing to escape. The
extract and concat stages of `render.py` are fine and should still be used.

## libass sizing: MarginV and FontSize are NOT pixels

They're ASS *script* units. An SRT carries no `PlayRes`, so libass assumes a
288-high script and everything scales by `1080/288 = 3.75`.

That's why the house style's `MarginV=90` renders ~337px above the bottom edge
— floating in the middle of the frame, not pinned to the bottom. For ~67px real,
use `MarginV=18`. Same scaling applies to `FontSize`.

This matters even when subtitles are off, because it invalidates the obvious
"reserve the bottom 140px for captions" instruction to overlay agents: captions
actually land around y≈700, right in the overlay working band.

For Inter (or any non-system font) also pass `fontsdir=` pointing at the kit's
`public/fonts` — libass won't find it otherwise and will silently substitute.

Note: SRTs written by `render.py` on Windows end up with `\r\r\n` line endings
(text mode translating an already-`\r\n` string). Reading them with universal
newlines inserts a blank line between every row and breaks any block-based
parser. Parse by lines, stripping `\r`.

## Write the sidecar SRT yourself — don't use `--build-subtitles`

Subtitles ship as a `.srt` alongside the video (see the skill's Subtitles
section), and `render.py --build-subtitles` is the wrong tool for it twice over:

1. **It writes with the platform's default encoding.** On Windows that's cp1252,
   so `"Sí"` lands as the bytes `53 CD` and every accent, `ñ`, `¿` and `¡` in the
   file is corrupted. The file still *opens*, which is how it gets shipped.
   Write with `encoding="utf-8-sig"` — the BOM makes YouTube and VLC detect it
   unambiguously.
2. **It emits the `bold-overlay` style**: 2-word UPPERCASE chunks, designed to be
   burned into vertical video. As a selectable YouTube track it's unreadable —
   no punctuation to follow and the eye resetting every ~200ms.

A sidecar track wants sentence case with real punctuation, breaking on sentence
end / a pause ≥0.45s / ~84 chars / 14 words / 6s, wrapped onto two lines at the
space nearest the middle. That lands around 198 cues and ~48 chars/cue for a
9-minute talking head, versus 961 cues from the overlay style.

Two things to verify after writing, both of which have shipped broken:

- **Millisecond truncation.** `f"{int(s):06.3f}"` casts to int *before*
  formatting, so every timestamp comes out squared to the whole second
  (`00:00:01,000`). It looks plausible at a glance and desyncs up to half a
  second per cue. Assert that most cues have non-zero milliseconds.
- **Overlaps.** Clamp each cue's end to `next_start - 0.02` after enforcing any
  minimum duration, then assert zero overlaps and zero non-positive durations.

## Self-eval for a cuts-only video

The three contact sheets in the main skill assume cutaways and alpha overlays.
With neither, only the boundary sheet has anything to say — and on a locked-off
talking head even that mostly shows expected jump cuts. Two checks replace them:

**Audio pops at the joins.** The 30ms fades are applied per segment *before* the
concat, so a failure shows up as a sample-to-sample discontinuity at the exact
seam. Decode a 0.5s PCM window around each join and compare the largest step in
the middle 3ms against the 99.9th percentile of the rest of the window:

```python
d = np.abs(np.diff(pcm_window))
ratio = d[mid-half:mid+half].max() / np.percentile(near, 99.9)   # pop si > 3
```

Healthy joins land at ratio 0.00–0.10 — the seam is *quieter* than the speech
around it, which is exactly what the fades should produce.

**Do not measure this with `astats`.** Its output goes to loglevel `info`, so
with `-v error` it prints nothing, the parse yields `nan`, and every comparison
against `nan` is `False` — the check reports a confident **"ok" on all joins
without having measured anything.** A verification that cannot fail is worse
than no verification.

**What the words actually are at each join.** Re-transcribe the render and print
its words on both sides of every join. Read the *sequence*, and expect two
artifacts that are not defects:

- Scribe's trailing-silence padding (Trap 1) gives the last word of a phrase an
  end time past the join, so `"vámonos."`, `"disfrazado."`, `"terminar,"` appear
  in neither the before nor the after column. They are in the audio.
- A word-by-word diff of render-transcript vs. EDL-predicted is **too noisy to
  be a gate**: Scribe non-deterministically renders the same audio as `"250"` or
  `"doscientos cincuenta"`, `"looks maxim"` or `"lux maxing"`. On one video 30 of
  30 "divergences" were ASR variance. Before chasing one, compute its distance
  to the nearest join — anything mid-segment is untouched audio by construction.

## Grade is baked at extraction — plan around it

`render.py` applies the EDL's `grade` during **per-segment extraction**. Two
consequences:

- A raw ffmpeg filter string in `grade` works, and because extraction is
  per-segment, anything frame-indexed restarts at each cut. That's how the
  per-cut zoom was implemented: `zoompan` with `on` (output frame number)
  naturally resets to 0 for every segment, so each cut gets its own push and
  the reset hides inside the cut. No piecewise timeline expression needed.
  Single quotes around `z`/`x`/`y` are load-bearing — they protect the commas
  inside `min()`/`pow()` from being parsed as filter separators.
- **Changing `grade` costs a full re-extraction** (~10 min) *and* invalidates
  the drift table, because `zoompan` forces exact output fps and changes every
  segment's duration. Re-extract → rebuild EDL → compose, in that order.

On the zoom itself (rejected by the user, documented in case it returns): at
**5%** it reads as *janky*, not subtle — the per-frame motion is so small that
`zoompan`'s integer rounding of the crop origin is larger than the movement
itself. At 30% the motion dominates and looks smooth. And since the source is
1080p, ending a push at 130% means the shot spends most of its time at ~77% of
native resolution; the `130% → 100%` direction avoids that but the user chose
the classic push-in knowingly.

## Loudness

Two-pass loudnorm to −14 LUFS / −1 dBTP / LRA 11, video stream-copied so it's
fast and lossless on the picture. Measure, then apply with the measured values.

Worth doing even when it seems unnecessary: one source measured **+2.16 dBTP**
— it was clipping — and another sat at −29.58 LUFS, nearly 16 dB quiet.
Delivered results land around −14.2 to −14.5 LUFS. **True peak is the part to
check, not assume.** loudnorm's dynamic mode is imprecise on TP even with
`linear=true`: outputs have come out anywhere from −0.15 to −0.62 dBTP, and
once at **+0.07 dBTP** — above zero, i.e. clipping on playback. Always measure
the finished file, and if TP lands above about −0.2, run a limiter over it
(video stream-copied, so it's quick):

```bash
ffmpeg -i in.mp4 -map 0:v -map 0:a -c:v copy   -af "alimiter=limit=0.891:attack=5:release=50:level=disabled"   -c:a aac -b:a 192k -ar 48000 out.mp4
```

**`limit=0.891` is often not enough — use `0.794`.** 0.891 is −1 dBFS on *sample*
peak, and an earlier version of this note claimed inter-sample true peak then
lands around −0.4 dBTP. On one video it didn't: an output measuring −0.18 dBTP
came back at **−0.16 dBTP** after the limiter, barely moved. The limiter caps
sample peak, and the AAC re-encode that follows reintroduces inter-sample peaks
above it, so a 1 dB ceiling leaves nothing to absorb them.

`limit=0.794` (−2 dBFS) landed the same file at **−1.3 dBTP** and cost only
0.2 LUFS (−14.45 → −14.67, still in spec). Start there.

Two process notes: apply the limiter to the **loudnorm output**, not to an
already-limited file, or you double-limit; and keep that intermediate around
(`final_*_nolimit.mp4`) so you can retry at a different ceiling without redoing
the composite. Worth wiring the measure-and-limit decision into the compose
script rather than doing it by hand — it runs on every delivery anyway.

Parsing pass 1: write ffmpeg's stderr to a **file** and read it back, rather
than `capture_output=True` — the in-memory capture came back empty once and a
file is easy to inspect when parsing fails. Add `-nostats` to keep the progress
spam out.

## `base.mp4` has shipped truncated — measure it, never assume

On one video `render.py` extracted all 22 segments correctly (they summed to
1055.47s in `clips_graded/`), printed `concat → base.mp4`, produced its own
downstream output, and **exited 0** — while `base.mp4` itself was
**550.8s, barely half the cut**. Nothing in the log said so.

The gate in the pipeline caught it, which is exactly why it's a gate:

```bash
ffprobe -v error -show_entries format=duration -of csv=p=0 base.mp4
# compare against edl.json's total_duration_s (expect it a few tenths LONGER —
# that's the frame-rounding drift, never shorter)
```

Recovery is cheap because the expensive part — extraction — is already done.
Rebuild the concat by hand from `clips_graded/` and re-probe:

```bash
python - <<'PY'
import io, json
edl = json.load(io.open('edl.json', encoding='utf-8'))
stem = list(edl['sources'])[0]
with io.open('concat.txt', 'w', encoding='utf-8') as f:
    for i in range(len(edl['ranges'])):
        f.write(f"file 'clips_graded/seg_{i:02d}_{stem}.mp4'\n")
PY
ffmpeg -y -v error -f concat -safe 0 -i concat.txt -c copy -movflags +faststart base.mp4
```

**Rebuild the drift table after this**, since `build_edl_*_final.py` measures
`clips_graded/` rather than the base — in this case it was unaffected, but any
re-extraction invalidates it.

## Don't point `render.py -o` at `base.mp4`

Extraction and concat are the expensive part and they're all you want when you
are only building the base. But `render.py` always runs its composite step
afterwards, and with no overlays that step degenerates into
`ffmpeg -i base.mp4 -c copy base.mp4` — same file as input and output — which
fails and makes the whole run exit 1.

The extraction and the concat have already succeeded at that point, so the base
is fine and you should not re-run anything. Verify it directly instead of
trusting the exit code: count the files in `clips_graded/` and `ffprobe` the
base's duration against the cut's `total_duration_s` (expect it a little longer
— that's the frame-rounding drift). Writing to a different name avoids the
error entirely.

## The composite is slow, and the progress log lies about how slow

A 21-segment / 33-overlay composite of an 18-minute 1080p60 video runs about
**48 fps, so ~23 minutes**. Budget for it.

Do not estimate progress from `tail -c` on the log. ffmpeg writes progress with
carriage returns and the tail you read back is often a partially flushed chunk,
so two samples taken minutes apart can appear to show almost no movement — it
looks like the render has stalled when it's running fine. Grep the **whole**
log for the last `frame=` instead, and sample twice with a known sleep between:

```bash
F1=$(grep -aoE "frame= *[0-9]+" log | tail -1 | tr -d ' ' | cut -d= -f2)
sleep 90
F2=$(grep -aoE "frame= *[0-9]+" log | tail -1 | tr -d ' ' | cut -d= -f2)
echo "$(( (F2-F1)/90 )) fps"
```

ffmpeg's own `speed=` field is also misleading here: it's averaged from process
start and includes the long setup where 34 inputs are opened, so it reads low
early on and never catches up.

## Verify what actually happened, not the exit code

This pattern lies:

```bash
cmd > log 2>&1; echo "EXIT=$?"     # reports 0 because `echo` succeeded
```

A render reported success while `build_final_composite` had thrown. Check for
`render.py`'s own `done: <path>` line, or an exit code written *inside* the log,
and `ffprobe` the output file's existence and duration.

Related: `ffmpeg`'s `-stats` output floods a captured log with thousands of
progress lines. Either drop `-stats` or grep the log rather than tailing it.

## Contact sheets: `tile` needs a frame sequence

`tile=NxM` operates on **one input stream of successive frames**, not on N
separate `-i` inputs. Feeding it N inputs silently produces just the first
tile. Renumber the stills into a `%03d` sequence and feed them through the
image2 demuxer:

```bash
ffmpeg -y -framerate 1 -i seq/f%03d.png \
  -vf tile=6x3:margin=6:padding=4:color=#202020 -frames:v 1 sheet.png
```

Also: name the temp stills by index, not by timestamp — two sample times that
round to the same integer will collide and overwrite each other.
