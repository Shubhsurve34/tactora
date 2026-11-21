/**
 * Tactora board model.
 *
 * The pitch is drawn in metres: 105 long (x, left to right) and 68 wide (y).
 * Home defends the left goal and attacks right; away is mirrored.
 *
 * A board is a sequence of steps (frames). Players keep their identity
 * (team, number, name) across steps; only positions change, so a move can
 * be played back as an animation.
 */

export const PITCH_W = 105;
export const PITCH_H = 68;
export const HALF = PITCH_W / 2;
export const MAX_STEPS = 12;

export type Team = "home" | "away";
export type XY = [number, number];
export type DrawKind = "run" | "pass";
export type ZoneKind = "press" | "space";
export type Tool = "move" | "run" | "pass" | "press" | "space" | "mark" | "erase";

export type Player = { id: string; team: Team; num: number; name: string };
export type Frame = { pos: Record<string, XY>; ball: XY };
export type Drawing = { id: string; kind: DrawKind; step: number; x1: number; y1: number; x2: number; y2: number };
export type Zone = { id: string; kind: ZoneKind; x: number; y: number; w: number; h: number };
export type Mark = { id: string; from: string; to: string };

export type Overlays = {
  control: boolean;
  shape: boolean;
  offside: boolean;
  shadows: boolean;
  lanes: boolean;
};

export const OVERLAY_KEYS: (keyof Overlays)[] = ["control", "shape", "offside", "shadows", "lanes"];

export type TeamInfo = { name: string; color: string; formation: string };

export type Board = {
  title: string;
  home: TeamInfo;
  away: TeamInfo & { shown: boolean };
  players: Player[];
  frames: Frame[];
  drawings: Drawing[];
  zones: Zone[];
  marks: Mark[];
  overlays: Overlays;
};

/** [depth, width] pairs, goalkeeper first. depth 0 = own goal line. width 0 = the team's right flank. */
export const FORMATIONS: Record<string, [number, number][]> = {
  "4-3-3": [
    [0.02, 0.5],
    [0.28, 0.12], [0.24, 0.37], [0.24, 0.63], [0.28, 0.88],
    [0.55, 0.28], [0.5, 0.5], [0.55, 0.72],
    [0.86, 0.15], [0.9, 0.5], [0.86, 0.85],
  ],
  "4-4-2": [
    [0.02, 0.5],
    [0.27, 0.12], [0.24, 0.37], [0.24, 0.63], [0.27, 0.88],
    [0.57, 0.12], [0.54, 0.37], [0.54, 0.63], [0.57, 0.88],
    [0.88, 0.38], [0.88, 0.62],
  ],
  "4-2-3-1": [
    [0.02, 0.5],
    [0.27, 0.12], [0.24, 0.37], [0.24, 0.63], [0.27, 0.88],
    [0.47, 0.37], [0.47, 0.63],
    [0.7, 0.15], [0.7, 0.5], [0.7, 0.85],
    [0.92, 0.5],
  ],
  "3-5-2": [
    [0.02, 0.5],
    [0.24, 0.25], [0.22, 0.5], [0.24, 0.75],
    [0.55, 0.08], [0.5, 0.32], [0.46, 0.5], [0.5, 0.68], [0.55, 0.92],
    [0.88, 0.38], [0.88, 0.62],
  ],
  "3-4-3": [
    [0.02, 0.5],
    [0.24, 0.25], [0.22, 0.5], [0.24, 0.75],
    [0.55, 0.1], [0.52, 0.37], [0.52, 0.63], [0.55, 0.9],
    [0.86, 0.15], [0.9, 0.5], [0.86, 0.85],
  ],
  "5-3-2": [
    [0.02, 0.5],
    [0.33, 0.06], [0.24, 0.28], [0.22, 0.5], [0.24, 0.72], [0.33, 0.94],
    [0.55, 0.28], [0.52, 0.5], [0.55, 0.72],
    [0.88, 0.38], [0.88, 0.62],
  ],
};

export const FORMATION_NAMES = Object.keys(FORMATIONS);

const SHIRTS: Record<string, number[]> = {
  "4-3-3": [1, 2, 5, 4, 3, 8, 6, 10, 7, 9, 11],
  "4-4-2": [1, 2, 5, 4, 3, 7, 8, 6, 11, 9, 10],
  "4-2-3-1": [1, 2, 5, 4, 3, 6, 8, 7, 10, 11, 9],
  "3-5-2": [1, 5, 4, 6, 2, 8, 10, 7, 3, 9, 11],
  "3-4-3": [1, 5, 4, 6, 2, 8, 10, 3, 7, 9, 11],
  "5-3-2": [1, 2, 5, 4, 6, 3, 8, 10, 7, 9, 11],
};

