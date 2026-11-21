import { describe, expect, it } from "vitest";
import {
  FORMATIONS,
  addStep,
  applyFormation,
  decodeBoard,
  defaultBoard,
  encodeBoard,
  frameAt,
  movePlayer,
  removeStep,
  teamInFormation,
  unpack,
} from "../lib/board";

describe("formations", () => {
  it("every preset has 11 players with unique shirt numbers", () => {
    for (const name of Object.keys(FORMATIONS)) {
      const { players } = teamInFormation("home", name);
      expect(players).toHaveLength(11);
      expect(new Set(players.map((p) => p.num)).size).toBe(11);
    }
  });

  it("keeps home in its own half and away in the other", () => {
    for (const name of Object.keys(FORMATIONS)) {
      for (const [x] of Object.values(teamInFormation("home", name).pos)) expect(x).toBeLessThan(52.5);
      for (const [x] of Object.values(teamInFormation("away", name).pos)) expect(x).toBeGreaterThan(52.5);
    }
  });

  it("puts each right back on the right of the team's attacking direction", () => {
    const home = teamInFormation("home", "4-4-2");
    const away = teamInFormation("away", "4-4-2");
    const rb = (t: typeof home) => t.pos[t.players.find((p) => p.num === 2)!.id];
    expect(rb(home)[1]).toBeGreaterThan(34);
    expect(rb(away)[1]).toBeLessThan(34);
  });

  it("switching formation only moves that team, in that step, and keeps names", () => {
    let b = defaultBoard();
    b = addStep(b, 0);
    b = { ...b, players: b.players.map((p) => (p.id === "h9" ? { ...p, name: "Kane" } : p)) };
    const next = applyFormation(b, "home", "3-5-2", 1);
    expect(next.home.formation).toBe("3-5-2");
    expect(next.players.find((p) => p.id === "h9")?.name).toBe("Kane");
    expect(next.frames[0]).toEqual(b.frames[0]);
    expect(next.frames[1].pos.a3).toEqual(b.frames[1].pos.a3);
    expect(next.frames[1].pos.h5).not.toEqual(b.frames[1].pos.h5);
  });
});

describe("steps", () => {
  it("adds a copy after the current step and shifts later drawings", () => {
    let b = defaultBoard();
    b = addStep(b, 0);
    b = { ...b, drawings: [{ id: "x", kind: "run", step: 1, x1: 1, y1: 1, x2: 9, y2: 9 }] };
    const c = addStep(b, 0);
    expect(c.frames).toHaveLength(3);
    expect(c.frames[1]).toEqual(c.frames[0]);
    expect(c.frames[1]).not.toBe(c.frames[0]);
    expect(c.drawings[0].step).toBe(2);
  });

  it("removes a step with its drawings", () => {
    let b = addStep(addStep(defaultBoard(), 0), 1);
    b = {
      ...b,
      drawings: [
        { id: "a", kind: "run", step: 1, x1: 1, y1: 1, x2: 9, y2: 9 },
        { id: "b", kind: "pass", step: 2, x1: 1, y1: 1, x2: 9, y2: 9 },
      ],
    };
    const c = removeStep(b, 1);
    expect(c.frames).toHaveLength(2);
    expect(c.drawings).toEqual([{ id: "b", kind: "pass", step: 1, x1: 1, y1: 1, x2: 9, y2: 9 }]);
    expect(removeStep(defaultBoard(), 0).frames).toHaveLength(1);
  });

  it("interpolates between steps with easing", () => {
    let b = addStep(defaultBoard(), 0);
    b = movePlayer(b, 1, "h9", [80, 20]);
    const start = b.frames[0].pos.h9;
    expect(frameAt(b, 0).pos.h9).toEqual(start);
    expect(frameAt(b, 1).pos.h9).toEqual([80, 20]);
    const mid = frameAt(b, 0.5).pos.h9;
    expect(mid[0]).toBeCloseTo((start[0] + 80) / 2, 5);
    const early = frameAt(b, 0.1).pos.h9;
    // Eased: slower than linear at the start.
    expect(early[0] - start[0]).toBeLessThan((80 - start[0]) * 0.1);
  });
});

describe("share links", () => {
  it("round-trips a multi-step board with zones, marks and overlays", async () => {
    let b = defaultBoard();
    b.title = "High press";
    b = addStep(b, 0);
    b = movePlayer(b, 1, "h3", [33.3, 20]);
    b.drawings = [{ id: "x", kind: "pass", step: 1, x1: 10, y1: 20, x2: 30, y2: 40 }];
    b.zones = [{ id: "z", kind: "press", x: 60, y: 10, w: 20, h: 15 }];
    b.marks = [{ id: "m", from: "h4", to: "a9" }];
    b.overlays = { ...b.overlays, control: true, lanes: true };
    b.players[3] = { ...b.players[3], name: "Ramos" };

    const back = await decodeBoard(await encodeBoard(b));
    expect(back).not.toBeNull();
    expect(back!.title).toBe("High press");
    expect(back!.frames).toHaveLength(2);
    expect(back!.frames[1].pos.h3).toEqual([33.3, 20]);
    expect(back!.players[3].name).toBe("Ramos");
    expect(back!.drawings[0]).toMatchObject({ kind: "pass", step: 1, x1: 10, y2: 40 });
    expect(back!.zones[0]).toMatchObject({ kind: "press", x: 60, w: 20 });
    expect(back!.marks[0]).toMatchObject({ from: "h4", to: "a9" });
    expect(back!.overlays).toEqual({ control: true, shape: false, offside: false, shadows: false, lanes: true });
    expect(back!.players).toHaveLength(22);
  });

  it("still opens links made by the first version", () => {
    const v1 = [1, "Old", ["A", "#d8432b", "4-3-3"], ["B", "#2443c9", "4-4-2", 1], [[0, 10, 20, 9, "Nine"], [1, 90, 30, 1, ""]], [50, 30], [[0, 1, 2, 3, 4]]];
    const b = unpack(v1)!;
    expect(b.title).toBe("Old");
    expect(b.frames).toHaveLength(1);
    expect(b.frames[0].pos.h0).toEqual([10, 20]);
    expect(b.players[0]).toMatchObject({ num: 9, name: "Nine" });
    expect(b.drawings[0]).toMatchObject({ kind: "run", step: 0 });
  });

  it("rejects junk instead of crashing", async () => {
    expect(await decodeBoard("zzzz")).toBeNull();
    expect(await decodeBoard("jbm90IGpzb24")).toBeNull();
    expect(unpack({ hello: 1 })).toBeNull();
    expect(unpack([2, "t", [], [], [], []])).toBeNull();
  });

  it("cleans hostile values", () => {
    const b = unpack([2, "t", ["A", "red;}", "9-9-9"], ["B", "#00ff00", "4-4-2", 1], [[0, 500, "x".repeat(99)]], [[1, 2, 1e9, -5]], [], [], [[0, 99]], 0]);
    expect(b?.home.color).toBe("#d8432b");
    expect(b?.home.formation).toBe("4-3-3");
    expect(b?.frames[0].pos.h0[0]).toBeLessThanOrEqual(107);
    expect(b?.frames[0].pos.h0[1]).toBeGreaterThanOrEqual(-2);
    expect(b?.players[0].num).toBe(99);
    expect(b?.players[0].name.length).toBe(24);
    expect(b?.marks).toEqual([]);
  });
});
