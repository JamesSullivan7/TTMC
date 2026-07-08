# Tulsa Training — World Tour

September collective challenge: the whole gym rides 40,000,000 meters around the world, together. No names, no leaderboard — one gym, one route, ~60 landmarks from Tulsa all the way back to Tulsa.

## How it works

- The site opens in **member view**: watch-only, no logging. Anyone can open it on their phone.
- **Trainer login** (PIN in `src/config.ts`, currently `0901`) unlocks the entry form, boost toggle, recent-entries undo, and testing tools on that device. "Lock" returns it to member view.
- Trainers log cardio meters: pick the machine, type the meters off the screen, hit **Log it**.
- Every real meter moves the journey 5 meters (the "team tailwind" — set in `convex/worldTour.ts` and applied server-side; nobody ever sees it).
- The dashboard shows a live 3D globe (drag to spin, scroll to zoom) with the logo riding the route and stamping every city passed, the pace ghost, projected arrival date, milestone feed, and per-machine totals.
- Crossing a landmark fires a celebration automatically — with a postcard backdrop if a photo exists at the milestone's `img` path (drop JPGs into `public/postcards/`), and a **Save share card** button that downloads a 1080×1080 branded image for Instagram. Share cards can also be downloaded anytime via the ↓ next to each unlocked milestone.
- **Boost day** (trainer toggle): every entry counts double while active; the TV shows the banner.
- **Daily recap**: each morning the display opens with yesterday's numbers; also available on demand via the button on the globe.
- **Replay the journey**: animates the whole trip from Tulsa to the current position in ~50 seconds — built for the finish party.
- Before September 1 the display shows the **T-minus countdown**.
- **TV mode** button: fullscreen display for the gym TV (double-click the globe or press the small "exit" label to leave).

## Running it

```
npm install
npx convex dev --once   # syncs backend functions (first time on a new machine)
npm run dev             # local dev server
```

Backend: Convex deployment `tt-world-tour` (team james-7ecd5, dev deployment fine-eagle-220). The URL lives in `.env.local`.

## Deploying for September

Same pattern as the calorie challenge app:

1. `npx convex deploy` — pushes functions to the production Convex deployment.
2. Deploy to Vercel with `VITE_CONVEX_URL` set to the **production** Convex URL.
3. Open the site on the gym computer, hit TV mode on the TV browser window.

## Tuning knobs

- `convex/worldTour.ts` — `MULTIPLIER` (the ×5). Change requires `npx convex deploy`.
- `src/config.ts` — goal, dates, machines, colors, and the full `MILESTONES` list (add/edit landmarks freely; cities need lat/lng).
- Boost days: log boosted meters directly, or temporarily raise the multiplier.