export const HOME_COLOR = "#d8432b";
export const AWAY_COLOR = "#2443c9";
export const TEAM_COLORS = ["#d8432b", "#2443c9", "#16201b", "#f2f4ef", "#e0a400", "#7b2fbf", "#0f8a5f", "#e0569b"];

export const DEFAULT_OVERLAYS: Overlays = { control: false, shape: false, offside: false, shadows: false, lanes: false };

const round = (n: number) => Math.round(n * 10) / 10;
export const clampX = (x: number) => Math.min(PITCH_W + 2, Math.max(-2, x));
export const clampY = (y: number) => Math.min(PITCH_H + 2, Math.max(-2, y));

/** Slot 0 of each team is the goalkeeper. */
export const isKeeper = (id: string) => id.length === 2 && id[1] === "0";

/** Where a formation slot sits on the pitch for a team. */
export function slotPosition(team: Team, depth: number, width: number): XY {
  const along = 3 + depth * 43;
  const x = team === "home" ? along : PITCH_W - along;
  // Home attacks left-to-right, so its right flank is the bottom touchline; away is mirrored.
  const across = 4 + width * (PITCH_H - 8);
  const y = team === "home" ? PITCH_H - across : across;
  return [round(x), round(y)];
}

export function teamInFormation(team: Team, formation: string): { players: Player[]; pos: Record<string, XY> } {
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const shirts = SHIRTS[formation] ?? SHIRTS["4-3-3"];
  const players: Player[] = [];
  const pos: Record<string, XY> = {};
  slots.forEach(([depth, width], i) => {
    const id = `${team[0]}${i}`;
    players.push({ id, team, num: shirts[i] ?? i + 1, name: "" });
    pos[id] = slotPosition(team, depth, width);
  });
  return { players, pos };
}

export function defaultBoard(): Board {
  const home = teamInFormation("home", "4-3-3");
  const away = teamInFormation("away", "4-4-2");
  return {
    title: "",
    home: { name: "Home", color: HOME_COLOR, formation: "4-3-3" },
    away: { name: "Away", color: AWAY_COLOR, formation: "4-4-2", shown: true },
    players: [...home.players, ...away.players],
    frames: [{ pos: { ...home.pos, ...away.pos }, ball: [HALF, PITCH_H / 2] }],
    drawings: [],
    zones: [],
    marks: [],
    overlays: { ...DEFAULT_OVERLAYS },
  };
}

/** Move a team into a formation in one step, keeping names and numbers. */
export function applyFormation(board: Board, team: Team, formation: string, step: number): Board {
  const { pos } = teamInFormation(team, formation);
  const frames = board.frames.map((f, i) => (i === step ? { ...f, pos: { ...f.pos, ...pos } } : f));
  return { ...board, [team]: { ...board[team], formation }, frames };
}

export function addStep(board: Board, after: number): Board {
  if (board.frames.length >= MAX_STEPS) return board;
  const src = board.frames[after];
  const copy: Frame = { pos: { ...src.pos }, ball: [...src.ball] as XY };
  const frames = [...board.frames.slice(0, after + 1), copy, ...board.frames.slice(after + 1)];
  const drawings = board.drawings.map((d) => (d.step > after ? { ...d, step: d.step + 1 } : d));
  return { ...board, frames, drawings };
}

export function removeStep(board: Board, index: number): Board {
  if (board.frames.length <= 1) return board;
  const frames = board.frames.filter((_, i) => i !== index);
  const drawings = board.drawings
    .filter((d) => d.step !== index)
    .map((d) => (d.step > index ? { ...d, step: d.step - 1 } : d));
  return { ...board, frames, drawings };
}

export function movePlayer(board: Board, step: number, id: string, at: XY): Board {
  const frames = board.frames.map((f, i) => (i === step ? { ...f, pos: { ...f.pos, [id]: at } } : f));
  return { ...board, frames };
}

export function moveBall(board: Board, step: number, at: XY): Board {
  const frames = board.frames.map((f, i) => (i === step ? { ...f, ball: at } : f));
  return { ...board, frames };
}

const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/**
 * Positions at timeline position t (0 = first step, frames.length - 1 = last),
 * eased between steps.
 */
export function frameAt(board: Board, t: number): Frame {
  const last = board.frames.length - 1;
  const clamped = Math.max(0, Math.min(last, t));
  const i = Math.min(last, Math.floor(clamped));
  const a = board.frames[i];
  if (i === last || clamped === i) return a;
  const b = board.frames[i + 1];
  const k = ease(clamped - i);
  const mix = (p: XY, q: XY): XY => [p[0] + (q[0] - p[0]) * k, p[1] + (q[1] - p[1]) * k];
  const pos: Record<string, XY> = {};
  for (const id of Object.keys(a.pos)) pos[id] = b.pos[id] ? mix(a.pos[id], b.pos[id]) : a.pos[id];
  return { pos, ball: mix(a.ball, b.ball) };
}

