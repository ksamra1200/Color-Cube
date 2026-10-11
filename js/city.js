// The Journey map's dystopian megacity: grimy 2.5D buildings, ruins, smokestacks, neon,
// street junk and the road, drawn on canvas.
import { mulberry32 } from './engine.js';
import { shade } from './render.js';

// Oblique projection: one unit of depth moves this far right and up on screen.
const DX = 0.5;
const DY = -0.55;
const ROAD_CLEAR = 30; // buildings stay this far from the road's center line
const NODE_CLEAR = 52; // ...and from level-node centers
const ROW_GAP = [52, 80]; // distance between rows of buildings
const BLEND = 180; // height over which one district's ground fades into the next
const BUCKET = 200;
const SIGN_FONT = 'bold 9px "Courier New", ui-monospace, monospace';
const BILLBOARDS = [
  'OBEY',
  'CONSUME',
  'COMPLY',
  'NO EXIT',
  'WORK',
  'SLEEP',
  'BUY',
  'CURFEW',
  'REPORT',
  'ZONE 9',
  'VOID',
];
const SIGNS = ['BAR', 'HOTEL', 'OPEN', 'SYNTH', 'RAMEN', 'CLONE', 'CHIP', 'PAWN'];

// Points along the Catmull-Rom curve through `pts` (the same curve the map's SVG path uses).
export function sampleCurve(pts, steps = 12) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    for (let s = 0; s < steps; s++) {
      const t = s / steps;
      const at = (k) =>
        0.5 *
        (2 * p1[k] +
          (p2[k] - p0[k]) * t +
          (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t * t +
          (3 * p1[k] - p0[k] - 3 * p2[k] + p3[k]) * t * t * t);
      out.push([at(0), at(1)]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

const lowerBound = (arr, v) => {
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid] < v) lo = mid + 1;
    else hi = mid;
  }
  return lo;
};

const pick = (rng, list) => list[Math.floor(rng() * list.length)];

