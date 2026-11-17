# NFC business card profiles

Your own replacement for Linktree. Each client gets a fast, good-looking profile page at
`your-site/their-name/` that you write onto their NFC card.

- One small file per client goes in the **`clients`** folder.
- A **build** turns those files into finished web pages in a folder called **`dist`**.
- You put `dist` on free hosting (GitHub Pages or Cloudflare Pages). No server, no monthly fee.

Each profile page has: photo, name and title, a **Save Contact** button, **Call / WhatsApp / Email / Location** buttons, social media buttons, and a **Share** button with a QR code.

---

## The 3 things you will actually do

| I want to… | Do this |
|---|---|
| Add or change a client | Open `admin.html`, fill the form, download the file, put it in `clients` |
| Make the pages | Run `node build.js` (or let GitHub do it for you – see Deploy) |
| Put it online | Merge / upload to the `main` branch – the site updates by itself |

---

## One-time setup

1. **Get the project onto your PC.** On the GitHub page of this repo press the green **Code** button → **Download ZIP**, and unzip it. (If you use GitHub Desktop, clone it instead – that makes uploading easier later.)
2. **Install Node.js** (only needed if you want to build and preview on your own PC). Download the "LTS" version from <https://nodejs.org> and install it with the default options. Nothing else needs installing.
3. **Set your web address.** Open `site.config.json` in Notepad and change `baseUrl` to the address your cards will live at, for example:
   ```json
   "baseUrl": "https://cards.yourbrand.com",
   ```
   This matters: **the QR codes are made from this address.** Do it before you print any QR code. If you don't have the address yet, do the Deploy section first and come back.
4. In the same file, set `brand.name` to your business name. It appears as "Powered by …" at the bottom of every card. Leave it as `""` to hide it.

---

## Add a client

1. Double-click **`admin.html`**. It opens in your browser. Nothing is uploaded anywhere – it works offline.
2. Fill in the form. The phone on the right shows the page live as you type.
   - **Page address** is the last part of the link, e.g. `ahmed-khan` → `your-site/ahmed-khan/`. For Arabic or Malayalam names, type it in English letters.
   - **Photo:** choose any picture. It is cropped square and shrunk automatically.
   - **Theme:** Clean light, Dark, Gold / premium, or Colourful.
   - Anything you leave empty simply doesn't appear on the page.
3. Press **Download client file**. You get a file like `ahmed-khan.json`.
4. Move that file into the **`clients`** folder.

**To change a client later:** in `admin.html` press **Open existing…**, pick their file from `clients`, edit, download again and replace the old file.

**To remove a client:** delete their file from `clients`.

> The file name is the page address. `clients/ahmed-khan.json` becomes `your-site/ahmed-khan/`.
> Don't rename a file after the NFC card has been written, or the card will point to a page that no longer exists.

---

## Build and look at the pages on your PC

1. Open the project folder, click the address bar of the folder window, type `cmd` and press Enter. A black window opens.
2. Type this and press Enter:
   ```
   node build.js
   ```
   You should see `✔ Built 3 profiles`. If something is wrong with a client file it tells you which file and why, in plain words.
3. To look at the result, type:
   ```
   node serve.js
   ```
   and open <http://localhost:8080/_all> in your browser. Press `Ctrl + C` in the black window to stop.

To see it like a phone: in Chrome press `F12`, then the little phone/tablet icon.

---

## Deploy (put it online)

Pick **one** of these. Both are free.

### Option A – GitHub Pages (simplest, already set up)

1. On GitHub open this repo → **Settings** → **Pages**.
2. Under **Build and deployment → Source** choose **GitHub Actions**.
3. Get this project onto the `main` branch (merge the pull request for this work).
4. Wait about a minute. Go to the **Actions** tab – a green tick means it's live.
5. Your address is shown in **Settings → Pages**. It looks like `https://YOUR-USERNAME.github.io/REPO-NAME`. Put exactly that into `baseUrl` in `site.config.json` (no slash at the end) and save/upload that change.

From then on, **every time a file changes on `main`, GitHub rebuilds and republishes by itself.** So adding a client can be as simple as: GitHub website → `clients` folder → **Add file → Upload files** → drop the `.json` in → **Commit changes**. No Node.js needed for that.

*Good to know:* on a free GitHub account, GitHub Pages needs the repo to be **public**. That means the client files (names, numbers) can be seen in the repo – the same details that are on their public card page anyway. If you'd rather keep the repo private, use Option B.

### Option B – Cloudflare Pages (works with a private repo)

1. Create a free account at <https://dash.cloudflare.com> → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**, and choose this repo.
2. When it asks for build settings:
   - **Build command:** `node build.js`
   - **Build output directory:** `dist`
3. Press **Save and Deploy**. You get an address like `https://something.pages.dev`. Put that into `baseUrl` in `site.config.json`.

It also rebuilds by itself whenever `main` changes.

### Your own domain (recommended for a card business)

A short address like `cards.yourbrand.com` looks more professional and means you can move hosting later **without re-writing any NFC cards**. Both GitHub Pages and Cloudflare Pages have a "Custom domain" setting; follow their on-screen steps, then put the new address in `baseUrl`.