/* --------------------------------------------------------------------------
   Share links: the whole board lives in the URL hash, so nothing is stored
   on a server. Compact arrays keep links short; deflate shrinks them more
   where the browser supports CompressionStream.

   v2: [2, title, home, away, players, frames, drawings, zones, marks, overlayBits]
   v1 (first release): one frame, positions stored per player.
   -------------------------------------------------------------------------- */

export function pack(board: Board): unknown[] {
  const ids = board.players.map((p) => p.id);
  const idx = new Map(ids.map((id, i) => [id, i]));
  return [
    2,
    board.title,
    [board.home.name, board.home.color, board.home.formation],
    [board.away.name, board.away.color, board.away.formation, board.away.shown ? 1 : 0],
    board.players.map((p) => [p.team === "home" ? 0 : 1, p.num, p.name]),
    board.frames.map((f) => [round(f.ball[0]), round(f.ball[1]), ...ids.flatMap((id) => (f.pos[id] ?? [0, 0]).map(round))]),
    board.drawings.map((d) => [d.kind === "run" ? 0 : 1, d.step, round(d.x1), round(d.y1), round(d.x2), round(d.y2)]),
    board.zones.map((z) => [z.kind === "press" ? 0 : 1, round(z.x), round(z.y), round(z.w), round(z.h)]),
    board.marks.map((m) => [idx.get(m.from) ?? -1, idx.get(m.to) ?? -1]).filter(([a, b]) => a >= 0 && b >= 0),
    OVERLAY_KEYS.reduce((bits, key, i) => (board.overlays[key] ? bits | (1 << i) : bits), 0),
  ];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max: number, fallback = "") => (typeof v === "string" ? v.slice(0, max) : fallback);
const color = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
const formation = (v: unknown, fallback: string) => (typeof v === "string" && v in FORMATIONS ? v : fallback);
const shirt = (v: unknown, fallback: number) => (isNum(v) ? Math.max(0, Math.min(99, Math.round(v))) : fallback);
const point = (x: unknown, y: unknown): XY => [clampX(isNum(x) ? x : HALF), clampY(isNum(y) ? y : PITCH_H / 2)];

function teamInfo(raw: unknown, fallbackName: string, fallbackColor: string, fallbackFormation: string): TeamInfo {
  const a = Array.isArray(raw) ? raw : [];
  return {
    name: str(a[0], 24, fallbackName),
    color: color(a[1], fallbackColor),
    formation: formation(a[2], fallbackFormation),
  };
}

/** Rebuild a board from untrusted data. Returns null if it isn't a board. */
export function unpack(data: unknown): Board | null {
  if (!Array.isArray(data)) return null;
  if (data[0] === 1) return unpackV1(data);
  if (data[0] !== 2) return null;

  const [, title, home, away, players, frames, drawings, zones, marks, bits] = data as unknown[];
  if (!Array.isArray(players) || !Array.isArray(frames) || frames.length === 0) return null;

  const counts = { home: 0, away: 0 };
  const outPlayers: Player[] = [];
  for (const p of players.slice(0, 40)) {
    if (!Array.isArray(p)) return null;
    const team: Team = p[0] === 1 ? "away" : "home";
    const i = counts[team]++;
    outPlayers.push({ id: `${team[0]}${i}`, team, num: shirt(p[1], i + 1), name: str(p[2], 24) });
  }

  const outFrames: Frame[] = [];
  for (const f of frames.slice(0, MAX_STEPS)) {
    if (!Array.isArray(f)) return null;
    const pos: Record<string, XY> = {};
    outPlayers.forEach((p, i) => {
      pos[p.id] = point(f[2 + i * 2], f[3 + i * 2]);
    });
    outFrames.push({ pos, ball: point(f[0], f[1]) });
  }

  const steps = outFrames.length;
  const outDrawings: Drawing[] = [];
  if (Array.isArray(drawings)) {
    drawings.slice(0, 300).forEach((d, i) => {
      if (!Array.isArray(d) || ![d[2], d[3], d[4], d[5]].every(isNum)) return;
      const step = isNum(d[1]) ? Math.max(0, Math.min(steps - 1, Math.round(d[1]))) : 0;
      outDrawings.push({
        id: `d${i}`,
        kind: d[0] === 0 ? "run" : "pass",
        step,
        x1: clampX(d[2] as number),
        y1: clampY(d[3] as number),
        x2: clampX(d[4] as number),
        y2: clampY(d[5] as number),
      });
    });
  }

  const outZones: Zone[] = [];
  if (Array.isArray(zones)) {
    zones.slice(0, 40).forEach((z, i) => {
      if (!Array.isArray(z) || ![z[1], z[2], z[3], z[4]].every(isNum)) return;
      const [x, y] = point(z[1], z[2]);
      outZones.push({
        id: `z${i}`,
        kind: z[0] === 0 ? "press" : "space",
        x,
        y,
        w: Math.max(1, Math.min(PITCH_W, z[3] as number)),
        h: Math.max(1, Math.min(PITCH_H, z[4] as number)),
      });
    });
  }

  const outMarks: Mark[] = [];
  if (Array.isArray(marks)) {
    marks.slice(0, 40).forEach((m, i) => {
      if (!Array.isArray(m) || !isNum(m[0]) || !isNum(m[1])) return;
      const a = outPlayers[m[0]];
      const b = outPlayers[m[1]];
      if (a && b && a.id !== b.id) outMarks.push({ id: `m${i}`, from: a.id, to: b.id });
    });
  }

  const flags = isNum(bits) ? bits : 0;
  const overlays = { ...DEFAULT_OVERLAYS };
  OVERLAY_KEYS.forEach((key, i) => {
    overlays[key] = Boolean(flags & (1 << i));
  });

  const awayRaw = Array.isArray(away) ? away : [];
  return {
    title: str(title, 60),
    home: teamInfo(home, "Home", HOME_COLOR, "4-3-3"),
    away: { ...teamInfo(away, "Away", AWAY_COLOR, "4-4-2"), shown: awayRaw[3] !== 0 },
    players: outPlayers,
    frames: outFrames,
    drawings: outDrawings,
    zones: outZones,
    marks: outMarks,
    overlays,
  };
}