// Lay out the whole city. bands: [{ top, bottom, index, theme, next }] bottom to top,
// points: level-node centers in order, keepOut: [x0, y0, x1, y1] rects (signs) to leave empty.
export function buildCity({ width: W, height, bands, points, keepOut }) {
  const road = sampleCurve(points);
  const roadByY = [...road].sort((a, b) => a[1] - b[1]);
  const roadYs = roadByY.map((p) => p[1]);
  const nodes = [...points].sort((a, b) => a[1] - b[1]);
  const nodeYs = nodes.map((p) => p[1]);

  const near = (list, ys, [x0, y0, x1, y1], clear) => {
    for (let i = lowerBound(ys, y0 - clear); i < list.length && list[i][1] <= y1 + clear; i++) {
      const [px, py] = list[i];
      const dx = Math.max(x0 - px, 0, px - x1);
      const dy = Math.max(y0 - py, 0, py - y1);
      if (dx * dx + dy * dy < clear * clear) return true;
    }
    return false;
  };
  const buckets = new Map();
  const bucketRange = (r) => [Math.floor(r[1] / BUCKET), Math.floor(r[3] / BUCKET)];
  const block = (r) => {
    const [b0, b1] = bucketRange(r);
    for (let b = b0; b <= b1; b++) {
      if (!buckets.has(b)) buckets.set(b, []);
      buckets.get(b).push(r);
    }
  };
  const overlaps = (r) => {
    const [b0, b1] = bucketRange(r);
    for (let b = b0; b <= b1; b++) {
      for (const o of buckets.get(b) || []) if (r[0] < o[2] && r[2] > o[0] && r[1] < o[3] && r[3] > o[1]) return true;
    }
    return false;
  };
  keepOut.forEach(block);
  const bandAt = (y) => bands.find((b) => y >= b.top && y <= b.bottom) || bands[0];

  const items = [];
  const ground = []; // flat things: grime, puddles
  const cracks = [];

  // Street junk along both sides of the road, and cracks in the asphalt.
  const rng = mulberry32(Math.round(W) * 31 + bands.length);
  let run = 0;
  for (let i = 1; i < road.length - 1; i++) {
    const [x, y] = road[i];
    run += Math.hypot(x - road[i - 1][0], y - road[i - 1][1]);
    if (rng() < 0.12) {
      const segs = [[x + (rng() - 0.5) * 22, y + (rng() - 0.5) * 6]];
      for (let k = 0; k < 3; k++) {
        const [px, py] = segs[segs.length - 1];
        segs.push([px + (rng() - 0.5) * 12, py + (rng() - 0.5) * 9]);
      }
      cracks.push(segs);
    }
    if (run < 46) continue;
    run = 0;
    const tx = road[i + 1][0] - road[i - 1][0];
    const ty = road[i + 1][1] - road[i - 1][1];
    const len = Math.hypot(tx, ty) || 1;
    const theme = bandAt(y).theme;
    for (const side of [-1, 1]) {
      if (rng() < 0.25) continue;
      const off = (32 + rng() * 5) * side;
      const px = x + (-ty / len) * off;
      const py = y + (tx / len) * off;
      if (px < 6 || px > W - 6) continue;
      const kind = pick(rng, theme.props);
      const box = [px - 9, py - 26, px + 9, py + 3];
      if (near(nodes, nodeYs, box, 40) || overlaps(box)) continue;
      block(box);
      items.push({ kind, x: px, y: py, box, theme, seed: Math.floor(rng() * 1e9) });
    }
  }

  for (const band of bands) {
    const { theme } = band;
    const r = mulberry32(band.index * 7919 + 101);
    const span = Math.max(0, band.bottom - band.top - BLEND);

    // Grime patches and oily or glowing puddles on the ground.
    for (let i = 0; i < 70; i++) {
      ground.push({
        kind: 'grime',
        x: r() * W,
        y: band.top + BLEND + r() * span,
        w: 8 + r() * 30,
        h: 5 + r() * 9,
        color: shade(theme.ground, (r() - 0.6) * 0.16),
      });
    }
    for (let i = 0; i < 14; i++) {
      const glow = theme.toxic ? '#3cff8f' : theme.neon.length ? pick(r, theme.neon) : theme.haze;
      ground.push({ kind: 'puddle', x: r() * W, y: band.top + BLEND + r() * span, w: 10 + r() * 24, glow });
    }

    // Rows of buildings filling every gap the road leaves.
    for (let base = band.bottom - 4; base > band.top + 24; base -= ROW_GAP[0] + r() * (ROW_GAP[1] - ROW_GAP[0])) {
      let x = -12 + r() * 10;
      while (x < W + 4) {
        const w = 24 + r() * 32;
        const d = 14 + r() * 18;
        const h = (theme.tall ? 60 : 34) + r() * (theme.tall ? 125 : 80);
        const ruined = r() < theme.ruins;
        const billboard = !ruined && theme.neon.length > 0 && w > 34 && r() < 0.18;
        const box = [x, base - h + d * DY - (billboard ? 24 : 0), x + w + d * DX, base];
        const fits = !near(roadByY, roadYs, box, ROAD_CLEAR) && !near(nodes, nodeYs, box, NODE_CLEAR) && !overlaps(box);
        if (!fits) {
          x += 7;
          continue;
        }
        items.push({
          kind: 'building',
          x,
          y: base,
          w,
          h,
          d,
          box,
          reach: 80, // smoke and antennas can rise above the box
          theme,
          ruined,
          billboard,
          color: pick(r, theme.buildings),
          style: r(),
          seed: Math.floor(r() * 1e9),
        });
        x += w + 3 + r() * 8;
      }
    }
  }

  // Far things first, so nearer ones overlap them.
  items.sort((a, b) => a.y - b.y);
  return { width: W, height, bands, road, ground, cracks, items };
}

