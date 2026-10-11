// The Journey map's city: 2.5D buildings, trees, street lamps and the road, drawn on canvas.
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
  const specks = [];

  // Trees (or street lamps at night) along both sides of the road.
  const rng = mulberry32(Math.round(W) * 31 + bands.length);
  let run = 0;
  for (let i = 1; i < road.length - 1; i++) {
    const [x, y] = road[i];
    run += Math.hypot(x - road[i - 1][0], y - road[i - 1][1]);
    if (run < 44) continue;
    run = 0;
    const tx = road[i + 1][0] - road[i - 1][0];
    const ty = road[i + 1][1] - road[i - 1][1];
    const len = Math.hypot(tx, ty) || 1;
    const theme = bandAt(y).theme;
    for (const side of [-1, 1]) {
      const off = (31 + rng() * 5) * side;
      const px = x + (-ty / len) * off;
      const py = y + (tx / len) * off;
      if (px < 6 || px > W - 6) continue;
      const lamp = theme.lit > 0 && rng() < 0.75;
      const r = 7 + rng() * 3;
      const box = lamp ? [px - 4, py - 26, px + 4, py + 2] : [px - r, py - r * 2.4, px + r, py + 2];
      if (near(nodes, nodeYs, box, 40) || overlaps(box)) continue;
      block(box);
      items.push({ kind: lamp ? 'lamp' : 'tree', x: px, y: py, r, box, theme });
    }
  }

  // Rows of buildings filling every gap the road leaves.
  for (const band of bands) {
    const { theme } = band;
    const r = mulberry32(band.index * 7919 + 101);
    for (let i = 0; i < 70; i++) {
      const y = band.top + BLEND + r() * Math.max(0, band.bottom - band.top - BLEND);
      specks.push({ x: r() * W, y, w: 8 + r() * 26, h: 5 + r() * 8, color: shade(theme.ground, (r() - 0.5) * 0.12) });
    }
    for (let base = band.bottom - 4; base > band.top + 24; base -= ROW_GAP[0] + r() * (ROW_GAP[1] - ROW_GAP[0])) {
      let x = -12 + r() * 10;
      while (x < W + 4) {
        const w = 24 + r() * 32;
        const d = 14 + r() * 18;
        const h = (theme.tall ? 56 : 30) + r() * (theme.tall ? 120 : 70);
        const box = [x, base - h + d * DY, x + w + d * DX, base];
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
          theme,
          color: theme.buildings[Math.floor(r() * theme.buildings.length)],
          style: r(),
          seed: Math.floor(r() * 1e9),
        });
        x += w + 3 + r() * 8;
      }
    }
  }

  // Far things first, so nearer ones overlap them.
  items.sort((a, b) => a.y - b.y);
  return { width: W, height, bands, road, specks, items };
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

// A plain box: front face, right side and roof.
function drawBox(ctx, x, y, w, h, d, color, snow) {
  const dx = d * DX;
  const dy = d * DY;
  const top = y - h;
  ctx.fillStyle = color;
  ctx.fillRect(x, top, w, h);
  poly(ctx, [x + w, y, x + w + dx, y + dy, x + w + dx, top + dy, x + w, top], shade(color, -0.28));
  poly(ctx, [x, top, x + w, top, x + w + dx, top + dy, x + dx, top + dy], snow ? '#f7fbff' : shade(color, 0.25));
}

