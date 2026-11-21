"use client";

import { useMemo } from "react";
import type { Board, Frame, Team } from "@/lib/board";
import {
  type Control,
  type Dot,
  type Lane,
  type Offside,
  type Possession,
  type Shape,
  coverShadows,
  offsideLine,
  passingLanes,
  possession,
  spaceControl,
  teamShape,
} from "@/lib/analysis";

export type Analysis = {
  dots: Dot[];
  control: Control | null;
  shapes: Shape[];
  offside: Offside[];
  possession: Possession | null;
  shadows: { id: string; points: [number, number][] }[];
  lanes: Lane[];
};

/** All analysis for the frame on screen. Cheap enough to run on every drag move. */
export function useAnalysis(board: Board, frame: Frame): Analysis {
  return useMemo(() => {
    const dots: Dot[] = board.players
      .filter((p) => p.team === "home" || board.away.shown)
      .flatMap((p) => {
        const at = frame.pos[p.id];
        return at ? [{ id: p.id, team: p.team, x: at[0], y: at[1] }] : [];
      });

    const teams: Team[] = board.away.shown ? ["home", "away"] : ["home"];
    const poss = possession(dots, frame.ball);
    const two = board.away.shown;

    const shapes = teams.map((t) => teamShape(t, dots)).filter((s): s is Shape => s !== null);

    // Offside line for the team on the ball; with no clear carrier, show both.
    const attackers: Team[] = !two ? [] : poss?.carrier ? [poss.team] : ["home", "away"];
    const offside = attackers.map((t) => offsideLine(t, dots, frame.ball)).filter((o): o is Offside => o !== null);

    const defending = poss ? dots.filter((d) => d.team !== poss.team) : [];
    const shadows = two && poss ? coverShadows(defending, frame.ball) : [];
    const lanes = poss?.carrier ? passingLanes(dots, poss.carrier) : [];

    return {
      dots,
      control: two ? spaceControl(dots) : null,
      shapes,
      offside,
      possession: poss,
      shadows,
      lanes,
    };
  }, [board.players, board.away.shown, frame]);
}
