// Pure game rules: no DOM, so it runs (and is tested) in Node too.
import { BOARD_SIZE, COLORS, GENERATOR, SCORING, SHAPES } from './config.js';

export const N = BOARD_SIZE;

export function parseShape({ id, weight = 1, rows }) {
  const cells = [];
  rows.forEach((row, r) => {
    [...row].forEach((ch, c) => {
      if (ch === 'X') cells.push([r, c]);
    });
  });
  return { id, weight, cells, h: rows.length, w: Math.max(...rows.map((row) => row.length)) };
}

export const SHAPE_LIST = SHAPES.map(parseShape);
const SHAPE_BY_ID = new Map(SHAPE_LIST.map((s) => [s.id, s]));
export const shapeOf = (piece) => SHAPE_BY_ID.get(piece.id);

export const idx = (r, c) => r * N + c;
export const createBoard = () => Array(N * N).fill(null);

// Seeded RNG so Journey levels are the same every time you play them.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rng) {
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

export function weightedPick(list, rng) {
  let total = 0;
  for (const item of list) total += item.weight;
  let x = rng() * total;
  for (const item of list) {
    x -= item.weight;
    if (x < 0) return item;
  }
  return list[list.length - 1];
}

export function canPlace(board, shape, row, col) {
  if (row < 0 || col < 0 || row + shape.h > N || col + shape.w > N) return false;
  for (const [r, c] of shape.cells) if (board[idx(row + r, col + c)]) return false;
  return true;
}

export function fitsAnywhere(board, shape) {
  for (let r = 0; r + shape.h <= N; r++) {
    for (let c = 0; c + shape.w <= N; c++) if (canPlace(board, shape, r, c)) return true;
  }
  return false;
}

export function fullLines(board) {
  const rows = [];
  const cols = [];
  for (let r = 0; r < N; r++) {
    let full = true;
    for (let c = 0; c < N && full; c++) full = !!board[idx(r, c)];
    if (full) rows.push(r);
  }
  for (let c = 0; c < N; c++) {
    let full = true;
    for (let r = 0; r < N && full; r++) full = !!board[idx(r, c)];
    if (full) cols.push(c);
  }
  return { rows, cols };
}

// Lines that would clear if `shape` were dropped at (row, col). Assumes the spot is free.
export function previewLines(board, shape, row, col) {
  const b = board.slice();
  for (const [r, c] of shape.cells) b[idx(row + r, col + c)] = true;
  return fullLines(b);
}

export function completesLine(board, shape) {
  for (let r = 0; r + shape.h <= N; r++) {
    for (let c = 0; c + shape.w <= N; c++) {
      if (!canPlace(board, shape, r, c)) continue;
      const { rows, cols } = previewLines(board, shape, r, c);
      if (rows.length || cols.length) return true;
    }
  }
  return false;
}

export function clearScore(lines, combo) {
  if (!lines) return 0;
  return ((SCORING.lineBase * lines * (lines + 1)) / 2) * Math.max(1, combo);
}

function dropAndClear(board, shape, row, col) {
  const b = board.slice();
  for (const [r, c] of shape.cells) b[idx(row + r, col + c)] = true;
  const { rows, cols } = fullLines(b);
  for (const r of rows) for (let c = 0; c < N; c++) b[idx(r, c)] = null;
  for (const c of cols) for (let r = 0; r < N; r++) b[idx(r, c)] = null;
  return b;
}

// Can every shape be placed, in some order, clearing lines along the way?
// Gives up (and says yes) after `budget` probes so dealing never stalls.
export function canPlaceAll(board, shapes, budget = { left: 40000 }) {
  if (!shapes.length) return true;
  for (let i = 0; i < shapes.length; i++) {
    const s = shapes[i];
    const rest = shapes.filter((_, j) => j !== i);
    for (let r = 0; r + s.h <= N; r++) {
      for (let c = 0; c + s.w <= N; c++) {
        if (--budget.left < 0) return true;
        if (canPlace(board, s, r, c) && canPlaceAll(dropAndClear(board, s, r, c), rest, budget)) return true;
      }
    }
  }
  return false;
}

