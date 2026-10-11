// Canvas drawing helpers: the beveled "jewel" blocks and gems.
import { COLORS, THEME } from './config.js';

const sprites = new Map();

export const colorHex = (key) => (key === 'gray' ? THEME.gray : COLORS[key].hex);

function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

// t > 0 lightens toward white, t < 0 darkens toward black.
export function shade(hex, t) {
  const target = t > 0 ? 255 : 0;
  const k = Math.abs(t);
  const [r, g, b] = rgb(hex).map((v) => Math.round(v + (target - v) * k));
  return `rgb(${r},${g},${b})`;
}

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function quad(ctx, pts, fill) {
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.closePath();
  ctx.fillStyle = fill;
  ctx.fill();
}

export function drawBlock(ctx, x, y, s, hex, gem = false) {
  const b = Math.max(2, s * 0.14);
  const r = s * 0.1;
  ctx.save();
  roundRect(ctx, x, y, s, s, r);
  ctx.clip();
  // Bevels: light from the top-left.
  quad(ctx, [x, y, x + s, y, x + s - b, y + b, x + b, y + b], shade(hex, 0.42));
  quad(ctx, [x, y, x + b, y + b, x + b, y + s - b, x, y + s], shade(hex, 0.18));
  quad(ctx, [x + s, y, x + s, y + s, x + s - b, y + s - b, x + s - b, y + b], shade(hex, -0.2));
  quad(ctx, [x, y + s, x + b, y + s - b, x + s - b, y + s - b, x + s, y + s], shade(hex, -0.38));
  // Face.
  const face = ctx.createLinearGradient(0, y + b, 0, y + s - b);
  face.addColorStop(0, shade(hex, 0.12));
  face.addColorStop(1, shade(hex, -0.06));
  ctx.fillStyle = face;
  ctx.fillRect(x + b, y + b, s - 2 * b, s - 2 * b);
  // Gloss.
  ctx.fillStyle = 'rgba(255,255,255,0.28)';
  roundRect(ctx, x + b * 1.4, y + b * 1.3, s * 0.26, s * 0.12, s * 0.06);
  ctx.fill();
  ctx.restore();
  if (gem) drawGem(ctx, x + s / 2, y + s / 2 + s * 0.03, s * 0.66, hex);
}

// A cut diamond, centered at (cx, cy).
export function drawGem(ctx, cx, cy, size, hex) {
  const u = size / 2;
  const P = (px, py) => [cx + px * u, cy + py * u];
  const tl = P(-0.55, -0.55);
  const tr = P(0.55, -0.55);
  const r = P(0.95, -0.12);
  const bottom = P(0, 0.92);
  const l = P(-0.95, -0.12);
  const ml = P(-0.3, -0.12);
  const mr = P(0.3, -0.12);
  const top = P(0, -0.55);

  ctx.save();
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(...tl);
  ctx.lineTo(...tr);
  ctx.lineTo(...r);
  ctx.lineTo(...bottom);
  ctx.lineTo(...l);
  ctx.closePath();
  ctx.fillStyle = shade(hex, 0.55);
  ctx.fill();
  ctx.lineWidth = Math.max(1.2, size * 0.07);
  ctx.strokeStyle = shade(hex, -0.55);
  ctx.stroke();

  // Facets.
  quad(ctx, [...l, ...ml, ...bottom], shade(hex, 0.2));
  quad(ctx, [...mr, ...r, ...bottom], shade(hex, -0.1));
  quad(ctx, [...ml, ...mr, ...bottom], shade(hex, 0.38));
  quad(ctx, [...tl, ...top, ...ml, ...l], shade(hex, 0.75));
  quad(ctx, [...top, ...tr, ...r, ...mr], shade(hex, 0.45));

  ctx.lineWidth = Math.max(0.8, size * 0.035);
  ctx.strokeStyle = shade(hex, -0.35);
  ctx.beginPath();
  ctx.moveTo(...l);
  ctx.lineTo(...r);
  ctx.moveTo(...top);
  ctx.lineTo(...ml);
  ctx.lineTo(...bottom);
  ctx.lineTo(...mr);
  ctx.lineTo(...top);
  ctx.stroke();

  // Sparkle.
  ctx.fillStyle = 'rgba(255,255,255,0.95)';
  ctx.beginPath();
  const [sx, sy] = P(-0.42, -0.32);
  ctx.arc(sx, sy, size * 0.06, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

// Blocks are drawn once per color/size and then stamped with drawImage.
export function blockSprite(key, size, dpr, gem = false) {
  const id = `${key}|${size}|${dpr}|${gem ? 1 : 0}`;
  let sprite = sprites.get(id);
  if (!sprite) {
    sprite = document.createElement('canvas');
    const px = Math.max(1, Math.round(size * dpr));
    sprite.width = sprite.height = px;
    const g = sprite.getContext('2d');
    g.scale(px / size, px / size);
    drawBlock(g, 0, 0, size, colorHex(key), gem);
    sprites.set(id, sprite);
  }
  return sprite;
}

export function clearSprites() {
  sprites.clear();
}

const icons = new Map();
export function gemIcon(color, size = 44) {
  if (!icons.has(color)) {
    const cv = document.createElement('canvas');
    cv.width = cv.height = size * 2;
    const g = cv.getContext('2d');
    g.scale(2, 2);
    drawBlock(g, 0, 0, size, colorHex(color), true);
    icons.set(color, cv.toDataURL());
  }
  return icons.get(color);
}
