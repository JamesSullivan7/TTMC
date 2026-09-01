# Tulsa Training — Cross Country

A collective gym challenge. The whole gym drives one route together, cardio meter by cardio meter: **Tulsa → Los Angeles → New York → Tulsa, 8,473,348 meters, through September 2026.** No names, no leaderboard — one gym, one road.

Westbound first, so the gym leaves town on Route 66 — which runs through Tulsa — and reaches the end of it at the Santa Monica Pier. The distance is the same either way round; the story is not.

**Live:** https://tt-cross-country.vercel.app

Every meter someone rows is a meter of road. There is no map scale and nothing hidden — see [Sizing](#sizing-the-route) for why that works out.

## Seven surfaces

| URL | Who | What |
|---|---|---|
| `/` | anyone watching, and the trainer computer | the map, the milestone feed, per-machine totals |
| `/tv` | the gym TV, usually a cast tab | the display layout, locked — no trainer UI, nothing to log in to |
| `/log` | a member's phone | log your own meters, reached by scanning a machine's QR |
| `/me` | a member's phone | what you have done, and on which machines |
| `/join` | a member's phone | claim your meters before September |
| `/pledge` | the gym TV, before the 1st | the pledge board — `/tv` serves this until the challenge starts |
| `/pledges` | a trainer | who pledged what, searchable, and who has not pledged yet |
| `/qr` | a trainer, once | print the QR cards to tape on the machines |

`/me` and `/join` are only ever reached by scanning a printed card, so both take
the log token in the URL and strip it back out of the address bar — one scan
sets a phone up to pledge now, check its own meters, and log more later, and a
screenshot of either page leaks nothing.

There is no router library — `src/main.tsx` checks the path. `vercel.json` rewrites everything to `index.html` so those survive a refresh.

## How it works

- The site opens in **member view**: watch-only. Anyone can open it on their phone.
- **Members log their own meters** by scanning the QR on a machine. That opens `/log` with the machine already picked, and hands them the moment afterwards: *"You just moved us 10,300 meters down the road — 10 km closer to Joplin."* One person's meters are 0.02% of the goal, but they are always a nameable piece of road.
- **Trainer login** unlocks the entry form on the gym computer, plus recent-entries undo and the testing tools. Trainers can log for anyone who will not use a phone.
- The dashboard shows a US map with the route drawn across it — road behind you in brand red, road ahead dashed — the logo riding the current position.
- Crossing a landmark fires a celebration, with a postcard backdrop if one exists, and a **Save share card** button that downloads a 1080×1080 branded image for Instagram.
- **Today vs. our best day** replaces a deadline as the source of urgency. The room races its own history, which is the point of having no leaderboard.
- **Daily recap** each morning, **Replay the journey** (~50s, built for the finish party), and **TV mode** for the gym screen.

The map is a static SVG (`d3-geo` `albersUsa` + `us-atlas` state shapes) that scales
to any screen. No WebGL, no camera, no render loop, no network call — it has to sit
on a TV for a month unattended.

**A state fills in once the road reaches it**, tinted by the act that got you there:
dark red for the Mother Road, brand red for the Long Haul, pink for the Run Home —
the same three tones as the act bars underneath. Twenty states across the month, so
the country slowly becomes a record of how the journey was made rather than just how
far it got. `src/stateCrossings.ts` holds that data and is generated:

```
node scripts/state-crossings.mjs      # re-run whenever the route changes
```

A test recomputes it from the real geometry and fails if the committed file is stale,
because route data and data derived from it drift apart silently — reversing the route
once already proved that.

What motion there is comes from SVG `<animate>` rather than React: the road ahead
drifts forward so the direction of travel is obvious at a glance, the last 700 km
glows, and the next stop pulses. The browser runs all of it on the compositor, so
nothing re-renders and nothing burns battery on a machine casting all day.

The look is tuned by the block of constants at the top of `src/MapView.tsx` —
`LIT_STRENGTH` is the first dial to reach for if the states want to be bolder or
quieter.

## Keys

Three tiers, all held ONLY in the Convex deployment environment. None is ever
in the bundle or the repo.

| | `LOG_TOKEN` | `TRAINER_PIN` | `ADMIN_KEY` |
|---|---|---|---|
| who has it | any member who scanned a QR | every trainer | you |
| log meters, for anyone | ✅ | ✅ | ✅ |
| undo an entry | ❌ | ✅ | ✅ |
| print the QR cards | ❌ | ✅ | ✅ |
| reset / simulate | ❌ | ❌ | ✅ |

Anyone not logged in can see everything — the map, the totals, the milestones —
and change nothing.

```
npx convex env set TRAINER_PIN 6426 --prod
npx convex env set ADMIN_KEY <long random> --prod
npx convex env set LOG_TOKEN <long random> --prod
npx convex env get TRAINER_PIN --prod        # recover one
```

**Why the PIN cannot reset.** Four digits is the right trade for something
trainers type at the gym all day — but it is 10,000 guesses against a public
endpoint, so it must not be able to erase a month of 182 people's work. Reset
and simulate keep the long key, and the UI asks for it at the moment it is
needed rather than caching it, so an unlocked gym computer left unattended
cannot wipe the challenge.

`LOG_TOKEN` rides in the QR URL, so you cannot get it by reading the site's
source — you have to have stood in the gym and pointed a camera at a machine.
A leaked QR costs you some junk entries, not the month. `/log` stores the token
then strips it from the address bar, so a screenshot does not leak it.

## Machines and units

The **Assault Bike reads in kilometers**; everything else reads in meters. The unit is part of the machine definition in `convex/machines.ts`, shared by the server and the UI, and conversion happens server-side — so nothing downstream ever holds a number whose unit is ambiguous. The form follows the machine: the label switches to Kilometers, decimals are allowed, and a live line shows `2.08 km = 2,080 meters` before you commit.

The bike's screen writes a **decimal comma** — `02,08` is 2.08 km — so `parseAmount` reads the separator by unit rather than guessing: on a distance machine a comma is the decimal point, on a meters machine it can only be a thousands mark (`2,000` is 2000). Guessing wrong is a silent 100x error in either direction, which is why the machine decides and not a digit-counting heuristic.

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
npm test                # 57 tests: route data, geometry, units, and the two pages
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

Each milestone can have a photo behind its celebration, at `public/postcards/<file>.jpg`. **23 of the 42 are in place**, and `docs/postcards-needed.md` lists every one still missing with a search for it. Reversing the route direction cost none of them — the cities are the same, only the order changed.

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
npm run acceptance -- <ADMIN_KEY> <LOG_TOKEN> <TRAINER_PIN>
```

68 checks against the running site and its Convex deployment: that the three key
tiers genuinely separate — in particular that the four-digit trainer PIN cannot reset or simulate — that input validation holds, that the Assault Bike
converts kilometers, that neither key leaks into the shipped bundle, and that a burst
of 30 concurrent logs produces no write conflicts.

It writes a handful of real entries and then resets, so only run it against a
deployment nobody is mid-challenge on. Recover the keys with
`npx convex env get ADMIN_KEY --prod`.
