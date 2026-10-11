// App shell: home screen, menus, saving, and wiring everything together.
import { Sfx } from './audio.js';
import { COLORS } from './config.js';
import { Game } from './engine.js';
import { GameScreen } from './game.js';
import { Haptics } from './haptics.js';
import { makeLevel, newJourneyGame, starsFor, worldInfo, worldOf } from './journey.js';
import { MapScreen, starRow } from './map.js';
import { gemIcon } from './render.js';
import { store } from './storage.js';

const $ = (id) => document.getElementById(id);
const CROWN = '<svg class="crown" viewBox="0 0 24 24"><path d="M3 7l4.5 4L12 4l4.5 7L21 7l-2 11H5z"/></svg>';

const settings = { sound: true, haptics: true, ...store.get('settings', {}) };
let best = store.get('best', 0);
let journeyLevel = store.get('journeyLevel', 1);
let journeyStars = store.get('journeyStars', {}); // best stars per level
let lastWin = null;

const sfx = new Sfx();
const haptics = new Haptics();
applySettings();

const screen = new GameScreen({
  canvas: $('board'),
  hud: {
    root: $('hud'),
    score: $('hud-score'),
    best: $('hud-best'),
    level: $('hud-level'),
    goals: $('hud-goals'),
    combo: $('hud-combo'),
    comboCount: $('hud-combo-count'),
    comboPips: $('hud-combo-pips'),
    stars: $('hud-stars'),
    moves: $('hud-moves'),
    par: $('hud-par'),
  },
  fxLayer: $('fx-layer'),
  sfx,
  haptics,
  events: { save: saveGame, over: onOver, won: onWon },
});

const map = new MapScreen({
  scroller: $('map-scroll'),
  content: $('map-content'),
  title: $('map-title'),
  onSelect: (level) => {
    sfx.button();
    openLevel(level);
  },
  onLocked: () => sfx.invalid(),
});

const totalStars = () => Object.values(journeyStars).reduce((sum, n) => sum + n, 0);
const isResumable = (g, level) => g && g.mode === 'journey' && g.level === level && !g.isOver && !g.isWon;

// ---------------------------------------------------------------- saving

function saveGame(game) {
  const key = game.mode === 'classic' ? 'classicSave' : 'journeySave';
  if (game.mode === 'classic' && game.score > best) {
    best = game.score;
    store.set('best', best);
  }
  if (game.isWon) {
    const { level, moves } = game;
    const stars = starsFor(moves, game.par || makeLevel(level).par);
    const previous = journeyStars[level] || 0;
    lastWin = { level, moves, stars, firstTime: level >= journeyLevel, improved: stars > previous };
    journeyStars = { ...journeyStars, [level]: Math.max(previous, stars) };
    journeyLevel = Math.max(journeyLevel, level + 1);
    store.set('journeyStars', journeyStars);
    store.set('journeyLevel', journeyLevel);
    store.remove(key);
  } else if (game.isOver) {
    store.remove(key);
  } else {
    store.set(key, game.toJSON());
  }
}

// ---------------------------------------------------------------- screens

function show(name) {
  for (const id of ['home', 'map', 'game']) $(`screen-${id}`).classList.toggle('hidden', name !== id);
  map.visible = name === 'map';
}

function refreshHome() {
  $('home-best').textContent = best;
  $('journey-sub').textContent = `Level ${journeyLevel}`;
  $('classic-sub').textContent = store.get('classicSave') ? 'Continue' : 'Play';
}

function clearConfetti() {
  $('confetti').replaceChildren();
}

function goHome() {
  screen.stop();
  closeModal();
  clearConfetti();
  refreshHome();
  show('home');
}

function playClassic(fresh = false) {
  const saved = fresh ? null : Game.fromJSON(store.get('classicSave'));
  const game = saved && saved.mode === 'classic' && !saved.isOver ? saved : Game.classic();
  if (game !== saved) store.remove('classicSave');
  closeModal();
  clearConfetti();
  show('game');
  screen.start(game, { best });
}

function playJourney(level, fresh = false) {
  const saved = fresh ? null : Game.fromJSON(store.get('journeySave'));
  const resumable = isResumable(saved, level);
  const game = resumable ? saved : newJourneyGame(level);
  if (!game.par) game.par = makeLevel(level).par;
  if (!resumable) store.remove('journeySave');
  closeModal();
  clearConfetti();
  show('game');
  screen.start(game, { best });
}

