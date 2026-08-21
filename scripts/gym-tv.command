#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────
#  Tulsa Training — Cross Country : launch the gym TV display  (macOS)
#
#  Copy this file onto the gym Mac (desktop is fine) and double-click it.
#  It opens the challenge full screen with no address bar and no tabs, and
#  stops the display going to sleep for the rest of the month.
#
#  To quit the display : Cmd+Q  (or Ctrl+Cmd+F to leave full screen first)
#  To let it sleep again: run  killall caffeinate
#
#  Do NOT log in as a trainer on this machine. This is the wall display, and
#  a trainer session would park an entry form and a Reset button in front of
#  everyone for a month. Members log from their phones via the QR codes.
# ──────────────────────────────────────────────────────────────────────────

SITE="https://tt-cross-country.vercel.app"

cat <<'BANNER'

  TULSA TRAINING — CROSS COUNTRY
  Starting the gym display...

BANNER

CHROME="/Applications/Google Chrome.app"
EDGE="/Applications/Microsoft Edge.app"

if [ -d "$CHROME" ]; then
  echo "  Chrome found — opening in kiosk mode."
  open -na "$CHROME" --args --kiosk --disable-session-crashed-bubble --noerrdialogs "$SITE"
elif [ -d "$EDGE" ]; then
  echo "  Edge found — opening in kiosk mode."
  open -na "$EDGE" --args --kiosk "$SITE" --edge-kiosk-type=fullscreen
else
  echo "  No Chrome or Edge — falling back to Safari."
  echo "  Once it opens, press Ctrl+Cmd+F for full screen, then hit TV mode."
  open -a Safari "$SITE"
fi

# Keep the display awake. Without this the Mac blanks the screen after a few
# minutes and the gym is looking at nothing. -d holds the display awake, -i
# the system, -s prevents sleep on AC power.
killall caffeinate >/dev/null 2>&1
nohup caffeinate -dis >/dev/null 2>&1 &
disown 2>/dev/null

cat <<'DONE'
  Display is up, and the screen will not sleep.

  If the TV is a SECOND display rather than a mirror, drag the browser
  window onto the TV first, then re-run this so it opens full screen there.

  You can close this Terminal window — the display keeps running.
  To allow the screen to sleep again later:  killall caffeinate

DONE

sleep 6
