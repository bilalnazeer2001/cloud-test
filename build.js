#!/usr/bin/env node
/* Build script: reads every file in /clients and writes a finished website to /dist.
 *
 *   node build.js
 *
 * For each client you get:
 *   dist/<slug>/index.html   the profile page
 *   dist/<slug>/contact.vcf  the "Save Contact" file
 *   dist/<slug>/qr.svg       QR code (best for printing)
 *   dist/<slug>/qr.png       QR code (for anywhere that needs a picture)
 *
 * No installs needed - it only uses what comes with Node.js. */
'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const core = require('./src/core');
const template = require('./src/template');
const qrcode = require('./vendor/qrcode-generator');

const ROOT = __dirname;
const CLIENTS = path.join(ROOT, 'clients');
const DIST = path.join(ROOT, 'dist');

const problems = [];   // stop the build
const notes = [];      // just tell the user

function readJson(file, what) {
  let text;
  try { text = fs.readFileSync(file, 'utf8').replace(/^﻿/, ''); }
  catch (e) { throw new Error('Cannot read ' + what + '.'); }
  try { return JSON.parse(text); }
  catch (e) {
    throw new Error(what + ' is not valid JSON (' + e.message + '). Tip: re-export it from admin.html instead of editing by hand.');
  }
}

// ---------- settings ----------
let site = {};
try { site = readJson(path.join(ROOT, 'site.config.json'), 'site.config.json'); }
catch (e) { console.error('\n✖ ' + e.message + '\n'); process.exit(1); }
const baseUrl = String(site.baseUrl || '').trim().replace(/\/+$/, '');
const baseIsPlaceholder = !/^https?:\/\//.test(baseUrl) || /\/\/example\.com$/.test(baseUrl);
const analytics = site.analytics && site.analytics.enabled
  ? { enabled: true, endpoint: core.webUrl(site.analytics.endpoint) } : { enabled: false };
const brand = site.brand || {};
const home = site.home || {};

// ---------- QR code ----------
function makeQr(text) {
  const qr = qrcode(0, 'M');           // 0 = pick the smallest size that fits
  qr.addData(text, 'Byte');
  qr.make();
  const n = qr.getModuleCount(), quiet = 4, size = n + quiet * 2;
  let d = '';
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (!qr.isDark(y, x)) continue;
      let w = 1;
      while (x + w < n && qr.isDark(y, x + w)) w++;
      d += 'M' + (x + quiet) + ' ' + (y + quiet) + 'h' + w + 'v1h-' + w + 'z';
      x += w - 1;
    }
  }
  const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + size + ' ' + size + '" shape-rendering="crispEdges">' +
    '<rect width="' + size + '" height="' + size + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>\n';

  // PNG, 16 pixels per square, grey-scale. Written by hand so no extra tools are needed.
  const scale = 16, px = size * scale;
  const raw = Buffer.alloc((px + 1) * px, 255);
  for (let y = 0; y < px; y++) {
    raw[y * (px + 1)] = 0;
    const my = Math.floor(y / scale) - quiet;
    if (my < 0 || my >= n) continue;
    for (let x = 0; x < px; x++) {
      const mx = Math.floor(x / scale) - quiet;
      if (mx >= 0 && mx < n && qr.isDark(my, mx)) raw[y * (px + 1) + 1 + x] = 0;
    }
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type), data]);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32 ? zlib.crc32(body) >>> 0 : crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(px, 0); ihdr.writeUInt32BE(px, 4); ihdr[8] = 8; ihdr[9] = 0;
  const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
  return { svg, png };
}
function crc32(buf) {
  let c, crc = ~0;
  for (let i = 0; i < buf.length; i++) {
    c = (crc ^ buf[i]) & 255;
    for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xEDB88320 : c >>> 1;
    crc = (crc >>> 8) ^ c;
  }
  return ~crc >>> 0;
}

// ---------- photo ----------
const PHOTO_TYPES = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', svg: 'image/svg+xml' };
/* Returns { file, vcard } - file is the name written next to the page ('' = none, or a full web address). */
function placePhoto(p, outDir, label) {
  const src = p.photo;
  if (!src) return { file: '' };
  let buf, ext;
  const data = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/=\s]+)$/.exec(src);
  if (data) {
    ext = data[1] === 'jpeg' ? 'jpg' : data[1];
    buf = Buffer.from(data[2], 'base64');
  } else if (/^https?:\/\//i.test(src)) {
    return { file: core.webUrl(src) };
  } else {
    const file = path.resolve(CLIENTS, src);
    if (!file.startsWith(CLIENTS + path.sep)) { notes.push(label + ': "photo" must be inside the clients folder - showing initials instead.'); return { file: '' }; }
    ext = path.extname(file).slice(1).toLowerCase();
    if (!PHOTO_TYPES[ext]) { notes.push(label + ': photo must be .jpg, .png, .webp or .svg - showing initials instead.'); return { file: '' }; }
    if (!fs.existsSync(file)) { notes.push(label + ': photo file "' + src + '" was not found in the clients folder - showing initials instead.'); return { file: '' }; }
    buf = fs.readFileSync(file);
  }
  if (buf.length > 400 * 1024) notes.push(label + ': the photo is ' + Math.round(buf.length / 1024) + ' KB. Pages load faster under 200 KB - admin.html shrinks photos for you.');
  const name = 'photo.' + ext;
  fs.writeFileSync(path.join(outDir, name), buf);
  const vtype = { jpg: 'JPEG', jpeg: 'JPEG', png: 'PNG' }[ext];
  return { file: name, vcard: vtype && buf.length <= 400 * 1024 ? { base64: buf.toString('base64'), type: vtype } : null };
}

