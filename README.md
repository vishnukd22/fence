# Fence

A one-night heist party game set in Kochi, for 2 to 8 players. One screen is the TV. Everyone else plays on their phone. A game takes about an hour.

## Put it online (about 10 minutes, free)

You need a free GitHub account and a free Render account.

1. Create a new empty repository on GitHub (for example `fence`).
2. Upload everything in this folder to it, except `node_modules`. On github.com you can drag the files into "Add file > Upload files".
3. Go to render.com, sign in with GitHub, and choose **New > Blueprint**. Pick your `fence` repository. Render reads `render.yaml` and sets everything up.
4. Wait for the deploy to finish. Render gives you a link like `https://fence-xxxx.onrender.com`.

That's it. On the free plan the game goes to sleep after 15 minutes with nobody playing, so the first visit of the night takes about a minute to wake up. Open it a few minutes before your friends arrive.

## Play

1. On the TV or laptop, open `your-link/tv` and click **Open the godowns**. Turn the volume up: there is a narrator.
2. Everyone scans the QR code on the TV, or opens `your-link` on their phone and types the 4-letter code.
3. The first person to join presses **Start the game** on their phone.

If a phone locks or drops out, just open the page again. It rejoins automatically.

Tips:
- Chrome or Edge on the TV laptop gives the best narrator voice. The Voice, Sound and Skip buttons sit in the bottom right corner of the TV screen. Space bar skips story screens.
- Phones should stay on the game page. The game asks the phone to keep its screen on.

## Run it on your own computer

You need Node.js 18 or newer.

```
npm install
npm start
```

Then open `http://localhost:3000/tv` on the computer. Phones on the same Wi-Fi can join using the computer's local IP address (for example `http://192.168.1.20:3000`).

## For tinkering

- `server/content.js` holds every item, suspect, heist, event, mission and story line. Add or change things there.
- `server/game.js` is the game engine.
- `public/` holds the TV screen (`host.*`) and the phone controller (`play.*`).
- `FENCE_SPEED=0.06 PORT=3100 npm start` runs every timer much faster. With that running, `npm test` plays a full game with 5 robot players.
