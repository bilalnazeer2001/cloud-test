/* OPTIONAL example: a tiny free click counter on Cloudflare Workers.
 *
 * This is a starting point, not something the build uses. It has not been
 * run against a live Cloudflare account - test it before relying on it.
 *
 * What it stores: one number per "day : profile : button". No IP address,
 * no cookies, nothing about the visitor.
 *
 * Set-up outline (Cloudflare dashboard):
 *   1. Workers & Pages -> Create Worker -> paste this file.
 *   2. Storage -> KV -> create a namespace, then bind it to the Worker as CLICKS.
 *   3. Worker Settings -> Variables -> add a secret called VIEW_KEY (your own password
 *      for reading the numbers). Never write that password in this repo.
 *   4. Put the Worker's address in site.config.json -> analytics.endpoint,
 *      set analytics.enabled to true, and build again.
 *   5. See the numbers at:  https://<your-worker-address>/?key=<your VIEW_KEY>
 *
 * Note: the free KV plan allows about 1,000 saves per day.
 */
export default {
  async fetch(request, env) {
    const cors = { 'Access-Control-Allow-Origin': '*' };

    if (request.method === 'POST') {
      try {
        const d = JSON.parse(await request.text());
        const ok = /^[a-z0-9-]{1,80}$/.test(d.slug) && /^[a-z0-9-]{1,30}$/.test(d.action) && /^\d{4}-\d{2}-\d{2}$/.test(d.day);
        if (ok) {
          const key = d.day + ':' + d.slug + ':' + d.action;
          const n = parseInt(await env.CLICKS.get(key), 10) || 0;
          await env.CLICKS.put(key, String(n + 1));
        }
      } catch (e) { /* ignore bad input */ }
      return new Response(null, { status: 204, headers: cors });
    }

    const url = new URL(request.url);
    if (!env.VIEW_KEY || url.searchParams.get('key') !== env.VIEW_KEY) {
      return new Response('Not found', { status: 404 });
    }
    const rows = [];
    let cursor;
    do {
      const page = await env.CLICKS.list({ cursor });
      for (const k of page.keys) rows.push(k.name + ' = ' + (await env.CLICKS.get(k.name)));
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
    return new Response(rows.sort().join('\n') || 'No clicks yet.', { headers: { 'Content-Type': 'text/plain; charset=utf-8' } });
  }
};
