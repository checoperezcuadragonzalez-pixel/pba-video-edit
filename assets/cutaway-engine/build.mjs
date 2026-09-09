// Generates one self-contained HTML per cutaway card from content.json.
// Contract required by ../renderer.mjs: window.__init(), window.seek(t), window.ready
const CSS = `<link rel="stylesheet" href="../brand/engine.css">`;

function esc(s) { return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;'); }

// Split a headline into <span class="word"> tokens, preserving \n as <br>.
// If emphasisWord is given, the matching word (punctuation-insensitive) gets the gold-text treatment.
function splitWords(text, emphasisWord) {
  const emphNorm = emphasisWord ? emphasisWord.toLowerCase() : null;
  return text.split('\n').map(line =>
    line.split(' ').map(w => {
      const bare = w.toLowerCase().replace(/[.,!?]/g, '');
      const cls = emphNorm && bare === emphNorm ? 'word gold-text' : 'word';
      return `<span class="${cls}">${esc(w)}</span>`;
    }).join(' ')
  ).join('<br>');
}
function wordCount(text) {
  return text.split('\n').join(' ').split(' ').filter(Boolean).length;
}

function bgMarkup() {
  return `<div class="stage"></div><div class="bg-glow" id="glow"></div><div class="bg-grain"></div>`;
}

function kickerMarkup(kicker, x, y, ruleWidth) {
  if (!kicker) return '';
  return `
  <div class="kicker-row" id="kickerRow" style="left:${x}px; top:${y}px;">
    <div class="kicker-dot" id="kickerDot"></div>
    <div class="kicker-label" id="kickerLabel">${esc(kicker)}</div>
  </div>
  <div class="kicker-rule" id="kickerRule" style="left:${x + 24}px; top:${y + 34}px; width:${ruleWidth}px;"></div>`;
}

function jsKicker() {
  return `
  tl.fromTo('#kickerDot', {scale:0,opacity:0}, {scale:1,opacity:1,duration:0.32,ease:'expo.out'}, 0);
  tl.fromTo('#kickerLabel', {opacity:0,x:-14}, {opacity:1,x:0,duration:0.36,ease:'expo.out'}, 0.04);
  tl.fromTo('#kickerRule', {scaleX:0}, {scaleX:1,duration:0.5,ease:'expo.out'}, 0.1);`;
}

function jsHeadline(sel, startAt, stagger) {
  return `
  tl.fromTo('${sel} .word', {opacity:0,y:26,filter:'blur(9px)'}, {opacity:1,y:0,filter:'blur(0px)',duration:0.46,ease:'expo.out',stagger:${stagger}}, ${startAt});`;
}

function jsIcon(sel, startAt) {
  return `
  tl.fromTo('${sel}', {opacity:0,y:46,scale:0.6}, {opacity:1,y:0,scale:1,duration:0.55,ease:'expo.out'}, ${startAt});
  tl.to('${sel}', {scale:1.04,duration:0.22,ease:'sine.out'}, ${startAt+0.5});
  tl.to('${sel}', {scale:1,duration:0.24,ease:'sine.inOut'}, ${startAt+0.72});`;
}

function wrap(bodyHtml, initJs, duration) {
  const dur = duration || 5;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">${CSS}</head>
<body>
${bgMarkup()}
${bodyHtml}
<script>
window.__init = async function() {
  await document.fonts.ready;
  const tl = gsap.timeline({ paused: true });
  // Ambient glow drift — keeps a long static hold from reading as a frozen frame.
  tl.to('#glow', { x: 26, y: -16, opacity: 0.85, duration: ${(dur/2).toFixed(2)}, ease: 'sine.inOut', repeat: -1, yoyo: true }, 0);
${initJs}
  tl.progress(0);
  window.seek = (t) => tl.seek(t, false);
  window.ready = true;
};
</script>
</body></html>`;
}

// ---------- STATEMENT: kicker + big headline, optional emphasis word, optional subtext, optional hero emoji watermark ----------
function tplStatement(d) {
  const big = wordCount(d.headline) <= 6;
  const fs = big ? 88 : 58;
  const iconMarkup = d.icon ? `<div class="hero-icon" id="hero" style="right:130px; top:110px; font-size:220px; opacity:0.14;">${d.icon}</div>` : '';
  const subtextTop = 400 + Math.round(fs * 1.12 * 2) + 20; // reserve room for a 2-line headline
  const subtextMarkup = d.subtext ? `<div class="headline" id="subtext" style="left:150px; top:${subtextTop}px; width:1560px; font-size:${Math.round(fs*0.6)}px;">${splitWords(d.subtext, d.emphasisWord)}</div>` : '';
  const body = `
  ${iconMarkup}
  ${kickerMarkup(d.kicker, 150, 330, 90)}
  <div class="headline" id="headline" style="left:150px; top:400px; width:1560px; font-size:${fs}px;">${splitWords(d.headline, d.emphasisWord)}</div>
  ${subtextMarkup}`;
  let js = '';
  if (d.icon) js += `
  gsap.set('#hero', {opacity:0, scale:0.85, y:24});
  tl.to('#hero', {opacity:0.14, scale:1, y:0, duration:1.1, ease:'expo.out'}, 0);`;
  if (d.kicker) js += jsKicker();
  js += jsHeadline('#headline', d.kicker ? 0.14 : 0.05, big ? 0.05 : 0.03);
  if (d.subtext) js += jsHeadline('#subtext', 0.85, 0.04);
  return wrap(body, js, d.end - d.start);
}

// ---------- STAT: case-study hero number with count-up ----------
function tplStat(d) {
  const body = `
  ${kickerMarkup(d.kicker, 150, 260, 90)}
  <div class="icon-badge" id="avatar" style="left:150px; top:360px; width:96px; height:96px; font-size:52px;">${d.icon || '🧑'}</div>
  <div class="headline" id="name" style="left:270px; top:378px; width:1000px; font-size:36px; font-weight:700;">${splitWords(d.name)}</div>
  <div class="body-line" id="detail" style="left:270px; top:426px; width:1000px; font-size:22px;">${esc(d.detail || '')}</div>
  <div class="stat-value gold-text" id="value" style="left:150px; top:520px; font-size:180px;">${esc(d.valuePrefix||'')}<span id="counter">0</span>${esc(d.valueSuffix||'')}</div>
  <div class="stat-label" id="statLabel" style="left:154px; top:730px; font-size:24px; width:900px;">${esc(d.statLabel || '')}</div>`;
  const js = `
  ${jsKicker()}
  ${jsIcon('#avatar', 0.06)}
  ${jsHeadline('#name', 0.14, 0.05)}
  tl.fromTo('#detail', {opacity:0,y:14}, {opacity:1,y:0,duration:0.35,ease:'expo.out'}, 0.26);
  tl.fromTo('#value', {opacity:0,y:30,filter:'blur(6px)'}, {opacity:1,y:0,filter:'blur(0px)',duration:0.36,ease:'expo.out'}, 0.36);
  { const counter = {v:0};
    tl.to(counter, {v:${d.valueNumber}, duration:0.95, ease:'power2.out', onUpdate:function(){
      document.getElementById('counter').textContent = Math.round(counter.v).toLocaleString('en-US');
    }}, 0.36);
  }
  tl.fromTo('#value', {backgroundPosition:'0% 0%'}, {backgroundPosition:'-120% 0%', duration:1.5, ease:'sine.inOut'}, 0.6);
  tl.fromTo('#statLabel', {opacity:0,y:10}, {opacity:1,y:0,duration:0.4,ease:'expo.out'}, 0.95);
  `;
  return wrap(body, js, d.end - d.start);
}

// ---------- LIST: staggered icon-badge rows rising into place ----------
function tplList(d) {
  const items = d.items; // [{icon, text, dim?}]
  const rowH = 92;
  const top0 = items.length >= 5 ? 380 : 430;
  const rows = items.map((it, i) => {
    const textColor = it.dim ? '#8A8A8A' : '#FAFAFA';
    return `
  <div class="icon-badge" id="ic${i}" style="left:150px; top:${top0 + i*rowH}px; width:64px; height:64px; font-size:32px; ${it.dim ? 'opacity:0.55;' : ''}">${it.icon}</div>
  <div class="body-line" id="row${i}" style="left:236px; top:${top0 + i*rowH + 14}px; width:1500px; font-size:29px; color:${textColor}; font-weight:500;">${esc(it.text)}</div>`;
  }).join('');
  const railH = items.length * rowH - (rowH - 64);
  const body = `
  ${kickerMarkup(d.kicker, 150, top0 - 130, 90)}
  <div style="position:absolute; left:180px; top:${top0+32}px; width:2px; height:${railH}px; background:rgba(250,204,21,0.35);" id="rail"></div>
  ${rows}`;
  let js = jsKicker();
  js += `tl.fromTo('#rail', {scaleY:0}, {scaleY:1, duration:${(items.length*0.16+0.35).toFixed(2)}, ease:'power1.inOut'}, 0.06);`;
  items.forEach((it, i) => {
    const t0 = 0.08 + i * 0.16;
    const finalOpacity = it.dim ? 0.55 : 1;
    js += jsIcon(`#ic${i}`, t0);
    js += `
  tl.fromTo('#row${i}', {opacity:0,x:22}, {opacity:${finalOpacity},x:0,duration:0.4,ease:'expo.out'}, ${(t0+0.06).toFixed(2)});`;
  });
  return wrap(body, js, d.end - d.start);
}

