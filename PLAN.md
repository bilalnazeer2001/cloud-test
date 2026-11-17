# Plan

## Goal
Self-hosted NFC business card profile pages (replace Linktree). One JSON file per
client in `/clients`; `node build.js` turns them into a static site in `/dist`.

## Features
- Profile page: photo, name/title, Save Contact (.vcf), Call / WhatsApp / Email / Location, socials, extra links
- 4 themes: light, dark, gold, colourful
- English, Arabic (RTL) and Malayalam
- QR code per profile (SVG + PNG)
- `admin.html` form that exports the client JSON, with live preview
- Optional click analytics hook (off by default)
- Deploys to GitHub Pages (workflow included) or Cloudflare Pages

## Tasks
- [x] Build script, page template, themes
- [x] vCard and QR generation
- [x] Admin form
- [x] 3 sample clients
- [x] README for non-developers
- [ ] Bilal: set the real web address in `site.config.json` (`baseUrl`)
- [ ] Bilal: choose hosting (GitHub Pages or Cloudflare Pages) and deploy
- [ ] Bilal: have a native speaker check the Arabic and Malayalam button words
- [ ] Bilal: test Save Contact on a real iPhone and Android phone

## Notes
- No installs: the build uses only Node.js itself. `vendor/qrcode-generator.js` is a bundled MIT library.
- `dist/` is not stored in git; it is rebuilt each time.
- The old `index.html` in the top folder is the original test page and is not part of the card site.
