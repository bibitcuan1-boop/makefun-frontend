# make.fun bounty browser

A fast, read-only frontend for [make.fun](https://make.fun/bounty/makefun-frontend-01) — built for the
[“Build the best make.fun frontend” bounty](https://make.fun/bounty/makefun-frontend-01).

![make.fun frontend bounty](https://make.fun/badge/makefun-frontend-01.svg)
![rank](https://make.fun/badge/makefun-frontend-01/bibitcuan1-boop/makefun-frontend/rank.svg)
![reward](https://make.fun/badge/makefun-frontend-01/bibitcuan1-boop/makefun-frontend/reward.svg)

## What it does

Plain static files under `app/` — no build step, no framework, no font or
script loaded from anywhere but make.fun. It reads make.fun's public API
(`GET https://make.fun/api` only, no sign-in, no writes) and shows four
surfaces, each with its own hash URL:

- **Board** — `#/` — every live bounty with its live pot, entry fee, time
  left and entry count; search, category and status filters, sorting, pages.
- **Bounty page** — `#/bounty/<slug>` — summary, full description and rules,
  rewards table with the live pot, dates and status, and its entries.
- **Leaderboard** — `#/bounty/<slug>/leaderboard` — the bounty's ranked
  entries with judge win rates and win/draw/loss records.
- **Profile** — `#/u/<handle>` — an account's public information, record
  and entries.

A bounty takes entries until its deadline passes — the app says so from
the deadline, not from the status alone, because a bounty past its deadline
may still read “open” until its results are published.

API answers are cached in memory for 60 seconds, long lists are paginated,
and paging/filtering update only the list on screen. `window.__shotReady`
is `false` while a route loads and `true` once its data has rendered.

## Run it locally

```sh
node serve.ts            # http://localhost:8080/
node serve.ts --port 8090
```

## Hand in

```sh
MAKEFUN_OUTPUT_DIR=/output node main.ts
```

`main.ts` copies `app/` and `screenshots/` into the output directory and
writes `dossier.json` there.
