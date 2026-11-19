# The Digital Beachhead

The official website of Jacob Harrison: **https://thedigitalbeachhead.com**

A landing craft beaches, a tank rolls onto the sand, and the long-promised confetti button finally works. Click it and the mortar squad lobs a round that bursts into confetti across the page. Click the tank and it fires a confetti shell of its own.

## Files
- `index.html`: page content and the beach scene (inline SVG)
- `style.css`: layout, the dispatch card, and scene animations
- `script.js`: landing sequence, the mortar squad, aiming, and the confetti/smoke effects (canvas)

No build step and no dependencies apart from two Google Fonts (Black Ops One, Special Elite).

## Hosting
- **Cloudflare Workers (static assets)** serves thedigitalbeachhead.com and www. `.github/workflows/deploy.yml` deploys on every push to `main`, using the `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` repo secrets. Config is in `wrangler.jsonc`.
- **GitHub Pages** still serves harrcoded.github.io, which forwards visitors to the new domain (the small script at the top of `index.html`).

## Run locally
Open `index.html` in a browser, or run `npx serve .` and visit the printed address.
