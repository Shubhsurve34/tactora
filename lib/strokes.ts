/**
 * Telestrator strokes. Runs and passes are drawn as gentle curves, the way
 * an analyst draws on a broadcast screen: runs as a solid stroke that
 * swells towards a sharp head, passes as the ball's dotted path.
 */

import { PITCH_H, PITCH_W } from "./board";

type P = { x: number; y: number };

/**
 * Control point for a quadratic curve from a to b. The curve bows towards
 * the middle of the pitch, which is how most runs and passes bend.
 */
export function controlPoint(a: P, b: P, bend = 0.12): P {
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  let nx = -dy / len;
  let ny = dx / len;
  // Bow towards the centre of the pitch.
  const cx = PITCH_W / 2 - mx;
  const cy = PITCH_H / 2 - my;
  if (nx * cx + ny * cy < 0) {
    nx = -nx;
    ny = -ny;
  }
  const k = Math.min(len * bend, 6);
  return { x: mx + nx * k, y: my + ny * k };
}

const quad = (a: P, c: P, b: P, t: number): P => {
  const u = 1 - t;
  return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
};

const tangent = (a: P, c: P, b: P, t: number): P => {
  const x = 2 * (1 - t) * (c.x - a.x) + 2 * t * (b.x - c.x);
  const y = 2 * (1 - t) * (c.y - a.y) + 2 * t * (b.y - c.y);
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};

/** Points along the curve at even arc-length spacing, up to `stopAt` metres from the end. */
function sampleCurve(a: P, c: P, b: P, n = 48) {
  const pts: { p: P; t: number; s: number }[] = [];
  let s = 0;
  let prev = a;
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const p = quad(a, c, b, t);
    s += Math.hypot(p.x - prev.x, p.y - prev.y);
    pts.push({ p, t, s });
    prev = p;
  }
  return { pts, length: s };
}

const f = (n: number) => n.toFixed(2);

export type Stroke = { body: string; head: string; dots: P[]; length: number };

const HEAD_LEN = 2.1;
const HEAD_HALF = 1.05;

function arrowHead(tip: P, dir: P): string {
  const base = { x: tip.x - dir.x * HEAD_LEN, y: tip.y - dir.y * HEAD_LEN };
  const nx = -dir.y;
  const ny = dir.x;
  const notch = { x: tip.x - dir.x * HEAD_LEN * 0.72, y: tip.y - dir.y * HEAD_LEN * 0.72 };
  return `M${f(tip.x)} ${f(tip.y)} L${f(base.x + nx * HEAD_HALF)} ${f(base.y + ny * HEAD_HALF)} L${f(notch.x)} ${f(notch.y)} L${f(base.x - nx * HEAD_HALF)} ${f(base.y - ny * HEAD_HALF)} Z`;
}

/** A run: tapered body, thin at the start and widest just before the head. */
export function runStroke(a: P, b: P): Stroke {
  const c = controlPoint(a, b);
  const { pts, length } = sampleCurve(a, c, b);
  const stop = Math.max(0, length - HEAD_LEN * 0.75);
  const body = pts.filter((q) => q.s <= stop);
  const left: P[] = [];
  const right: P[] = [];
  for (const q of body) {
    const k = stop > 0 ? q.s / stop : 0;
    const w = 0.08 + 0.34 * Math.pow(k, 0.8);
    const d = tangent(a, c, b, q.t);
    left.push({ x: q.p.x - d.y * w, y: q.p.y + d.x * w });
    right.push({ x: q.p.x + d.y * w, y: q.p.y - d.x * w });
  }
  const ring = [...left, ...right.reverse()];
  const bodyPath = ring.length > 2 ? `M${ring.map((p) => `${f(p.x)} ${f(p.y)}`).join(" L")} Z` : "";
  return { body: bodyPath, head: arrowHead(b, tangent(a, c, b, 1)), dots: [], length };
}

/** A pass: the ball's path as evenly spaced dots, then a head. */
export function passStroke(a: P, b: P): Stroke {
  const c = controlPoint(a, b, 0.08);
  const { pts, length } = sampleCurve(a, c, b, 64);
  const stop = Math.max(0, length - HEAD_LEN * 1.05);
  const gap = 1.15;
  const dots: P[] = [];
  let next = 0.4;
  for (const q of pts) {
    if (q.s > stop) break;
    if (q.s >= next) {
      dots.push(q.p);
      next += gap;
    }
  }
  return { body: "", head: arrowHead(b, tangent(a, c, b, 1)), dots, length };
}

/** A gently curved path for marking links and similar ties. */
export function curvePath(a: P, b: P, bend = 0.1): string {
  const c = controlPoint(a, b, bend);
  return `M${f(a.x)} ${f(a.y)} Q${f(c.x)} ${f(c.y)} ${f(b.x)} ${f(b.y)}`;
}

/** Tapered comet from where a player was to where they are now. */
export function cometPath(a: P, b: P, width = 1.5): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const w = width / 2;
  return `M${f(a.x)} ${f(a.y)} L${f(b.x + nx * w)} ${f(b.y + ny * w)} A${f(w)} ${f(w)} 0 0 1 ${f(b.x - nx * w)} ${f(b.y - ny * w)} Z`;
}

/* Kit colours ------------------------------------------------------------- */

function mix(hex: string, to: number, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (to - v) * amount));
  return `#${ch.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

export const lighten = (hex: string, amount: number) => mix(hex, 255, amount);
export const darken = (hex: string, amount: number) => mix(hex, 0, amount);

/** Ink or white text, whichever reads better on a shirt colour. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#16201b" : "#ffffff";
}
