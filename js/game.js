// The play screen: input, animation and drawing. Rules live in engine.js.
import { PRAISE, SCORING, THEME } from './config.js';
import { N, idx, previewLines, shapeOf } from './engine.js';
import { blockSprite, clearSprites, colorHex, gemIcon, roundRect } from './render.js';

const now = () => performance.now();
const clamp01 = (t) => (t < 0 ? 0 : t > 1 ? 1 : t);
const lerp = (a, b, t) => a + (b - a) * t;
const outCubic = (t) => 1 - (1 - t) ** 3;
const inOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const outBack = (t) => 1 + 2.70158 * (t - 1) ** 3 + 1.70158 * (t - 1) ** 2;
const avg = (list) => list.reduce((a, b) => a + b, 0) / list.length;

const LIFT_MS = 110;
const RETURN_MS = 170;
const SPAWN_MS = 320;
const POP_MS = 180;
const CLEAR_MS = 420;
const FLY_MS = 720;
const TRAY_SHARE = 0.42; // tray height relative to the board
const GAP_SHARE = 0.05;

function safeInset(side) {
  const probe = document.getElementById('safe-probe');
  return probe ? parseFloat(getComputedStyle(probe)[`padding${side}`]) || 0 : 0;
}

export class GameScreen {
  constructor({ canvas, hud, fxLayer, sfx, haptics, events }) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.hud = hud;
    this.fxLayer = fxLayer;
    this.sfx = sfx;
    this.haptics = haptics;
    this.events = events;
    this.game = null;
    this.state = 'idle'; // play | paused | busy | over | won | idle
    this.active = false;
    this.session = 0;
    this.drag = null;
    this.resetFx();
    this.frame = this.frame.bind(this);

