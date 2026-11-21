/**
 * Tactical analysis on a single frame. Everything is in metres on the
 * 105 × 68 pitch, so the numbers shown to the user are real distances.
 */

import { Delaunay } from "d3-delaunay";
import { HALF, PITCH_H, PITCH_W, type Team, type XY, isKeeper } from "./board";

export type Dot = { id: string; team: Team; x: number; y: number };

const dist = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);

/** Distance from a team's own goal line (home defends x = 0, away x = 105). */
export const depthOf = (team: Team, x: number) => (team === "home" ? x : PITCH_W - x);

function polygonArea(points: XY[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i];
    const [x2, y2] = points[(i + 1) % points.length];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/* Space control ------------------------------------------------------------ */

export type ControlCell = { id: string; team: Team; points: XY[] };
export type Control = { cells: ControlCell[]; share: Record<Team, number>; finalThird: Record<Team, number> };

/**
 * Who reaches each patch of grass first, as a Voronoi map clipped to the
 * pitch. Share is the percentage of the pitch each team controls;
 * finalThird is the share of the attacking third each team owns.
 */
export function spaceControl(dots: Dot[]): Control | null {
  const both = new Set(dots.map((d) => d.team));
  if (dots.length < 3 || both.size < 2) return null;

  const voronoi = Delaunay.from(dots, (d) => d.x, (d) => d.y).voronoi([0, 0, PITCH_W, PITCH_H]);
  const cells: ControlCell[] = [];
  const area = { home: 0, away: 0 };
  const third = { home: 0, away: 0 };
  const thirdW = PITCH_W / 3;

  dots.forEach((d, i) => {
    const poly = voronoi.cellPolygon(i);
    if (!poly) return;
    const points = poly.slice(0, -1).map(([x, y]) => [x, y] as XY);
    cells.push({ id: d.id, team: d.team, points });
    area[d.team] += polygonArea(points);
    // Area of this cell inside the third the team attacks.
    const clipped = clipX(points, d.team === "home" ? PITCH_W - thirdW : 0, d.team === "home" ? PITCH_W : thirdW);
    if (clipped.length >= 3) third[d.team] += polygonArea(clipped);
  });

  const total = PITCH_W * PITCH_H;
  const thirdArea = thirdW * PITCH_H;
  return {
    cells,
    share: { home: (area.home / total) * 100, away: (area.away / total) * 100 },
    finalThird: { home: (third.home / thirdArea) * 100, away: (third.away / thirdArea) * 100 },
  };
}

/** Clip a convex polygon to minX ≤ x ≤ maxX (Sutherland–Hodgman on two edges). */
function clipX(points: XY[], minX: number, maxX: number): XY[] {
  const clipEdge = (pts: XY[], inside: (p: XY) => boolean, edgeX: number): XY[] => {
    const out: XY[] = [];
    for (let i = 0; i < pts.length; i++) {
      const cur = pts[i];
      const prev = pts[(i + pts.length - 1) % pts.length];
      const curIn = inside(cur);
      const prevIn = inside(prev);
      if (curIn !== prevIn) {
        const t = (edgeX - prev[0]) / (cur[0] - prev[0]);
        out.push([edgeX, prev[1] + t * (cur[1] - prev[1])]);
      }
      if (curIn) out.push(cur);
    }
    return out;
  };
  const left = clipEdge(points, (p) => p[0] >= minX, minX);
  return clipEdge(left, (p) => p[0] <= maxX, maxX);
}

/* Team shape --------------------------------------------------------------- */

export function convexHull(points: XY[]): XY[] {
  if (points.length < 3) return points.slice();
  const pts = points.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: XY, a: XY, b: XY) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: XY[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: XY[] = [];
  for (const p of pts.reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

export type Line = { depth: number; x: number; minY: number; maxY: number; ids: string[] };

export type Shape = {
  team: Team;
  hull: XY[];
  /** m² covered by the outfield players. */
  compactness: number;
  /** Touchline-to-touchline spread of the outfield, in metres. */
  width: number;
  /** Deepest to highest outfield player, in metres. */
  length: number;
  /** How far the last outfield player stands from his own goal. */
  defLine: number;
  /** Defence, midfield and attack lines, deepest first. */
  lines: Line[];
  /** Gaps between consecutive lines, in metres. */
  gaps: number[];
};

/**
 * Splits outfield players into lines at the biggest gaps in depth, the way
 * an analyst reads a block: back line, midfield line, front line.
 */
export function teamShape(team: Team, dots: Dot[]): Shape | null {
  const outfield = dots.filter((d) => d.team === team && !isKeeper(d.id));
  if (outfield.length < 3) return null;

  const xs = outfield.map((d) => d.x);
  const ys = outfield.map((d) => d.y);
  const hull = convexHull(outfield.map((d) => [d.x, d.y] as XY));

  const sorted = outfield
    .map((d) => ({ d, depth: depthOf(team, d.x) }))
    .sort((a, b) => a.depth - b.depth);

  const lineCount = Math.min(3, sorted.length);
  const gapsIdx = sorted
    .slice(1)
    .map((s, i) => ({ i: i + 1, gap: s.depth - sorted[i].depth }))
    .sort((a, b) => b.gap - a.gap)
    .slice(0, lineCount - 1)
    .map((g) => g.i)
    .sort((a, b) => a - b);

  const groups: (typeof sorted)[] = [];
  let start = 0;
  for (const cut of [...gapsIdx, sorted.length]) {
    groups.push(sorted.slice(start, cut));
    start = cut;
  }

  const lines: Line[] = groups.map((g) => {
    const depth = g.reduce((s, p) => s + p.depth, 0) / g.length;
    return {
      depth,
      x: team === "home" ? depth : PITCH_W - depth,
      minY: Math.min(...g.map((p) => p.d.y)),
      maxY: Math.max(...g.map((p) => p.d.y)),
      ids: g.map((p) => p.d.id),
    };
  });

  return {
    team,
    hull,
    compactness: polygonArea(hull),
    width: Math.max(...ys) - Math.min(...ys),
    length: Math.max(...xs) - Math.min(...xs),
    defLine: sorted[0].depth,
    lines,
    gaps: lines.slice(1).map((l, i) => l.depth - lines[i].depth),
  };
}

/* Offside ------------------------------------------------------------------ */

export type Offside = { attacking: Team; x: number; offside: string[] };

/**
 * The line an attacking team must stay behind: the deeper of the
 * second-last defender and the ball, never inside the attackers' own half.
 */
export function offsideLine(attacking: Team, dots: Dot[], ball: XY): Offside | null {
  const defending: Team = attacking === "home" ? "away" : "home";
  const defenders = dots.filter((d) => d.team === defending);
  if (defenders.length < 2) return null;

  // Depth measured from the defending team's goal: smaller = closer to goal.
  const depths = defenders.map((d) => depthOf(defending, d.x)).sort((a, b) => a - b);
  const secondLast = depths[1];
  const ballDepth = depthOf(defending, ball[0]);
  const lineDepth = Math.min(secondLast, ballDepth, HALF);
  const x = defending === "home" ? lineDepth : PITCH_W - lineDepth;

  const offside = dots
    .filter((d) => d.team === attacking && depthOf(defending, d.x) < lineDepth - 0.05)
    .map((d) => d.id);

  return { attacking, x, offside };
}

/* Possession, cover shadows and passing lanes ------------------------------ */

export type Possession = { team: Team; carrier: string | null };

/** The team nearest the ball has it; the nearest player carries it if close enough. */
export function possession(dots: Dot[], ball: XY): Possession | null {
  if (dots.length === 0) return null;
  const b = { x: ball[0], y: ball[1] };
  let best = dots[0];
  for (const d of dots) if (dist(d, b) < dist(best, b)) best = d;
  return { team: best.team, carrier: dist(best, b) <= 3.5 ? best.id : null };
}

const SHADOW_RADIUS = 1.4;
const SHADOW_LENGTH = 16;

/**
 * The cone behind each defender, seen from the ball, that a pass can't get
 * through. Returned as quads ready to draw.
 */
export function coverShadows(defenders: Dot[], ball: XY): { id: string; points: XY[] }[] {
  const out: { id: string; points: XY[] }[] = [];
  for (const d of defenders) {
    const dx = d.x - ball[0];
    const dy = d.y - ball[1];
    const len = Math.hypot(dx, dy);
    if (len < 2 || len > 40) continue;
    const ux = dx / len;
    const uy = dy / len;
    const px = -uy;
    const py = ux;
    const r = SHADOW_RADIUS;
    const rFar = (r * (len + SHADOW_LENGTH)) / len;
    out.push({
      id: d.id,
      points: [
        [d.x + px * r, d.y + py * r],
        [d.x + ux * SHADOW_LENGTH + px * rFar, d.y + uy * SHADOW_LENGTH + py * rFar],
        [d.x + ux * SHADOW_LENGTH - px * rFar, d.y + uy * SHADOW_LENGTH - py * rFar],
        [d.x - px * r, d.y - py * r],
      ],
    });
  }
  return out;
}

function segmentDistance(p: Dot, a: Dot, b: Dot): { d: number; t: number } {
  const abx = b.x - a.x;
  const aby = b.y - a.y;
  const len2 = abx * abx + aby * aby || 1;
  const t = Math.max(0, Math.min(1, ((p.x - a.x) * abx + (p.y - a.y) * aby) / len2));
  return { d: Math.hypot(a.x + abx * t - p.x, a.y + aby * t - p.y), t };
}

export type Lane = { to: string; open: boolean; length: number; x1: number; y1: number; x2: number; y2: number };

const LANE_BLOCK = 1.8;

/**
 * Every pass the ball carrier could play, marked open or blocked. A lane is
 * blocked when an opponent stands within reach of the ball's path.
 */
export function passingLanes(dots: Dot[], carrierId: string): Lane[] {
  const carrier = dots.find((d) => d.id === carrierId);
  if (!carrier) return [];
  const mates = dots.filter((d) => d.team === carrier.team && d.id !== carrier.id);
  const opponents = dots.filter((d) => d.team !== carrier.team);
  return mates.map((m) => {
    const blocked = opponents.some((o) => {
      const { d, t } = segmentDistance(o, carrier, m);
      return t > 0.04 && t < 0.98 && d < LANE_BLOCK;
    });
    return { to: m.id, open: !blocked, length: dist(carrier, m), x1: carrier.x, y1: carrier.y, x2: m.x, y2: m.y };
  });
}
