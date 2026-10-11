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

// Map districts, bottom to top. After the last one they repeat as "II", "III", ...
// lit > 0 makes it a night district: that share of windows glow in the `windows` colors.
export const WORLDS = [
  {
    name: 'Downtown',
    node: '#ff7a3d',
    ground: '#bcc6d2',
    road: { asphalt: '#555d6e', sidewalk: '#e6e2d8', curb: '#a8a397', lane: '#ffffff' },
    buildings: ['#f2b07e', '#e47f6c', '#78aed3', '#f3d06a', '#9fcfa7', '#c7a2e0'],
    windows: ['#e3f4ff', '#b9dcf5'],
    trees: '#4fb35a',
  },
  {
    name: 'Harbor Heights',
    node: '#3f73ee',
    ground: '#a9c4cf',
    road: { asphalt: '#4d5868', sidewalk: '#e8eef0', curb: '#9fb0b8', lane: '#ffffff' },
    buildings: ['#f4f1de', '#5fa8d3', '#e07a5f', '#3d5a80', '#81b29a', '#f2cc8f'],
    windows: ['#e6f7ff', '#c4e6fa'],
    trees: '#3fa36b',
  },
  {
    name: 'Sunset Boulevard',
    node: '#f262b5',
    ground: '#e3b394',
    road: { asphalt: '#5c4b5a', sidewalk: '#f6dcc4', curb: '#c79a82', lane: '#ffe9b0' },
    buildings: ['#ff9f6b', '#ffc86b', '#e76f8a', '#b5838d', '#ffd6a5', '#f28f8f'],
    windows: ['#fff1c2', '#ffd98a'],
    trees: '#5aa35a',
  },
  {
    name: 'Neon Nights',
    node: '#9b5cf0',
    ground: '#2a2452',
    road: { asphalt: '#1c1838', sidewalk: '#4a4378', curb: '#2f2a58', lane: '#ff6ec7' },
    buildings: ['#3a3370', '#463d86', '#2f2960', '#54479a'],
    windows: ['#ffe66d', '#ff6ec7', '#4de1ff'],
    lit: 0.45,
    trees: '#2f6b5a',
  },
  {
    name: 'Snowy Uptown',
    node: '#35c6ea',
    ground: '#e9eff6',
    road: { asphalt: '#69718a', sidewalk: '#ffffff', curb: '#c5cfdb', lane: '#ffffff' },
    buildings: ['#9fb7d6', '#c48b7a', '#7d9fc0', '#d9c2a7', '#b7a3c9'],
    windows: ['#fff2c4', '#ffe08a'],
    trees: '#3e8a6b',
    snow: true,
  },
  {
    name: 'Old Town',
    node: '#e8732a',
    ground: '#d4c09c',
    road: { asphalt: '#6b5d4f', sidewalk: '#efe3c8', curb: '#b8a47f', lane: '#fff6dc' },
    buildings: ['#c0573e', '#d98b4a', '#a64b36', '#e3b27a', '#8f6a4a'],
    windows: ['#fff1c9', '#f2d790'],
    trees: '#5f9e45',
  },
  {
    name: 'Skyline Summit',
    node: '#ffb21f',
    ground: '#1b2546',
    road: { asphalt: '#121a33', sidewalk: '#3c4a78', curb: '#26305a', lane: '#9be7ff' },
    buildings: ['#2c3a66', '#34477a', '#25315a', '#3f5590'],
    windows: ['#ffd66b', '#9be7ff', '#ffffff'],
    lit: 0.55,
    tall: true,
    trees: '#2c5a4a',
  },
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
