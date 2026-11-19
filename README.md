# The Digital Beachhead

The official website of Jacob Harrison: **https://thedigitalbeachhead.com**

A landing craft beaches, a tank rolls onto the sand, and the long-promised confetti button finally works. Click it and the mortar squad lobs a round that bursts into confetti across the page. Click the tank and it fires a confetti shell of its own.

## Files
- `index.html`: page content and the beach scene (inline SVG)
- `style.css`: layout, the dispatch card, and scene animations
- `script.js`: landing sequence, the mortar squad, aiming, the confetti/smoke effects (canvas), and the smile counter
- `src/worker.js`: the server side of the shared "Smiles caused" counter (not published as a file)

No build step and no dependencies apart from two Google Fonts (Black Ops One, Special Elite).

## The shared smile counter
Every confetti hit from every visitor adds 1 to one all-time total.
- `GET /api/smiles` returns `{"smiles": total}`; `POST /api/smiles` adds 1 and returns the new total.
- The total is stored in a Cloudflare Durable Object (`SmileCounter`), which handles one request at a time, so simultaneous clicks are never lost.
- Each visitor (by IP) counts at most once every 0.4 s, so mashing the button or scripting it can't inflate the number quickly.
- The page also remembers how many smiles this browser caused, shown as "(N by you)". If the counter can't be reached (opening the file locally, for example), it falls back to that local count.

## Hosting
- **Cloudflare Workers (static assets)** serves thedigitalbeachhead.com and www. `.github/workflows/deploy.yml` deploys on every push to `main`, using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. Config is in `wrangler.jsonc`.
- **GitHub Pages** still serves harrcoded.github.io, which forwards visitors to the new domain (the small script at the top of `index.html`).

## Run locally
Open `index.html` in a browser, or run `npx serve .` and visit the printed address. The counter will use this browser's own count.

To run it with the shared counter, copy the site files into `dist/` and run `npx wrangler dev`.