function unpackV1(data: unknown[]): Board | null {
  const [, title, home, away, players, ball, drawings] = data;
  if (!Array.isArray(players)) return null;
  const counts = { home: 0, away: 0 };
  const outPlayers: Player[] = [];
  const pos: Record<string, XY> = {};
  for (const p of players.slice(0, 40)) {
    if (!Array.isArray(p) || !isNum(p[1]) || !isNum(p[2])) continue;
    const team: Team = p[0] === 1 ? "away" : "home";
    const i = counts[team]++;
    const id = `${team[0]}${i}`;
    outPlayers.push({ id, team, num: shirt(p[3], i + 1), name: str(p[4], 24) });
    pos[id] = point(p[1], p[2]);
  }
  const outDrawings: Drawing[] = [];
  if (Array.isArray(drawings)) {
    drawings.slice(0, 200).forEach((d, i) => {
      if (!Array.isArray(d) || ![d[1], d[2], d[3], d[4]].every(isNum)) return;
      outDrawings.push({
        id: `d${i}`,
        kind: d[0] === 0 ? "run" : "pass",
        step: 0,
        x1: clampX(d[1] as number),
        y1: clampY(d[2] as number),
        x2: clampX(d[3] as number),
        y2: clampY(d[4] as number),
      });
    });
  }
  const b = Array.isArray(ball) ? ball : [];
  const awayRaw = Array.isArray(away) ? away : [];
  return {
    title: str(title, 60),
    home: teamInfo(home, "Home", HOME_COLOR, "4-3-3"),
    away: { ...teamInfo(away, "Away", AWAY_COLOR, "4-4-2"), shown: awayRaw[3] !== 0 },
    players: outPlayers,
    frames: [{ pos, ball: point(b[0], b[1]) }],
    drawings: outDrawings,
    zones: [],
    marks: [],
    overlays: { ...DEFAULT_OVERLAYS },
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(text: string): Uint8Array {
  const b64 = text.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "===".slice((b64.length + 3) % 4));
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream) {
  const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
  return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Board → "z…" (deflated) or "j…" (plain) for the URL hash. */
export async function encodeBoard(board: Board): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(pack(board)));
  if (typeof CompressionStream !== "undefined") {
    try {
      return "z" + toBase64Url(await pipe(json, new CompressionStream("deflate-raw")));
    } catch {
      // fall through to plain
    }
  }
  return "j" + toBase64Url(json);
}

export async function decodeBoard(code: string): Promise<Board | null> {
  try {
    let bytes = fromBase64Url(code.slice(1));
    if (code[0] === "z") {
      if (typeof DecompressionStream === "undefined") return null;
      bytes = await pipe(bytes, new DecompressionStream("deflate-raw"));
    } else if (code[0] !== "j") {
      return null;
    }
    if (bytes.length > 400_000) return null;
    return unpack(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
