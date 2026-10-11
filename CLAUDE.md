# Color Block

Ad-free block puzzle web app (vanilla JS, no build step, no dependencies). See README.md for the layout.

## Workflow

- When the user asks for a change: commit, push, open a PR into `main`, and merge it once the `test` check passes. Don't ask first. Merging to `main` deploys to GitHub Pages (`.github/workflows/deploy.yml`).

## Before pushing

- `npm test` (game rules in `js/engine.js` and `js/journey.js` are unit-tested)
- `prettier --check "js/**/*.js" "tests/*.mjs" sw.js styles.css index.html`
- If you add a file the game loads, add it to `FILES` in `sw.js` and bump `VERSION`.
- Gameplay numbers belong in `js/config.js`.
