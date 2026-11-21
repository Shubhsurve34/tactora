"use client";

import type { Board, Overlays, Team } from "@/lib/board";
import type { Analysis } from "./useAnalysis";

const TOGGLES: [keyof Overlays, string, string][] = [
  ["control", "Space control", "Who reaches each patch of grass first."],
  ["shape", "Team shape", "Block outline, lines, and the gaps between them."],
  ["offside", "Offside line", "Live line for the team on the ball. Flags anyone beyond it."],
  ["shadows", "Cover shadows", "Passing angles each defender blocks from the ball."],
  ["lanes", "Passing lanes", "Every pass the ball carrier has: open or cut out."],
];

type Props = {
  board: Board;
  analysis: Analysis;
  onToggle: (key: keyof Overlays) => void;
};

const m = (n: number | undefined) => (n === undefined ? "–" : `${Math.round(n)} m`);
const pct = (n: number | undefined) => (n === undefined ? "–" : `${Math.round(n)}%`);

export function AnalysisPanel({ board, analysis, onToggle }: Props) {
  const teams: Team[] = board.away.shown ? ["home", "away"] : ["home"];
  const shape = (t: Team) => analysis.shapes.find((s) => s.team === t);
  const caught = (t: Team) => analysis.offside.find((o) => o.attacking === t)?.offside.length;
  const name = (id: string) => {
    const p = board.players.find((q) => q.id === id);
    if (!p) return "";
    return `${board[p.team].name} #${p.num}${p.name ? ` ${p.name}` : ""}`;
  };

  const open = analysis.lanes.filter((l) => l.open).length;
  const poss = analysis.possession;

  const rows: [string, (t: Team) => string, string?][] = [
    ["Pitch controlled", (t) => pct(analysis.control?.share[t]), "Share of the whole pitch"],
    ["Final third owned", (t) => pct(analysis.control?.finalThird[t]), "Share of the third they attack"],
    ["Defensive line", (t) => m(shape(t)?.defLine), "Last outfield player to own goal"],
    ["Width", (t) => m(shape(t)?.width)],
    ["Length", (t) => m(shape(t)?.length), "Deepest to highest outfield player"],
    ["Block area", (t) => (shape(t) ? `${Math.round(shape(t)!.compactness)} m²` : "–"), "Smaller is more compact"],
    ["Defence to midfield", (t) => m(shape(t)?.gaps[0])],
    ["Midfield to attack", (t) => m(shape(t)?.gaps[1])],
    ["Caught offside", (t) => (caught(t) === undefined ? "–" : String(caught(t)))],
  ];

  return (
    <>
      <div className="card card-analysis">
        <div className="card-head">
          <h2>Overlays</h2>
        </div>
        <ul className="toggles">
          {TOGGLES.map(([key, label, help]) => (
            <li key={key}>
              <label className={`toggle toggle-${key}`}>
                <input type="checkbox" checked={board.overlays[key]} onChange={() => onToggle(key)} />
                <span className="toggle-track" aria-hidden="true" />
                <span className="toggle-text">
                  <strong>{label}</strong>
                  <span>{help}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
        {!board.away.shown && <p className="analysis-note">Show the away team to see space control, offside and passing.</p>}
      </div>

      <div className="card card-metrics">
        <div className="card-head">
          <h2>Numbers</h2>
          <span className="live-tag">Live</span>
        </div>

        <p className="possession">
          {poss?.carrier ? (
            <>
              On the ball: <strong>{name(poss.carrier)}</strong>
              {analysis.lanes.length > 0 && (
                <>
                  {" "}
                  · {open} of {analysis.lanes.length} passes open
                </>
              )}
            </>
          ) : poss ? (
            <>
              Loose ball, nearest: <strong>{board[poss.team].name}</strong>
            </>
          ) : (
            "No players on the pitch."
          )}
        </p>

        <table className="metrics">
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">Measure</span>
              </th>
              {teams.map((t) => (
                <th key={t} scope="col">
                  <span className="team-dot" style={{ background: board[t].color }} aria-hidden="true" />
                  {board[t].name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, value, help]) => (
              <tr key={label}>
                <th scope="row" title={help}>
                  {label}
                </th>
                {teams.map((t) => (
                  <td key={t}>{value(t)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <p className="analysis-note">Measured in metres on a 105 × 68 pitch, for the step on screen.</p>
      </div>
    </>
  );
}
