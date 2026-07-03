#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function readFile(p) {
  try { return fs.readFileSync(p, 'utf8'); } catch (e) { return ''; }
}

function extractBlock(css, selector) {
  const re = new RegExp(selector.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&') + '\\\s*\\{([\\s\\S]*?)\\}','m');
  const m = css.match(re);
  return m ? m[1] : '';
}

function parseVars(block) {
  const vars = {};
  const re = /--([a-zA-Z0-9-_]+)\s*:\s*([^;]+);/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    vars['--' + m[1]] = m[2].trim();
  }
  return vars;
}

function hexToRgb(hex) {
  hex = hex.replace('#','').trim();
  if (hex.length === 3) hex = hex.split('').map(c=>c+c).join('');
  const num = parseInt(hex,16);
  return {r:(num>>16)&255, g:(num>>8)&255, b:num&255, a:1};
}

function parseColor(str) {
  str = str.trim();
  if (!str) return null;
  if (str.startsWith('#')) return hexToRgb(str);
  const rgba = /rgba?\(([^)]+)\)/.exec(str);
  if (rgba) {
    const parts = rgba[1].split(',').map(p=>p.trim());
    const r = parseInt(parts[0],10);
    const g = parseInt(parts[1],10);
    const b = parseInt(parts[2],10);
    const a = parts[3] !== undefined ? parseFloat(parts[3]) : 1;
    return {r,g,b,a};
  }
  // fallback: try numeric rgb words or named colors (not supported)
  return null;
}

function blend(bg, fg) {
  // bg, fg: {r,g,b,a}
  const a = fg.a + bg.a * (1 - fg.a);
  if (a === 0) return {r:0,g:0,b:0,a:0};
  const r = Math.round((fg.r * fg.a + bg.r * bg.a * (1 - fg.a)) / a);
  const g = Math.round((fg.g * fg.a + bg.g * bg.a * (1 - fg.a)) / a);
  const b = Math.round((fg.b * fg.a + bg.b * bg.a * (1 - fg.a)) / a);
  return {r,g,b,a};
}

function srgb2lin(c) {
  c = c/255;
  return c <= 0.03928 ? c/12.92 : Math.pow((c+0.055)/1.055, 2.4);
}

function luminance(col) {
  return 0.2126 * srgb2lin(col.r) + 0.7152 * srgb2lin(col.g) + 0.0722 * srgb2lin(col.b);
}

function contrast(a, b) {
  const L1 = luminance(a);
  const L2 = luminance(b);
  const hi = Math.max(L1,L2);
  const lo = Math.min(L1,L2);
  return (hi + 0.05) / (lo + 0.05);
}

function ensureColor(val, fallback) {
  const c = parseColor(val);
  if (!c) return null;
  if (c.a < 1 && fallback) {
    const fb = parseColor(fallback) || {r:0,g:0,b:0,a:1};
    return blend(fb, c);
  }
  return c;
}

function run() {
  const repoRoot = path.resolve(__dirname, '..');
  const globalCss = readFile(path.join(repoRoot, 'src', 'styles', 'global.css'));
  const lightCss = readFile(path.join(repoRoot, 'src', 'styles', 'lightTheme.css'));

  const rootBlock = extractBlock(globalCss, ':root');
  const themeLightBlock = extractBlock(globalCss, '.theme-light');
  const varsRoot = parseVars(rootBlock);
  const varsLight = parseVars(themeLightBlock);

  // merge and prefer theme-light for light theme
  const darkVars = Object.assign({}, varsRoot);
  const lightVars = Object.assign({}, varsRoot, varsLight);

  const checkTextVars = ['--text','--text-secondary','--text-muted','--text-inverse'];
  const bgVars = ['--bg','--bg-strong'];

  console.log('Theme Audit — Contrast checks (WCAG AA target >= 4.5 for normal text)');
  console.log('Scanning variables from src/styles/global.css');
  console.log('');

  function report(themeName, vars) {
    console.log('--- ' + themeName + ' ---');
    const bg = vars['--bg'] || '#000000';
    const bgColor = parseColor(bg) || hexToRgb('#000000');
    if (!bgColor.a) bgColor.a = 1;

    for (const tv of checkTextVars) {
      const tvVal = vars[tv];
      if (!tvVal) continue;
      let textColor = parseColor(tvVal);
      if (!textColor) { console.log(tv + ': unsupported format -> ' + tvVal); continue; }
      if (textColor.a < 1) textColor = blend(bgColor, textColor);
      const ratio = contrast(textColor, bgColor);
      const pass = ratio >= 4.5 ? 'PASS' : 'FAIL';
      console.log(`${tv} vs --bg: ${ratio.toFixed(2)} (${pass}) — ${tvVal}`);
    }
    console.log('');
  }

  report('Dark (root variables)', darkVars);
  report('Light (.theme-light)', lightVars);
}

run();
