"use client";

import type { Board, Overlays, Team } from "@/lib/board";
import { ControlIcon, LanesIcon, OffsideIcon, ShadowIcon, ShapeIcon } from "./Icons";
import type { Analysis } from "./useAnalysis";

type IconCmp = (p: { size?: number }) => React.ReactElement;

const TOGGLES: [keyof Overlays, string, string, IconCmp][] = [
  ["control", "Space control", "Who reaches each patch of grass first", ControlIcon],
  ["shape", "Team shape", "Block outline, lines and the gaps between them", ShapeIcon],
  ["offside", "Offside line", "Follows the ball and the second-last defender", OffsideIcon],
  ["shadows", "Cover shadows", "Passing angles each defender takes away", ShadowIcon],
  ["lanes", "Passing lanes", "Every pass the carrier has, open or cut out", LanesIcon],
];

type Props = {
  board: Board;
  analysis: Analysis;
  onToggle: (key: keyof Overlays) => void;
};

const metres = (n: number | undefined) => (n === undefined ? null : Math.round(n));

export function AnalysisPanel({ board, analysis, onToggle }: Props) {
  const teams: Team[] = board.away.shown ? ["home", "away"] : ["home"];
  const shape = (t: Team) => analysis.shapes.find((s) => s.team === t);
  const caught = (t: Team) => analysis.offside.find((o) => o.attacking === t)?.offside.length;
  const player = (id: string) => board.players.find((q) => q.id === id);

  const open = analysis.lanes.filter((l) => l.open).length;
  const poss = analysis.possession;
  const carrier = poss?.carrier ? player(poss.carrier) : null;

  type Row = { label: string; unit: string; value: (t: Team) => number | null | undefined; help?: string };
  const rows: Row[] = [
    { label: "Pitch controlled", unit: "%", value: (t) => metres(analysis.control?.share[t]), help: "Share of the whole pitch" },
    { label: "Final third owned", unit: "%", value: (t) => metres(analysis.control?.finalThird[t]), help: "Share of the third they attack" },
    { label: "Defensive line", unit: "m", value: (t) => metres(shape(t)?.defLine), help: "Last outfield player to own goal" },
    { label: "Width", unit: "m", value: (t) => metres(shape(t)?.width) },
    { label: "Length", unit: "m", value: (t) => metres(shape(t)?.length), help: "Deepest to highest outfield player" },
    { label: "Block area", unit: "m²", value: (t) => metres(shape(t)?.compactness), help: "Smaller is more compact" },
    { label: "Defence to midfield", unit: "m", value: (t) => metres(shape(t)?.gaps[0]) },
    { label: "Midfield to attack", unit: "m", value: (t) => metres(shape(t)?.gaps[1]) },
    { label: "Caught offside", unit: "", value: (t) => caught(t) },
  ];

  return (
    <>
      <div className="card card-analysis">
        <ul className="toggles">
          {TOGGLES.map(([key, label, help, Glyph]) => (
            <li key={key}>
              <label className={`toggle toggle-${key}${board.overlays[key] ? " is-on" : ""}`}>
                <input type="checkbox" checked={board.overlays[key]} onChange={() => onToggle(key)} />
                <span className="toggle-icon" aria-hidden="true">
                  <Glyph size={20} />
                </span>
                <span className="toggle-text">
                  <strong>{label}</strong>
                  <span>{help}</span>
                </span>
                <span className="toggle-track" aria-hidden="true" />
              </label>
            </li>
          ))}
        </ul>
        {!board.away.shown && <p className="analysis-note">Show the away team to see space control, offside and passing.</p>}
      </div>

      <div className="card card-metrics">
        <div className="possession">
          {carrier ? (
            <>
              <span className="kit-dot" style={{ background: board[carrier.team].color }} aria-hidden="true" />
              <p>
                <strong>
                  {board[carrier.team].name} {carrier.num}
                  {carrier.name ? ` ${carrier.name}` : ""}
                </strong>{" "}
                has the ball.
                {analysis.lanes.length > 0 && (
                  <>
                    {" "}
                    {open} of {analysis.lanes.length} passes are open.
                  </>
                )}
              </p>
            </>
          ) : poss ? (
            <p>Loose ball. {board[poss.team].name} are closest.</p>
          ) : (
            <p>No players on the pitch.</p>
          )}
        </div>

        <table className="metrics">
          <caption className="sr-only">Team measurements for the step on screen</caption>
          <thead>
            <tr>
              <td />
              {teams.map((t) => (
                <th key={t} scope="col">
                  <span className="kit-dot" style={{ background: board[t].color }} aria-hidden="true" />
                  {board[t].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.label}>
                <th scope="row" title={r.help}>
                  {r.label}
                </th>
                {teams.map((t) => {
                  const v = r.value(t);
                  return (
                    <td key={t}>
                      {v === null || v === undefined ? (
                        <span className="nil">–</span>
                      ) : (
                        <>
                          <span className="fig">{v}</span>
                          {r.unit && <span className="unit">{r.unit}</span>}
                        </>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="analysis-note">Real distances on a 105 by 68 metre pitch, for the step on screen.</p>
      </div>
    </>
  );
}
