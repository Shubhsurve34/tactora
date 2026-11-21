/**
 * Tactora board model.
 *
 * The pitch is drawn in metres: 105 long (x, left to right) and 68 wide (y).
 * Home defends the left goal, away defends the right goal.
 */

export const PITCH_W = 105;
export const PITCH_H = 68;

export type Team = "home" | "away";
export type Tool = "move" | "run" | "pass" | "erase";
export type DrawKind = "run" | "pass";

export type Player = {
  id: string;
  team: Team;
  x: number;
  y: number;
  num: number;
  name: string;
};

export type Drawing = {
  id: string;
  kind: DrawKind;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
};

export type Board = {
  title: string;
  home: { name: string; color: string; formation: string };
  away: { name: string; color: string; formation: string; shown: boolean };
  players: Player[];
  ball: { x: number; y: number };
  drawings: Drawing[];
};

/** [depth, width] pairs, goalkeeper first. depth 0 = own goal line, 1 = halfway-ish. */
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

const round = (n: number) => Math.round(n * 10) / 10;

/** Where a formation slot sits on the pitch for a team. */
export function slotPosition(team: Team, depth: number, width: number) {
  const along = 3 + depth * 43; // stays in own half
  const x = team === "home" ? along : PITCH_W - along;
  // width 0 = the team's right flank. Home attacks left-to-right, so its
  // right flank is the bottom touchline; away is mirrored.
  const across = 4 + width * (PITCH_H - 8);
  const y = team === "home" ? PITCH_H - across : across;
  return { x: round(x), y: round(y) };
}

export function teamInFormation(team: Team, formation: string): Player[] {
  const slots = FORMATIONS[formation] ?? FORMATIONS["4-3-3"];
  const shirts = SHIRTS[formation] ?? SHIRTS["4-3-3"];
  return slots.map(([depth, width], i) => ({
    id: `${team[0]}${i}`,
    team,
    ...slotPosition(team, depth, width),
    num: shirts[i] ?? i + 1,
    name: "",
  }));
}

/** Move an existing team into a formation, keeping names and numbers. */
export function applyFormation(board: Board, team: Team, formation: string): Board {
  const fresh = teamInFormation(team, formation);
  const old = board.players.filter((p) => p.team === team);
  const players = fresh.map((p, i) =>
    old[i] ? { ...p, name: old[i].name, num: old[i].num } : p,
  );
  return {
    ...board,
    [team]: { ...board[team], formation },
    players: [...board.players.filter((p) => p.team !== team), ...players],
  };
}

export function defaultBoard(): Board {
  return {
    title: "",
    home: { name: "Home", color: HOME_COLOR, formation: "4-3-3" },
    away: { name: "Away", color: AWAY_COLOR, formation: "4-4-2", shown: true },
    players: [...teamInFormation("home", "4-3-3"), ...teamInFormation("away", "4-4-2")],
    ball: { x: PITCH_W / 2, y: PITCH_H / 2 },
    drawings: [],
  };
}

export const clampX = (x: number) => Math.min(PITCH_W + 2, Math.max(-2, x));
export const clampY = (y: number) => Math.min(PITCH_H + 2, Math.max(-2, y));

/* --------------------------------------------------------------------------
   Share links: the whole board lives in the URL hash, so nothing is stored
   on a server. Compact arrays keep links short; deflate shrinks them more
   where the browser supports CompressionStream.
   -------------------------------------------------------------------------- */

type Packed = [
  1, // version
  string, // title
  [string, string, string], // home: name, color, formation
  [string, string, string, 0 | 1], // away: name, color, formation, shown
  [number, number, number, number, string][], // players: team(0/1), x, y, num, name
  [number, number], // ball
  [number, number, number, number, number][], // drawings: kind(0 run, 1 pass), x1, y1, x2, y2
];

export function pack(board: Board): Packed {
  return [
    1,
    board.title,
    [board.home.name, board.home.color, board.home.formation],
    [board.away.name, board.away.color, board.away.formation, board.away.shown ? 1 : 0],
    board.players.map((p) => [p.team === "home" ? 0 : 1, round(p.x), round(p.y), p.num, p.name]),
    [round(board.ball.x), round(board.ball.y)],
    board.drawings.map((d) => [d.kind === "run" ? 0 : 1, round(d.x1), round(d.y1), round(d.x2), round(d.y2)]),
  ];
}

const isNum = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
const str = (v: unknown, max: number, fallback = "") =>
  typeof v === "string" ? v.slice(0, max) : fallback;
const color = (v: unknown, fallback: string) =>
  typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v) ? v : fallback;
const formation = (v: unknown, fallback: string) =>
  typeof v === "string" && v in FORMATIONS ? v : fallback;

/** Rebuild a board from untrusted data. Returns null if it isn't a board. */
export function unpack(data: unknown): Board | null {
  if (!Array.isArray(data) || data[0] !== 1) return null;
  const [, title, home, away, players, ball, drawings] = data as unknown[];
  if (!Array.isArray(home) || !Array.isArray(away) || !Array.isArray(players)) return null;

  const counts = { home: 0, away: 0 };
  const outPlayers: Player[] = [];
  for (const p of players.slice(0, 40)) {
    if (!Array.isArray(p) || !isNum(p[1]) || !isNum(p[2])) continue;
    const team: Team = p[0] === 1 ? "away" : "home";
    const i = counts[team]++;
    outPlayers.push({
      id: `${team[0]}${i}`,
      team,
      x: clampX(p[1]),
      y: clampY(p[2]),
      num: isNum(p[3]) ? Math.max(0, Math.min(99, Math.round(p[3]))) : i + 1,
      name: str(p[4], 24),
    });
  }

  const outDrawings: Drawing[] = [];
  if (Array.isArray(drawings)) {
    drawings.slice(0, 200).forEach((d, i) => {
      if (!Array.isArray(d) || ![d[1], d[2], d[3], d[4]].every(isNum)) return;
      outDrawings.push({
        id: `d${i}`,
        kind: d[0] === 0 ? "run" : "pass",
        x1: clampX(d[1]),
        y1: clampY(d[2]),
        x2: clampX(d[3]),
        y2: clampY(d[4]),
      });
    });
  }

  const b = Array.isArray(ball) && isNum(ball[0]) && isNum(ball[1]) ? ball : [PITCH_W / 2, PITCH_H / 2];

  return {
    title: str(title, 60),
    home: {
      name: str(home[0], 24, "Home"),
      color: color(home[1], HOME_COLOR),
      formation: formation(home[2], "4-3-3"),
    },
    away: {
      name: str(away[0], 24, "Away"),
      color: color(away[1], AWAY_COLOR),
      formation: formation(away[2], "4-4-2"),
      shown: away[3] !== 0,
    },
    players: outPlayers,
    ball: { x: clampX(b[0] as number), y: clampY(b[1] as number) },
    drawings: outDrawings,
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
    if (bytes.length > 200_000) return null;
    return unpack(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return null;
  }
}
