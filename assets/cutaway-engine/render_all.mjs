// Reads content.json, builds each card's HTML, renders PNG frames via ./renderer.mjs,
// then encodes each to an opaque h264 mp4 clip whose duration exactly matches (end-start).
// Requires: npm install gsap playwright && npx playwright install chromium
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { execFileSync } from 'child_process';
import { buildCard } from './build.mjs';

const contentPath = process.argv[2] || 'content.json';
const onlyId = process.argv[3]; // optional: render a single id for testing

const content = JSON.parse(readFileSync(contentPath, 'utf8'));
mkdirSync('cards', { recursive: true });
mkdirSync('out', { recursive: true });

const FPS = 60;

for (const entry of content) {
  if (onlyId && entry.id !== onlyId) continue;
  const duration = +(entry.end - entry.start).toFixed(3);
  const html = buildCard(entry);
  const htmlPath = `cards/${entry.id}.html`;
  writeFileSync(htmlPath, html);

  const framesDir = `out/${entry.id}_frames`;
  console.log(`\n=== ${entry.id} (${entry.type}, ${duration}s) ===`);
  execFileSync('node', ['./renderer.mjs', htmlPath, String(duration), String(FPS), framesDir], { stdio: 'inherit' });

  const outMp4 = `out/${entry.id}.mp4`;
  execFileSync('ffmpeg', [
    '-y', '-framerate', String(FPS), '-i', `${framesDir}/frame_%04d.png`,
    '-frames:v', String(Math.round(duration * FPS)),
    '-c:v', 'libx264', '-crf', '15', '-pix_fmt', 'yuv420p', '-movflags', '+faststart',
    outMp4
  ], { stdio: 'inherit' });
  console.log(`-> ${outMp4}`);
}
