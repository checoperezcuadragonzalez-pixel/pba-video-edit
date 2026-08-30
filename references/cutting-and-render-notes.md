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
MAX_WORD = 1.0
for w in words:
    w["wend"] = min(w["end"], w["start"] + MAX_WORD)
```

No real word lasts longer than a second, so this is safe and it makes both
failure modes go away.

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

`limit=0.891` is −1 dBFS on sample peak; inter-sample true peak lands a little
above that, around −0.4 dBTP, which is safe.

Parsing pass 1: write ffmpeg's stderr to a **file** and read it back, rather
than `capture_output=True` — the in-memory capture came back empty once and a
file is easy to inspect when parsing fails. Add `-nostats` to keep the progress
spam out.

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
