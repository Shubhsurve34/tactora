import { describe, expect, it } from "vitest";
import {
  type Dot,
  convexHull,
  coverShadows,
  offsideLine,
  passingLanes,
  possession,
  spaceControl,
  teamShape,
} from "../lib/analysis";
import { defaultBoard } from "../lib/board";

const dotsFrom = () => {
  const b = defaultBoard();
  return b.players.map((p) => ({ id: p.id, team: p.team, x: b.frames[0].pos[p.id][0], y: b.frames[0].pos[p.id][1] })) as Dot[];
};

describe("space control", () => {
  it("splits the whole pitch between the two teams", () => {
    const c = spaceControl(dotsFrom())!;
    expect(c.share.home + c.share.away).toBeCloseTo(100, 3);
    expect(c.cells).toHaveLength(22);
  });

  it("gives a team more of the pitch when it pushes up", () => {
    const base = spaceControl(dotsFrom())!.share.home;
    const pushed = dotsFrom().map((d) => (d.team === "home" && d.id !== "h0" ? { ...d, x: d.x + 15 } : d));
    expect(spaceControl(pushed)!.share.home).toBeGreaterThan(base);
  });

  it("needs both teams", () => {
    expect(spaceControl(dotsFrom().filter((d) => d.team === "home"))).toBeNull();
  });
});

describe("team shape", () => {
  it("reads a 4-3-3 as three lines with the back four deepest", () => {
    const s = teamShape("home", dotsFrom())!;
    expect(s.lines).toHaveLength(3);
    expect(s.lines[0].ids.sort()).toEqual(["h1", "h2", "h3", "h4"]);
    expect(s.lines[1].ids).toHaveLength(3);
    expect(s.gaps.every((g) => g > 0)).toBe(true);
    expect(s.width).toBeGreaterThan(40);
    expect(s.compactness).toBeGreaterThan(0);
  });

  it("measures the away defensive line from its own goal", () => {
    const home = teamShape("home", dotsFrom())!;
    const away = teamShape("away", dotsFrom())!;
    // Mirrored set-ups: both back lines sit a similar distance from their goals.
    expect(Math.abs(home.defLine - away.defLine)).toBeLessThan(2);
  });

  it("builds a hull around the outside points", () => {
    const hull = convexHull([[0, 0], [10, 0], [10, 10], [0, 10], [5, 5]]);
    expect(hull).toHaveLength(4);
  });
});

describe("offside", () => {
  const dots: Dot[] = [
    { id: "a0", team: "away", x: 103, y: 34 },
    { id: "a1", team: "away", x: 80, y: 30 },
    { id: "a2", team: "away", x: 78, y: 40 },
    { id: "h9", team: "home", x: 85, y: 34 },
    { id: "h8", team: "home", x: 75, y: 20 },
  ];

  it("draws the line at the second-last defender", () => {
    const o = offsideLine("home", dots, [60, 34])!;
    expect(o.x).toBe(80);
    expect(o.offside).toEqual(["h9"]);
  });

  it("uses the ball when it is further forward", () => {
    const o = offsideLine("home", dots, [90, 34])!;
    expect(o.x).toBe(90);
    expect(o.offside).toEqual([]);
  });

  it("never puts the line in the attackers' own half", () => {
    const deep: Dot[] = [
      { id: "a0", team: "away", x: 103, y: 34 },
      { id: "a1", team: "away", x: 40, y: 30 },
      { id: "h9", team: "home", x: 45, y: 34 },
    ];
    expect(offsideLine("home", deep, [30, 34])!.x).toBe(52.5);
  });

  it("works for the away team attacking left", () => {
    const d: Dot[] = [
      { id: "h0", team: "home", x: 2, y: 34 },
      { id: "h1", team: "home", x: 25, y: 30 },
      { id: "a9", team: "away", x: 20, y: 34 },
    ];
    const o = offsideLine("away", d, [50, 34])!;
    expect(o.x).toBe(25);
    expect(o.offside).toEqual(["a9"]);
  });
});

describe("possession, shadows and lanes", () => {
  const dots: Dot[] = [
    { id: "h6", team: "home", x: 50, y: 34 },
    { id: "h8", team: "home", x: 70, y: 34 },
    { id: "h7", team: "home", x: 60, y: 10 },
    { id: "a6", team: "away", x: 60, y: 34.5 },
  ];

  it("finds the carrier", () => {
    expect(possession(dots, [51, 34])).toEqual({ team: "home", carrier: "h6" });
    expect(possession(dots, [55, 50])?.carrier).toBeNull();
  });

  it("blocks a pass with a defender in the way", () => {
    const lanes = passingLanes(dots, "h6");
    expect(lanes.find((l) => l.to === "h8")?.open).toBe(false);
    expect(lanes.find((l) => l.to === "h7")?.open).toBe(true);
  });

  it("casts a shadow away from the ball", () => {
    const [s] = coverShadows([dots[3]], [50, 34]);
    const farX = Math.max(...s.points.map((p) => p[0]));
    expect(farX).toBeGreaterThan(70);
  });
});

describe("final third", () => {
  it("credits a striker who gets into the final third", () => {
    const dots: Dot[] = [
      { id: "h9", team: "home", x: 95, y: 34 },
      { id: "h6", team: "home", x: 40, y: 34 },
      { id: "a1", team: "away", x: 60, y: 10 },
      { id: "a2", team: "away", x: 60, y: 58 },
    ];
    const c = spaceControl(dots)!;
    expect(c.finalThird.home).toBeGreaterThan(50);
  });
});