function poly(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

function circle(ctx, x, y, r, fill) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fillStyle = fill;
  ctx.fill();
}

function glowAt(ctx, x, y, r, color, alpha) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
  ctx.restore();
}

// A plain box: front face, right side and roof.
function drawBox(ctx, x, y, w, h, d, color) {
  const dx = d * DX;
  const dy = d * DY;
  const top = y - h;
  ctx.fillStyle = color;
  ctx.fillRect(x, top, w, h);
  poly(ctx, [x + w, y, x + w + dx, y + dy, x + w + dx, top + dy, x + w, top], shade(color, -0.3));
  poly(ctx, [x, top, x + w, top, x + w + dx, top + dy, x + dx, top + dy], shade(color, 0.12));
}

// A bombed-out shell: jagged top edge, dark gutted interior, rebar poking out.
// Returns the lowest point of the broken edge (windows stay below it).
function drawRuin(ctx, b, rng) {
  const { x, y, w, h, d, color } = b;
  const dx = d * DX;
  const dy = d * DY;
  const top = y - h;
  const steps = 3 + Math.floor(rng() * 3);
  const edge = [];
  for (let i = 0; i <= steps; i++) edge.push([x + (w * i) / steps, top + rng() * h * 0.35]);
  const interior = edge.flat();
  for (let i = edge.length - 1; i >= 0; i--) interior.push(edge[i][0] + dx, edge[i][1] + dy + rng() * 6);
  poly(ctx, interior, '#0b0a10');
  const last = edge[edge.length - 1][1];
  poly(ctx, [x + w, y, x + w + dx, y + dy, x + w + dx, last + dy + 6, x + w, last], shade(color, -0.3));
  poly(ctx, [x, y, ...edge.flat(), x + w, y], color);
  ctx.strokeStyle = '#8a8580';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 3; i++) {
    const [ex, ey] = edge[Math.floor(rng() * edge.length)];
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex + (rng() - 0.5) * 6, ey - 5 - rng() * 6);
  }
  ctx.stroke();
  return Math.max(...edge.map((p) => p[1]));
}

function neonText(ctx, text, x, y, color) {
  ctx.save();
  ctx.font = SIGN_FONT;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = color;
  ctx.shadowBlur = 7;
  ctx.fillStyle = color;
  ctx.fillText(text, x, y);
  ctx.restore();
}

function neonFrame(ctx, x, y, w, h, color) {
  ctx.fillStyle = '#0b0a12';
  ctx.fillRect(x, y, w, h);
  ctx.save();
  ctx.strokeStyle = color;
  ctx.shadowColor = color;
  ctx.shadowBlur = 6;
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  ctx.restore();
}

