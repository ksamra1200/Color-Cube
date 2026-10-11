// Journey map: a road of levels winding up through a 2.5D city, one district per world.
import { buildCity, drawCity } from './city.js';
import { JOURNEY } from './config.js';
import { worldInfo, worldOf } from './journey.js';

const SPACING = 96; // vertical distance between levels
const WORLD_GAP = 90; // extra room between districts for the sign
const TOP_PAD = 150;
const BOTTOM_PAD = 170;
const SIGN_DROP = 84; // how far below level 1 the first district's sign hangs
const TILE = 640; // the city is drawn in canvas tiles this tall, only near the screen
const WAVE = 0.8; // how quickly the path swings side to side
const WALK_MS = 950;

const STAR_SVG =
  '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>';

export function starRow(earned, cls = '') {
  const stars = [1, 2, 3].map((n) => `<i class="star${n <= earned ? ' on' : ''}" style="--i:${n}">${STAR_SVG}</i>`);
  return `<span class="star-row ${cls}">${stars.join('')}</span>`;
}

// Smooth curve through the points (Catmull-Rom as cubic Béziers).
function smoothPath(pts) {
  if (!pts.length) return '';
  const f = (n) => n.toFixed(1);
  let d = `M${f(pts[0][0])} ${f(pts[0][1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${f(c1[0])} ${f(c1[1])} ${f(c2[0])} ${f(c2[1])} ${f(p2[0])} ${f(p2[1])}`;
  }
  return d;
}

export class MapScreen {
  constructor({ scroller, content, title, onSelect, onLocked }) {
    this.scroller = scroller;
    this.content = content;
    this.title = title;
    this.onSelect = onSelect;
    this.onLocked = onLocked;
    this.visible = false;
    this.state = null;
    content.addEventListener('click', (e) => {
      const node = e.target.closest('.node');
      if (!node || this.walking) return;
      if (node.classList.contains('locked')) {
        node.classList.remove('shake');
        void node.offsetWidth;
        node.classList.add('shake');
        this.onLocked?.();
        return;
      }
      this.onSelect(Number(node.dataset.level));
    });
    scroller.addEventListener(
      'scroll',
      () => {
        if (this.scrollQueued) return;
        this.scrollQueued = true;
        requestAnimationFrame(() => {
          this.scrollQueued = false;
          this.updateTitle();
          this.updateTiles();
        });
      },
      { passive: true },
    );
    window.addEventListener('resize', () => {
      if (!this.visible || !this.state) return;
      const keep = this.levelAtCenter();
      this.render(this.state);
      this.scrollTo(keep);
    });
  }

  // unlocked: highest playable level. stars: { [level]: 1-3 }.
  // avatarAt < unlocked draws the newest level still locked, ready for advance().
  render({ unlocked, stars, avatarAt = unlocked }) {
    this.state = { unlocked, stars, avatarAt };
    const W = this.scroller.clientWidth || window.innerWidth;
    const size = JOURNEY.worldSize;
    const worlds = worldOf(unlocked) + 2; // the current world plus a peek at the next
    const count = worlds * size;
    const height = TOP_PAD + BOTTOM_PAD + (count - 1) * SPACING + (worlds - 1) * WORLD_GAP;
    const amp = Math.min(W * 0.27, 130);
    const pathX = (t) => W / 2 + amp * Math.sin((t - 1) * WAVE);
    const pos = (level) => [pathX(level), height - BOTTOM_PAD - (level - 1) * SPACING - worldOf(level) * WORLD_GAP];
    this.pos = pos;
    this.width = W;
    this.bands = [];

    const html = ['<div class="city"></div>'];
    const gapMid = (SPACING + WORLD_GAP) / 2;
    const signY = (w) => pos(w * size + 1)[1] + (w === 0 ? SIGN_DROP : gapMid);
    const bands = [];
    const keepOut = [];
    for (let w = 0; w < worlds; w++) {
      const first = w * size + 1;
      const bottom = w === 0 ? height : pos(first)[1] + gapMid;
      const top = w === worlds - 1 ? 0 : pos(first + size)[1] + gapMid;
      const next = w < worlds - 1 ? worldInfo(w + 1) : null;
      bands.push({ top, bottom, index: w, theme: worldInfo(w), next });
      const half = Math.max(90, worldInfo(w).name.length * 6.5 + 34);
      keepOut.push([W / 2 - half, signY(w) - 34, W / 2 + half, signY(w) + 80]);
    }
    this.bands = bands.map(({ top, bottom, theme }) => ({ top, bottom, name: theme.name }));

    const points = [];
    for (let level = 1; level <= count; level++) points.push(pos(level));
    this.city = buildCity({ width: W, height, bands, points, keepOut });
    const done = smoothPath(points.slice(0, avatarAt));
    html.push(
      `<svg class="map-path" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" aria-hidden="true">
        <path class="road-glow" d="${done}"/>
        <path class="road-done" d="${done}"/>
      </svg>`,
    );

    for (let w = 0; w < worlds; w++) {
      const first = w * size + 1;
      const locked = first > unlocked ? ' locked' : '';
      html.push(
        `<div class="world-banner${locked}" style="top:${signY(w)}px"><small>District ${w + 1}</small><b>${worldInfo(w).name}</b></div>`,
      );
    }

    for (let level = 1; level <= count; level++) {
      const [x, y] = pos(level);
      // While an advance is pending, the newest level stays locked until the marker arrives.
      const state = level < unlocked ? 'done' : level === unlocked && avatarAt === unlocked ? 'current' : 'locked';
      const color = worldInfo(worldOf(level)).node;
      const label = `Level ${level}${state === 'locked' ? ', locked' : ''}`;
      html.push(
        `<button class="node ${state}" data-level="${level}" style="left:${x}px;top:${y}px;--node:${color}" aria-label="${label}"><span>${level}</span>${
          state === 'done' ? starRow(stars[level] || 0, 'node-stars') : ''
        }</button>`,
      );
    }

    html.push(
      `<div class="avatar" style="transform:${this.avatarTransform(avatarAt)}"><div class="avatar-body"><i class="eye"></i><i class="eye"></i><i class="mouth"></i></div></div>`,
    );

    this.content.style.height = `${height}px`;
    this.content.innerHTML = html.join('');
    this.points = points;
    this.height = height;
    this.cityLayer = this.content.querySelector('.city');
    this.tiles = new Map();
    this.updateTitle();
    this.updateTiles();
  }