// advanceFrom: the level just beaten for the first time; the marker walks on from it.
function openMap({ advanceFrom = null, focus = null } = {}) {
  screen.stop();
  closeModal();
  clearConfetti();
  show('map');
  $('map-stars').textContent = totalStars();
  const walking = advanceFrom !== null && advanceFrom < journeyLevel;
  const avatarAt = walking ? advanceFrom : journeyLevel;
  map.render({ unlocked: journeyLevel, stars: journeyStars, avatarAt });
  map.scrollTo(focus ?? avatarAt);
  if (!walking) return;
  map.advance().then(() => {
    if (!map.visible) return;
    sfx.levelUnlock();
    haptics.tap('medium');
    setTimeout(() => map.visible && openLevel(journeyLevel), 500);
  });
}

function openLevel(level) {
  const { goals, par } = makeLevel(level);
  const pills = goals
    .map((g) => `<div class="goal"><img alt="" src="${gemIcon(g.color)}"><span>${g.need}</span></div>`)
    .join('');
  const resumable = isResumable(Game.fromJSON(store.get('journeySave')), level);
  openModal(
    `<h2>Level ${level}</h2>
     <p class="level-world">${worldInfo(worldOf(level)).name}</p>
     ${starRow(journeyStars[level] || 0, 'big')}
     <p>Collect the gems</p>
     <div class="goal-row">${pills}</div>
     <p class="star-hint">Finish in ${par[0]} moves or fewer for 3 stars</p>
     <button class="btn btn-green" data-act="play">${resumable ? 'Continue' : 'Play'}</button>
     <button class="btn btn-gray" data-act="close">Close</button>`,
    { play: () => playJourney(level), close: closeModal },
  );
}

// ---------------------------------------------------------------- modals

const modal = $('modal');
const card = modal.querySelector('.modal-card');

function openModal(html, actions = {}) {
  card.innerHTML = html;
  for (const [name, fn] of Object.entries(actions)) {
    card.querySelector(`[data-act="${name}"]`)?.addEventListener('click', () => {
      sfx.button();
      fn();
    });
  }
  for (const el of card.querySelectorAll('[data-setting]')) {
    el.addEventListener('click', () => {
      const key = el.dataset.setting;
      settings[key] = !settings[key];
      el.setAttribute('aria-checked', String(settings[key]));
      store.set('settings', settings);
      applySettings();
      sfx.button();
      if (key === 'haptics') haptics.tap('medium');
    });
  }
  modal.classList.remove('hidden');
  card.style.animation = 'none';
  void card.offsetWidth;
  card.style.animation = '';
}

function closeModal() {
  modal.classList.add('hidden');
}

function applySettings() {
  sfx.enabled = settings.sound;
  haptics.enabled = settings.haptics;
}

const toggleRows = () =>
  [
    ['sound', 'Sound'],
    ['haptics', 'Vibration'],
  ]
    .map(
      ([key, label]) =>
        `<div class="toggle-row"><span>${label}</span><button class="switch" role="switch" aria-label="${label}" data-setting="${key}" aria-checked="${settings[key]}"></button></div>`,
    )
    .join('');

function openPause() {
  if (!screen.pause()) return;
  const resume = () => {
    closeModal();
    screen.resume();
  };
  const { mode, level } = screen.game;
  const journey = mode === 'journey';
  openModal(
    `<h2>Paused</h2>
     ${toggleRows()}
     <button class="btn btn-green" data-act="resume">Resume</button>
     <button class="btn btn-orange" data-act="restart">${journey ? 'Restart Level' : 'New Game'}</button>
     <button class="btn btn-blue" data-act="leave">${journey ? 'Map' : 'Home'}</button>`,
    {
      resume,
      restart: () => (journey ? playJourney(level, true) : playClassic(true)),
      leave: () => (journey ? openMap({ focus: level }) : goHome()),
    },
  );
}

function openSettings() {
  openModal(
    `<h2>Settings</h2>
     ${toggleRows()}
     <button class="btn btn-blue" data-act="done">Done</button>
     <button class="link-btn" data-act="reset">Reset progress</button>`,
    { done: closeModal, reset: confirmReset },
  );
}

function confirmReset() {
  openModal(
    `<h2>Reset?</h2>
     <p>This clears your best score, Journey level and saved games on this device.</p>
     <button class="btn btn-red" data-act="yes">Reset Everything</button>
     <button class="btn btn-gray" data-act="no">Cancel</button>`,
    {
      yes: () => {
        for (const key of ['best', 'journeyLevel', 'journeyStars', 'classicSave', 'journeySave']) store.remove(key);
        best = 0;
        journeyLevel = 1;
        journeyStars = {};
        closeModal();
        refreshHome();
      },
      no: openSettings,
    },
  );
}

