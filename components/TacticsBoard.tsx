"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  type Board,
  type DrawKind,
  type Drawing,
  type Team,
  type Tool,
  FORMATION_NAMES,
  PITCH_H,
  PITCH_W,
  TEAM_COLORS,
  applyFormation,
  clampX,
  clampY,
  decodeBoard,
  defaultBoard,
  encodeBoard,
} from "@/lib/board";

const STORAGE_KEY = "tactora:board";
const HISTORY_LIMIT = 60;
const PAD = 4;

type Drag =
  | { kind: "player"; id: string; dx: number; dy: number; moved: boolean; startX: number; startY: number }
  | { kind: "ball"; dx: number; dy: number; moved: boolean }
  | { kind: "draw"; draw: DrawKind; x1: number; y1: number };

/** Ink or white text, whichever reads better on a shirt colour. */
function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#16201b" : "#ffffff";
}

let idCounter = 0;
const newId = () => `d${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export function TacticsBoard() {
  const [board, setBoard] = useState<Board>(defaultBoard);
  const [tool, setTool] = useState<Tool>("move");
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<Drawing | null>(null);
  const [toast, setToast] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const [vertical, setVertical] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const fieldRef = useRef<SVGGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const historyRef = useRef<Board[]>([]);
  const boardRef = useRef(board);
  const toastTimer = useRef<number | undefined>(undefined);

  useEffect(() => {
    boardRef.current = board;
  }, [board]);

  const say = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2600);
  }, []);

  /** Record the current board so the next change can be undone. */
  const remember = useCallback(() => {
    historyRef.current.push(boardRef.current);
    if (historyRef.current.length > HISTORY_LIMIT) historyRef.current.shift();
    setCanUndo(true);
  }, []);

  const change = useCallback(
    (next: Board | ((b: Board) => Board)) => {
      remember();
      setBoard(next);
    },
    [remember],
  );

  const undo = useCallback(() => {
    const prev = historyRef.current.pop();
    if (!prev) return;
    setBoard(prev);
    setCanUndo(historyRef.current.length > 0);
    setSelected(null);
  }, []);

  // Phones get an upright pitch so players are big enough to drag.
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setVertical(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  // Load: a shared link wins, then the last board on this device.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const match = window.location.hash.match(/^#b=([A-Za-z0-9_-]+)/);
      let next: Board | null = null;
      if (match) {
        next = await decodeBoard(match[1]);
        if (!next && !cancelled) say("That link couldn't be opened, so here's a fresh board.");
      } else {
        try {
          const saved = window.localStorage.getItem(STORAGE_KEY);
          if (saved) next = await decodeBoard(saved);
        } catch {
          // storage blocked: start fresh
        }
      }
      if (cancelled) return;
      if (next) setBoard(next);
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [say]);

  // Autosave on this device.
  useEffect(() => {
    if (!loaded) return;
    const id = window.setTimeout(async () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, await encodeBoard(board));
      } catch {
        // private mode or full storage: nothing to do
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [board, loaded]);

  // Keyboard: undo, tool shortcuts, Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        undo();
        return;
      }
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const key = e.key.toLowerCase();
      if (key === "v") setTool("move");
      else if (key === "r") setTool("run");
      else if (key === "p") setTool("pass");
      else if (key === "e") setTool("erase");
      else if (key === "escape") {
        setSelected(null);
        setTool("move");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  function point(e: React.PointerEvent): { x: number; y: number } {
    const field = fieldRef.current;
    if (!field) return { x: 0, y: 0 };
    const ctm = field.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function startPlayer(e: React.PointerEvent, id: string) {
    if (tool !== "move") return;
    e.stopPropagation();
    const p = board.players.find((q) => q.id === id);
    if (!p) return;
    const at = point(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "player", id, dx: at.x - p.x, dy: at.y - p.y, moved: false, startX: at.x, startY: at.y };
  }

  function startBall(e: React.PointerEvent) {
    if (tool !== "move") return;
    e.stopPropagation();
    const at = point(e);
    svgRef.current?.setPointerCapture(e.pointerId);
    dragRef.current = { kind: "ball", dx: at.x - board.ball.x, dy: at.y - board.ball.y, moved: false };
  }

  function startPitch(e: React.PointerEvent) {
    if (tool === "run" || tool === "pass") {
      const at = point(e);
      svgRef.current?.setPointerCapture(e.pointerId);
      dragRef.current = { kind: "draw", draw: tool, x1: at.x, y1: at.y };
      setDraft({ id: "draft", kind: tool, x1: at.x, y1: at.y, x2: at.x, y2: at.y });
    } else if (tool === "move") {
      setSelected(null);
    }
  }

  function onMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const at = point(e);

    if (drag.kind === "draw") {
      setDraft({ id: "draft", kind: drag.draw, x1: drag.x1, y1: drag.y1, x2: clampX(at.x), y2: clampY(at.y) });
      return;
    }

    if (!drag.moved) {
      if (drag.kind === "player" && Math.hypot(at.x - drag.startX, at.y - drag.startY) < 0.6) return;
      drag.moved = true;
      remember();
    }

    const x = clampX(at.x - drag.dx);
    const y = clampY(at.y - drag.dy);
    if (drag.kind === "player") {
      const id = drag.id;
      setBoard((b) => ({ ...b, players: b.players.map((p) => (p.id === id ? { ...p, x, y } : p)) }));
    } else {
      setBoard((b) => ({ ...b, ball: { x, y } }));
    }
  }

  function onUp() {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.kind === "draw") {
      const d = draft;
      setDraft(null);
      if (d && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 2) {
        change((b) => ({ ...b, drawings: [...b.drawings, { ...d, id: newId() }] }));
      }
      return;
    }

    if (drag.kind === "player" && !drag.moved) {
      setSelected((s) => (s === drag.id ? null : drag.id));
    }
  }

  function erase(e: React.PointerEvent, id: string) {
    if (tool !== "erase") return;
    e.stopPropagation();
    change((b) => ({ ...b, drawings: b.drawings.filter((d) => d.id !== id) }));
  }

  async function share() {
    const code = await encodeBoard(board);
    const url = `${window.location.origin}${window.location.pathname}#b=${code}`;
    window.history.replaceState(null, "", `#b=${code}`);
    try {
      await navigator.clipboard.writeText(url);
      say("Link copied. Anyone with it sees this board.");
    } catch {
      say("Copying was blocked. The link is in your address bar.");
    }
  }

  async function savePng() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    const scale = 20;
    const long = (PITCH_W + PAD * 2) * scale;
    const short = (PITCH_H + PAD * 2) * scale;
    const [w, h] = vertical ? [short, long] : [long, short];
    clone.setAttribute("width", String(w));
    clone.setAttribute("height", String(h));
    clone.querySelectorAll("[data-ui]").forEach((n) => n.remove());
    const xml = new XMLSerializer().serializeToString(clone);
    const img = new Image();
    img.decoding = "async";
    const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
    try {
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = () => reject(new Error("render failed"));
        img.src = url;
      });
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("no canvas");
      ctx.drawImage(img, 0, 0, w, h);
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("no image");
      const a = document.createElement("a");
      const slug = (board.title || "tactora-board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.href = URL.createObjectURL(blob);
      a.download = `${slug || "tactora-board"}.png`;
      a.click();
      window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      say("Image saved.");
    } catch {
      say("Couldn't make the image in this browser.");
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  function setTeam(team: Team, patch: Partial<Board["home"]> & { shown?: boolean }) {
    change((b) => ({ ...b, [team]: { ...b[team], ...patch } }));
  }

  const selectedPlayer = board.players.find((p) => p.id === selected) ?? null;
  const visiblePlayers = board.players.filter((p) => p.team === "home" || board.away.shown);
  const lines = draft ? [...board.drawings, draft] : board.drawings;

  return (
    <div className="board-layout">
      <section className="board-main" aria-label="Tactics board">
        <div className="board-head">
          <input
            className="board-title"
            value={board.title}
            placeholder="Name this tactic"
            maxLength={60}
            aria-label="Tactic name"
            onFocus={remember}
            onChange={(e) => setBoard((b) => ({ ...b, title: e.target.value }))}
          />
          <div className="tools" role="toolbar" aria-label="Tools">
            {(
              [
                ["move", "Move", "V"],
                ["run", "Run", "R"],
                ["pass", "Pass", "P"],
                ["erase", "Erase", "E"],
              ] as [Tool, string, string][]
            ).map(([id, label, key]) => (
              <button
                key={id}
                type="button"
                className={`tool tool-${id}`}
                aria-pressed={tool === id}
                title={`${label} (${key})`}
                onClick={() => setTool(id)}
              >
                <span className="tool-glyph" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className={`pitch-wrap tool-is-${tool}`}>
          <svg
            ref={svgRef}
            className="pitch"
            viewBox={
              vertical
                ? `${-PAD} ${-PAD} ${PITCH_H + PAD * 2} ${PITCH_W + PAD * 2}`
                : `${-PAD} ${-PAD} ${PITCH_W + PAD * 2} ${PITCH_H + PAD * 2}`
            }
            xmlns="http://www.w3.org/2000/svg"
            role="img"
            aria-label={`${board.home.name} ${board.home.formation}${board.away.shown ? ` against ${board.away.name} ${board.away.formation}` : ""}`}
            onPointerDown={startPitch}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
          >
            <defs>
              <marker id="head-run" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#ffffff" />
              </marker>
              <marker id="head-pass" viewBox="0 0 10 10" refX="7" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
                <path d="M0 0 L10 5 L0 10 z" fill="#c8f53c" />
              </marker>
            </defs>

            <g ref={fieldRef} transform={vertical ? `translate(${PITCH_H} 0) rotate(90)` : undefined}>
            {/* Turf */}
            <rect x={-PAD} y={-PAD} width={PITCH_W + PAD * 2} height={PITCH_H + PAD * 2} fill="#1d7a4c" />
            {Array.from({ length: 12 }, (_, i) => (
              <rect key={i} x={(PITCH_W / 12) * i} y={0} width={PITCH_W / 12} height={PITCH_H} fill={i % 2 ? "#228a56" : "#1f8050"} />
            ))}

            {/* Markings */}
            <g fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={0.3}>
              <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
              <line x1={PITCH_W / 2} y1={0} x2={PITCH_W / 2} y2={PITCH_H} />
              <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={9.15} />
              {[0, 1].map((side) => {
                const x0 = side ? PITCH_W : 0;
                const dir = side ? -1 : 1;
                const box = (depth: number, width: number) => (
                  <rect x={side ? PITCH_W - depth : 0} y={(PITCH_H - width) / 2} width={depth} height={width} />
                );
                const arcX = x0 + dir * 16.5;
                const dy = Math.sqrt(9.15 ** 2 - 5.5 ** 2);
                return (
                  <g key={side}>
                    {box(16.5, 40.32)}
                    {box(5.5, 18.32)}
                    <path d={`M ${arcX} ${PITCH_H / 2 - dy} A 9.15 9.15 0 0 ${side ? 0 : 1} ${arcX} ${PITCH_H / 2 + dy}`} />
                    <rect x={side ? PITCH_W : -1.6} y={(PITCH_H - 7.32) / 2} width={1.6} height={7.32} />
                  </g>
                );
              })}
            </g>
            <g fill="rgba(255,255,255,0.85)">
              <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={0.35} />
              <circle cx={11} cy={PITCH_H / 2} r={0.3} />
              <circle cx={PITCH_W - 11} cy={PITCH_H / 2} r={0.3} />
            </g>

            {/* Runs and passes */}
            <g>
              {lines.map((d) => (
                <g key={d.id} className="drawing" onPointerDown={(e) => erase(e, d.id)}>
                  <line x1={d.x1} y1={d.y1} x2={d.x2} y2={d.y2} stroke="transparent" strokeWidth={2.4} />
                  <line
                    x1={d.x1}
                    y1={d.y1}
                    x2={d.x2}
                    y2={d.y2}
                    stroke={d.kind === "run" ? "#ffffff" : "#c8f53c"}
                    strokeWidth={0.45}
                    strokeLinecap="round"
                    strokeDasharray={d.kind === "pass" ? "1.2 0.9" : undefined}
                    markerEnd={`url(#head-${d.kind})`}
                  />
                </g>
              ))}
            </g>

            {/* Players */}
            {visiblePlayers.map((p) => {
              const fill = board[p.team].color;
              const isSel = p.id === selected;
              return (
                <g
                  key={p.id}
                  className="player"
                  transform={`translate(${p.x} ${p.y})${vertical ? " rotate(-90)" : ""}`}
                  onPointerDown={(e) => startPlayer(e, p.id)}
                >
                  {isSel && <circle data-ui r={3.1} fill="none" stroke="#c8f53c" strokeWidth={0.45} />}
                  <circle r={2.1} fill={fill} stroke="rgba(255,255,255,0.9)" strokeWidth={0.3} />
                  <text
                    y={0.75}
                    textAnchor="middle"
                    fontSize={2.1}
                    fontWeight={800}
                    fontFamily="Arial, Helvetica, sans-serif"
                    fill={textOn(fill)}
                  >
                    {p.num}
                  </text>
                  {p.name && (
                    <text
                      y={4.3}
                      textAnchor="middle"
                      fontSize={1.6}
                      fontWeight={700}
                      fontFamily="Arial, Helvetica, sans-serif"
                      fill="#ffffff"
                      stroke="rgba(10,40,24,0.75)"
                      strokeWidth={0.35}
                      paintOrder="stroke"
                    >
                      {p.name}
                    </text>
                  )}
                </g>
              );
            })}

            {/* Ball */}
            <g className="ball" transform={`translate(${board.ball.x} ${board.ball.y})`} onPointerDown={startBall}>
              <circle r={1.6} fill="transparent" />
              <circle r={0.9} fill="#ffffff" stroke="#16201b" strokeWidth={0.22} />
              <path d="M0 -0.42 L0.4 -0.13 L0.25 0.34 L-0.25 0.34 L-0.4 -0.13 Z" fill="#16201b" />
            </g>
            </g>
          </svg>
        </div>

        <p className="board-hint">
          {tool === "move" && "Drag players and the ball. Tap a player to rename them."}
          {tool === "run" && "Drag on the pitch to draw a run."}
          {tool === "pass" && "Drag on the pitch to draw a pass."}
          {tool === "erase" && "Tap a run or pass to remove it."}
        </p>
      </section>

      <aside className="panel" aria-label="Board settings">
        {selectedPlayer ? (
          <div className="card card-player">
            <div className="card-head">
              <h2>Player</h2>
              <button type="button" className="link-btn" onClick={() => setSelected(null)}>
                Done
              </button>
            </div>
            <div className="field-row">
              <label className="field field-num">
                <span>No.</span>
                <input
                  type="number"
                  min={0}
                  max={99}
                  value={selectedPlayer.num}
                  onFocus={remember}
                  onChange={(e) => {
                    const num = Math.max(0, Math.min(99, Number(e.target.value) || 0));
                    setBoard((b) => ({ ...b, players: b.players.map((p) => (p.id === selectedPlayer.id ? { ...p, num } : p)) }));
                  }}
                />
              </label>
              <label className="field">
                <span>Name</span>
                <input
                  value={selectedPlayer.name}
                  maxLength={24}
                  placeholder="Optional"
                  autoFocus
                  onFocus={remember}
                  onChange={(e) =>
                    setBoard((b) => ({
                      ...b,
                      players: b.players.map((p) => (p.id === selectedPlayer.id ? { ...p, name: e.target.value } : p)),
                    }))
                  }
                />
              </label>
            </div>
          </div>
        ) : null}

        {(["home", "away"] as Team[]).map((team) => {
          const t = board[team];
          const shown = team === "home" || board.away.shown;
          return (
            <div key={team} className={`card${shown ? "" : " is-off"}`}>
              <div className="card-head">
                <span className="team-dot" style={{ background: t.color }} aria-hidden="true" />
                <input
                  className="team-name"
                  value={t.name}
                  maxLength={24}
                  aria-label={`${team === "home" ? "Home" : "Away"} team name`}
                  onFocus={remember}
                  onChange={(e) => setBoard((b) => ({ ...b, [team]: { ...b[team], name: e.target.value } }))}
                />
                {team === "away" && (
                  <label className="switch">
                    <input
                      type="checkbox"
                      checked={board.away.shown}
                      onChange={(e) => setTeam("away", { shown: e.target.checked })}
                    />
                    <span>Show</span>
                  </label>
                )}
              </div>
              <div className="formations" role="group" aria-label={`${t.name} formation`}>
                {FORMATION_NAMES.map((f) => (
                  <button
                    key={f}
                    type="button"
                    className="chip"
                    aria-pressed={t.formation === f}
                    disabled={!shown}
                    onClick={() => change((b) => applyFormation(b, team, f))}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="swatches" role="group" aria-label={`${t.name} shirt colour`}>
                {TEAM_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    className="swatch"
                    style={{ background: c }}
                    aria-label={`Colour ${c}`}
                    aria-pressed={t.color === c}
                    disabled={!shown}
                    onClick={() => setTeam(team, { color: c })}
                  />
                ))}
              </div>
            </div>
          );
        })}

        <div className="card card-actions">
          <button type="button" className="btn btn-ink" onClick={share}>
            Copy share link
          </button>
          <button type="button" className="btn btn-line" onClick={savePng}>
            Save as image
          </button>
          <div className="actions-row">
            <button type="button" className="btn btn-quiet" onClick={undo} disabled={!canUndo}>
              Undo
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              disabled={board.drawings.length === 0}
              onClick={() => change((b) => ({ ...b, drawings: [] }))}
            >
              Clear lines
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => {
                change(defaultBoard());
                setSelected(null);
                window.history.replaceState(null, "", window.location.pathname);
              }}
            >
              New board
            </button>
          </div>
          <p className="saved-note">Saved on this device as you go.</p>
        </div>
      </aside>

      <div className={`toast${toast ? " is-on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