  // Draw the city tiles around the visible part of the map and drop far-away ones.
  updateTiles() {
    if (!this.city || !this.visible) return;
    const view = this.scroller.clientHeight || window.innerHeight;
    const top = this.scroller.scrollTop;
    const last = Math.ceil(this.height / TILE) - 1;
    const from = Math.max(0, Math.floor((top - view) / TILE));
    const to = Math.min(last, Math.floor((top + view * 2) / TILE));
    for (let i = from; i <= to; i++) if (!this.tiles.has(i)) this.tiles.set(i, this.drawTile(i));
    for (const [i, tile] of this.tiles) {
      if (i >= from - 2 && i <= to + 2) continue;
      tile.remove();
      this.tiles.delete(i);
    }
  }

  drawTile(i) {
    const top = i * TILE;
    const h = Math.min(TILE, this.height - top);
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const tile = document.createElement('canvas');
    tile.className = 'city-tile';
    tile.width = Math.ceil(this.width * dpr);
    tile.height = Math.ceil(h * dpr);
    tile.style.top = `${top}px`;
    tile.style.width = `${this.width}px`;
    tile.style.height = `${h}px`;
    const ctx = tile.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, -top * dpr);
    drawCity(ctx, this.city, top, top + h);
    this.cityLayer.append(tile);
    return tile;
  }

  // The marker stands beside its level, on the side facing the middle of the screen.
  avatarTransform(level) {
    const [x, y] = this.pos(level);
    const left = x > this.width / 2 ? x - 90 : x + 46;
    return `translate(${left}px, ${y - 40}px)`;
  }

  scrollTo(level, smooth = false) {
    if (!this.pos) return;
    const top = this.pos(level)[1] - this.scroller.clientHeight * 0.58;
    this.scroller.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    this.updateTiles();
  }

  levelAtCenter() {
    const y = this.scroller.scrollTop + this.scroller.clientHeight * 0.58;
    let best = 1;
    for (let level = 1; level <= this.points.length; level++) {
      if (Math.abs(this.pos(level)[1] - y) < Math.abs(this.pos(best)[1] - y)) best = level;
    }
    return best;
  }

  updateTitle() {
    if (!this.bands?.length) return;
    const y = this.scroller.scrollTop + this.scroller.clientHeight / 2;
    const band = this.bands.find((b) => y >= b.top && y <= b.bottom) || this.bands[0];
    if (this.title.textContent !== band.name) this.title.textContent = band.name;
  }

  // Walk the marker from avatarAt up to the newly unlocked level.
  advance() {
    const { unlocked } = this.state;
    const avatar = this.content.querySelector('.avatar');
    const node = this.content.querySelector(`.node[data-level="${unlocked}"]`);
    if (!avatar || !node) return Promise.resolve();
    this.walking = true;
    return new Promise((resolve) => {
      setTimeout(() => {
        this.scrollTo(unlocked, true);
        avatar.classList.add('walking');
        avatar.style.transform = this.avatarTransform(unlocked);
        setTimeout(() => {
          avatar.classList.remove('walking');
          node.classList.remove('locked');
          node.classList.add('current', 'unlocking');
          node.setAttribute('aria-label', `Level ${unlocked}`);
          const done = smoothPath(this.points.slice(0, unlocked));
          for (const path of this.content.querySelectorAll('.road-done, .road-glow')) path.setAttribute('d', done);
          this.state.avatarAt = unlocked;
          this.walking = false;
          resolve();
        }, WALK_MS);
      }, 450);
    });
  }
}
