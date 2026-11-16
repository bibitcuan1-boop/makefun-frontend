[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/bibitcuan1-boop/makefun-frontend/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/bibitcuan1-boop/makefun-frontend/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

# makefun-frontend

A fast, unofficial frontend for [make.fun](https://make.fun/bounty/makefun-frontend-01) — static files, no build step, no framework, no fonts, no trackers. It reads only the make.fun public API (GET, CORS) and shows all four surfaces, each on its own hash route:

- `#/` — the live bounty board: each bounty with its live pot, entry fee, deadline / time left and entries, plus search, sort and status filters
- `#/bounty/<slug>` — a bounty's page: summary, description and rules, rewards table with the live pot, dates, status (a bounty past its deadline reads "closed to entries" even while its status still says open), and a top-5 preview
- `#/bounty/<slug>/leaderboard` — that bounty's leaderboard (overall / performance views, paginated)
- `#/u/<handle>` — an account's public profile: links, record and entries

## Why it is fast

- First load is 6 small files (HTML + CSS + 4 ES modules, ~26 KB raw) — no framework, no fonts.
- API answers are cached for 60 s and revalidated with `If-None-Match` (the API's ETags are bound to the minute, so a revalidation inside the same minute answers 304). The footer shows the live request count.
- Long lists page client-side (12 cards, 25 leaderboard rows); countdowns tick in place every 30 s without re-fetching or rebuilding the page.
- A bounty page fetches with `?submissions=summary`, so it never downloads the (hundreds-long) entry list.

## Run it

```sh
node serve.ts   # app/ on http://localhost:8080
```

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts   # writes out/dossier.json
```

Built for the make.fun bounty **"Build the best make.fun frontend"** ([makefun-frontend-01](https://make.fun/bounty/makefun-frontend-01)).
