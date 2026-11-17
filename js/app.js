'use strict';
/* Tool list, search, hash routing, theme and offline (service worker) set-up */
(() => {
  const CATS = ['PCB', 'Basics', 'Power', 'Microcontrollers', '3D printing'];
  const list = document.getElementById('list'), view = document.getElementById('view'), q = document.getElementById('q');
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/colour/g, 'color');
  const hay = t => norm([t.title, t.desc, t.keys, t.cat].join(' '));

  function score(t, words) {
    const title = norm(t.title), all = hay(t);
    let s = 0;
    for (const w of words) {
      if (title.split(/\W+/).some(x => x.startsWith(w))) s += 3;
      else if (all.includes(w)) s += 1;
      else return 0;
    }
    return s;
  }

  function drawList() {
    const words = norm(q.value).split(/\s+/).filter(Boolean), cur = location.hash.slice(2);
    list.replaceChildren();
    const item = t => h('a', { href: '#/' + t.id, class: t.id === cur ? 'on' : null }, h('b', null, t.title), h('span', null, t.desc));
    if (words.length) {
      const hits = BT.tools.map(t => [t, score(t, words)]).filter(x => x[1]).sort((a, b) => b[1] - a[1]);
      if (!hits.length) return void list.append(h('p', { class: 'empty' }, `No tools match “${q.value}”.`));
      list.append(h('h2', null, `${hits.length} result${hits.length > 1 ? 's' : ''}`), ...hits.map(x => item(x[0])));
      return;
    }
    for (const c of CATS) {
      const ts = BT.tools.filter(t => t.cat === c);
      if (ts.length) list.append(h('h2', null, c), ...ts.map(item));
    }
  }

  function route() {
    const id = location.hash.slice(2), t = BT.tools.find(x => x.id === id);
    document.body.classList.toggle('at-home', !t);
    view.replaceChildren();
    if (!t) {
      document.title = 'Bench Tools';
      view.append(h('div', { class: 'home-hero' }, h('h1', null, 'Pick a tool'),
        h('p', null, 'Electronics and 3D-printing calculators. Everything runs on this device and works offline once loaded.')));
    } else {
      document.title = `${t.title} · Bench Tools`;
      view.append(h('header', { class: 'tool-head' }, h('a', { href: '#/', class: 'back' }, '‹ All tools'), h('h1', null, t.title), h('p', null, t.desc)));
      const body = h('section');
      view.append(body);
      t.render(body);
      if (t.notes) view.append(h('details', { class: 'notes' }, h('summary', null, 'How it works'), t.notes.map(n => h('p', null, n))));
      view.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    }
    drawList();
  }

  q.addEventListener('input', drawList);
  q.addEventListener('keydown', e => { if (e.key === 'Enter') { const a = list.querySelector('a'); if (a) { location.hash = a.getAttribute('href'); q.blur(); } } });
  document.addEventListener('keydown', e => {
    if (e.key === '/' && !/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) { e.preventDefault(); if (!document.body.classList.contains('at-home') && innerWidth < 900) location.hash = '#/'; q.focus(); }
  });
  window.addEventListener('hashchange', route);

  document.getElementById('theme').addEventListener('click', () => {
    const root = document.documentElement, dark = root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
    root.dataset.theme = dark ? 'light' : 'dark';
    BT.store.set('theme', root.dataset.theme);
    if (location.hash.includes('print-cost')) route();   // re-colour the 3D preview
  });

  route();

  const st = document.getElementById('status');
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    navigator.serviceWorker.register('sw.js').then(() => navigator.serviceWorker.ready)
      .then(() => { st.textContent = 'Saved for offline use. All calculations run on this device.'; }).catch(() => {});
  }
})();
