/* Shared logic: cleans up client data, builds links, makes the vCard (.vcf).
 * Used by both build.js (Node) and admin.html (browser), so the live preview
 * in the admin form always matches the real pages. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NFCCore = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  var THEMES = ['light', 'dark', 'gold', 'colourful'];
  var LANGS = { en: 'ltr', ar: 'rtl', ml: 'ltr' };

  // Text shown on buttons, per language.
  var LABELS = {
    en: {
      save: 'Save Contact', call: 'Call', whatsapp: 'WhatsApp', email: 'Email', maps: 'Location',
      website: 'Website', share: 'Share', scan: 'Scan to open this profile', copy: 'Copy link',
      copied: 'Link copied', close: 'Close', powered: 'Powered by'
    },
    ar: {
      save: 'حفظ جهة الاتصال', call: 'اتصال', whatsapp: 'واتساب', email: 'البريد', maps: 'الموقع',
      website: 'الموقع الإلكتروني', share: 'مشاركة', scan: 'امسح الرمز لفتح هذا الملف', copy: 'نسخ الرابط',
      copied: 'تم نسخ الرابط', close: 'إغلاق', powered: 'بواسطة'
    },
    ml: {
      save: 'കോൺടാക്റ്റ് സേവ് ചെയ്യുക', call: 'വിളിക്കുക', whatsapp: 'വാട്സ്ആപ്പ്', email: 'ഇമെയിൽ', maps: 'ലൊക്കേഷൻ',
      website: 'വെബ്സൈറ്റ്', share: 'പങ്കിടുക', scan: 'ഈ പ്രൊഫൈൽ തുറക്കാൻ സ്കാൻ ചെയ്യുക', copy: 'ലിങ്ക് കോപ്പി ചെയ്യുക',
      copied: 'ലിങ്ക് കോപ്പി ചെയ്തു', close: 'അടയ്ക്കുക', powered: 'Powered by'
    }
  };

  // Social networks we know. "base" is put in front of a plain username.
  var SOCIALS = {
    instagram: { label: 'Instagram', base: 'https://instagram.com/' },
    facebook: { label: 'Facebook', base: 'https://facebook.com/' },
    linkedin: { label: 'LinkedIn', base: 'https://www.linkedin.com/in/' },
    x: { label: 'X', base: 'https://x.com/' },
    tiktok: { label: 'TikTok', base: 'https://www.tiktok.com/@' },
    youtube: { label: 'YouTube', base: 'https://www.youtube.com/@' },
    snapchat: { label: 'Snapchat', base: 'https://www.snapchat.com/add/' },
    telegram: { label: 'Telegram', base: 'https://t.me/' },
    threads: { label: 'Threads', base: 'https://www.threads.net/@' },
    behance: { label: 'Behance', base: 'https://www.behance.net/' },
    pinterest: { label: 'Pinterest', base: 'https://www.pinterest.com/' },
    github: { label: 'GitHub', base: 'https://github.com/' }
  };

  function str(v) { return v == null ? '' : String(v).trim(); }

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function slugify(s) {
    return str(s).toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
  }

  // Only ever allow normal web links. Adds https:// when it was left off.
  function webUrl(v) {
    v = str(v);
    if (!v) return '';
    if (!/^[a-z][a-z0-9+.-]*:/i.test(v)) v = 'https://' + v;
    if (!/^https?:\/\/[^\s/]+\.[^\s]+$/i.test(v) && !/^https?:\/\/localhost/i.test(v)) return '';
    return v.replace(/\s/g, '%20');
  }

  function prettyUrl(u) {
    return str(u).replace(/^https?:\/\/(www\.)?/i, '').replace(/\/$/, '');
  }

  function digits(v) { return str(v).replace(/[^\d+]/g, '').replace(/(?!^)\+/g, ''); }

  function socialUrl(key, value) {
    value = str(value);
    if (!value) return null;
    var def = SOCIALS[key];
    if (/^https?:\/\//i.test(value) || /^[\w-]+(\.[\w-]+)+\//.test(value)) {
      var u = webUrl(value);
      return u ? { url: u, handle: prettyUrl(u).replace(/^[^/]+\//, '').replace(/^(in|add)\//, '') } : null;
    }
    var handle = value.replace(/^@/, '').replace(/\s+/g, '');
    if (!handle) return null;
    return { url: def.base + encodeURIComponent(handle), handle: '@' + handle };
  }

  function initials(name, lang) {
    var words = str(name).split(/\s+/).filter(Boolean);
    if (!words.length) return '?';
    function first(w) {
      if (typeof Intl !== 'undefined' && Intl.Segmenter) {
        var it = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(w)[Symbol.iterator]().next();
        if (!it.done) return it.value.segment;
      }
      return Array.from(w)[0];
    }
    if (lang !== 'en' || words.length === 1) return first(words[0]);
    return (first(words[0]) + first(words[words.length - 1])).toUpperCase();
  }

  // Pick black or white text for a coloured button.
  function contrastOn(hex) {
    var m = /^#?([0-9a-f]{6})$/i.exec(str(hex));
    if (!m) return '#ffffff';
    var n = parseInt(m[1], 16);
    var lum = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(function (c) {
      c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return (0.2126 * lum[0] + 0.7152 * lum[1] + 0.0722 * lum[2]) > 0.4 ? '#111111' : '#ffffff';
  }

  /* Turn a raw client JSON object into a tidy, safe profile.
   * Returns { profile, errors, warnings }. Errors stop the build. */
  function normalize(raw, fallbackSlug) {
    var errors = [], warnings = [];
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      return { profile: null, errors: ['The file must contain one { ... } object.'], warnings: warnings };
    }
    var p = {};
    p.name = str(raw.name);
    if (!p.name) errors.push('"name" is missing.');

    p.slug = str(raw.slug) || str(fallbackSlug) || slugify(p.name);
    if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(p.slug)) {
      errors.push('"slug" (' + JSON.stringify(p.slug) + ') may only use small letters, numbers and dashes, e.g. "ahmed-khan".');
    }

    p.title = str(raw.title);
    p.company = str(raw.company);
    p.bio = str(raw.bio);

    p.lang = str(raw.lang).toLowerCase() || 'en';
    if (!LANGS[p.lang]) { warnings.push('Unknown "lang" ' + JSON.stringify(raw.lang) + ' - using "en". Choose en, ar or ml.'); p.lang = 'en'; }
    p.dir = raw.dir === 'rtl' || raw.dir === 'ltr' ? raw.dir : LANGS[p.lang];

    p.theme = str(raw.theme).toLowerCase() || 'light';
    if (p.theme === 'colorful') p.theme = 'colourful';
    if (THEMES.indexOf(p.theme) < 0) { warnings.push('Unknown "theme" ' + JSON.stringify(raw.theme) + ' - using "light". Choose ' + THEMES.join(', ') + '.'); p.theme = 'light'; }

    p.accent = str(raw.accent);
    if (p.accent && !/^#[0-9a-f]{6}$/i.test(p.accent)) { warnings.push('"accent" should look like #1a73e8 - ignoring it.'); p.accent = ''; }

    p.photo = str(raw.photo);
    p.phone = str(raw.phone);
    p.whatsapp = str(raw.whatsapp);
    p.whatsappMessage = str(raw.whatsappMessage);
    p.email = str(raw.email);
    if (p.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(p.email)) { warnings.push('"email" does not look like an email address - leaving it out.'); p.email = ''; }
    p.website = webUrl(raw.website);
    if (str(raw.website) && !p.website) warnings.push('"website" does not look like a web address - leaving it out.');
    p.address = str(raw.address);
    p.mapsUrl = webUrl(raw.mapsUrl) || (p.address ? 'https://www.google.com/maps/search/?api=1&query=' + encodeURIComponent(p.address) : '');

    if (p.phone && digits(p.phone).replace('+', '').length < 6) { warnings.push('"phone" looks too short - leaving it out.'); p.phone = ''; }
    if (p.whatsapp && digits(p.whatsapp).replace('+', '').length < 8) { warnings.push('"whatsapp" needs the full number with country code, e.g. +971501234567 - leaving it out.'); p.whatsapp = ''; }
    if (p.whatsapp && digits(p.whatsapp).charAt(0) !== '+') warnings.push('"whatsapp" should start with the country code, e.g. +971... The link may not work without it.');

    p.telHref = p.phone ? 'tel:' + digits(p.phone) : '';
    p.waHref = p.whatsapp ? 'https://wa.me/' + digits(p.whatsapp).replace('+', '') + (p.whatsappMessage ? '?text=' + encodeURIComponent(p.whatsappMessage) : '') : '';
    p.mailHref = p.email ? 'mailto:' + p.email : '';

    p.socials = [];
    var s = raw.socials && typeof raw.socials === 'object' ? raw.socials : {};
    Object.keys(s).forEach(function (key) {
      var k = key.toLowerCase();
      if (k === 'twitter') k = 'x';
      if (!str(s[key])) return;
      if (!SOCIALS[k]) { warnings.push('Unknown social "' + key + '". Put it under "links" instead. Known: ' + Object.keys(SOCIALS).join(', ') + '.'); return; }
      var r = socialUrl(k, s[key]);
      if (!r) { warnings.push('Could not understand the ' + key + ' value - leaving it out.'); return; }
      p.socials.push({ key: k, label: SOCIALS[k].label, url: r.url, handle: r.handle });
    });

    p.links = [];
    (Array.isArray(raw.links) ? raw.links : []).forEach(function (l, i) {
      if (!l || (!str(l.label) && !str(l.url))) return;
      var u = webUrl(l.url);
      if (!u || !str(l.label)) { warnings.push('Extra link ' + (i + 1) + ' needs both a "label" and a valid "url" - leaving it out.'); return; }
      p.links.push({ label: str(l.label), url: u });
    });

    p.initials = initials(p.name, p.lang);
    p.labels = LABELS[p.lang];
    return { profile: errors.length ? null : p, errors: errors, warnings: warnings };
  }

  // ---- vCard (the "Save Contact" file) ----
  function vEsc(s) { return str(s).replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;'); }

  // vCard lines must be folded at 75 bytes; never split inside a character.
  function fold(line) {
    var out = [], cur = '', bytes = 0;
    Array.from(line).forEach(function (ch) {
      var cp = ch.codePointAt(0);
      var n = cp < 0x80 ? 1 : cp < 0x800 ? 2 : cp < 0x10000 ? 3 : 4;
      if (bytes + n > (out.length ? 74 : 75)) { out.push(cur); cur = ''; bytes = 0; }
      cur += ch; bytes += n;
    });
    out.push(cur);
    return out.join('\r\n ');
  }

  /* photo (optional): { base64: '...', type: 'JPEG' | 'PNG' } */
  function vcard(p, pageUrl, photo) {
    var parts = p.name.split(/\s+/);
    var family = parts.length > 1 ? parts[parts.length - 1] : '';
    var given = parts.length > 1 ? parts.slice(0, -1).join(' ') : p.name;
    var L = ['BEGIN:VCARD', 'VERSION:3.0',
      'N:' + vEsc(family) + ';' + vEsc(given) + ';;;',
      'FN:' + vEsc(p.name)];
    if (p.company) L.push('ORG:' + vEsc(p.company));
    if (p.title) L.push('TITLE:' + vEsc(p.title));
    if (p.phone) L.push('TEL;TYPE=CELL,VOICE:' + digits(p.phone));
    if (p.whatsapp && digits(p.whatsapp) !== digits(p.phone)) L.push('TEL;TYPE=WORK,VOICE:' + digits(p.whatsapp));
    if (p.email) L.push('EMAIL;TYPE=INTERNET,WORK:' + vEsc(p.email));
    if (p.website) L.push('URL:' + vEsc(p.website));
    if (pageUrl) L.push('URL:' + vEsc(pageUrl));
    if (p.address) L.push('ADR;TYPE=WORK:;;' + vEsc(p.address) + ';;;;');
    p.socials.forEach(function (s) { L.push('X-SOCIALPROFILE;TYPE=' + s.key + ':' + vEsc(s.url)); });
    if (p.bio) L.push('NOTE:' + vEsc(p.bio));
    if (photo && photo.base64) L.push('PHOTO;ENCODING=b;TYPE=' + photo.type + ':' + photo.base64);
    L.push('END:VCARD');
    return L.map(fold).join('\r\n') + '\r\n';
  }

  return {
    THEMES: THEMES, LANGS: LANGS, LABELS: LABELS, SOCIALS: SOCIALS,
    esc: esc, slugify: slugify, webUrl: webUrl, prettyUrl: prettyUrl, digits: digits,
    contrastOn: contrastOn, normalize: normalize, vcard: vcard
  };
});