function countUp(el, to, ms = 900) {
  const start = performance.now();
  const tick = (t) => {
    const k = Math.min(1, (t - start) / ms);
    el.textContent = Math.round(to * (1 - (1 - k) ** 3));
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

function onOver(info) {
  if (info.mode === 'journey') {
    const progress = info.goals
      .map((g) => `<div class="goal"><img alt="" src="${gemIcon(g.color)}"><span>${g.got}/${g.need}</span></div>`)
      .join('');
    openModal(
      `<h2>Out of Space</h2>
       <p>Level ${info.level}</p>
       <div class="goal-row">${progress}</div>
       <button class="btn btn-green" data-act="retry">Try Again</button>
       <button class="btn btn-blue" data-act="map">Map</button>`,
      { retry: () => playJourney(info.level, true), map: () => openMap({ focus: info.level }) },
    );
    return;
  }
  if (info.newBest) {
    confetti();
    sfx.record();
  }
  openModal(
    `${info.newBest ? '<div class="record">New Best!</div>' : ''}
     <h2>Game Over</h2>
     <div class="stat"><div class="stat-label">Score</div><div class="stat-value" id="final-score">0</div></div>
     <div class="stat-best">${CROWN}<span>${info.best}</span></div>
     <button class="btn btn-green" data-act="again">Play Again</button>
     <button class="btn btn-blue" data-act="home">Home</button>`,
    { again: () => playClassic(true), home: goHome },
  );
  countUp($('final-score'), info.score);
}

function onWon({ level }) {
  const win = lastWin?.level === level ? lastWin : { level, moves: 0, stars: 1, firstTime: false, improved: false };
  confetti();
  openModal(
    `<h2>Level ${level}<br>Complete!</h2>
     ${starRow(win.stars, 'big reveal')}
     <p>${win.moves} moves${win.improved && !win.firstTime ? ' · New best!' : ''}</p>
     <button class="btn btn-green" data-act="next">Continue</button>`,
    { next: () => openMap(win.firstTime ? { advanceFrom: level } : { focus: level }) },
  );
  for (let i = 0; i < win.stars; i++) setTimeout(() => sfx.star(i), 550 + i * 350);
}

// ---------------------------------------------------------------- decoration

function confetti() {
  const layer = $('confetti');
  for (let i = 0; i < 70; i++) {
    const el = document.createElement('i');
    el.style.left = `${Math.random() * 100}%`;
    el.style.background = COLORS[i % COLORS.length].hex;
    el.style.setProperty('--dx', `${(Math.random() - 0.5) * 180}px`);
    el.style.setProperty('--rot', `${(Math.random() - 0.5) * 1440}deg`);
    el.style.animationDuration = `${1.8 + Math.random() * 1.6}s`;
    el.style.animationDelay = `${Math.random() * 0.5}s`;
    el.addEventListener('animationend', () => el.remove());
    layer.append(el);
  }
}

function buildHomeBackground() {
  const shapes = [['XX', 'XX'], ['XXX'], ['X', 'X', 'X'], ['XX', 'X.'], ['XXX', '.X.'], ['X.', 'XX', '.X'], ['XXXX']];
  const bg = $('home-bg');
  for (let i = 0; i < 12; i++) {
    const rows = shapes[i % shapes.length];
    const size = Math.round(16 + Math.random() * 20);
    const el = document.createElement('div');
    el.className = 'float-block';
    el.style.gridTemplateColumns = `repeat(${rows[0].length}, ${size}px)`;
    el.style.gridAutoRows = `${size}px`;
    el.style.left = `${Math.random() * 92}%`;
    el.style.animationDuration = `${16 + Math.random() * 16}s`;
    el.style.animationDelay = `${-Math.random() * 30}s`;
    el.style.setProperty('--spin', `${(Math.random() - 0.5) * 200}deg`);
    const color = COLORS[(i * 3) % COLORS.length].hex;
    for (const row of rows) {
      for (const ch of row) {
        const b = document.createElement('i');
        if (ch === 'X') b.style.setProperty('--c', color);
        else b.style.visibility = 'hidden';
        el.append(b);
      }
    }
    bg.append(el);
  }
}

// ---------------------------------------------------------------- wiring

const tap = (id, fn) =>
  $(id).addEventListener('click', () => {
    sfx.button();
    fn();
  });

tap('btn-classic', () => playClassic());
tap('btn-journey', () => openMap());
tap('btn-map-home', goHome);
tap('btn-settings', openSettings);
tap('btn-pause', openPause);

// Audio can only start from a user gesture on iOS (some versions only count touchend).
for (const type of ['pointerdown', 'touchend', 'click']) {
  document.addEventListener(type, () => sfx.unlock(), { capture: true, passive: true });
}
// Stop iOS pinch-zoom and double-tap zoom from hijacking drags.
document.addEventListener('gesturestart', (e) => e.preventDefault());
document.addEventListener('dblclick', (e) => e.preventDefault());

buildHomeBackground();
refreshHome();
show('home');

// Open the game with ?debug to poke at it from the browser console.
if (new URLSearchParams(location.search).has('debug')) window.colorBlock = { screen, store };

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}
