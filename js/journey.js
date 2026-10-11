// Journey mode: endless numbered levels. Each one starts with a pre-filled board
// and asks you to collect gems by clearing the lines they sit in.
import { COLORS, JOURNEY } from './config.js';
import {
  Game,
  N,
  SHAPE_LIST,
  canPlace,
  createBoard,
  fullLines,
  idx,
  mulberry32,
  shuffle,
  weightedPick,
} from './engine.js';

const levelSeed = (level) => Math.imul(level, 2654435761) >>> 0;

export function makeLevel(level) {
  const rng = mulberry32(levelSeed(level));
  const types = level <= 2 ? 1 : level <= 9 ? 2 : 3;
  const colors = shuffle([...COLORS.keys()], rng).slice(0, types);
  const perGoal = Math.min(JOURNEY.maxPerGoal, JOURNEY.basePerGoal + Math.floor((level - 1) * JOURNEY.perLevel));
  const share = [1, 0.75, 0.6][types - 1];
  const goals = colors.map((color) => ({ color, need: Math.max(3, Math.round(perGoal * share)), got: 0 }));

  const density = Math.min(JOURNEY.maxDensity, JOURNEY.baseDensity + (level - 1) * JOURNEY.densityPerLevel);
  const board = prefill(rng, density);

  const filled = shuffle(
    board.map((cell, i) => (cell ? i : -1)).filter((i) => i >= 0),
    rng,
  );
  let k = 0;
  for (const g of goals) {
    const count = Math.ceil(g.need * JOURNEY.startGemShare);
    for (let j = 0; j < count && k < filled.length; j++, k++) board[filled[k]] = { c: g.color, g: 1 };
  }
  return { level, board, goals, seed: levelSeed(level) ^ 0x9e3779b9 };
}

function prefill(rng, density) {
  const board = createBoard();
  const target = Math.round(density * N * N);
  let filled = 0;
  for (let tries = 0; filled < target && tries < 500; tries++) {
    const s = weightedPick(SHAPE_LIST, rng);
    const r = Math.floor(rng() * (N - s.h + 1));
    const c = Math.floor(rng() * (N - s.w + 1));
    if (!canPlace(board, s, r, c)) continue;
    const color = Math.floor(rng() * COLORS.length);
    for (const [dr, dc] of s.cells) board[idx(r + dr, c + dc)] = { c: color, g: 0 };
    filled += s.cells.length;
  }
  // Never start a level with a line already complete.
  for (;;) {
    const { rows, cols } = fullLines(board);
    if (rows.length) board[idx(rows[0], Math.floor(rng() * N))] = null;
    else if (cols.length) board[idx(Math.floor(rng() * N), cols[0])] = null;
    else break;
  }
  return board;
}

export function newJourneyGame(level) {
  const { board, goals, seed } = makeLevel(level);
  const game = new Game({ mode: 'journey', level, board, goals, rng: mulberry32(seed) });
  game.refill();
  return game;
}
