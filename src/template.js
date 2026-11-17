/* Builds the HTML of one profile page from a cleaned-up profile.
 * Used by build.js and by the live preview in admin.html. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./core'), require('./icons'), require('./styles'));
  else root.NFCTemplate = factory(root.NFCCore, root.NFCIcons, root.NFCStyles);
})(typeof self !== 'undefined' ? self : this, function (core, icons, css) {
  var esc = core.esc, icon = icons.icon;

  function ext(url) { return /^https?:/i.test(url) ? ' target="_blank" rel="noopener"' : ''; }

  /* opts:
   *   photoSrc  - what to put in <img src> ('' = show initials)
   *   pageUrl   - full public address of this page ('' if unknown)
   *   photoUrl  - full public address of the photo, for link previews
   *   vcfHref   - link to the .vcf file
   *   qrSrc     - link to the QR image ('' = no QR in the share box)
   *   brand     - { name, url } shown as "Powered by" ({} = hidden)
   *   analytics - { enabled, endpoint }
   */
  function render(p, opts) {
    opts = opts || {};
    var t = p.labels;
    var brand = opts.brand || {};
    var an = opts.analytics || {};

    var style = '';
    if (p.accent) style = ' style="--accent:' + p.accent + ';--on-accent:' + core.contrastOn(p.accent) + (p.theme === 'light' ? ';--icon:' + p.accent : '') + '"';

    var role = '';
    if (p.title && p.company) role = esc(p.title) + ' · <b>' + esc(p.company) + '</b>';
    else if (p.title) role = esc(p.title);
    else if (p.company) role = '<b>' + esc(p.company) + '</b>';

    var quick = [];
    function q(href, ic, label, track) {
      if (href) quick.push('<a href="' + esc(href) + '"' + ext(href) + ' data-track="' + track + '"><span class="ico-wrap">' + icon(ic) + '</span><span class="t">' + esc(label) + '</span></a>');
    }
    q(p.telHref, 'phone', t.call, 'call');
    q(p.waHref, 'whatsapp', t.whatsapp, 'whatsapp');
    q(p.mailHref, 'mail', t.email, 'email');
    q(p.mapsUrl, 'map', t.maps, 'maps');

    var rows = [];
    function row(href, ic, label, sub, track) {
      rows.push('<li><a href="' + esc(href) + '" target="_blank" rel="noopener" data-track="' + esc(track) + '"><span class="ico-wrap">' + icon(ic) + '</span>' +
        '<span class="txt"><b>' + esc(label) + '</b>' + (sub ? '<small>' + esc(sub) + '</small>' : '') + '</span>' + icon('chevron').replace('class="ico"', 'class="ico go"') + '</a></li>');
    }
    if (p.website) row(p.website, 'globe', t.website, core.prettyUrl(p.website), 'website');
    p.socials.forEach(function (s) { row(s.url, s.key, s.label, s.handle, s.key); });
    p.links.forEach(function (l) { row(l.url, 'link', l.label, core.prettyUrl(l.url), 'link'); });

    var desc = [p.title, p.company].filter(Boolean).join(' · ') || p.bio;
    var avatar = opts.photoSrc
      ? '<img src="' + esc(opts.photoSrc) + '" alt="' + esc(p.name) + '" width="124" height="124" decoding="async">'
      : '<span aria-hidden="true">' + esc(p.initials) + '</span>';

    var themeColor = { light: '#f3f2ee', dark: '#0b0d10', gold: '#0e0c08', colourful: '#e8453c' }[p.theme];

    var cfg = { url: opts.pageUrl || '', copied: t.copied, copy: t.copy };
    if (an.enabled) { cfg.slug = p.slug; cfg.endpoint = an.endpoint || ''; }

    var h = '<!doctype html>\n<html lang="' + p.lang + '" dir="' + p.dir + '" data-theme="' + p.theme + '"' + style + '>\n<head>\n' +
      '<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n' +
      '<title>' + esc(p.name) + (p.company ? ' · ' + esc(p.company) : '') + '</title>\n' +
      (desc ? '<meta name="description" content="' + esc(desc) + '">\n' : '') +
      '<meta name="theme-color" content="' + themeColor + '">\n' +
      '<meta property="og:type" content="profile">\n<meta property="og:title" content="' + esc(p.name) + '">\n' +
      (desc ? '<meta property="og:description" content="' + esc(desc) + '">\n' : '') +
      (opts.pageUrl ? '<meta property="og:url" content="' + esc(opts.pageUrl) + '">\n<link rel="canonical" href="' + esc(opts.pageUrl) + '">\n' : '') +
      (opts.photoUrl ? '<meta property="og:image" content="' + esc(opts.photoUrl) + '">\n' : '') +
      '<meta name="twitter:card" content="summary">\n' +
      (opts.photoSrc ? '<link rel="icon" href="' + esc(opts.photoSrc) + '">\n' : '<link rel="icon" href="data:,">\n') +
      '<style>' + css + '</style>\n</head>\n<body>\n<main class="page">\n' +
      '<div class="cover"></div>\n<header class="hero">\n<div class="avatar">' + avatar + '</div>\n' +
      '<h1>' + esc(p.name) + '</h1>\n' +
      (role ? '<p class="role">' + role + '</p>\n' : '') +
      (p.bio ? '<p class="bio">' + esc(p.bio).replace(/\r?\n/g, '<br>') + '</p>\n' : '') +
      '</header>\n' +
      '<a class="save" href="' + esc(opts.vcfHref || '#') + '" download="' + esc(p.slug) + '.vcf" data-track="save-contact">' + icon('save') + '<span>' + esc(t.save) + '</span></a>\n' +
      (quick.length ? '<nav class="quick">' + quick.join('') + '</nav>\n' : '') +
      (rows.length ? '<ul class="links">' + rows.join('') + '</ul>\n' : '') +
      '<footer class="foot">\n<button class="ghost" type="button" id="shareBtn" data-track="share">' + icon(opts.qrSrc ? 'qr' : 'share') + '<span>' + esc(t.share) + '</span></button>\n' +
      (brand.name ? '<div class="powered">' + esc(t.powered) + ' ' + (core.webUrl(brand.url) ? '<a href="' + esc(core.webUrl(brand.url)) + '" target="_blank" rel="noopener">' + esc(brand.name) + '</a>' : esc(brand.name)) + '</div>\n' : '') +
      '</footer>\n</main>\n' +
      '<dialog id="sheet" aria-label="' + esc(t.share) + '"><div class="sheet">' +
      (opts.qrSrc ? '<img src="' + esc(opts.qrSrc) + '" alt="QR" width="220" height="220" loading="lazy"><p>' + esc(t.scan) + '</p>' : '') +
      '<div class="row"><button type="button" class="pri" id="copyBtn">' + icon('copy') + '<span>' + esc(t.copy) + '</span></button>' +
      '<button type="button" id="closeBtn">' + esc(t.close) + '</button></div></div></dialog>\n' +
      '<script>(' + pageScript.toString() + ')(' + JSON.stringify(cfg).replace(/</g, '\\u003c') + ')</script>\n</body>\n</html>\n';
    return h;
  }

  /* Runs in the visitor's phone. Kept tiny. No cookies, nothing stored. */
  function pageScript(c) {
    var d = document, sheet = d.getElementById('sheet'), url = c.url || location.href.split(/[?#]/)[0];
    d.getElementById('shareBtn').addEventListener('click', function () {
      if (sheet.showModal) sheet.showModal(); else sheet.setAttribute('open', '');
    });
    d.getElementById('closeBtn').addEventListener('click', function () { sheet.close(); });
    sheet.addEventListener('click', function (e) { if (e.target === sheet) sheet.close(); });
    d.getElementById('copyBtn').addEventListener('click', function () {
      var label = this.querySelector('span');
      function done() { label.textContent = c.copied; setTimeout(function () { label.textContent = c.copy; }, 1800); }
      if (navigator.clipboard) navigator.clipboard.writeText(url).then(done, function () { prompt('', url); });
      else prompt('', url);
    });
    /* Optional click counting - only present when switched on in site.config.json.
       Sends: which profile, which button, and today's date. Nothing about the visitor. */
    if (!c.slug) return;
    function send(action) {
      var data = { slug: c.slug, action: action, day: new Date().toISOString().slice(0, 10) };
      try { window.dispatchEvent(new CustomEvent('nfc:click', { detail: data })); } catch (e) {}
      if (!c.endpoint || navigator.doNotTrack === '1') return;
      try { navigator.sendBeacon(c.endpoint, JSON.stringify(data)); } catch (e) {}
    }
    send('view');
    d.addEventListener('click', function (e) {
      var a = e.target.closest && e.target.closest('[data-track]');
      if (a) send(a.getAttribute('data-track'));
    });
  }

  return { render: render };
});
