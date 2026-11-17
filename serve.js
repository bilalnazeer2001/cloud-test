#!/usr/bin/env node
/* Preview the built site on your own computer:
 *
 *   node serve.js
 *
 * then open the address it prints. Press Ctrl+C to stop. Not used on the live site. */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const DIST = path.join(__dirname, 'dist');
const PORT = Number(process.env.PORT) || 8080;
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.vcf': 'text/vcard; charset=utf-8', '.json': 'application/json'
};

if (!fs.existsSync(DIST)) { console.error('\nThere is no dist folder yet. Run:  node build.js\n'); process.exit(1); }
const slugs = () => fs.readdirSync(DIST).filter(d => fs.existsSync(path.join(DIST, d, 'index.html')));

http.createServer((req, res) => {
  let p;
  try { p = decodeURIComponent(req.url.split('?')[0]); } catch (e) { p = '/'; }
  if (p === '/_all') {   // handy list of every profile - exists only in this local preview
    res.writeHead(200, { 'Content-Type': TYPES['.html'] });
    return res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>All profiles</title>' +
      '<body style="font-family:system-ui;max-width:480px;margin:40px auto;padding:0 16px"><h1>All profiles</h1><ul>' +
      slugs().map(s => '<li style="margin:10px 0"><a href="/' + s + '/">' + s + '</a> &nbsp; <a href="/' + s + '/qr.png">QR</a></li>').join('') + '</ul></body>');
  }
  let file = path.join(DIST, path.normalize(p));
  if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
    if (!p.endsWith('/')) { res.writeHead(301, { Location: p + '/' }); return res.end(); }
    file = path.join(file, 'index.html');
  }
  if (!fs.existsSync(file)) {
    res.writeHead(404, { 'Content-Type': TYPES['.html'] });
    return res.end(fs.readFileSync(path.join(DIST, '404.html')));
  }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}).listen(PORT, () => {
  console.log('\nPreview is running. Open this in your browser:\n\n  http://localhost:' + PORT + '/_all\n\nPress Ctrl+C to stop.\n');
});
