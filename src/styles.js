/* The look of the profile pages. The four themes are the blocks that start
 * with [data-theme="..."] - change the colours there to restyle a theme. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.NFCStyles = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  return `
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%;text-size-adjust:100%}
body{margin:0;min-height:100vh;min-height:100dvh;background:var(--bg);color:var(--ink);
  font-family:system-ui,-apple-system,"Segoe UI",Roboto,"Noto Sans","Noto Sans Arabic","Geeza Pro","Noto Sans Malayalam","Malayalam Sangam MN",sans-serif;
  font-size:16px;line-height:1.5;-webkit-font-smoothing:antialiased;-webkit-tap-highlight-color:transparent}
:lang(ar) body,:lang(ml) body{line-height:1.75}
a{color:inherit;text-decoration:none}
button{font:inherit;color:inherit;cursor:pointer}

/* ---------- themes ---------- */
[data-theme="light"]{
  --bg:#f3f2ee;--surface:#ffffff;--ink:#15171c;--muted:#5f6470;--line:#e4e2db;
  --hero-ink:#15171c;--hero-muted:#5f6470;
  --accent:#15171c;--on-accent:#ffffff;--icon:#15171c;--icon-bg:#f0efea;
  --cover:linear-gradient(135deg,#d9e4f7 0%,#efe6f5 50%,#f8e9db 100%);
  --ring:#ffffff;--shadow:0 1px 2px rgba(20,22,28,.05),0 6px 20px rgba(20,22,28,.05);
  --display:inherit;color-scheme:light}
[data-theme="dark"]{
  --bg:#0b0d10;--surface:#15181d;--ink:#f3f4f6;--muted:#9aa1ad;--line:#262b33;
  --hero-ink:#f3f4f6;--hero-muted:#9aa1ad;
  --accent:#6ee7b7;--on-accent:#04261a;--icon:#6ee7b7;--icon-bg:#1d2229;
  --cover:radial-gradient(120% 140% at 0% 0%,#0f3d33 0%,transparent 60%),radial-gradient(120% 140% at 100% 0%,#232a5c 0%,transparent 60%),#12151a;
  --ring:#0b0d10;--shadow:none;
  --display:inherit;color-scheme:dark}
[data-theme="gold"]{
  --bg:#0e0c08;--surface:#17130c;--ink:#f6edd8;--muted:#b3a586;--line:#3b3019;
  --hero-ink:#f6edd8;--hero-muted:#c9b98f;
  --accent:linear-gradient(135deg,#b98a2c 0%,#f1d98c 48%,#c2962f 100%);--on-accent:#1b1404;--icon:#e6c66f;--icon-bg:#231c0e;
  --cover:radial-gradient(90% 120% at 50% 0%,rgba(226,190,98,.34) 0%,transparent 70%),linear-gradient(180deg,#1d170b,#0e0c08);
  --ring:#d9b65a;--shadow:none;
  --display:"Cormorant Garamond","Playfair Display",Georgia,"Times New Roman",serif;color-scheme:dark}
[data-theme="colourful"]{
  --bg:#c2187a;--surface:#ffffff;--ink:#1f1235;--muted:#5d5470;--line:transparent;
  --hero-ink:#ffffff;--hero-muted:rgba(255,255,255,.92);
  --accent:#1f1235;--on-accent:#ffffff;--icon:#d6246e;--icon-bg:#fdeaf2;
  --cover:transparent;
  --ring:#ffffff;--shadow:0 8px 24px rgba(40,8,70,.22);
  --display:inherit;color-scheme:light}
[data-theme="colourful"] body{background:linear-gradient(165deg,#e8453c 0%,#cf1f72 42%,#5b2fd6 100%) fixed}
[data-theme="colourful"] .quick a:nth-child(4n+2) .ico-wrap,[data-theme="colourful"] .links li:nth-child(3n+2) .ico-wrap{color:#5b2fd6;background:#eee9fd}
[data-theme="colourful"] .quick a:nth-child(4n+3) .ico-wrap,[data-theme="colourful"] .links li:nth-child(3n+3) .ico-wrap{color:#d2511a;background:#fdeee4}

/* ---------- layout ---------- */
.page{max-width:460px;margin:0 auto;padding:0 16px 28px}
.cover{height:132px;margin:0 -16px;background:var(--cover)}
@media(min-width:500px){.page{padding-top:24px}.cover{margin:0;border-radius:24px}}

.hero{text-align:center;margin-top:-62px}
.avatar{width:124px;height:124px;margin:0 auto;border-radius:50%;border:4px solid var(--ring);
  background:var(--icon-bg);color:var(--icon);display:grid;place-items:center;overflow:hidden;
  font-size:2.6rem;font-weight:700;font-family:var(--display);box-shadow:var(--shadow)}
.avatar img{width:100%;height:100%;object-fit:cover;display:block}
[data-theme="gold"] .avatar{border-width:2px;box-shadow:0 0 0 5px var(--bg),0 0 44px rgba(226,190,98,.22)}
h1{margin:16px 0 0;font-size:clamp(1.65rem,7.2vw,2rem);line-height:1.2;font-weight:750;color:var(--hero-ink);
  font-family:var(--display);overflow-wrap:anywhere;text-wrap:balance}
:lang(en) h1{letter-spacing:-.02em}
:lang(ar) h1,:lang(ml) h1{line-height:1.5}
[data-theme="gold"] h1{font-weight:600;font-size:clamp(1.9rem,8.2vw,2.3rem)}
[data-theme="gold"]:lang(en) h1{letter-spacing:.01em}
.role{margin:6px 0 0;color:var(--hero-muted);font-size:1rem;overflow-wrap:anywhere}
.role b{font-weight:600;color:var(--hero-ink)}
[data-theme="gold"]:lang(en) .role{text-transform:uppercase;letter-spacing:.14em;font-size:.76rem;margin-top:10px}
.bio{margin:14px auto 0;max-width:36ch;color:var(--hero-muted);font-size:.95rem;overflow-wrap:anywhere;text-wrap:pretty}

.save{display:flex;align-items:center;justify-content:center;gap:10px;margin-top:24px;min-height:58px;padding:10px 20px;
  border:0;border-radius:18px;background:var(--accent);color:var(--on-accent);font-size:1.06rem;font-weight:650;
  box-shadow:var(--shadow);transition:transform .15s ease,filter .15s ease}
.save:active,.quick a:active,.links a:active,.ghost:active{transform:scale(.975)}
.save .ico{width:22px;height:22px}

.quick{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}
.quick a{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;border-radius:18px;
  background:var(--surface);border:1px solid var(--line);font-weight:600;box-shadow:var(--shadow);
  transition:transform .15s ease;min-width:0}
.quick a:last-child:nth-child(odd){grid-column:1/-1}
.quick span.t{min-width:0;overflow-wrap:anywhere;line-height:1.3}
.ico-wrap{flex:none;width:40px;height:40px;border-radius:12px;display:grid;place-items:center;background:var(--icon-bg);color:var(--icon)}
.ico{width:20px;height:20px;display:block}

.links{list-style:none;margin:10px 0 0;padding:0;display:grid;gap:10px}
.links a{display:flex;align-items:center;gap:12px;min-height:64px;padding:10px 14px;border-radius:18px;
  background:var(--surface);border:1px solid var(--line);box-shadow:var(--shadow);transition:transform .15s ease}
.links .txt{flex:1;min-width:0;display:grid;line-height:1.3}
.links .txt b{font-weight:600}
.links .txt small{color:var(--muted);font-size:.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;direction:ltr;unicode-bidi:isolate}
[dir="rtl"] .links .txt small{text-align:right}
.links .go{flex:none;width:18px;height:18px;color:var(--muted);opacity:.7}
[dir="rtl"] .links .go{transform:scaleX(-1)}

.foot{margin-top:22px;display:grid;justify-items:center;gap:14px}
.ghost{display:inline-flex;align-items:center;gap:8px;min-height:46px;padding:8px 20px;border-radius:999px;
  background:transparent;border:1px solid color-mix(in srgb,var(--hero-ink) 28%,transparent);color:var(--hero-ink);font-weight:600;font-size:.95rem;
  transition:transform .15s ease}
.ghost .ico{width:18px;height:18px}
.powered{font-size:.78rem;color:var(--hero-muted);opacity:.85}
.powered a{text-decoration:underline;text-underline-offset:3px}

@media(hover:hover){.save:hover{filter:brightness(1.08)}.quick a:hover,.links a:hover{border-color:color-mix(in srgb,var(--icon) 45%,var(--line))}
  .ghost:hover{background:color-mix(in srgb,var(--hero-ink) 8%,transparent)}}
a:focus-visible,button:focus-visible{outline:3px solid color-mix(in srgb,var(--hero-ink) 70%,transparent);outline-offset:3px}

/* ---------- share / QR sheet ---------- */
dialog{border:0;padding:0;border-radius:24px;background:var(--surface);color:var(--ink);width:min(340px,calc(100vw - 32px));
  box-shadow:0 20px 60px rgba(0,0,0,.4)}
dialog::backdrop{background:rgba(0,0,0,.55)}
[data-theme="dark"] dialog,[data-theme="gold"] dialog{border:1px solid var(--line)}
.sheet{padding:22px;display:grid;gap:14px;justify-items:center;text-align:center}
.sheet img{width:220px;height:220px;border-radius:14px;background:#fff;padding:6px;display:block}
.sheet p{margin:0;color:var(--muted);font-size:.92rem}
.sheet .row{display:grid;grid-template-columns:1fr 1fr;gap:8px;width:100%}
.sheet button{min-height:48px;border-radius:14px;border:1px solid var(--line);background:transparent;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px}
[data-theme="colourful"] .sheet button{border-color:#e3deee}
.sheet button.pri{background:var(--accent);color:var(--on-accent);border:0}
.sheet .ico{width:18px;height:18px}

/* ---------- gentle entrance ---------- */
@media(prefers-reduced-motion:no-preference){
  .hero,.save,.quick,.links,.foot{animation:rise .5s cubic-bezier(.2,.7,.2,1) both}
  .save{animation-delay:.06s}.quick{animation-delay:.1s}.links{animation-delay:.14s}.foot{animation-delay:.18s}
  @keyframes rise{from{opacity:0;translate:0 10px}to{opacity:1;translate:0 0}}
}
`;
});