// ---------- COMPARISON: two sides, each a stat OR a paragraph, tone-driven ----------
// side = { label, value? | lines?, tone: 'muted'|'bold'|'gold', dim? }
function toneColor(tone) {
  if (tone === 'gold') return null; // handled via gold-text class
  if (tone === 'bold') return '#FAFAFA';
  return '#D9D9D9'; // muted enters at body brightness, recedes later
}
function tplComparison(d) {
  const sides = [
    { key: 'l', x: 150, w: 760, side: d.left },
    { key: 'r', x: 1060, w: 760, side: d.right },
  ];
  let body = kickerMarkup(d.kicker, 150, 260, 90);
  let js = jsKicker();
  sides.forEach(({ key, x, w, side }) => {
    const isGold = side.tone === 'gold';
    const valueClass = isGold ? 'stat-value gold-text' : 'stat-value';
    const color = toneColor(side.tone);
    body += `
  <div class="body-line" id="${key}Label" style="left:${x}px; top:400px; width:${w}px; font-size:24px; color:#8A8A8A;">${esc(side.label)}</div>`;
    if (side.value) {
      body += `
  <div class="${valueClass}" id="${key}Value" style="left:${x}px; top:450px; width:${w}px; font-size:${isGold ? 116 : 90}px; ${color ? `color:${color};` : ''}">${esc(side.value)}</div>`;
    } else {
      const lines = side.lines || [];
      body += lines.map((ln, i) => `
  <div class="body-line ${isGold ? 'gold-text' : ''}" id="${key}Line${i}" style="left:${x}px; top:${460 + i*54}px; width:${w}px; font-size:34px; font-weight:700; ${color ? `color:${color};` : ''}">${esc(ln)}</div>`).join('');
    }
    const finalOpacity = side.dim ? 0.55 : (side.tone === 'muted' ? 0.78 : 1);
    const t0 = key === 'l' ? 0.18 : 0.55;
    js += `
  tl.fromTo('#${key}Label', {opacity:0,y:16}, {opacity:${side.tone === 'muted' ? 0.7 : 1}, y:0, duration:0.4, ease:'expo.out'}, ${t0});`;
    if (side.value) {
      js += `
  tl.fromTo('#${key}Value', {opacity:0,y:24,filter:'blur(7px)'}, {opacity:${side.tone === 'muted' ? 0.9 : finalOpacity}, y:0, filter:'blur(0px)', duration:0.45, ease:'expo.out'}, ${(t0+0.08).toFixed(2)});`;
      if (side.tone === 'muted') {
        js += `
  tl.to('#${key}Value', {opacity:${finalOpacity}, duration:0.4, ease:'sine.inOut'}, ${(t0+0.75).toFixed(2)});`;
      }
      if (isGold) {
        js += `
  tl.fromTo('#${key}Value', {backgroundPosition:'0% 0%'}, {backgroundPosition:'-120% 0%', duration:1.5, ease:'sine.inOut'}, ${(t0+0.3).toFixed(2)});`;
      }
    } else {
      (side.lines || []).forEach((ln, i) => {
        js += `
  tl.fromTo('#${key}Line${i}', {opacity:0,y:18,filter:'blur(5px)'}, {opacity:${finalOpacity}, y:0, filter:'blur(0px)', duration:0.4, ease:'expo.out'}, ${(t0+0.1+i*0.1).toFixed(2)});`;
      });
    }
  });
  return wrap(body, js, d.end - d.start);
}

