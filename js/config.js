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
// lit: share of windows still glowing. haze: smog tint over the map in this district.
// neon: sign/billboard colors (empty = no signs). props: what lines the street.
// ruins: chance a building is bombed-out. smoke/clutter/beacons/hazard/tall: extra scenery.
export const WORLDS = [
  {
    name: 'Rust Yards',
    node: '#ff7a3d',
    ground: '#3b302a',
    road: { asphalt: '#25211f', sidewalk: '#4d4038', curb: '#2e2622', lane: '#c9a227' },
    buildings: ['#5b4636', '#6e4b35', '#4a3a30', '#7a5a3f', '#3f3a36'],
    windows: ['#ffb347', '#ff8c42'],
    lit: 0.22,
    haze: '#c4622d',
    neon: ['#ff8c42'],
    props: ['barrel', 'deadtree', 'lamp', 'barrier'],
    ruins: 0.12,
    smoke: true,
    hazard: true,
  },
  {
    name: 'Smog Quarter',
    node: '#9bd34a',
    ground: '#2f3430',
    road: { asphalt: '#1f2321', sidewalk: '#454b45', curb: '#2a2e2b', lane: '#9aa38f' },
    buildings: ['#4b524c', '#5a5f55', '#3c423e', '#6a6e62'],
    windows: ['#d6e68a', '#f0f5b0'],
    lit: 0.2,
    haze: '#8f9c63',
    neon: ['#d6e68a', '#ff5f5f'],
    props: ['lamp', 'deadtree', 'barrel'],
    ruins: 0.08,
    smoke: true,
  },
  {
    name: 'Neon Abyss',
    node: '#ff2bd6',
    ground: '#14121f',
    road: { asphalt: '#0d0b16', sidewalk: '#2a2440', curb: '#1a1630', lane: '#ff2bd6' },
    buildings: ['#1f1c33', '#262140', '#191629', '#2d2750'],
    windows: ['#ff2bd6', '#20e3ff', '#fff04d'],
    lit: 0.35,
    haze: '#7a2bff',
    neon: ['#ff2bd6', '#20e3ff', '#fff04d', '#7cff4d'],
    props: ['lamp', 'barrier', 'lamp'],
    ruins: 0,
    beacons: true,
  },
  {
    name: 'The Slums',
    node: '#ffb21f',
    ground: '#2c2a26',
    road: { asphalt: '#1d1b19', sidewalk: '#3d3934', curb: '#26231f', lane: '#8a8170' },
    buildings: ['#5e5a52', '#6b5d4c', '#4f4b45', '#7a6b5a', '#55606a'],
    windows: ['#ffcf6b', '#ffa94d'],
    lit: 0.18,
    haze: '#6b5e4a',
    neon: ['#ffcf6b', '#ff5f5f'],
    props: ['barrel', 'barrel', 'deadtree', 'lamp'],
    ruins: 0.25,
    clutter: true,
  },
  {
    name: 'Toxic Docks',
    node: '#3cff8f',
    ground: '#1e2a26',
    road: { asphalt: '#141c1a', sidewalk: '#2e3d38', curb: '#1a2420', lane: '#3cff8f' },
    buildings: ['#2f3d39', '#3a4a44', '#26322e', '#44564f'],
    windows: ['#3cff8f', '#b6ff6b'],
    lit: 0.25,
    haze: '#2bd67b',
    neon: ['#3cff8f', '#b6ff6b'],
    props: ['toxic', 'toxic', 'deadtree', 'barrier'],
    ruins: 0.15,
    smoke: true,
    hazard: true,
    toxic: true,
  },
  {
    name: 'Ash Wastes',
    node: '#ff5a3d',
    ground: '#3a3836',
    road: { asphalt: '#262423', sidewalk: '#4c4946', curb: '#2f2d2b', lane: '#77716b' },
    buildings: ['#5a5754', '#4a4744', '#666260', '#3e3b39'],
    windows: ['#ff6a3d', '#ffb347'],
    lit: 0.08,
    haze: '#9a8f86',
    neon: [],
    props: ['barrel', 'deadtree', 'deadtree', 'barrier'],
    ruins: 0.55,
  },
  {
    name: 'The Spire',
    node: '#4dc3ff',
    ground: '#0f1220',
    road: { asphalt: '#090b14', sidewalk: '#1f2438', curb: '#141829', lane: '#ff3b3b' },
    buildings: ['#1a2033', '#222a42', '#151a2a', '#2a3350'],
    windows: ['#9be7ff', '#ffffff', '#ff3b3b'],
    lit: 0.4,
    haze: '#3b5bff',
    neon: ['#ff3b3b', '#9be7ff'],
    props: ['lamp', 'barrier', 'lamp'],
    ruins: 0,
    tall: true,
    beacons: true,
    hazard: true,
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