function drawBuilding(ctx, b) {
  const { x, y, w, h, d, color, theme: t } = b;
  const dx = d * DX;
  const dy = d * DY;
  const top = y - h;
  const rng = mulberry32(b.seed);
  const windowColor = () => {
    if (rng() < t.lit) return pick(rng, t.windows);
    return rng() < 0.2 ? '#2a2c35' : '#0f0d16';
  };

  // Long shadow across the ground.
  const reach = h * 0.35;
  poly(
    ctx,
    [x + w, y, x + w + dx, y + dy, x + w + dx + reach, y + dy + reach * 0.15, x + w + reach, y + reach * 0.15],
    'rgba(0,0,0,0.3)',
  );

  let ceiling = top;
  if (b.ruined) ceiling = drawRuin(ctx, b, rng);
  else drawBox(ctx, x, y, w, h, d, color);

  // Windows: horizontal strips or a grid, mostly dark.
  if (b.style < 0.35) {
    for (let cy = ceiling + 6; cy + 5 < y - 6; cy += 11) {
      ctx.fillStyle = windowColor();
      ctx.fillRect(x + 4, cy, w - 8, 5);
    }
  } else {
    const cols = Math.max(1, Math.floor((w - 4) / 9));
    const left = x + (w - (cols * 9 - 4)) / 2;
    for (let cy = ceiling + 6; cy + 7 < y - 5; cy += 12) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = windowColor();
        ctx.fillRect(left + c * 9, cy, 5, 7);
      }
    }
  }
  const sideCols = Math.max(1, Math.floor(d / 10));
  for (let cy = ceiling + 6; cy + 7 < y - 5; cy += 12) {
    for (let c = 0; c < sideCols; c++) {
      const f0 = (c + 0.25) / sideCols;
      const f1 = (c + 0.75) / sideCols;
      const x0 = x + w + dx * f0;
      const x1 = x + w + dx * f1;
      poly(ctx, [x0, cy + dy * f0, x1, cy + dy * f1, x1, cy + dy * f1 + 7, x0, cy + dy * f0 + 7], windowColor());
    }
  }

  // Grime streaks running down the facade, and a drainpipe on the side.
  ctx.fillStyle = 'rgba(0,0,0,0.18)';
  for (let i = 0; i < 3; i++) {
    const sx = x + rng() * (w - 3);
    const sy = ceiling + rng() * h * 0.2;
    ctx.fillRect(sx, sy, 2 + rng() * 3, (y - sy) * (0.3 + rng() * 0.5));
  }
  const pf = 0.3 + rng() * 0.4;
  ctx.fillStyle = shade(color, -0.5);
  ctx.fillRect(x + w + dx * pf - 0.75, ceiling + dy * pf + 4, 1.5, y - ceiling - 4);

  if (b.ruined) return;
  if (h < 90 && w > 26) {
    ctx.fillStyle = '#0b0a10';
    ctx.fillRect(x + w / 2 - 4, y - 11, 8, 11);
  }

  // Rooftop: shanty clutter or an AC unit, and smokestacks.
  if (t.clutter) {
    for (let i = 0; i < 2; i++) {
      const f = 0.15 + rng() * 0.5;
      drawBox(ctx, x + w * f + dx * 0.2, top + dy * 0.2, w * 0.28, 6 + rng() * 6, d * 0.4, pick(rng, t.buildings));
    }
  } else if (rng() < 0.3) {
    drawBox(ctx, x + w * 0.25 + dx * 0.3, top + dy * 0.3, w * 0.3, 7, d * 0.35, color);
  }
  if (t.smoke && rng() < 0.32) {
    const sx = x + w * (0.4 + rng() * 0.4) + dx * 0.5;
    const sy = top + dy * 0.5;
    const sh = 14 + rng() * 12;
    ctx.fillStyle = '#3a312c';
    ctx.fillRect(sx - 3, sy - sh, 6, sh);
    ctx.fillStyle = '#56483f';
    ctx.fillRect(sx - 3, sy - sh, 2, sh);
    ctx.fillStyle = '#c0392b';
    ctx.fillRect(sx - 3, sy - sh + 3, 6, 2);
    const smoke = t.toxic ? '120,190,120' : '95,90,92';
    for (let i = 0; i < 7; i++) {
      circle(ctx, sx + i * i * 0.8 + i * 2, sy - sh - 4 - i * 8, 3.5 + i * 2.2, `rgba(${smoke},${0.42 - i * 0.05})`);
    }
  }

  // Neon: a vertical shop sign on the facade, or a propaganda billboard on the roof.
  if (t.neon.length && !b.billboard && h > 60 && rng() < 0.3) {
    const word = pick(rng, SIGNS);
    const sx = rng() < 0.5 ? x + 2 : x + w - 10;
    const neon = pick(rng, t.neon);
    neonFrame(ctx, sx, top + 8, 8, word.length * 9 + 6, neon);
    [...word].forEach((ch, i) => neonText(ctx, ch, sx + 4, top + 15 + i * 9, neon));
  }
  if (b.billboard) {
    ctx.font = SIGN_FONT;
    const fitting = BILLBOARDS.filter((word) => ctx.measureText(word).width < w - 12);
    if (fitting.length) {
      const neon = pick(rng, t.neon);
      ctx.fillStyle = '#2a2a30';
      ctx.fillRect(x + 7, top - 8, 2, 8);
      ctx.fillRect(x + w - 9, top - 8, 2, 8);
      neonFrame(ctx, x + 3, top - 21, w - 6, 13, neon);
      neonText(ctx, pick(rng, fitting), x + w / 2, top - 14, neon);
    }
  }

  // Red warning beacons and antennas on the towers.
  if ((t.beacons || t.tall) && h > 100) {
    const ax = x + w / 2 + dx / 2;
    const ay = top + dy / 2;
    ctx.fillStyle = '#5b6170';
    ctx.fillRect(ax - 1, ay - 24, 2, 24);
    glowAt(ctx, ax, ay - 25, 9, '#ff3b3b', 0.7);
    circle(ctx, ax, ay - 25, 2.2, '#ff4d4d');
    circle(ctx, x + 2, top + 1, 1.6, '#ff4d4d');
    circle(ctx, x + w + dx - 2, top + dy + 1, 1.6, '#ff4d4d');
  }
}

