# Tulsa Training — Cross Country

A collective gym challenge: the whole gym covers one long route together, cardio meter by cardio meter. No names, no leaderboard — one gym, one road, a run of landmarks from Tulsa and back.

> **Status: mid-pivot.** This started as an around-the-world challenge (40,000,000 m, eastbound, 3D globe). It is being reworked into a US cross-country route. See "Open decisions" below — the milestone list, goal, and map view are all still the old around-the-world data.

## How it works

- The site opens in **member view**: watch-only, no logging. Anyone can open it on their phone.
- **Trainer login** (PIN in `src/config.ts`, currently `6426`) unlocks the entry form, recent-entries undo, and testing tools on that device. "Lock" returns it to member view.
- Trainers log cardio meters: pick the machine, type the meters off the screen, hit **Log it**.
- Every real meter moves the journey `MULTIPLIER` meters, applied server-side in `convex/worldTour.ts`.
- The dashboard shows a US map with the route drawn across it — the road behind you in brand red, the road ahead dashed — the logo riding the current position, plus the milestone feed and per-machine totals.
- Crossing a landmark fires a celebration automatically — with a postcard backdrop if a photo exists at the milestone's `img` path (drop JPGs into `public/postcards/`), and a **Save share card** button that downloads a 1080×1080 branded image for Instagram. Share cards can also be downloaded anytime via the ↓ next to each unlocked milestone.
- **Daily recap**: each morning the display opens with yesterday's numbers; also available on demand.
- **Replay the journey**: animates the whole trip from the start to the current position in ~50 seconds — built for the finish party.
- **TV mode** button: fullscreen display for the gym TV (double-click the map or press the small "exit" label to leave).

The map is a static SVG (d3-geo `albersUsa` + `us-atlas` state shapes) in a fixed 975x610 viewBox that scales to any screen. No WebGL, no camera, no render loop, no network — it is meant to sit on a TV for a month without anyone touching it.

### Dates are optional

`CHALLENGE_WINDOW` in `src/config.ts` is currently `null`, which means the challenge is **open-ended** — it runs until the route is finished. In that mode the app hides the T-minus countdown, the "Day N of N" counter, the pace ghost, the ahead/behind-pace badge, and the "day N" line on share cards.

Set it to `{ start: new Date('...'), days: N }` and every one of those turns back on by itself. Nothing else needs touching.

## Open decisions

These block the rest of the rebuild:

1. **The route.** Leaning Tulsa → both coasts → home. Route length and `MULTIPLIER` are the *same decision* — see below.
2. **Participation and machines.** The calibration assumes ~182 athletes on the current 5 machines. Both need confirming.
3. **The name.** `CHALLENGE_NAME` in `src/config.ts` is a placeholder (`'Cross Country'`). One line to change; it drives the header, TV title, completion copy, and share cards.

### Sizing the route

The gym's output is the fixed input, not the route. From the calorie challenge (182 athletes) and the machine mix in `simulateDay`:

| | |
|---|---|
| Expected real meters per entry | 3,414 |
| Expected **real** meters per gym day | ~273,000 |
| Expected **real** meters over 30 days | ~8,200,000 |

So `route length ÷ MULTIPLIER ≈ 8,200,000` for a 30-day finish. A US route of ~8,000–9,000 km lands at `MULTIPLIER = 1` — meaning the map scale disappears entirely and every meter rowed is a real meter down the road.

## Running it

```
npm install
npx convex dev --once   # syncs backend functions (first time on a new machine)
npm run dev             # local dev server
```

Backend: Convex deployment `tt-world-tour` (team james-7ecd5, dev deployment fine-eagle-220). The URL lives in `.env.local`.

## Deploying

First time, run the wizard — it does all of the below, generates the production
trainer key, and proves the destructive mutations are actually locked down
before it hands you the URL:

```
bash scripts/first-deploy.sh
```

It is safe to re-run; it offers to keep the existing production key rather than
rotating it out from under the trainers' devices.

By hand, it is:

1. `npx convex deploy` — pushes functions to the production Convex deployment.
2. `npx convex env set ADMIN_KEY <value> --prod` — production needs its own key.
3. Deploy to Vercel with `VITE_CONVEX_URL` set to the **production** Convex URL.
4. Open the site on the gym computer, hit TV mode on the TV browser window.

**Not yet done.** There is no Vercel project and no Convex production deployment. Also note every Convex mutation is currently unauthenticated — including `resetChallenge`, which wipes the challenge — and `VITE_CONVEX_URL` ships in the client bundle. That needs locking down before this goes on a public URL.

## Tuning knobs

- `convex/worldTour.ts` — `MULTIPLIER`. Change requires `npx convex deploy`.
- `src/config.ts` — `GOAL`, `CHALLENGE_NAME`, `CHALLENGE_WINDOW`, `KIOSK_PIN`, machines, colors, and the full `MILESTONES` list (add/edit landmarks freely; cities need lat/lng). `ROUTE` derives from `MILESTONES`, so swapping the route is a data edit, not a code change.
