import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SCORING } from '../js/config.js';
import {
  Game,
  N,
  SHAPE_LIST,
  canPlace,
  canPlaceAll,
  clearScore,
  createBoard,
  fitsAnywhere,
  fullLines,
  generateTray,
  idx,
  mulberry32,
  parseShape,
  previewLines,
  shapeOf,
} from '../js/engine.js';
import { makeLevel, newJourneyGame } from '../js/journey.js';

const block = (c = 0, g = 0) => ({ c, g });
const piece = (id, color = 0, gems = []) => ({ id, color, gems });

function fillRow(board, r, except = []) {
  for (let c = 0; c < N; c++) if (!except.includes(c)) board[idx(r, c)] = block();
}

test('shapes parse with correct size', () => {
  const s = parseShape({ id: 'x', rows: ['XXX', 'X..'] });
  assert.equal(s.w, 3);
  assert.equal(s.h, 2);
  assert.deepEqual(s.cells, [
    [0, 0],
    [0, 1],
    [0, 2],
    [1, 0],
  ]);
  const ids = new Set(SHAPE_LIST.map((x) => x.id));
  assert.equal(ids.size, SHAPE_LIST.length, 'shape ids are unique');
  for (const shape of SHAPE_LIST) assert.ok(shape.cells.length > 0 && shape.w <= N && shape.h <= N);
});

test('canPlace respects edges and overlaps', () => {
  const board = createBoard();
  const i3 = shapeOf(piece('i3h'));
  assert.ok(canPlace(board, i3, 0, 5));
  assert.ok(!canPlace(board, i3, 0, 6));
  assert.ok(!canPlace(board, i3, -1, 0));
  board[idx(4, 4)] = block();
  assert.ok(!canPlace(board, i3, 4, 2));
  assert.ok(canPlace(board, i3, 4, 5));
});

test('completing a row clears it and scores', () => {
  const g = new Game();
  fillRow(g.board, 7, [6, 7]);
  g.tray = [piece('i2h'), null, null];
  const res = g.place(0, 7, 6);
  assert.equal(res.lines, 1);
  assert.deepEqual(res.rows, [7]);
  assert.equal(res.cleared.length, N);
  assert.ok(g.board.every((cell) => !cell));
  assert.equal(res.combo, 1);
  assert.equal(res.allClear, true);
  assert.equal(g.score, 2 + clearScore(1, 1) + SCORING.allClearBonus);
});

test('row + column clear counts the shared cell once', () => {
  const g = new Game();
  fillRow(g.board, 0, [0]);
  for (let r = 1; r < N; r++) g.board[idx(r, 0)] = block();
  g.board[idx(5, 5)] = block(); // keeps the board from being all-clear
  g.tray = [piece('dot'), null, null];
  const res = g.place(0, 0, 0);
  assert.equal(res.lines, 2);
  assert.equal(res.cleared.length, N * 2 - 1);
  assert.equal(res.allClear, false);
  assert.equal(res.clearPoints, clearScore(2, 1));
});

test('combo grows on consecutive clears and breaks after the window', () => {
  const g = new Game();
  g.board[idx(0, 0)] = block(); // never clears, so no all-clear bonus
  const clearRow = (r) => {
    fillRow(g.board, r, [7]);
    g.tray = [piece('dot'), null, null];
    return g.place(0, r, 7);
  };
  assert.equal(clearRow(7).combo, 1);
  assert.equal(clearRow(7).combo, 2);
  const third = clearRow(7);
  assert.equal(third.combo, 3);
  assert.equal(third.clearPoints, clearScore(1, 3));

  // Two quiet moves keep the combo alive...
  for (const col of [2, 4]) {
    g.tray = [piece('dot'), null, null];
    const res = g.place(0, 3, col);
    assert.equal(res.combo, 3);
    assert.equal(res.comboBroken, false);
  }
  // ...the third one breaks it.
  g.tray = [piece('dot'), null, null];
  const res = g.place(0, 3, 6);
  assert.equal(res.combo, 0);
  assert.equal(res.comboBroken, true);
});

test('illegal moves are rejected without changing state', () => {
  const g = new Game();
  g.board[idx(0, 0)] = block();
  g.tray = [piece('sq2'), null, null];
  const before = JSON.stringify(g.toJSON());
  assert.equal(g.place(0, 0, 0), null);
  assert.equal(g.place(0, 7, 7), null);
  assert.equal(g.place(1, 3, 3), null);
  assert.equal(JSON.stringify(g.toJSON()), before);
});

test('game is over only when no tray piece fits', () => {
  const g = new Game();
  for (let i = 0; i < N * N; i++) g.board[i] = block();
  g.board[idx(3, 3)] = null;
  g.tray = [piece('sq2'), piece('i2h'), null];
  assert.equal(g.isOver, true);
  g.tray[2] = piece('dot');
  assert.equal(g.isOver, false);
});

test('previewLines matches what place() clears', () => {
  const g = new Game();
  fillRow(g.board, 2, [3, 4, 5]);
  const shape = shapeOf(piece('i3h'));
  assert.deepEqual(previewLines(g.board, shape, 2, 3), { rows: [2], cols: [] });
  assert.deepEqual(previewLines(g.board, shape, 1, 3), { rows: [], cols: [] });
});