function drawProp(ctx, it) {
  const { x, y, theme: t } = it;
  const rng = mulberry32(it.seed);
  ctx.beginPath();
  ctx.ellipse(x + 3, y + 1, 8, 3, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.fill();
  if (it.kind === 'barrel' || it.kind === 'toxic') {
    const toxic = it.kind === 'toxic';
    if (toxic) {
      ctx.beginPath();
      ctx.ellipse(x - 2, y + 2, 11, 3.5, 0, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(60,255,143,0.45)';
      ctx.fill();
    }
    const body = toxic ? '#8fb33a' : '#5a3a2a';
    ctx.fillStyle = body;
    ctx.fillRect(x - 4, y - 11, 8, 11);
    ctx.fillStyle = shade(body, -0.3);
    ctx.fillRect(x - 4, y - 8, 8, 1.5);
    ctx.fillRect(x - 4, y - 4, 8, 1.5);
    ctx.beginPath();
    ctx.ellipse(x, y - 11, 4, 1.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = shade(body, -0.45);
    ctx.fill();
    if (toxic) {
      glowAt(ctx, x, y - 10, 16, '#3cff8f', 0.6);
    } else {
      glowAt(ctx, x, y - 14, 24, '#ff8a2b', 0.75);
      circle(ctx, x - 1.5, y - 14, 3, '#ff6a1a');
      circle(ctx, x + 1.5, y - 15, 2.6, '#ff9a2e');
      circle(ctx, x, y - 17.5, 2, '#ffd34d');
    }
  } else if (it.kind === 'deadtree') {
    ctx.strokeStyle = '#2b2420';
    ctx.lineCap = 'round';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 18);
    ctx.stroke();
    ctx.lineWidth = 1.3;
    ctx.beginPath();
    for (let i = 0; i < 4; i++) {
      const by = y - 8 - i * 3;
      const dir = i % 2 ? 1 : -1;
      ctx.moveTo(x, by);
      ctx.lineTo(x + dir * (5 + rng() * 4), by - 4 - rng() * 4);
    }
    ctx.stroke();
  } else if (it.kind === 'barrier') {
    ctx.fillStyle = '#2a2a2e';
    ctx.fillRect(x - 7, y - 3, 2, 3);
    ctx.fillRect(x + 5, y - 3, 2, 3);
    ctx.fillStyle = '#e8c33a';
    ctx.fillRect(x - 8, y - 9, 16, 6);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 8, y - 9, 16, 6);
    ctx.clip();
    for (let i = 0; i < 5; i++)
      poly(ctx, [x - 10 + i * 4, y - 9, x - 8 + i * 4, y - 9, x - 10 + i * 4, y - 3, x - 12 + i * 4, y - 3], '#16151a');
    ctx.restore();
  } else {
    // Street lamp: some still work, buzzing a sickly yellow or neon; the rest are dead.
    const on = rng() < 0.6;
    if (on) glowAt(ctx, x + 5, y - 20, 24, t.neon.length && rng() < 0.4 ? pick(rng, t.neon) : '#ffcc66', 0.55);
    ctx.fillStyle = '#4a4f5c';
    ctx.fillRect(x - 1, y - 21, 2, 21);
    ctx.fillRect(x - 1, y - 22, 6, 1.5);
    circle(ctx, x + 5, y - 20.5, 2.4, on ? '#fff3c4' : '#3b3e48');
  }
}

function strokeRoad(ctx, path, cracks, t) {
  const { road } = t;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stroke = (color, width, { dy = 0, dash = null, alpha = 1 } = {}) => {
    ctx.save();
    ctx.translate(0, dy);
    if (dash) ctx.setLineDash(dash);
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(path);
    ctx.restore();
  };
  stroke('rgba(0,0,0,0.35)', 50, { dy: 8 });
  stroke(road.curb, 48, { dy: 5 });
  stroke(road.sidewalk, 48);
  if (t.hazard) stroke('#b8952a', 48, { dash: [6, 8], alpha: 0.45 });
  stroke(road.asphalt, 34);
  ctx.save();
  ctx.strokeStyle = shade(road.asphalt, -0.5);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const segs of cracks) {
    ctx.moveTo(segs[0][0], segs[0][1]);
    for (let i = 1; i < segs.length; i++) ctx.lineTo(segs[i][0], segs[i][1]);
  }
  ctx.stroke();
  ctx.restore();
  stroke(road.lane, 2.5, { dash: [9, 13], alpha: 0.55 });
}