---

## Writing the NFC card and printing the QR

- **NFC:** with any NFC writing app (for example "NFC Tools"), write a **URL** record: `your-site/page-address/` – e.g. `https://cards.yourbrand.com/ahmed-khan/`.
- **QR:** after a build, each client folder in `dist` contains:
  - `qr.svg` – best for printing (stays sharp at any size)
  - `qr.png` – a normal picture, for anything else

  Online they are at `your-site/ahmed-khan/qr.svg` and `…/qr.png`. Always test a printed QR with your phone before a full print run.

---

## Languages and themes

- **Language** (in the form) sets the words on the buttons and the direction of the page: **English**, **Arabic** (right-to-left) or **Malayalam**. The client's own name, title and bio can be typed in any language.
- **Theme** is one of `light`, `dark`, `gold`, `colourful`.
- **Brand colour** (optional) changes the colour of the main button to match the client's logo.

The Arabic and Malayalam button words were written carefully, but please have a native speaker glance at them once. They live near the top of `src/core.js` under `LABELS` if you want to change a word.

---

## Settings file: `site.config.json`

| Setting | What it does |
|---|---|
| `baseUrl` | Your site's address. Used for QR codes and link previews. **Must be right before printing QR codes.** |
| `brand.name`, `brand.url` | "Powered by …" line at the bottom of each card. Empty name = hidden. |
| `home.title` | The heading on the front page of the site. |
| `home.listClients` | `false` (default): the front page does **not** list your clients. `true`: it shows a list of everyone. |
| `analytics.enabled` | `false` (default): no tracking code is added to pages at all. |
| `analytics.endpoint` | Where click counts are sent if analytics is on. |

### Click analytics (optional, off by default)

When off, the pages contain no tracking code at all.

When on, each button press sends three things to the address in `analytics.endpoint`: **which profile, which button, and today's date**. No cookies, no visitor ID, and it is skipped for visitors whose browser says "Do Not Track". You need somewhere to receive it – `docs/analytics-worker.example.js` is a small free Cloudflare Worker you can start from (it is an untested example; try it before you rely on it).

---

## What a client file looks like

You never need to write this by hand – `admin.html` makes it – but this is what's inside:

```json
{
  "name": "Sara Thomas",
  "title": "Interior Designer",
  "company": "Studio Oryx",
  "bio": "Calm, practical interiors for homes and small offices.",
  "lang": "en",
  "theme": "light",
  "photo": "photos/sara-thomas.svg",
  "phone": "+971 50 000 0001",
  "whatsapp": "+971 50 000 0001",
  "email": "sara@example.com",
  "website": "https://example.com",
  "address": "Dubai Design District, Dubai, UAE",
  "socials": { "instagram": "studio.oryx", "linkedin": "sara-thomas" },
  "links": [ { "label": "View portfolio", "url": "https://example.com/portfolio.pdf" } ]
}
```

Only `name` is required. Other optional fields: `accent` (brand colour like `#1a73e8`), `whatsappMessage`, `mapsUrl`.
Social networks supported: Instagram, Facebook, LinkedIn, X, TikTok, YouTube, Snapchat, Telegram, Threads, Behance, Pinterest, GitHub. Anything else goes under `links`.

`photo` can be a picture chosen in the form (stored inside the file), a file you put in `clients/photos/`, or a web link to a picture.

Three sample clients are included so you can see it working – **delete them from `clients` before you go live:**
`sara-thomas` (English, light), `khalid-al-farsi` (Arabic, gold), `anjali-menon` (Malayalam, colourful).

---

## If something goes wrong

| What you see | What to do |
|---|---|
| `'node' is not recognized` | Node.js isn't installed, or the black window was opened before installing. Install it and open a new window. |
| `Build stopped – please fix:` | Read the line under it. It names the file and the problem. Easiest fix: open that file in `admin.html` and download it again. |
| QR code opens `example.com` | `baseUrl` in `site.config.json` is still the example. Change it and build again. |
| Page shows initials instead of the photo | The photo file wasn't found. Choose the photo again in `admin.html`. |
| Changed something but the live site is the same | Check the **Actions** tab on GitHub for a red cross; open it to read the message. Also try refreshing the page on your phone. |
| Save Contact does nothing inside Instagram/Facebook's built-in browser | Those in-app browsers block downloads. Opening the link in Safari/Chrome works. NFC taps open the real browser, so cards are fine. |

---

## What's in this folder

| | |
|---|---|
| `admin.html` | The form for making client files. Open it on your PC. |
| `clients/` | One file per client. `clients/photos/` for loose photo files. |
| `site.config.json` | Your settings. |
| `build.js` | Makes the website (`node build.js`). |
| `serve.js` | Shows the built site on your PC (`node serve.js`). |
| `dist/` | The finished website. Created by the build; never edit it by hand. |
| `src/` | The page design and wording. `src/styles.js` holds the theme colours. |
| `vendor/` | A small bundled QR code library (MIT licence). |
| `.github/workflows/deploy.yml` | Tells GitHub to build and publish automatically. |
| `docs/` | Optional analytics example. |
