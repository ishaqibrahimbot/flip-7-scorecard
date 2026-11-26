# Flip 7 Scorecard

An offline-only Progressive Web App for keeping score in Flip 7.

- Enter player names separated by commas, and set the points to win (default 200).
- After each round, enter each player's round score. Totals add up and players are ranked automatically.
- When someone reaches the target, the highest total wins. If the lead is tied, the tied players play tie-break rounds.
- Undo the last round, or edit any round from the round history.
- A results screen shows the winner, final standings, number of rounds and the highest single round.

Everything runs on the device: no network requests, no accounts, no analytics. The game is saved in `localStorage`, and a service worker precaches every file, so after the first visit the app opens and works with no connection.

## Running it

It is plain HTML, CSS and JavaScript with no build step. Serve the folder over HTTPS (or `localhost`) from any static host, such as GitHub Pages, open it once, then use "Add to Home Screen" / "Install app".

Locally: `python3 -m http.server 8000`, then open http://localhost:8000.

When you change any file, bump `CACHE` in `sw.js` so installed copies pick up the update.