// ---------- DIAGRAM: center hub + satellite nodes connected by drawn lines ----------
function tplDiagram(d) {
  // d.center {icon,label}, d.nodes [{icon,label,x,y}] with x,y as 0..1920/1080 absolute anchor points
  const cx = 960, cy = 620;
  const lines = d.nodes.map((n, i) => `
    <line id="ln${i}" x1="${cx}" y1="${cy}" x2="${n.x}" y2="${n.y}" stroke="rgba(250,204,21,0.45)" stroke-width="2" stroke-dasharray="400" stroke-dashoffset="400"/>`).join('');
  const nodes = d.nodes.map((n, i) => `
  <div class="icon-badge" id="node${i}" style="left:${n.x-52}px; top:${n.y-52}px; width:104px; height:104px; font-size:44px;">${n.icon}</div>
  <div class="body-line" id="nodeLabel${i}" style="left:${n.x-110}px; top:${n.y+58}px; width:220px; text-align:center; font-size:20px; font-weight:600; color:#FAFAFA;">${esc(n.label)}</div>`).join('');
  const body = `
  ${kickerMarkup(d.kicker, 150, 200, 90)}
  <div class="headline" id="headline" style="left:150px; top:260px; width:1560px; font-size:44px;">${splitWords(d.headline || '')}</div>
  <svg width="1920" height="1080" style="position:absolute; left:0; top:0;">${lines}</svg>
  <div class="icon-badge" id="center" style="left:${cx-64}px; top:${cy-64}px; width:128px; height:128px; font-size:56px; box-shadow:inset 0 1px 0 rgba(255,255,255,0.14), 0 0 40px rgba(250,204,21,0.25), 0 14px 30px rgba(0,0,0,0.5);">${d.center.icon}</div>
  <div class="body-line" id="centerLabel" style="left:${cx-120}px; top:${cy+72}px; width:240px; text-align:center; font-size:22px; font-weight:700; color:#FACC15;">${esc(d.center.label)}</div>
  ${nodes}`;
  let js = jsKicker();
  if (d.headline) js += jsHeadline('#headline', 0.1, 0.04);
  js += jsIcon('#center', 0.15);
  js += `tl.fromTo('#centerLabel', {opacity:0,y:10}, {opacity:1,y:0,duration:0.35,ease:'expo.out'}, 0.35);`;
  d.nodes.forEach((n, i) => {
    const t0 = 0.45 + i * 0.22;
    js += `tl.to('#ln${i}', {strokeDashoffset:0, duration:0.5, ease:'power2.inOut'}, ${t0.toFixed(2)});`;
    js += jsIcon(`#node${i}`, (t0 + 0.3).toFixed(2));
    js += `tl.fromTo('#nodeLabel${i}', {opacity:0,y:10}, {opacity:1,y:0,duration:0.35,ease:'expo.out'}, ${(t0+0.5).toFixed(2)});`;
  });
  return wrap(body, js, d.end - d.start);
}

export const BUILDERS = { statement: tplStatement, stat: tplStat, list: tplList, comparison: tplComparison, diagram: tplDiagram, other: tplStatement };

export function buildCard(entry) {
  const fn = BUILDERS[entry.type] || tplStatement;
  return fn(entry);
}
