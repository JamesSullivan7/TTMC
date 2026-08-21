# Tulsa Training — Cross Country

A collective gym challenge. The whole gym drives one route together, cardio meter by cardio meter: **Tulsa → Los Angeles → New York → Tulsa, 8,473,348 meters, through September 2026.** No names, no leaderboard — one gym, one road.

Westbound first, so the gym leaves town on Route 66 — which runs through Tulsa — and reaches the end of it at the Santa Monica Pier. The distance is the same either way round; the story is not.

**Live:** https://tt-cross-country.vercel.app

Every meter someone rows is a meter of road. There is no map scale and nothing hidden — see [Sizing](#sizing-the-route) for why that works out.

## Three surfaces

| URL | Who | What |
|---|---|---|
| `/` | anyone watching, and the trainer computer | the map, the milestone feed, per-machine totals |
| `/tv` | the gym TV, usually a cast tab | the display layout, locked — no trainer UI, nothing to log in to |
| `/log` | a member's phone | log your own meters, reached by scanning a machine's QR |
| `/qr` | a trainer, once | print the QR cards to tape on the machines |

There is no router library — `src/main.tsx` checks the path. `vercel.json` rewrites everything to `index.html` so those survive a refresh.

## How it works

- The site opens in **member view**: watch-only. Anyone can open it on their phone.
- **Members log their own meters** by scanning the QR on a machine. That opens `/log` with the machine already picked, and hands them the moment afterwards: *"You just moved us 10,300 meters down the road — 10 km closer to Joplin."* One person's meters are 0.02% of the goal, but they are always a nameable piece of road.
- **Trainer login** unlocks the entry form on the gym computer, plus recent-entries undo and the testing tools. Trainers can log for anyone who will not use a phone.
- The dashboard shows a US map with the route drawn across it — road behind you in brand red, road ahead dashed — the logo riding the current position.
- Crossing a landmark fires a celebration, with a postcard backdrop if one exists, and a **Save share card** button that downloads a 1080×1080 branded image for Instagram.
- **Today vs. our best day** replaces a deadline as the source of urgency. The room races its own history, which is the point of having no leaderboard.
- **Daily recap** each morning, **Replay the journey** (~50s, built for the finish party), and **TV mode** for the gym screen.

The map is a static SVG (`d3-geo` `albersUsa` + `us-atlas` state shapes) that scales to any screen. No WebGL, no camera, no render loop, no network call — it has to sit on a TV for a month unattended.

## Keys

Two tiers, both living only in the Convex deployment environment. Neither is ever in the bundle or the repo.

| | `LOG_TOKEN` | `ADMIN_KEY` |
|---|---|---|
| who has it | any member who scanned a QR | trainers |
| log meters | ✅ | ✅ |
| undo / reset / simulate | ❌ | ✅ |
| read the log token back | ❌ | ✅ |

```
npx convex env set ADMIN_KEY <value> --prod
npx convex env set LOG_TOKEN <value> --prod
npx convex env get ADMIN_KEY --prod        # recover one
```

`LOG_TOKEN` rides in the QR URL, so you cannot get it by reading the site's source — you have to have stood in the gym and pointed a camera at a machine. It is a deliberately modest bar: it is not protecting money, it is stopping a stranger who guessed the URL from spraying the total. A leaked QR costs you some junk entries, not the month.

`/log` stores the token then strips it from the address bar, so a screenshot does not leak it.

## Machines and units

The **Assault Bike reads in miles**; everything else reads in meters. The unit is part of the machine definition in `convex/machines.ts`, shared by the server and the UI, and conversion happens server-side — so nothing downstream ever holds a number whose unit is ambiguous. The form follows the machine: the label switches to Miles, decimals are allowed, and a live line shows `6.4 mi = 10,300 meters` before you commit.

Adding or changing a machine is one entry in that file.

## Sizing the route

The gym's output is the fixed input, not the route. From the calorie challenge (182 athletes) and the machine mix in `simulateDay`:

| | |
|---|---|
| Expected real meters per entry | 3,414 |
| Expected **real** meters per gym day | ~273,000 |
| **This route** | 8,473,348 m = **31.0 gym days at `MULTIPLIER = 1`** |

Route length and `MULTIPLIER` are one decision, not two. This route is short enough that the journey is 1:1 with real meters, which is why the old silent ×5 "tailwind" is gone.

42 milestones, averaging one every 0.74 gym days, with no gap larger than 1.60 — so no day the gym is open passes without something happening.

### The 30 days are tight on purpose

September is 30 days. At the calorie challenge's observed output the gym would cover 8,193,600 m — **3.3% short of the route.**

| | |
|---|---|
| Needed per gym day | 282,445 m |
| Managed last time | 273,120 m |
| Per athlete (182) | ~1,552 m a day |
| **Uplift required** | **+3.4%** |

That is a real margin, not a rounding error, and it is deliberate. The gym has to beat its own previous pace slightly or the last week gets interesting. If that turns out to be the wrong call, the honest lever is the route, not the multiplier — cut a landmark or two rather than quietly inflating meters.

`CHALLENGE_WINDOW` in `src/config.ts` drives the countdown, the "Day N of N" counter, the pace ghost, the ahead/behind-pace badge, and the day line on share cards. Set it to `null` to run open-ended instead; everything above hides itself.

## Running it

```
npm install
npx convex dev --once   # syncs backend functions (first time on a new machine)
npm run dev             # local dev server
npm test                # 28 tests over the route data, geometry and units
```

Backend: Convex project `tt-world-tour` (team `james-7ecd5`). Dev deployment `fine-eagle-220`, production `utmost-gopher-81`. URLs live in `.env.local`.

## Deploying

Production is live. Vercel is connected to the GitHub repo, so merging to `main` deploys.

For a fresh environment, the wizard does the whole thing — including generating the keys and proving on the live deployment that the destructive mutations are actually locked down before it hands you a URL:

```
bash scripts/first-deploy.sh
```

By hand: `npx convex deploy`, set both keys with `npx convex env set ... --prod`, then deploy to Vercel with `VITE_CONVEX_URL` pointing at the **production** Convex URL.

## Postcards

Each milestone can have a photo behind its celebration, at `public/postcards/<file>.jpg`. **20 of the 42 are in place.** Reversing the route direction cost none of them — the cities are the same, only the order changed.

```
bash scripts/postcards.sh
```

One stage per missing landmark: it opens a search, gives you the exact filename, checks the file is a real JPEG rather than a saved error page, and writes the `img:` line into `src/config.ts` for you. Ctrl-C any time — re-running picks up where it left off.

A milestone with no `img` is **not** broken. `Celebration` confirms the photo loads before using it and falls back to the brand treatment otherwise, so a missing postcard degrades quietly rather than showing a washed-out overlay over a 404.

`tulsa.jpg` is the finish frame, and it is meant to be a real photo of the gym and the crew — nothing else fills that screen at 8,473,348 m.

## The gym display

Cast a tab, or open it on a machine wired to the TV. Either way use:

**https://tt-cross-country.vercel.app/tv**

That route is the display layout and nothing else. It cannot show the entry
form, the testing tools or the Reset button even on a machine that is logged in
as a trainer, there is no way out of it by accident, and it comes back correctly
on its own if the tab reloads. Use it rather than `/` plus the TV mode button.

Casting a tab sends the page without browser chrome, so `/tv` does not ask for
fullscreen — there is nothing to hide. If you are driving the TV directly rather
than casting, press F11 (or Ctrl+Cmd+F on a Mac).

Whatever is casting has to stay awake. On a Mac, `caffeinate -dis` in a Terminal
does it; `killall caffeinate` releases it. There are double-clickable launchers
in `scripts/` for both platforms that handle this and open kiosk mode:
`gym-tv.command` for macOS, `gym-tv.bat` for Windows.

## Notes for whoever works on this next

- **`logEntry` must not read the whole `entries` table.** It used to, and 35 people logging at once produced ~14% `OptimisticConcurrencyControlFailure`. The running total is computed client-side from the live subscription instead. The rate limiter is sharded for the same reason — see the comments in `convex/worldTour.ts`.
- **`ROUTE` derives from `MILESTONES`**, so changing the route is a data edit in `src/config.ts`, not a code change. The tests will catch an out-of-order milestone, a city with no coordinates, a coordinate outside the continental US (`albersUsa` silently drops those), or a gap longer than two gym days.
- `simulateDay` and `resetChallenge` are admin-gated but still shipped to production. Handy for testing, worth being careful with during a live challenge.
- The daily recap buckets days in browser-local time while the server uses a hardcoded UTC−5. Correct in Tulsa, drifts elsewhere.

## Tuning knobs

- `convex/worldTour.ts` — `MULTIPLIER`, the single-entry cap, rate limits. Changes need `npx convex deploy`.
- `convex/machines.ts` — the machines and their units.
- `src/config.ts` — `GOAL`, `CHALLENGE_NAME`, `CHALLENGE_WINDOW`, `ACTS`, colours, and the full `MILESTONES` list.

## Checking a live deployment

```
npm run acceptance -- <ADMIN_KEY> <LOG_TOKEN>
```

36 checks against the running site and its Convex deployment: that the two key
tiers genuinely separate, that input validation holds, that the Assault Bike
converts miles, that neither key leaks into the shipped bundle, and that a burst
of 30 concurrent logs produces no write conflicts.

It writes a handful of real entries and then resets, so only run it against a
deployment nobody is mid-challenge on. Recover the keys with
`npx convex env get ADMIN_KEY --prod`.
