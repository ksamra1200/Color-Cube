# Color Block

An ad-free take on **Color Block: Combo Blast** for you and your friends. It's a web app: open it in Safari, add it to your Home Screen, and it runs full-screen like a normal app, even offline.

## How to play

- Drag pieces from the tray onto the 8×8 board. Pieces can't be rotated.
- Fill a whole row or column to clear it. Clearing several lines at once earns more points, plus **Good! Great! Excellent! Amazing! Unbelievable!**
- **Combos:** clear again within 3 moves to keep a combo going. Every clear is multiplied by the combo count. The orange badge shows the combo, and its dots show the moves you have left.
- Empty the whole board for a **Perfect!** bonus.
- The game ends when none of your remaining pieces fit.

**Classic** is endless high-score play, and your best score is the crown.
**Journey** is a series of numbered levels. Each one starts with a partly filled board, and you clear the lines that hold gems until you've collected every goal.

Your game saves after every move, so you can close the app and pick up where you left off. Scores and progress are stored on each phone separately.

## Put it on your phones

The game is a set of static files, so any static host works. GitHub Pages is free:

1. Merge this branch into `main`.
2. On GitHub, open the repo → **Settings → Pages**. Under **Build and deployment**, pick **Deploy from a branch**, then select `main` and `/ (root)` and click Save.
3. After a minute it's live at `https://<your-username>.github.io/Color-Cube/`.
4. On each iPhone, open that link in **Safari**, tap **Share → Add to Home Screen**.

## Run it on your computer

```sh
npm start        # serves the folder at http://localhost:8080
npm test         # game-rule tests (Node 18+)
```

There's no build step and there are no dependencies. Edit a file and reload the page.

## Customizing

Almost everything lives in [`js/config.js`](js/config.js):

| Setting | What it changes |
| --- | --- |
| `COLORS`, `THEME` | Block colors, board colors |
| `SCORING` | Points per block and per line, combo window, all-clear bonus |
| `PRAISE` | The words for multi-line clears |
| `SHAPES` | Every piece shape (drawn with `X` and `.`) and how often it's dealt |
| `GENERATOR` | How generous dealing is and how it ramps up as your score grows |
| `JOURNEY` | Gems per level, how full the starting boards are, difficulty curve |

Other files:

- `styles.css`: the menus, buttons, HUD and popup text
- `js/render.js`: how blocks and gems are drawn
- `js/audio.js`: sound effects. They're generated in code, so there are no audio files.
- `scripts/make_icons.py`: regenerates the Home Screen icons (`python3 scripts/make_icons.py`, needs Pillow)
- Open the game with `?debug` on the URL to get `window.colorBlock` in the browser console

**Offline caching:** the app always fetches the newest files when online and falls back to the saved copy offline, so your friends get your changes on their next launch. If you add a new file, also add it to the `FILES` list in `sw.js` and bump `VERSION`.

## Project layout

```
index.html            page shell: home screen, HUD, modals
styles.css
manifest.webmanifest  makes it installable
sw.js                 offline support
js/
  config.js           all the tunable numbers
  engine.js           game rules (no DOM, unit-tested)
  journey.js          Journey level generator
  game.js             play screen: input, animation, drawing
  render.js           block and gem drawing
  main.js             menus, saving, wiring
  audio.js, haptics.js, storage.js
tests/engine.test.mjs
icons/
```