// Draw the part of the city between `top` and `bottom` (map coordinates).
export function drawCity(ctx, city, top, bottom) {
  const { width: W, bands } = city;
  if (!city.path) {
    city.path = new Path2D();
    city.road.forEach(([x, y], i) => (i ? city.path.lineTo(x, y) : city.path.moveTo(x, y)));
  }
  for (const band of bands) {
    if (band.bottom < top || band.top > bottom) continue;
    ctx.fillStyle = band.theme.ground;
    ctx.fillRect(0, band.top, W, band.bottom - band.top);
    if (band.next) {
      const fade = ctx.createLinearGradient(0, band.top + BLEND, 0, band.top);
      fade.addColorStop(0, band.theme.ground);
      fade.addColorStop(1, band.next.ground);
      ctx.fillStyle = fade;
      ctx.fillRect(0, band.top, W, BLEND);
    }
  }
  for (const g of city.ground) {
    if (g.y + 20 < top || g.y - 20 > bottom) continue;
    if (g.kind === 'grime') {
      ctx.fillStyle = g.color;
      ctx.fillRect(g.x, g.y, g.w, g.h);
      continue;
    }
    ctx.save();
    ctx.translate(g.x, g.y);
    ctx.scale(1, 0.32);
    const shine = ctx.createRadialGradient(0, 0, 0, 0, 0, g.w);
    shine.addColorStop(0, g.glow);
    shine.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = 0.35;
    ctx.fillStyle = shine;
    ctx.beginPath();
    ctx.arc(0, 0, g.w, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  for (const band of bands) {
    if (band.bottom < top - 60 || band.top > bottom + 60) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, band.top, W, band.bottom - band.top);
    ctx.clip();
    strokeRoad(ctx, city.path, city.cracks, band.theme);
    ctx.restore();
  }
  for (const it of city.items) {
    if (it.box[3] + 40 < top || it.box[1] - (it.reach || 50) > bottom) continue;
    if (it.kind === 'building') drawBuilding(ctx, it);
    else drawProp(ctx, it);
  }
}