function drawBuilding(ctx, b) {
  const { x, y, w, h, d, color, theme: t } = b;
  const dx = d * DX;
  const dy = d * DY;
  const top = y - h;
  const night = t.lit > 0;
  const rng = mulberry32(b.seed);
  const windowColor = () => {
    if (!night) return t.windows[rng() < 0.75 ? 0 : 1];
    return rng() < t.lit ? t.windows[Math.floor(rng() * t.windows.length)] : '#17142f';
  };

  // Shadow falling to the right across the ground.
  const reach = h * 0.35;
  poly(
    ctx,
    [x + w, y, x + w + dx, y + dy, x + w + dx + reach, y + dy + reach * 0.15, x + w + reach, y + reach * 0.15],
    'rgba(0,0,0,0.2)',
  );
  drawBox(ctx, x, y, w, h, d, color, t.snow);
  ctx.fillStyle = shade(color, -0.12);
  ctx.fillRect(x, top, w, 2);

  // Front windows: glass curtain wall, horizontal strips, or a grid.
  if (b.style < 0.2 && !night) {
    const glass = ctx.createLinearGradient(x, top, x + w, y);
    glass.addColorStop(0, t.windows[0]);
    glass.addColorStop(1, shade(t.windows[1], -0.15));
    ctx.fillStyle = glass;
    ctx.fillRect(x + 3, top + 5, w - 6, h - 8);
    ctx.fillStyle = shade(color, -0.1);
    for (let cx = x + 10; cx < x + w - 4; cx += 7) ctx.fillRect(cx, top + 5, 1, h - 8);
    for (let cy = top + 14; cy < y - 4; cy += 9) ctx.fillRect(x + 3, cy, w - 6, 1);
  } else if (b.style < 0.45) {
    for (let cy = top + 6; cy + 5 < y - 6; cy += 11) {
      ctx.fillStyle = windowColor();
      ctx.fillRect(x + 4, cy, w - 8, 5);
    }
  } else {
    const cols = Math.max(1, Math.floor((w - 4) / 9));
    const left = x + (w - (cols * 9 - 4)) / 2;
    for (let cy = top + 6; cy + 7 < y - 5; cy += 12) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = windowColor();
        ctx.fillRect(left + c * 9, cy, 5, 7);
      }
    }
  }

  // Side windows, sheared to follow the wall.
  const sideCols = Math.max(1, Math.floor(d / 10));
  for (let cy = top + 6; cy + 7 < y - 5; cy += 12) {
    for (let c = 0; c < sideCols; c++) {
      const f0 = (c + 0.25) / sideCols;
      const f1 = (c + 0.75) / sideCols;
      const x0 = x + w + dx * f0;
      const x1 = x + w + dx * f1;
      const y0 = cy + dy * f0;
      const y1 = cy + dy * f1;
      poly(ctx, [x0, y0, x1, y1, x1, y1 + 7, x0, y0 + 7], night ? windowColor() : shade(t.windows[1], -0.25));
    }
  }

  if (h < 90 && w > 26) {
    ctx.fillStyle = shade(color, -0.45);
    ctx.fillRect(x + w / 2 - 4, y - 11, 8, 11);
  }

  // Rooftop clutter: an AC unit or water tank, and antennas on the tall towers.
  if (rng() < 0.35) drawBox(ctx, x + w * 0.25 + dx * 0.3, top + dy * 0.3, w * 0.3, 7, d * 0.35, color, t.snow);
  if (t.tall && h > 120 && rng() < 0.6) {
    const ax = x + w / 2 + dx / 2;
    const ay = top + dy / 2;
    ctx.fillStyle = '#9aa3b5';
    ctx.fillRect(ax - 1, ay - 22, 2, 22);
    circle(ctx, ax, ay - 23, 2.2, '#ff4d4d');
  }
}

function drawTree(ctx, { x, y, r, theme: t }) {
  ctx.beginPath();
  ctx.ellipse(x + r * 0.5, y, r * 1.1, r * 0.45, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.fill();
  ctx.fillStyle = '#7a5232';
  ctx.fillRect(x - 1.5, y - r * 0.9, 3, r * 0.9);
  circle(ctx, x, y - r * 1.3, r, shade(t.trees, -0.2));
  circle(ctx, x - r * 0.25, y - r * 1.45, r * 0.75, t.trees);
  circle(ctx, x - r * 0.4, y - r * 1.7, r * 0.3, shade(t.trees, 0.3));
  if (t.snow) circle(ctx, x - r * 0.1, y - r * 1.85, r * 0.5, 'rgba(255,255,255,0.92)');
}

function drawLamp(ctx, { x, y }) {
  const glow = ctx.createRadialGradient(x, y - 22, 0, x, y - 22, 26);
  glow.addColorStop(0, 'rgba(255,226,140,0.55)');
  glow.addColorStop(1, 'rgba(255,226,140,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(x - 26, y - 48, 52, 52);
  ctx.beginPath();
  ctx.ellipse(x, y + 1, 9, 3.5, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,226,140,0.3)';
  ctx.fill();
  ctx.fillStyle = '#8b93ad';
  ctx.fillRect(x - 1, y - 22, 2, 22);
  circle(ctx, x, y - 23, 3.2, '#fff6c8');
}

function strokeRoad(ctx, path, { road }) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const stroke = (color, width, dy = 0) => {
    ctx.save();
    ctx.translate(0, dy);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke(path);
    ctx.restore();
  };
  stroke('rgba(0,0,0,0.22)', 50, 8);
  stroke(road.curb, 48, 5);
  stroke(road.sidewalk, 48);
  stroke(road.asphalt, 34);
  ctx.save();
  ctx.setLineDash([9, 11]);
  ctx.globalAlpha = 0.7;
  stroke(road.lane, 2.5);
  ctx.restore();
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
  for (const s of city.specks) {
    if (s.y + s.h < top || s.y > bottom) continue;
    ctx.fillStyle = s.color;
    ctx.fillRect(s.x, s.y, s.w, s.h);
  }
  for (const band of bands) {
    if (band.bottom < top - 60 || band.top > bottom + 60) continue;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, band.top, W, band.bottom - band.top);
    ctx.clip();
    strokeRoad(ctx, city.path, band.theme);
    ctx.restore();
  }
  for (const it of city.items) {
    if (it.box[3] + 40 < top || it.box[1] - 50 > bottom) continue;
    if (it.kind === 'building') drawBuilding(ctx, it);
    else if (it.kind === 'tree') drawTree(ctx, it);
    else drawLamp(ctx, it);
  }
}