test('dealt pieces fit the board whenever something can', () => {
  const rng = mulberry32(42);
  for (let trial = 0; trial < 200; trial++) {
    const board = createBoard();
    for (let i = 0; i < N * N; i++) if (rng() < 0.6) board[i] = block();
    const anyFits = SHAPE_LIST.some((s) => fitsAnywhere(board, s));
    const tray = generateTray(board, rng);
    assert.equal(tray.length, 3);
    for (const p of tray) {
      if (anyFits) assert.ok(fitsAnywhere(board, shapeOf(p)), `trial ${trial}: ${p.id} should fit`);
    }
    assert.notEqual(tray[0].color, tray[1].color);
    assert.notEqual(tray[1].color, tray[2].color);
  }
});

test('canPlaceAll accounts for order and line clears', () => {
  // Full board except a diagonal of single holes: no line is complete, no 2x2 fits.
  const board = createBoard();
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (r !== c) board[idx(r, c)] = block();
  const dot = shapeOf(piece('dot'));
  const sq2 = shapeOf(piece('sq2'));
  const i2 = shapeOf(piece('i2h'));
  assert.equal(canPlaceAll(board, [sq2]), false);
  assert.equal(canPlaceAll(board, [sq2, sq2]), false);
  // A dot in a hole clears its row and column, which makes room for the others.
  assert.equal(canPlaceAll(board, [sq2, dot]), true);
  assert.equal(canPlaceAll(board, [i2, dot, dot]), true);
});

test('fair deals can be fully placed far more often than unfair ones', () => {
  const rng = mulberry32(99);
  const solvable = { fair: 0, unfair: 0 };
  const trials = 150;
  for (let trial = 0; trial < trials; trial++) {
    const board = createBoard();
    for (let i = 0; i < N * N; i++) if (rng() < 0.55) board[i] = block();
    for (const mode of ['fair', 'unfair']) {
      const tray = generateTray(board, rng, { fairChance: mode === 'fair' ? 1 : 0, helpfulChance: 0 });
      if (canPlaceAll(board, tray.map(shapeOf), { left: 1e7 })) solvable[mode]++;
    }
  }
  assert.ok(solvable.fair >= trials * 0.95, `fair deals solvable ${solvable.fair}/${trials}`);
  assert.ok(solvable.fair > solvable.unfair, JSON.stringify(solvable));
});

test('classic game deals a full tray and refills only when empty', () => {
  const g = Game.classic(mulberry32(7));
  assert.ok(g.tray.every(Boolean));
  assert.equal(g.refill(), false);
  g.tray = [null, null, null];
  assert.equal(g.refill(), true);
  assert.ok(g.tray.every(Boolean));
});

test('save and restore round-trips', () => {
  const g = Game.classic(mulberry32(3));
  const slot = g.tray.findIndex(Boolean);
  const shape = shapeOf(g.tray[slot]);
  g.place(slot, 0, 0) || g.place(slot, N - shape.h, N - shape.w);
  const json = JSON.parse(JSON.stringify(g));
  const back = Game.fromJSON(json);
  assert.deepEqual(back.toJSON(), g.toJSON());
  assert.equal(Game.fromJSON(null), null);
  assert.equal(Game.fromJSON({ v: 1, board: [], tray: [] }), null);
  assert.equal(Game.fromJSON({ ...json, tray: [piece('nope'), null, null] }), null);
});

test('journey levels are deterministic and start without full lines', () => {
  for (let level = 1; level <= 60; level++) {
    const a = makeLevel(level);
    const b = makeLevel(level);
    assert.deepEqual(a, b);
    const { rows, cols } = fullLines(a.board);
    assert.equal(rows.length + cols.length, 0, `level ${level} starts with a full line`);
    assert.ok(a.goals.length >= 1 && a.goals.length <= 3);
    for (const goal of a.goals) {
      assert.ok(goal.need >= 3);
      assert.equal(goal.got, 0);
    }
    const gems = a.board.filter((cell) => cell && cell.g).length;
    assert.ok(gems > 0, `level ${level} has starting gems`);
    const game = newJourneyGame(level);
    assert.equal(game.isOver, false, `level ${level} is playable`);
  }
});

test('clearing a gem counts toward its goal and wins the level', () => {
  const g = new Game({ mode: 'journey', goals: [{ color: 4, need: 1, got: 0 }] });
  fillRow(g.board, 0, [7]);
  g.board[idx(0, 2)] = block(4, 1);
  g.board[idx(6, 6)] = block();
  g.tray = [piece('dot'), null, null];
  assert.equal(g.isWon, false);
  const res = g.place(0, 0, 7);
  assert.deepEqual(res.gems, [{ r: 0, c: 2, color: 4, goal: 0 }]);
  assert.equal(g.goals[0].got, 1);
  assert.equal(g.isWon, true);
});

test('journey deals gems in goal colors', () => {
  let gemPieces = 0;
  for (let level = 1; level <= 30; level++) {
    const g = newJourneyGame(level);
    const goalColors = g.goals.map((x) => x.color);
    for (let round = 0; round < 10; round++) {
      g.tray = [null, null, null];
      g.refill();
      for (const p of g.tray) {
        if (!p.gems.length) continue;
        gemPieces++;
        assert.ok(goalColors.includes(p.color));
        assert.ok(p.gems.every((i) => i >= 0 && i < shapeOf(p).cells.length));
      }
    }
  }
  assert.ok(gemPieces > 0);
});
