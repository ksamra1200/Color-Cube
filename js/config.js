// Every gameplay knob lives here. Tweak values, reload, play.

export const BOARD_SIZE = 8;

// Block colors. Order matters only for saved games (cells store the index).
export const COLORS = [
  { name: 'red', hex: '#f04848' },
  { name: 'orange', hex: '#ff9330' },
  { name: 'yellow', hex: '#ffcf33' },
  { name: 'green', hex: '#5acb4e' },
  { name: 'cyan', hex: '#35c6ea' },
  { name: 'blue', hex: '#3f73ee' },
  { name: 'purple', hex: '#9b5cf0' },
  { name: 'pink', hex: '#f262b5' },
];

export const THEME = {
  board: '#1d2858',
  boardEdge: '#151e45',
  cell: '#26336b',
  gray: '#7a83a6',
};

export const SCORING = {
  perCell: 1, // points for every block you place
  lineBase: 10, // 1 line = 10, 2 = 30, 3 = 60, 4 = 100 ... then x combo
  comboWindow: 3, // clear again within this many moves to keep the combo alive
  allClearBonus: 300, // emptying the whole board
};

// Shown when you clear this many lines in one move (6 = "6 or more").
export const PRAISE = {
  2: 'Good!',
  3: 'Great!',
  4: 'Excellent!',
  5: 'Amazing!',
  6: 'Unbelievable!',
};

// How new pieces are dealt. In Classic, each "...Chance" slides from its start
// value to its "...Min" value as your score climbs to rampScore.
export const GENERATOR = {
  rampScore: 10000,
  fairChance: 1, // chance the three pieces are guaranteed to all fit together
  fairChanceMin: 0.7,
  fairAttempts: 12, // re-deals to try before giving up on a fair trio
  helpfulChance: 0.35, // chance a slot gets a piece that can complete a line right now
  helpfulChanceMin: 0.12,
  fitAttempts: 30, // random tries to find a piece that fits before scanning all shapes
  gemChance: 0.18, // Journey: chance a piece carries a gem
  gemChanceScarce: 0.55, // ...when the board doesn't have enough gems left to finish
};

export const JOURNEY = {
  basePerGoal: 4, // gems needed per goal on level 1
  perLevel: 0.7, // extra gems per level
  maxPerGoal: 24,
  baseDensity: 0.22, // share of the board pre-filled on level 1
  densityPerLevel: 0.012,
  maxDensity: 0.48,
  startGemShare: 0.5, // share of each goal already sitting on the starting board
  worldSize: 15, // levels per world on the map
  // Star targets, in moves, from the total number of gems a level asks for:
  // 3 stars within threeBase + threePerGem * gems, 2 stars within twoBase + twoPerGem * gems.
  stars: { threeBase: 6, threePerGem: 0.9, twoBase: 12, twoPerGem: 1.35 },
};

// Map worlds, bottom to top. After the last one they repeat as "II", "III", ...
// `sky` is the background at the bottom of the world; it blends into the next world's.
export const WORLDS = [
  { name: 'Rainbow Meadow', sky: '#6fd37a', node: '#ff7a3d', deco: ['#ffcf33', '#f04848', '#3f73ee'] },
  { name: 'Bubblegum Bay', sky: '#6fd3f0', node: '#f262b5', deco: ['#ffffff', '#f262b5', '#9b5cf0'] },
  { name: 'Lemon Dunes', sky: '#ffd56b', node: '#e8732a', deco: ['#ff9330', '#5acb4e', '#f04848'] },
  { name: 'Crystal Caves', sky: '#6b55d9', node: '#35c6ea', deco: ['#35c6ea', '#f262b5', '#ffffff'] },
  { name: 'Frosty Peaks', sky: '#9fd2f7', node: '#3f73ee', deco: ['#ffffff', '#35c6ea', '#3f73ee'] },
  { name: 'Lava Ridge', sky: '#ef6a45', node: '#ffb21f', deco: ['#ffcf33', '#ff9330', '#7a1d1d'] },
  { name: 'Galaxy Garden', sky: '#2e2a7a', node: '#9b5cf0', deco: ['#ffffff', '#ffcf33', '#35c6ea'] },
];

// Piece shapes: 'X' = block, '.' = gap. Weight = how often it's dealt.
const S = (id, weight, ...rows) => ({ id, weight, rows });
export const SHAPES = [
  S('dot', 1, 'X'),

  S('i2h', 2, 'XX'),
  S('i2v', 2, 'X', 'X'),
  S('i3h', 2.4, 'XXX'),
  S('i3v', 2.4, 'X', 'X', 'X'),
  S('i4h', 2, 'XXXX'),
  S('i4v', 2, 'X', 'X', 'X', 'X'),
  S('i5h', 1.3, 'XXXXX'),
  S('i5v', 1.3, 'X', 'X', 'X', 'X', 'X'),

  S('sq2', 3, 'XX', 'XX'),
  S('sq3', 1.2, 'XXX', 'XXX', 'XXX'),
  S('r23', 1.4, 'XXX', 'XXX'),
  S('r32', 1.4, 'XX', 'XX', 'XX'),

  S('c3a', 1.5, 'XX', 'X.'),
  S('c3b', 1.5, 'XX', '.X'),
  S('c3c', 1.5, 'X.', 'XX'),
  S('c3d', 1.5, '.X', 'XX'),

  S('c5a', 1, 'XXX', 'X..', 'X..'),
  S('c5b', 1, 'XXX', '..X', '..X'),
  S('c5c', 1, 'X..', 'X..', 'XXX'),
  S('c5d', 1, '..X', '..X', 'XXX'),

  S('l4a', 1, 'X.', 'X.', 'XX'),
  S('l4b', 1, '.X', '.X', 'XX'),
  S('l4c', 1, 'XX', 'X.', 'X.'),
  S('l4d', 1, 'XX', '.X', '.X'),
  S('l4e', 1, 'XXX', 'X..'),
  S('l4f', 1, 'XXX', '..X'),
  S('l4g', 1, 'X..', 'XXX'),
  S('l4h', 1, '..X', 'XXX'),

  S('t4a', 1.1, 'XXX', '.X.'),
  S('t4b', 1.1, '.X.', 'XXX'),
  S('t4c', 1.1, 'X.', 'XX', 'X.'),
  S('t4d', 1.1, '.X', 'XX', '.X'),

  S('s4a', 0.8, '.XX', 'XX.'),
  S('s4b', 0.8, 'XX.', '.XX'),
  S('s4c', 0.8, 'X.', 'XX', '.X'),
  S('s4d', 0.8, '.X', 'XX', 'X.'),
];
