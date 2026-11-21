// The Digital Beachhead: shared "Smiles caused" counter.
//
//   GET  /api/smiles  -> { "smiles": <total> }
//   POST /api/smiles  -> adds 1 (unless throttled), returns
//                        { "smiles": <new total>, "counted": true|false }
//
// Everything else is served from the static site files.
// The total lives in one Durable Object, which handles one request at a time,
// so simultaneous clicks are never lost.

import { DurableObject } from 'cloudflare:workers';

const MIN_GAP_MS = 400; // per-visitor throttle: at most ~2.5 smiles a second

export class SmileCounter extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.lastHit = new Map(); // visitor IP -> time of last counted smile (in memory only)
  }

  async total() {
    return (await this.ctx.storage.get('smiles')) || 0;
  }

  async add(visitor) {
    const now = Date.now();
    const last = this.lastHit.get(visitor) || 0;
    let smiles = await this.total();
    const counted = now - last >= MIN_GAP_MS;
    if (counted) {
      smiles += 1;
      await this.ctx.storage.put('smiles', smiles);
      this.lastHit.set(visitor, now);
      if (this.lastHit.size > 5000) this.lastHit.clear();
    }
    return { smiles, counted };
  }
}

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store' },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/smiles') {
      const counter = env.SMILES.get(env.SMILES.idFromName('global'));
      if (request.method === 'GET') return json({ smiles: await counter.total() });
      if (request.method === 'POST') {
        const visitor = request.headers.get('cf-connecting-ip') || 'unknown';
        return json(await counter.add(visitor));
      }
      return json({ error: 'method not allowed' }, 405);
    }

    return env.ASSETS.fetch(request);
  },
};