    canvas.addEventListener('pointerdown', (e) => this.onDown(e));
    canvas.addEventListener('pointermove', (e) => this.onMove(e));
    canvas.addEventListener('pointerup', (e) => this.onUp(e));
    canvas.addEventListener('pointercancel', (e) => this.onUp(e, true));
    window.addEventListener('resize', () => this.active && this.resize());
    document.addEventListener('visibilitychange', () => document.hidden && this.cancelDrag());
  }

  resetFx() {
    this.fx = { clears: [], particles: [], pops: new Map(), flying: [], spawn: [0, 0, 0], back: null, gray: 0 };
  }

  start(game, { best }) {
    this.session++;
    this.game = game;
    this.best = best;
    this.startBest = best;
    this.shownScore = game.score;
    this.goalShown = game.goals ? game.goals.map((g) => g.got) : null;
    this.drag = null;
    this.resetFx();
    this.fxLayer.replaceChildren();
    this.state = 'play';
    this.active = true;
    this.setupHud();
    this.resize();
    const t = now();
    this.fx.spawn = [t + 120, t + 190, t + 260];
    this.updateFits();
    cancelAnimationFrame(this.raf);
    this.raf = requestAnimationFrame(this.frame);
  }

  stop() {
    this.session++;
    this.active = false;
    this.state = 'idle';
    this.drag = null;
    cancelAnimationFrame(this.raf);
    this.fxLayer.replaceChildren();
  }

  pause() {
    if (this.state !== 'play') return false;
    this.cancelDrag();
    this.state = 'paused';
    return true;
  }

  resume() {
    if (this.state === 'paused') this.state = 'play';
  }

  later(ms, fn) {
    const session = this.session;
    setTimeout(() => session === this.session && fn(), ms);
  }

  // ---------------------------------------------------------------- layout

  resize() {
    const W = window.innerWidth;
    const H = window.innerHeight;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.W = W;
    this.H = H;
    this.dpr = dpr;
    this.canvas.width = Math.round(W * dpr);
    this.canvas.height = Math.round(H * dpr);

    const top = this.hud.root.getBoundingClientRect().bottom + 4;
    const bottom = H - safeInset('Bottom') - 8;
    const avail = bottom - top;
    const size = Math.floor(Math.max(180, Math.min(W - 24, 560, avail / (1 + GAP_SHARE + TRAY_SHARE))));
    const used = size * (1 + GAP_SHARE + TRAY_SHARE);
    const x = Math.round((W - size) / 2);
    const y = Math.round(top + Math.max(0, (avail - used) * 0.35));
    const pad = Math.round(size * 0.024);
    const cell = (size - pad * 2) / N;
    const slotW = size / 3;
    this.L = {
      x,
      y,
      size,
      pad,
      cell,
      gx: x + pad,
      gy: y + pad,
      inset: Math.max(1, cell * 0.035),
      trayY: y + size * (1 + GAP_SHARE),
      trayH: size * TRAY_SHARE,
      slotW,
      trayCell: Math.min(cell * 0.54, (slotW * 0.9) / 5),
    };
    this.L.block = this.L.cell - this.L.inset * 2;
    clearSprites();
    this.boardCache = null;
  }

  slotCenter(i) {
    const L = this.L;
    return [L.x + L.slotW * (i + 0.5), L.trayY + L.trayH / 2];
  }

  cellCenter(r, c) {
    const L = this.L;
    return [L.gx + (c + 0.5) * L.cell, L.gy + (r + 0.5) * L.cell];
  }

  // ---------------------------------------------------------------- input

  onDown(e) {
    this.sfx.unlock();
    if (this.state !== 'play' || this.drag) return;
    const L = this.L;
    const px = e.clientX;
    const py = e.clientY;
    if (py < L.trayY - L.cell * 0.6 || py > L.trayY + L.trayH + L.cell) return;
    const slot = px < L.x + L.slotW ? 0 : px < L.x + L.slotW * 2 ? 1 : 2;
    const piece = this.game.tray[slot];
    if (!piece) return;
    e.preventDefault();
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      // Not all browsers allow capture for every pointer type.
    }
    if (this.fx.back?.slot === slot) this.fx.back = null;
    const shape = shapeOf(piece);
    const touch = e.pointerType !== 'mouse';
    this.drag = {
      slot,
      piece,
      shape,
      pointerId: e.pointerId,
      px,
      py,
      startX: px,
      startY: py,
      t0: now(),
      from: this.slotCenter(slot),
      lift: touch ? (shape.h * L.cell) / 2 + L.cell * 1.15 : 0,
      target: null,
    };
    this.sfx.pick();
    this.updateTarget();
  }

  onMove(e) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    d.px = e.clientX;
    d.py = e.clientY;
    this.updateTarget();
  }

  onUp(e, cancelled = false) {
    const d = this.drag;
    if (!d || e.pointerId !== d.pointerId) return;
    if (!cancelled && d.target && this.state === 'play') {
      this.drag = null;
      this.commit(d.slot, d.target.row, d.target.col);
      return;
    }
    const moved = Math.hypot(d.px - d.startX, d.py - d.startY) > 12;
    this.cancelDrag();
    if (moved && !cancelled) this.sfx.invalid();
  }

  cancelDrag() {
    const d = this.drag;
    if (!d) return;
    this.fx.back = { slot: d.slot, ...this.dragPose(now()), t0: now() };
    this.drag = null;
  }

  // Snap the dragged piece to the nearest cell and work out which lines it would clear.
  updateTarget() {
    const d = this.drag;
    const L = this.L;
    const x0 = d.px - (d.shape.w * L.cell) / 2;
    const y0 = d.py - d.lift - (d.shape.h * L.cell) / 2;
    const col = Math.round((x0 - L.gx) / L.cell);
    const row = Math.round((y0 - L.gy) / L.cell);
    if (!this.game.canPlace(d.slot, row, col)) {
      d.target = null;
      return;
    }
    if (d.target && d.target.row === row && d.target.col === col) return;
    const { rows, cols } = previewLines(this.game.board, d.shape, row, col);
    d.target = { row, col, rows: new Set(rows), cols: new Set(cols), lines: rows.length + cols.length };
  }

  dragPose(t) {
    const d = this.drag;
    const k = outCubic(clamp01((t - d.t0) / LIFT_MS));
    return {
      cx: lerp(d.from[0], d.px, k),
      cy: lerp(d.from[1], d.py - d.lift, k),
      scale: lerp(this.L.trayCell / this.L.cell, 1, k),
    };
  }

  // ---------------------------------------------------------------- moves

  commit(slot, row, col) {
    const game = this.game;
    const res = game.place(slot, row, col);
    if (!res) return;
    const t = now();
    for (const p of res.placed) this.fx.pops.set(idx(p.r, p.c), t);
    this.sfx.place();
    this.haptics.tap('light');

    let flyEnd = 0;
    if (res.lines) {
      const cr = avg(res.placed.map((p) => p.r));
      const cc = avg(res.placed.map((p) => p.c));
      for (const cl of res.cleared) {
        const start = t + Math.hypot(cl.r - cr, cl.c - cc) * 26;
        this.fx.clears.push({ ...cl, t0: start, burst: false });
        if (cl.cell.g) {
          const gem = res.gems.find((g) => g.r === cl.r && g.c === cl.c);
          if (gem && gem.goal >= 0) {
            this.fx.flying.push({ ...gem, t0: start + 60, from: this.cellCenter(cl.r, cl.c), to: null });
            flyEnd = Math.max(flyEnd, start + 60 + FLY_MS - t);
          }
        }
      }
      this.sfx.clear(res.lines, res.combo);
      this.haptics.tap(res.lines >= 3 ? 'heavy' : 'medium');
      this.celebrate(res);
    }

    if (game.refill()) {
      this.fx.spawn = [t + 140, t + 210, t + 280];
      this.later(140, () => this.sfx.refill());
    }
    this.updateFits();
    if (game.score > this.best) this.best = game.score;
    this.updateHud();
    this.events.save(game);

    if (game.isWon) {
      this.state = 'busy';
      this.later(Math.max(500, flyEnd + 250), () => this.win());
    } else if (game.isOver) {
      this.state = 'busy';
      this.later(res.lines ? 700 : 400, () => this.lose());
    }
  }

  celebrate(res) {
    const L = this.L;
    const cx = L.x + L.size / 2;
    const cy = L.y + L.size * 0.45;
    let text = null;
    let tier = 0;
    if (res.allClear) {
      text = 'Perfect!';
      tier = 6;
    } else if (res.lines >= 2) {
      tier = Math.min(res.lines, 6);
      text = PRAISE[tier];
    }
    if (text) {
      this.float(text, cx, cy, `praise tier-${tier}`);
      this.sfx.praise();
    }
    if (res.combo >= 2) this.float(`Combo ${res.combo}`, cx, text ? cy - L.cell * 1.2 : cy, 'combo-pop');
    if (this.game.mode === 'classic') {
      const sx = avg(res.cleared.map((c) => this.cellCenter(c.r, c.c)[0]));
      const sy = avg(res.cleared.map((c) => this.cellCenter(c.r, c.c)[1]));
      this.float(`+${res.clearPoints}`, sx, sy + L.cell * 0.6, 'points');
    }
  }

  win() {
    this.state = 'won';
    this.sfx.win();
    this.haptics.tap('heavy');
    const L = this.L;
    this.float('Level Complete!', L.x + L.size / 2, L.y + L.size * 0.45, 'banner win');
    this.later(1400, () => this.events.won({ level: this.game.level }));
  }

  lose() {
    this.state = 'over';
    this.sfx.gameOver();
    this.haptics.tap('heavy');
    this.fx.gray = now();
    const L = this.L;
    this.float('No More Space!', L.x + L.size / 2, L.y + L.size * 0.45, 'banner');
    const game = this.game;
    this.later(1800, () =>
      this.events.over({
        mode: game.mode,
        level: game.level,
        goals: game.goals,
        score: game.score,
        best: Math.max(this.startBest, game.score),
        newBest: game.mode === 'classic' && game.score > this.startBest,
      }),
    );
  }

  updateFits() {
    this.fits = [0, 1, 2].map((i) => this.game.fits(i));
  }

  // ---------------------------------------------------------------- HUD

  float(text, x, y, cls) {
    const el = document.createElement('div');
    el.className = `float ${cls}`;
    el.textContent = text;
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    el.addEventListener('animationend', () => el.remove());
    this.fxLayer.append(el);
    setTimeout(() => el.remove(), 4000);
  }

  setupHud() {
    const { hud, game } = this;
    const journey = game.mode === 'journey';
    for (const el of hud.root.querySelectorAll('.hud-classic')) el.classList.toggle('hidden', journey);
    for (const el of hud.root.querySelectorAll('.hud-journey')) el.classList.toggle('hidden', !journey);
    hud.combo.classList.remove('show');
    hud.score.textContent = game.score;
    hud.best.textContent = this.best;
    if (journey) {
      hud.level.textContent = game.level;
      hud.goals.replaceChildren(
        ...game.goals.map(() => {
          const el = document.createElement('div');
          el.className = 'goal';
          el.append(document.createElement('img'), document.createElement('span'));
          return el;
        }),
      );
      game.goals.forEach((g, i) => {
        hud.goals.children[i].querySelector('img').src = gemIcon(g.color);
      });
    }
    this.updateHud();
  }

  updateHud() {
    const { hud, game } = this;
    if (game.mode === 'classic') {
      const show = game.combo >= 2;
      hud.combo.classList.toggle('show', show);
      if (show) {
        hud.comboCount.textContent = game.combo;
        const left = SCORING.comboWindow - game.movesSinceClear;
        hud.comboPips.replaceChildren(
          ...Array.from({ length: SCORING.comboWindow }, (_, i) => {
            const pip = document.createElement('i');
            if (i < left) pip.className = 'on';
            return pip;
          }),
        );
      }
    } else {
      game.goals.forEach((g, i) => {
        const el = hud.goals.children[i];
        const left = g.need - this.goalShown[i];
        el.querySelector('span').textContent = left > 0 ? left : '✓';
        el.classList.toggle('done', left <= 0);
      });
    }
  }

  gemArrived(goal) {
    this.goalShown[goal]++;
    this.updateHud();
    const el = this.hud.goals.children[goal];
    if (el) {
      el.classList.remove('bump');
      void el.offsetWidth;
      el.classList.add('bump');
    }
    this.sfx.gem();
  }

  // ---------------------------------------------------------------- drawing

  frame() {
    if (!this.active) return;
    this.raf = requestAnimationFrame(this.frame);
    const score = this.game.score;
    if (this.shownScore !== score) {
      const diff = score - this.shownScore;
      this.shownScore = diff < 0 ? score : this.shownScore + Math.max(1, Math.ceil(diff * 0.16));
      this.hud.score.textContent = this.shownScore;
      this.hud.best.textContent = Math.max(this.startBest, this.shownScore);
    }
    this.draw(now());
  }

  draw(t) {
    const { ctx, dpr, game } = this;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, this.W, this.H);
    this.drawBoardBase();

    const d = this.drag;
    const target = d?.target;
    const gray = this.fx.gray;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = game.board[idx(r, c)];
        if (!cell) continue;
        let key = cell.c;
        if (target && (target.rows.has(r) || target.cols.has(c))) key = d.piece.color;
        if (gray && t > gray + r * 60) key = 'gray';
        let scale = 1;
        const popT = this.fx.pops.get(idx(r, c));
        if (popT !== undefined) {
          const k = (t - popT) / POP_MS;
          if (k >= 1) this.fx.pops.delete(idx(r, c));
          else scale = lerp(1.18, 1, outCubic(clamp01(k)));
        }
        this.drawCell(r, c, key, !!cell.g, scale);
      }
    }

    if (target) {
      ctx.globalAlpha = target.lines ? 0.85 : 0.4;
      d.shape.cells.forEach(([r, c], i) =>
        this.drawCell(target.row + r, target.col + c, d.piece.color, d.piece.gems.includes(i)),
      );
      ctx.globalAlpha = 1;
    }

    this.drawClears(t);
    for (let i = 0; i < 3; i++) this.drawTrayPiece(i, t);
    if (d) this.drawPiece(d.piece, d.shape, this.dragPose(t));
    this.drawParticles(t);
    this.drawFlying(t);
  }

  drawBoardBase() {
    const L = this.L;
    if (!this.boardCache) {
      const cv = document.createElement('canvas');
      cv.width = cv.height = Math.ceil(L.size * this.dpr);
      const g = cv.getContext('2d');
      g.scale(this.dpr, this.dpr);
      roundRect(g, 0, 0, L.size, L.size, L.size * 0.035);
      g.fillStyle = THEME.boardEdge;
      g.fill();
      roundRect(g, 1.5, 1.5, L.size - 3, L.size - 3, L.size * 0.032);
      g.fillStyle = THEME.board;
      g.fill();
      for (let r = 0; r < N; r++) {
        for (let c = 0; c < N; c++) {
          const x = L.pad + c * L.cell + L.inset;
          const y = L.pad + r * L.cell + L.inset;
          roundRect(g, x, y, L.block, L.block, L.block * 0.12);
          g.fillStyle = THEME.cell;
          g.fill();
          g.fillStyle = 'rgba(0,0,0,0.16)';
          g.fillRect(x + L.block * 0.1, y, L.block * 0.8, Math.max(1, L.block * 0.06));
        }
      }
      this.boardCache = cv;
    }
    this.ctx.drawImage(this.boardCache, L.x, L.y, L.size, L.size);
  }

  drawCell(r, c, key, gem = false, scale = 1) {
    const L = this.L;
    const size = L.block * scale;
    const [cx, cy] = this.cellCenter(r, c);
    this.ctx.drawImage(blockSprite(key, L.block, this.dpr, gem), cx - size / 2, cy - size / 2, size, size);
  }

  drawPiece(piece, shape, { cx, cy, scale }, alpha = 1) {
    const L = this.L;
    const s = L.cell * scale;
    const inset = L.inset * scale;
    const x0 = cx - (shape.w * s) / 2;
    const y0 = cy - (shape.h * s) / 2;
    this.ctx.globalAlpha = alpha;
    shape.cells.forEach(([r, c], i) => {
      const sprite = blockSprite(piece.color, L.block, this.dpr, piece.gems.includes(i));
      this.ctx.drawImage(sprite, x0 + c * s + inset, y0 + r * s + inset, s - inset * 2, s - inset * 2);
    });
    this.ctx.globalAlpha = 1;
  }

  drawTrayPiece(i, t) {
    const piece = this.game.tray[i];
    if (!piece || this.drag?.slot === i) return;
    const sp = (t - this.fx.spawn[i]) / SPAWN_MS;
    if (sp <= 0) return;
    const [sx, sy] = this.slotCenter(i);
    const rest = this.L.trayCell / this.L.cell;
    let pose = { cx: sx, cy: sy, scale: rest };
    const back = this.fx.back;
    if (back && back.slot === i) {
      const k = outCubic(clamp01((t - back.t0) / RETURN_MS));
      if (k >= 1) this.fx.back = null;
      pose = { cx: lerp(back.cx, sx, k), cy: lerp(back.cy, sy, k), scale: lerp(back.scale, rest, k) };
    }
    if (sp < 1) pose.scale *= outBack(sp);
    const dim = this.state === 'play' && !this.fits[i];
    this.drawPiece(piece, shapeOf(piece), pose, dim ? 0.35 : 1);
  }

  drawClears(t) {
    const { ctx, L } = this;
    this.fx.clears = this.fx.clears.filter((fx) => {
      const k = (t - fx.t0) / CLEAR_MS;
      if (k >= 1) return false;
      if (k < 0) {
        this.drawCell(fx.r, fx.c, fx.cell.c, !!fx.cell.g);
        return true;
      }
      if (!fx.burst) {
        fx.burst = true;
        this.burst(fx);
      }
      const scale = k < 0.2 ? lerp(1, 1.12, k / 0.2) : lerp(1.12, 0, outCubic((k - 0.2) / 0.8));
      ctx.globalAlpha = 1 - k * 0.4;
      this.drawCell(fx.r, fx.c, fx.cell.c, false, scale);
      const flash = k < 0.3 ? k / 0.3 : 1 - (k - 0.3) / 0.7;
      const size = L.block * scale;
      const [cx, cy] = this.cellCenter(fx.r, fx.c);
      ctx.globalAlpha = flash * 0.75;
      ctx.fillStyle = '#fff';
      roundRect(ctx, cx - size / 2, cy - size / 2, size, size, size * 0.12);
      ctx.fill();
      ctx.globalAlpha = 1;
      return true;
    });
  }

  burst(fx) {
    const L = this.L;
    const [x, y] = this.cellCenter(fx.r, fx.c);
    const color = colorHex(fx.cell.c);
    for (let i = 0; i < 5; i++) {
      const a = Math.random() * Math.PI * 2;
      const speed = (0.5 + Math.random()) * L.cell * 4;
      this.fx.particles.push({
        x,
        y,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - L.cell * 3,
        size: L.cell * (0.12 + Math.random() * 0.14),
        color,
        t0: fx.t0,
        life: 450 + Math.random() * 350,
        rot: Math.random() * 6,
        spin: (Math.random() - 0.5) * 14,
      });
    }
  }

  drawParticles(t) {
    const { ctx, L } = this;
    const gravity = L.cell * 24;
    this.fx.particles = this.fx.particles.filter((p) => {
      const k = (t - p.t0) / p.life;
      if (k >= 1) return false;
      if (k < 0) return true;
      const s = (t - p.t0) / 1000;
      const size = p.size * (1 - k * 0.5);
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.translate(p.x + p.vx * s, p.y + p.vy * s + 0.5 * gravity * s * s);
      ctx.rotate(p.rot + p.spin * s);
      ctx.fillStyle = p.color;
      ctx.fillRect(-size / 2, -size / 2, size, size);
      ctx.restore();
      return true;
    });
  }

  drawFlying(t) {
    const L = this.L;
    this.fx.flying = this.fx.flying.filter((f) => {
      const k = (t - f.t0) / FLY_MS;
      if (k < 0) return true;
      if (!f.to) {
        const el = this.hud.goals.children[f.goal];
        const rect = el?.querySelector('img')?.getBoundingClientRect();
        f.to = rect ? [rect.left + rect.width / 2, rect.top + rect.height / 2] : [this.W / 2, 0];
      }
      if (k >= 1) {
        this.gemArrived(f.goal);
        return false;
      }
      const e = inOutCubic(k);
      const [x0, y0] = f.from;
      const [x1, y1] = f.to;
      const ctrlX = x0 + (x0 < this.W / 2 ? -1 : 1) * L.cell * 1.5;
      const ctrlY = Math.min(y0, y1) + (y0 - y1) * 0.25;
      const x = (1 - e) ** 2 * x0 + 2 * (1 - e) * e * ctrlX + e * e * x1;
      const y = (1 - e) ** 2 * y0 + 2 * (1 - e) * e * ctrlY + e * e * y1;
      const size = L.block * lerp(1.1, 0.6, e) * (1 + 0.25 * Math.sin(Math.PI * k));
      this.ctx.drawImage(blockSprite(f.color, L.block, this.dpr, true), x - size / 2, y - size / 2, size, size);
      return true;
    });
  }
}
