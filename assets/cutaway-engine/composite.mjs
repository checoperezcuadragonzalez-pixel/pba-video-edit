// Builds the ffmpeg overlay chain that drops each rendered cutaway clip onto
// the master VSL at its exact timestamp, keeping the original narration audio
// untouched throughout (per pba-video-edit skill: opaque overlays, not spliced ranges).
import { readFileSync, writeFileSync } from 'fs';
import { execFileSync } from 'child_process';

const contentPath = process.argv[2] || 'content.json';
const MAIN = process.argv[3] || 'C:/Users/Checo Perezcuadra/Downloads/svleditado.mp4';
const OUT = process.argv[4] || 'C:/Users/Checo Perezcuadra/Downloads/svleditado_motion_v2.mp4';

const content = JSON.parse(readFileSync(contentPath, 'utf8'));

const args = ['-y', '-i', MAIN];
for (const e of content) {
  args.push('-itsoffset', String(e.start), '-i', `out/${e.id}.mp4`);
}

let filter = '';
let prev = '0:v';
content.forEach((e, i) => {
  const idx = i + 1;
  const outLabel = i === content.length - 1 ? 'vout' : `v${idx}`;
  filter += `[${prev}][${idx}:v]overlay=0:0:eof_action=pass:enable='between(t,${e.start},${e.end})'[${outLabel}];`;
  prev = outLabel;
});
filter = filter.slice(0, -1); // drop trailing ;

writeFileSync('filter_complex.txt', filter);

args.push(
  '-filter_complex', filter,
  '-map', '[vout]', '-map', '0:a',
  '-c:v', 'libx264', '-preset', 'medium', '-crf', '16', '-pix_fmt', 'yuv420p',
  '-c:a', 'copy',
  OUT
);

writeFileSync('composite_args.json', JSON.stringify(args, null, 2));
console.log(`Composite command staged for ${content.length} overlays.`);
console.log(`Run: ffmpeg (args in composite_args.json) -> ${OUT}`);

if (process.argv.includes('--run')) {
  console.log('Running composite now (this will take a while)...');
  execFileSync('ffmpeg', args, { stdio: 'inherit' });
  console.log('Done ->', OUT);
}
