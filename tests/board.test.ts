import { describe, expect, it } from "vitest";
import {
  FORMATIONS,
  applyFormation,
  decodeBoard,
  defaultBoard,
  encodeBoard,
  teamInFormation,
  unpack,
} from "../lib/board";

describe("formations", () => {
  it("every preset has 11 players with unique shirt numbers", () => {
    for (const name of Object.keys(FORMATIONS)) {
      const team = teamInFormation("home", name);
      expect(team).toHaveLength(11);
      expect(new Set(team.map((p) => p.num)).size).toBe(11);
    }
  });

  it("keeps home in its own half and away in the other", () => {
    for (const name of Object.keys(FORMATIONS)) {
      for (const p of teamInFormation("home", name)) expect(p.x).toBeLessThan(52.5);
      for (const p of teamInFormation("away", name)) expect(p.x).toBeGreaterThan(52.5);
    }
  });

  it("switching formation keeps names", () => {
    let b = defaultBoard();
    b = { ...b, players: b.players.map((p) => (p.id === "h9" ? { ...p, name: "Kane" } : p)) };
    const next = applyFormation(b, "home", "3-5-2");
    expect(next.home.formation).toBe("3-5-2");
    expect(next.players.find((p) => p.id === "h9")?.name).toBe("Kane");
    expect(next.players.filter((p) => p.team === "away")).toEqual(b.players.filter((p) => p.team === "away"));
  });
});

describe("share links", () => {
  it("round-trips a board", async () => {
    const b = defaultBoard();
    b.title = "High press";
    b.drawings = [{ id: "x", kind: "pass", x1: 10, y1: 20, x2: 30, y2: 40 }];
    b.players[3] = { ...b.players[3], name: "Ramos", x: 33.3 };
    const back = await decodeBoard(await encodeBoard(b));
    expect(back?.title).toBe("High press");
    expect(back?.players[3].name).toBe("Ramos");
    expect(back?.players[3].x).toBe(33.3);
    expect(back?.drawings[0]).toMatchObject({ kind: "pass", x1: 10, y2: 40 });
    expect(back?.players).toHaveLength(22);
  });

  it("rejects junk instead of crashing", async () => {
    expect(await decodeBoard("zzzz")).toBeNull();
    expect(await decodeBoard("jbm90IGpzb24")).toBeNull();
    expect(unpack({ hello: 1 })).toBeNull();
  });

  it("cleans hostile values", () => {
    const b = unpack([1, "t", ["A", "red;}", "9-9-9"], ["B", "#00ff00", "4-4-2", 1], [[0, 1e9, -5, 500, "x".repeat(99)]], [1, 2], []]);
    expect(b?.home.color).toBe("#d8432b");
    expect(b?.home.formation).toBe("4-3-3");
    expect(b?.players[0].x).toBeLessThanOrEqual(107);
    expect(b?.players[0].num).toBe(99);
    expect(b?.players[0].name.length).toBe(24);
  });
});

describe("flanks", () => {
  it("puts each right back on the right of the team's attacking direction", () => {
    const home = teamInFormation("home", "4-4-2");
    const away = teamInFormation("away", "4-4-2");
    // Home attacks towards +x, so its right is +y (bottom). Away attacks -x, so its right is top.
    expect(home.find((p) => p.num === 2)!.y).toBeGreaterThan(34);
    expect(away.find((p) => p.num === 2)!.y).toBeLessThan(34);
  });
});