// Deal three pieces. With probability `fairChance` the trio is re-dealt until all
// three can be placed; otherwise each piece only has to fit on its own.
export function generateTray(
  board,
  rng,
  { helpfulChance = GENERATOR.helpfulChance, fairChance = GENERATOR.fairChance, gemNeeds = null } = {},
) {
  const fair = rng() < fairChance;
  let tray;
  for (let attempt = 0; attempt < GENERATOR.fairAttempts; attempt++) {
    tray = dealPieces(board, rng, helpfulChance);
    if (!fair || canPlaceAll(board, tray.map(shapeOf))) break;
  }
  if (gemNeeds) addGems(tray, rng, gemNeeds);
  return tray;
}

function dealPieces(board, rng, helpfulChance) {
  const tray = [];
  const used = new Set();
  let lastColor = -1;
  for (let slot = 0; slot < 3; slot++) {
    let shape = null;
    if (rng() < helpfulChance) {
      const helpful = SHAPE_LIST.filter((s) => !used.has(s.id) && completesLine(board, s));
      if (helpful.length) shape = weightedPick(helpful, rng);
    }
    for (let i = 0; !shape && i < GENERATOR.fitAttempts; i++) {
      const s = weightedPick(SHAPE_LIST, rng);
      const fresh = !used.has(s.id) || i >= GENERATOR.fitAttempts / 2;
      if (fresh && fitsAnywhere(board, s)) shape = s;
    }
    if (!shape) {
      const fitting = SHAPE_LIST.filter((s) => fitsAnywhere(board, s));
      shape = weightedPick(fitting.length ? fitting : SHAPE_LIST, rng);
    }
    used.add(shape.id);
    // Never give two neighbors the same color.
    let color = Math.floor(rng() * (lastColor < 0 ? COLORS.length : COLORS.length - 1));
    if (lastColor >= 0 && color >= lastColor) color++;
    lastColor = color;
    tray.push({ id: shape.id, color, gems: [] });
  }
  return tray;
}

function addGems(tray, rng, needs) {
  const open = needs.filter((n) => n.remaining > 0);
  if (!open.length) return;
  for (const piece of tray) {
    const need = open[Math.floor(rng() * open.length)];
    const chance = need.remaining > need.inPlay ? GENERATOR.gemChanceScarce : GENERATOR.gemChance;
    if (rng() >= chance) continue;
    const size = shapeOf(piece).cells.length;
    const count = size >= 4 && rng() < 0.4 ? 2 : 1;
    piece.color = need.color;
    piece.gems = shuffle([...Array(size).keys()], rng)
      .slice(0, count)
      .sort((a, b) => a - b);
    need.inPlay += count;
  }
}

export class Game {
  constructor(d = {}) {
    this.mode = d.mode ?? 'classic';
    this.board = d.board ?? createBoard();
    this.tray = d.tray ?? [null, null, null];
    this.score = d.score ?? 0;
    this.combo = d.combo ?? 0;
    this.movesSinceClear = d.movesSinceClear ?? 0;
    this.moves = d.moves ?? 0;
    this.level = d.level ?? 0;
    this.goals = d.goals ?? null; // Journey: [{ color, need, got }]
    this.rng = d.rng ?? Math.random;
  }

  static classic(rng) {
    const g = new Game({ mode: 'classic', rng });
    g.refill();
    return g;
  }

  get trayEmpty() {
    return this.tray.every((p) => !p);
  }

  get isOver() {
    const pieces = this.tray.filter(Boolean);
    return pieces.length > 0 && pieces.every((p) => !fitsAnywhere(this.board, shapeOf(p)));
  }

  get isWon() {
    return !!this.goals && this.goals.every((g) => g.got >= g.need);
  }

  fits(slot) {
    const p = this.tray[slot];
    return !!p && fitsAnywhere(this.board, shapeOf(p));
  }

