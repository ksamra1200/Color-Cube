// Journey map: a winding path of levels from the bottom up, grouped into worlds.
import { JOURNEY } from './config.js';
import { mulberry32 } from './engine.js';
import { worldInfo, worldOf } from './journey.js';

const SPACING = 96; // vertical distance between levels
const WORLD_GAP = 90; // extra room between worlds for the banner
const TOP_PAD = 150;
const BOTTOM_PAD = 140;
const WAVE = 0.8; // how quickly the path swings side to side
const WALK_MS = 950;

const STAR_SVG =
  '<svg viewBox="0 0 24 24"><path d="M12 2.5l2.9 6.2 6.8.8-5 4.7 1.3 6.7L12 17.6l-6 3.3 1.3-6.7-5-4.7 6.8-.8z"/></svg>';

export function starRow(earned, cls = '') {
  const stars = [1, 2, 3].map((n) => `<i class="star${n <= earned ? ' on' : ''}" style="--i:${n}">${STAR_SVG}</i>`);
  return `<span class="star-row ${cls}">${stars.join('')}</span>`;
}

const DECO_SHAPES = [['XX', 'XX'], ['XXX'], ['X', 'X'], ['XX', 'X.'], ['XXX', '.X.'], ['.X', 'XX'], ['X']];

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
    scroller.addEventListener('scroll', () => this.updateTitle(), { passive: true });
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

    const html = [];
    const gapMid = (SPACING + WORLD_GAP) / 2;
    for (let w = 0; w < worlds; w++) {
      const info = worldInfo(w);
      const first = w * size + 1;
      const bottom = w === 0 ? height : pos(first)[1] + gapMid;
      const top = w === worlds - 1 ? 0 : pos(first + size)[1] + gapMid;
      this.bands.push({ top, bottom, name: info.name });
      html.push(
        `<div class="band" style="top:${top}px;height:${bottom - top}px;background:linear-gradient(to top, ${info.sky}, ${worldInfo(w + 1).sky})"></div>`,
      );

      // Scenery: block clusters on whichever side of the path has room.
      const rng = mulberry32(w * 7919 + 17);
      const decoCount = Math.max(9, Math.round(W / 45));
      for (let i = 0; i < decoCount; i++) {
        const t = first + rng() * (size - 1);
        const y = pos(first)[1] - (t - first) * SPACING;
        const px = pathX(t);
        const left = px - 56;
        const right = W - px - 56;
        const cell = Math.round(11 + rng() * 8);
        const shape = DECO_SHAPES[Math.floor(rng() * DECO_SHAPES.length)];
        const shapeW = shape[0].length * (cell + 2);
        const room = Math.max(left, right) - shapeW - 10;
        const color = info.deco[Math.floor(rng() * info.deco.length)];
        const tilt = Math.round((rng() - 0.5) * 50);
        if (room < 4) continue;
        const x = left > right ? 6 + rng() * room : px + 56 + rng() * room;
        const cells = shape
          .join('')
          .split('')
          .map((ch) => (ch === 'X' ? '<i></i>' : '<i class="gap"></i>'))
          .join('');
        html.push(
          `<div class="deco" style="left:${x.toFixed(0)}px;top:${y.toFixed(0)}px;--c:${color};grid-template-columns:repeat(${shape[0].length},${cell}px);grid-auto-rows:${cell}px;rotate:${tilt}deg">${cells}</div>`,
        );
      }
      for (let i = 0; i < 4; i++) {
        const r = 30 + rng() * 70;
        const y = top + rng() * (bottom - top);
        html.push(
          `<i class="bubble" style="left:${(rng() * W - r).toFixed(0)}px;top:${(y - r).toFixed(0)}px;width:${(r * 2).toFixed(0)}px;height:${(r * 2).toFixed(0)}px"></i>`,
        );
      }
    }

    const points = [];
    for (let level = 1; level <= count; level++) points.push(pos(level));
    const road = smoothPath(points);
    html.push(
      `<svg class="map-path" width="${W}" height="${height}" viewBox="0 0 ${W} ${height}" aria-hidden="true">
        <path class="road-edge" d="${road}"/>
        <path class="road" d="${road}"/>
        <path class="road-done" d="${smoothPath(points.slice(0, avatarAt))}"/>
        <path class="road-dots" d="${road}"/>
      </svg>`,
    );

    for (let w = 0; w < worlds; w++) {
      const first = w * size + 1;
      const y = pos(first)[1] + (w === 0 ? 74 : gapMid);
      const locked = first > unlocked ? ' locked' : '';
      html.push(
        `<div class="world-banner${locked}" style="top:${y}px"><small>World ${w + 1}</small><b>${worldInfo(w).name}</b></div>`,
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
    this.updateTitle();
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
          this.content.querySelector('.road-done')?.setAttribute('d', smoothPath(this.points.slice(0, unlocked)));
          this.state.avatarAt = unlocked;
          this.walking = false;
          resolve();
        }, WALK_MS);
      }, 450);
    });
  }
}
