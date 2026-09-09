/**
 * Playwright frame capturer — seekable GSAP HTML → PNG sequence
 * Usage: node renderer.mjs <html-file> <duration-s> <fps> <out-dir>
 */
import { chromium } from 'playwright';
import path from 'path';
import { mkdirSync, existsSync, rmSync, readFileSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const [,, htmlFile, durationStr, fpsStr, outDir] = process.argv;

if (!htmlFile || !durationStr || !fpsStr || !outDir) {
  console.error('Usage: node renderer.mjs <html-file> <duration> <fps> <out-dir>');
  process.exit(1);
}

const duration = parseFloat(durationStr);
const fps      = parseInt(fpsStr);
const frames   = Math.round(duration * fps);
const htmlPath = path.resolve(htmlFile).replace(/\\/g, '/');
const gsapPath = path.join(__dirname, 'node_modules', 'gsap', 'dist', 'gsap.min.js');
const gsapContent = readFileSync(gsapPath, 'utf8');

console.log(`Rendering ${frames} frames (${duration}s @ ${fps}fps)`);
console.log(`  source: ${htmlPath}`);
console.log(`  output: ${outDir}`);

if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });

console.log('  launching browser...');
const browser = await chromium.launch({ args: ['--no-sandbox'] });

const context = await browser.newContext({ viewport: { width: 1920, height: 1080 } });
const page    = await context.newPage();

console.log('  loading page...');
await page.goto(`file:///${htmlPath}`, { waitUntil: 'domcontentloaded', timeout: 15000 });

console.log('  injecting GSAP...');
// addScriptTag injects as <script> tag — no return-value serialization issue
await page.addScriptTag({ content: gsapContent });

console.log('  calling __init...');
// Explicitly return undefined to avoid serialization of GSAP objects
await page.evaluate('window.__init(); undefined');

console.log('  waiting for ready...');
await page.waitForFunction(() => window.ready === true, { timeout: 10000 });

await page.evaluate('window.seek(0); undefined');

console.log('  capturing frames...');
for (let i = 0; i < frames; i++) {
  const t = i / fps;
  await page.evaluate((t) => { window.seek(t); }, t);
  await page.screenshot({
    path: `${outDir}/frame_${String(i).padStart(4, '0')}.png`,
    omitBackground: true,
  });
  if (i % fps === 0) process.stdout.write(`\r  frame ${i}/${frames} (t=${t.toFixed(2)}s)  `);
}

await browser.close();
console.log(`\n  done`);