  canPlace(slot, row, col) {
    const p = this.tray[slot];
    return !!p && canPlace(this.board, shapeOf(p), row, col);
  }

  // Classic gets gradually less generous as your score climbs.
  dealOptions() {
    const t = this.mode === 'classic' ? Math.min(1, this.score / GENERATOR.rampScore) : 0;
    const ramp = (from, to) => from + (to - from) * t;
    return {
      helpfulChance: ramp(GENERATOR.helpfulChance, GENERATOR.helpfulChanceMin),
      fairChance: ramp(GENERATOR.fairChance, GENERATOR.fairChanceMin),
      gemNeeds: this.gemNeeds(),
    };
  }

  gemNeeds() {
    if (!this.goals) return null;
    return this.goals.map((g) => ({
      color: g.color,
      remaining: g.need - g.got,
      inPlay: this.board.filter((cell) => cell && cell.g && cell.c === g.color).length,
    }));
  }

  refill() {
    if (!this.trayEmpty) return false;
    this.tray = generateTray(this.board, this.rng, this.dealOptions());
    return true;
  }

  // Drop tray[slot] at (row, col). Returns what happened, or null if the move is illegal.
  place(slot, row, col) {
    const piece = this.tray[slot];
    if (!piece) return null;
    const shape = shapeOf(piece);
    if (!canPlace(this.board, shape, row, col)) return null;

    const placed = shape.cells.map(([r, c], i) => {
      this.board[idx(row + r, col + c)] = { c: piece.color, g: piece.gems?.includes(i) ? 1 : 0 };
      return { r: row + r, c: col + c };
    });
    this.tray[slot] = null;
    this.moves++;

    const { rows, cols } = fullLines(this.board);
    const lines = rows.length + cols.length;
    const cleared = [];
    const gems = [];
    let comboBroken = false;
    let allClear = false;

    if (lines) {
      this.combo++;
      this.movesSinceClear = 0;
      const hit = new Set();
      for (const r of rows) for (let c = 0; c < N; c++) hit.add(idx(r, c));
      for (const c of cols) for (let r = 0; r < N; r++) hit.add(idx(r, c));
      for (const i of hit) {
        const cell = this.board[i];
        const r = Math.floor(i / N);
        const c = i % N;
        cleared.push({ r, c, cell });
        if (cell.g) {
          const goal = this.goals ? this.goals.findIndex((g) => g.color === cell.c && g.got < g.need) : -1;
          if (goal >= 0) this.goals[goal].got++;
          gems.push({ r, c, color: cell.c, goal });
        }
        this.board[i] = null;
      }
      allClear = this.board.every((cell) => !cell);
    } else {
      this.movesSinceClear++;
      if (this.combo && this.movesSinceClear >= SCORING.comboWindow) {
        this.combo = 0;
        comboBroken = true;
      }
    }

    const placePoints = placed.length * SCORING.perCell;
    const clearPoints = clearScore(lines, this.combo) + (allClear ? SCORING.allClearBonus : 0);
    this.score += placePoints + clearPoints;

    return {
      slot,
      piece,
      row,
      col,
      placed,
      rows,
      cols,
      lines,
      cleared,
      gems,
      allClear,
      combo: this.combo,
      comboBroken,
      placePoints,
      clearPoints,
      points: placePoints + clearPoints,
    };
  }

  toJSON() {
    const { mode, board, tray, score, combo, movesSinceClear, moves, level, goals } = this;
    return { v: 1, mode, board, tray, score, combo, movesSinceClear, moves, level, goals };
  }

  static fromJSON(d, rng) {
    if (!d || d.v !== 1 || !Array.isArray(d.board) || d.board.length !== N * N) return null;
    if (!Array.isArray(d.tray) || d.tray.length !== 3) return null;
    if (d.tray.some((p) => p && !SHAPE_BY_ID.has(p.id))) return null;
    const tray = d.tray.map((p) => p && { ...p, gems: p.gems ?? [] });
    return new Game({ ...d, tray, rng });
  }
}