// ---------- read the clients ----------
if (!fs.existsSync(CLIENTS)) { console.error('\n✖ There is no "clients" folder.\n'); process.exit(1); }
const files = fs.readdirSync(CLIENTS).filter(f => f.toLowerCase().endsWith('.json') && !f.startsWith('_')).sort();
const profiles = [];
const seen = {};
for (const f of files) {
  let raw;
  try { raw = readJson(path.join(CLIENTS, f), 'clients/' + f); }
  catch (e) { problems.push(e.message); continue; }
  const fileSlug = core.slugify(f.replace(/\.json$/i, ''));
  const r = core.normalize(raw, fileSlug);
  r.warnings.forEach(w => notes.push('clients/' + f + ': ' + w));
  if (r.errors.length) { r.errors.forEach(e => problems.push('clients/' + f + ': ' + e)); continue; }
  if (seen[r.profile.slug]) { problems.push('clients/' + f + ' and clients/' + seen[r.profile.slug] + ' both use the address "' + r.profile.slug + '". Each client needs a different one.'); continue; }
  seen[r.profile.slug] = f;
  profiles.push({ file: f, p: r.profile });
}

if (problems.length) {
  console.error('\n✖ Build stopped - please fix:\n');
  problems.forEach(m => console.error('  • ' + m));
  console.error('\nNothing was changed in the dist folder.\n');
  process.exit(1);
}

// ---------- write the site ----------
fs.rmSync(DIST, { recursive: true, force: true });
fs.mkdirSync(DIST, { recursive: true });

for (const { file, p } of profiles) {
  const out = path.join(DIST, p.slug);
  fs.mkdirSync(out, { recursive: true });
  const pageUrl = baseUrl + '/' + p.slug + '/';
  const photo = placePhoto(p, out, 'clients/' + file);
  const isRemote = /^https?:/.test(photo.file);
  const qr = makeQr(pageUrl);
  fs.writeFileSync(path.join(out, 'qr.svg'), qr.svg);
  fs.writeFileSync(path.join(out, 'qr.png'), qr.png);
  fs.writeFileSync(path.join(out, 'contact.vcf'), core.vcard(p, baseIsPlaceholder ? '' : pageUrl, photo.vcard));
  fs.writeFileSync(path.join(out, 'index.html'), template.render(p, {
    photoSrc: photo.file,
    photoUrl: !photo.file ? '' : isRemote ? photo.file : baseIsPlaceholder ? '' : pageUrl + photo.file,
    pageUrl: baseIsPlaceholder ? '' : pageUrl,
    vcfHref: 'contact.vcf',
    qrSrc: 'qr.svg',
    brand, analytics
  }));
}

// Front page + "not found" page. The front page does NOT list clients unless you switch that on.
const homeTitle = core.esc(home.title || brand.name || 'Digital Business Cards');
const shell = (title, body) => '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
  '<meta name="robots" content="noindex">\n<title>' + title + '</title>\n<link rel="icon" href="data:,">\n' +
  '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;background:#f3f2ee;color:#15171c}' +
  'main{padding:32px 20px;text-align:center;max-width:460px;width:100%;box-sizing:border-box}h1{font-size:1.7rem;margin:0 0 8px}p{color:#5f6470;margin:0}' +
  'ul{list-style:none;padding:0;margin:24px 0 0;display:grid;gap:10px}li a{display:block;padding:16px;border-radius:16px;background:#fff;border:1px solid #e4e2db;color:inherit;text-decoration:none;font-weight:600}' +
  '@media(prefers-color-scheme:dark){body{background:#0b0d10;color:#f3f4f6}p{color:#9aa1ad}li a{background:#15181d;border-color:#262b33}}</style>\n</head>\n<body>\n<main>\n' + body + '\n</main>\n</body>\n</html>\n';
const list = home.listClients
  ? '<ul>' + profiles.map(({ p }) => '<li><a href="' + p.slug + '/" lang="' + p.lang + '" dir="' + p.dir + '">' + core.esc(p.name) + '</a></li>').join('') + '</ul>' : '';
fs.writeFileSync(path.join(DIST, 'index.html'), shell(homeTitle, '<h1>' + homeTitle + '</h1>\n<p>Tap a card to open a profile.</p>' + list));
fs.writeFileSync(path.join(DIST, '404.html'), shell('Profile not found', '<h1>Profile not found</h1>\n<p>This card link is not active. Please check with the card owner.</p>'));
fs.writeFileSync(path.join(DIST, '.nojekyll'), '');

// ---------- report ----------
console.log('\n✔ Built ' + profiles.length + ' profile' + (profiles.length === 1 ? '' : 's') + ' into the dist folder:\n');
profiles.forEach(({ p }) => console.log('  ' + (p.theme + '        ').slice(0, 10) + (baseUrl || '') + '/' + p.slug + '/'));
if (notes.length) { console.log('\nThings to check:'); notes.forEach(m => console.log('  • ' + m)); }
if (baseIsPlaceholder) {
  console.log('\n⚠ "baseUrl" in site.config.json is still the example address.\n' +
    '  The QR codes point to ' + baseUrl + '/... - set your real web address and build again before printing any QR code.');
}
if (site.analytics && site.analytics.enabled && !analytics.endpoint) {
  console.log('\n⚠ Analytics is switched on but "endpoint" is empty, so nothing is sent anywhere.');
}
console.log('\nTo look at the pages on this computer:  node serve.js\n');
