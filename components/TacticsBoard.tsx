"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import {
  type Board,
  type Drawing,
  type DrawKind,
  type Overlays,
  type Team,
  type Tool,
  type XY,
  type Zone,
  type ZoneKind,
  FORMATION_NAMES,
  MAX_STEPS,
  PITCH_H,
  PITCH_W,
  TEAM_COLORS,
  addStep,
  applyFormation,
  clampX,
  clampY,
  decodeBoard,
  defaultBoard,
  encodeBoard,
  frameAt,
  moveBall,
  movePlayer,
  removeStep,
} from "@/lib/board";
import { canRecordVideo, download, drawCaption, recordVideo, slug, svgToImage, timelineAt, timelineLength } from "@/lib/export";
import { PAD, Pitch } from "./Pitch";
import { FormationGlyph } from "./FormationGlyph";
import { Timeline } from "./Timeline";
import {
  AnalysisIcon,
  CloseIcon,
  EraseIcon,
  ImageIcon,
  LinkIcon,
  MarkIcon,
  MoveIcon,
  NewBoardIcon,
  PassIcon,
  PressIcon,
  RunIcon,
  SpaceIcon,
  TeamsIcon,
  UndoIcon,
  VideoIcon,
} from "./Icons";
import { AnalysisPanel } from "./AnalysisPanel";
import { useAnalysis } from "./useAnalysis";

const STORAGE_KEY = "tactora:board";
const HISTORY_LIMIT = 80;

type Drag =
  | { kind: "player"; id: string; dx: number; dy: number; moved: boolean; startX: number; startY: number }
  | { kind: "ball"; dx: number; dy: number; moved: boolean }
  | { kind: "draw"; draw: DrawKind; x1: number; y1: number }
  | { kind: "zone"; zone: ZoneKind; x1: number; y1: number }
  | { kind: "mark"; from: string };

type IconCmp = (p: { size?: number }) => React.ReactElement;

const TOOLS: [Tool, string, string, string, IconCmp][] = [
  ["move", "Move", "V", "Drag players and the ball. Tap a player to name them.", MoveIcon],
  ["run", "Run", "R", "Drag on the pitch to draw a run for this step.", RunIcon],
  ["pass", "Pass", "P", "Drag on the pitch to draw a pass for this step.", PassIcon],
  ["press", "Press zone", "Z", "Drag a box where your team should press.", PressIcon],
  ["space", "Space", "S", "Drag a box over space to attack.", SpaceIcon],
  ["mark", "Mark", "M", "Drag from a player to the opponent they mark.", MarkIcon],
  ["erase", "Erase", "E", "Tap a run, pass, zone or marking link to remove it.", EraseIcon],
];

let idCounter = 0;
const newId = (p: string) => `${p}${Date.now().toString(36)}${(idCounter++).toString(36)}`;

export function TacticsBoard() {
  const [board, setBoard] = useState<Board>(defaultBoard);
  const [step, setStep] = useState(0);
  const [tool, setTool] = useState<Tool>("move");
  const [selected, setSelected] = useState<string | null>(null);
  const [draftLine, setDraftLine] = useState<Drawing | null>(null);
  const [draftZone, setDraftZone] = useState<Zone | null>(null);
  const [draftMark, setDraftMark] = useState<{ from: string; x: number; y: number } | null>(null);
  const [playT, setPlayT] = useState<number | null>(null);
  const [speed, setSpeed] = useState(1);
  const [loop, setLoop] = useState(false);
  const [recording, setRecording] = useState<number | null>(null);
  const [tab, setTab] = useState<"teams" | "analysis">("teams");
  const [toast, setToast] = useState("");
  const [canUndo, setCanUndo] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [vertical, setVertical] = useState(false);

  const svgRef = useRef<SVGSVGElement>(null);
  const fieldRef = useRef<SVGGElement>(null);
  const dragRef = useRef<Drag | null>(null);
  const historyRef = useRef<{ board: Board; step: number }[]>([]);
  const boardRef = useRef(board);
  const stepRef = useRef(step);
  const toastTimer = useRef<number | undefined>(undefined);
  const playRef = useRef<{ raf: number; start: number } | null>(null);

  useEffect(() => {
    boardRef.current = board;
    stepRef.current = step;
  }, [board, step]);

  const steps = board.frames.length;
  const playing = playT !== null;
  const frame = useMemo(
    () => (playT !== null ? frameAt(board, playT) : board.frames[Math.min(step, steps - 1)]),
    [board, playT, step, steps],
  );
  const shownStep = playT !== null ? Math.min(steps - 1, Math.floor(playT)) : step;
  const prevFrame = playT === null && step > 0 ? board.frames[step - 1] : null;
  const analysis = useAnalysis(board, frame);

  const say = useCallback((message: string) => {
    setToast(message);
    window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 2800);
  }, []);

  /* History ---------------------------------------------------------------- */

  const remember = useCallback(() => {
    historyRef.current.push({ board: boardRef.current, step: stepRef.current });
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
    setBoard(prev.board);
    setStep(Math.min(prev.step, prev.board.frames.length - 1));
    setCanUndo(historyRef.current.length > 0);
    setSelected(null);
  }, []);

  /* Playback --------------------------------------------------------------- */

  const stop = useCallback(() => {
    if (playRef.current) cancelAnimationFrame(playRef.current.raf);
    playRef.current = null;
    setPlayT(null);
  }, []);

  const play = useCallback(() => {
    const total = boardRef.current.frames.length;
    if (total < 2) {
      say("Add a second step to play the move.");
      return;
    }
    if (playRef.current) cancelAnimationFrame(playRef.current.raf);
    setSelected(null);
    const state = { raf: 0, start: performance.now() };
    playRef.current = state;
    const tick = (now: number) => {
      if (playRef.current !== state) return;
      const n = boardRef.current.frames.length;
      const length = timelineLength(n, speed);
      let elapsed = now - state.start;
      if (elapsed >= length) {
        if (loop) {
          state.start = now;
          elapsed = 0;
        } else {
          playRef.current = null;
          setPlayT(null);
          setStep(n - 1);
          return;
        }
      }
      setPlayT(timelineAt(elapsed, n, speed));
      state.raf = requestAnimationFrame(tick);
    };
    state.raf = requestAnimationFrame(tick);
    setPlayT(0);
  }, [loop, say, speed]);

  useEffect(
    () => () => {
      if (playRef.current) cancelAnimationFrame(playRef.current.raf);
    },
    [],
  );

  /* Load, save, layout ----------------------------------------------------- */

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 640px)");
    const sync = () => setVertical(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

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
      if (next) {
        setBoard(next);
        if (match && next.frames.length > 1) say(`This move has ${next.frames.length} steps. Press play to watch it.`);
      }
      setLoaded(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [say]);

  useEffect(() => {
    if (!loaded) return;
    const id = window.setTimeout(async () => {
      try {
        window.localStorage.setItem(STORAGE_KEY, await encodeBoard(board));
      } catch {
        // private mode or full storage
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [board, loaded]);

  /* Steps ------------------------------------------------------------------ */

  const goTo = useCallback(
    (i: number) => {
      stop();
      setSelected(null);
      setStep(Math.max(0, Math.min(boardRef.current.frames.length - 1, i)));
    },
    [stop],
  );

  const newStep = useCallback(() => {
    stop();
    if (boardRef.current.frames.length >= MAX_STEPS) {
      say(`A move can have up to ${MAX_STEPS} steps.`);
      return;
    }
    const at = stepRef.current;
    change((b) => addStep(b, at));
    setStep(at + 1);
    say(`Step ${at + 2} added. Move players to show what happens next.`);
  }, [change, say, stop]);

  const deleteStep = useCallback(() => {
    stop();
    if (boardRef.current.frames.length <= 1) return;
    const at = stepRef.current;
    change((b) => removeStep(b, at));
    setStep(Math.max(0, at - 1));
  }, [change, stop]);

  /* Keyboard --------------------------------------------------------------- */

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
      if (e.key === " ") {
        e.preventDefault();
        if (playRef.current) stop();
        else play();
        return;
      }
      if (e.key === "ArrowRight") return goTo(stepRef.current + 1);
      if (e.key === "ArrowLeft") return goTo(stepRef.current - 1);
      const key = e.key.toLowerCase();
      if (key === "n") return newStep();
      const found = TOOLS.find(([, , k]) => k.toLowerCase() === key);
      if (found) setTool(found[0]);
      else if (key === "escape") {
        setSelected(null);
        setTool("move");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goTo, newStep, play, stop, undo]);

  /* Pointer ---------------------------------------------------------------- */

  function point(e: React.PointerEvent): { x: number; y: number } {
    const ctm = fieldRef.current?.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const p = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: p.x, y: p.y };
  }

  function capture(e: React.PointerEvent) {
    svgRef.current?.setPointerCapture(e.pointerId);
  }

  function onPlayerDown(e: React.PointerEvent, id: string) {
    if (playing || recording !== null) return;
    if (tool === "mark") {
      e.stopPropagation();
      capture(e);
      const at = point(e);
      dragRef.current = { kind: "mark", from: id };
      setDraftMark({ from: id, x: at.x, y: at.y });
      return;
    }
    if (tool !== "move") return;
    e.stopPropagation();
    const at = point(e);
    const p = frame.pos[id];
    if (!p) return;
    capture(e);
    dragRef.current = { kind: "player", id, dx: at.x - p[0], dy: at.y - p[1], moved: false, startX: at.x, startY: at.y };
  }

  function onBallDown(e: React.PointerEvent) {
    if (playing || recording !== null || tool !== "move") return;
    e.stopPropagation();
    const at = point(e);
    capture(e);
    dragRef.current = { kind: "ball", dx: at.x - frame.ball[0], dy: at.y - frame.ball[1], moved: false };
  }

  function onPitchDown(e: React.PointerEvent) {
    if (recording !== null) return;
    if (playing) {
      stop();
      return;
    }
    const at = point(e);
    if (tool === "run" || tool === "pass") {
      capture(e);
      dragRef.current = { kind: "draw", draw: tool, x1: at.x, y1: at.y };
      setDraftLine({ id: "draft", kind: tool, step, x1: at.x, y1: at.y, x2: at.x, y2: at.y });
    } else if (tool === "press" || tool === "space") {
      capture(e);
      dragRef.current = { kind: "zone", zone: tool, x1: at.x, y1: at.y };
      setDraftZone({ id: "draft", kind: tool, x: at.x, y: at.y, w: 0, h: 0 });
    } else if (tool === "move") {
      setSelected(null);
    }
  }

  function onMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    if (!drag) return;
    const at = point(e);

    if (drag.kind === "draw") {
      setDraftLine({ id: "draft", kind: drag.draw, step, x1: drag.x1, y1: drag.y1, x2: clampX(at.x), y2: clampY(at.y) });
      return;
    }
    if (drag.kind === "zone") {
      const x2 = Math.max(0, Math.min(PITCH_W, at.x));
      const y2 = Math.max(0, Math.min(PITCH_H, at.y));
      const x1 = Math.max(0, Math.min(PITCH_W, drag.x1));
      const y1 = Math.max(0, Math.min(PITCH_H, drag.y1));
      setDraftZone({ id: "draft", kind: drag.zone, x: Math.min(x1, x2), y: Math.min(y1, y2), w: Math.abs(x2 - x1), h: Math.abs(y2 - y1) });
      return;
    }
    if (drag.kind === "mark") {
      setDraftMark({ from: drag.from, x: at.x, y: at.y });
      return;
    }

    if (!drag.moved) {
      if (drag.kind === "player" && Math.hypot(at.x - drag.startX, at.y - drag.startY) < 0.6) return;
      drag.moved = true;
      remember();
    }
    const next: XY = [clampX(at.x - drag.dx), clampY(at.y - drag.dy)];
    if (drag.kind === "player") {
      const id = drag.id;
      setBoard((b) => movePlayer(b, step, id, next));
    } else {
      setBoard((b) => moveBall(b, step, next));
    }
  }

  function onUp(e: React.PointerEvent) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag) return;

    if (drag.kind === "draw") {
      const d = draftLine;
      setDraftLine(null);
      if (d && Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 2) {
        change((b) => ({ ...b, drawings: [...b.drawings, { ...d, id: newId("d") }] }));
      }
      return;
    }
    if (drag.kind === "zone") {
      const z = draftZone;
      setDraftZone(null);
      if (z && z.w > 2 && z.h > 2) change((b) => ({ ...b, zones: [...b.zones, { ...z, id: newId("z") }] }));
      return;
    }
    if (drag.kind === "mark") {
      setDraftMark(null);
      const at = point(e);
      const target = analysis.dots
        .filter((d) => d.id !== drag.from)
        .map((d) => ({ d, r: Math.hypot(d.x - at.x, d.y - at.y) }))
        .sort((a, b) => a.r - b.r)[0];
      if (target && target.r < 4) {
        const exists = board.marks.some(
          (m) => (m.from === drag.from && m.to === target.d.id) || (m.to === drag.from && m.from === target.d.id),
        );
        if (!exists) change((b) => ({ ...b, marks: [...b.marks, { id: newId("m"), from: drag.from, to: target.d.id }] }));
      }
      return;
    }
    if (drag.kind === "player" && !drag.moved) {
      setSelected((s) => (s === drag.id ? null : drag.id));
    }
  }

  function onErase(e: React.PointerEvent, kind: "drawing" | "zone" | "mark", id: string) {
    if (tool !== "erase" || playing) return;
    e.stopPropagation();
    if (kind === "drawing") change((b) => ({ ...b, drawings: b.drawings.filter((d) => d.id !== id) }));
    if (kind === "zone") change((b) => ({ ...b, zones: b.zones.filter((z) => z.id !== id) }));
    if (kind === "mark") change((b) => ({ ...b, marks: b.marks.filter((m) => m.id !== id) }));
  }

  /* Sharing and export ----------------------------------------------------- */

  async function share() {
    const code = await encodeBoard(board);
    const url = `${window.location.origin}${window.location.pathname}#b=${code}`;
    window.history.replaceState(null, "", `#b=${code}`);
    try {
      await navigator.clipboard.writeText(url);
      say(steps > 1 ? `Link copied. It opens all ${steps} steps, ready to play.` : "Link copied. Anyone with it sees this board.");
    } catch {
      say("Copying was blocked. The link is in your address bar.");
    }
  }

  const exportSize = () => {
    const scale = 18;
    const long = Math.round((PITCH_W + PAD * 2) * scale);
    const short = Math.round((PITCH_H + PAD * 2) * scale);
    // Even sizes keep video encoders happy.
    const even = (n: number) => n - (n % 2);
    return vertical ? { w: even(short), h: even(long) } : { w: even(long), h: even(short) };
  };

  async function savePng() {
    const svg = svgRef.current;
    if (!svg) return;
    try {
      const { w, h } = exportSize();
      const img = await svgToImage(svg, w, h);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error();
      ctx.drawImage(img, 0, 0, w, h);
      drawCaption(ctx, w, h, board.title, steps > 1 ? `Step ${step + 1} of ${steps}` : "");
      const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error();
      download(blob, `${slug(board.title)}${steps > 1 ? `-step-${step + 1}` : ""}.png`);
      say("Image saved.");
    } catch {
      say("Couldn't make the image in this browser.");
    }
  }

  async function saveVideo() {
    if (steps < 2) {
      say("Add a second step first. The video plays the move step by step.");
      return;
    }
    if (!canRecordVideo()) {
      say("This browser can't record video. Try Chrome, Edge or Safari.");
      return;
    }
    stop();
    setSelected(null);
    setRecording(0);
    try {
      const { w, h } = exportSize();
      const { blob, ext } = await recordVideo({
        svg: () => svgRef.current,
        width: w,
        height: h,
        steps,
        speed,
        title: board.title,
        show: (t) => flushSync(() => setPlayT(t)),
        onProgress: (f) => setRecording(f),
      });
      download(blob, `${slug(board.title)}.${ext}`);
      say(`Video saved (${ext.toUpperCase()}).`);
    } catch (err) {
      say(err instanceof Error && err.message ? err.message : "Couldn't record the video.");
    } finally {
      setRecording(null);
      setPlayT(null);
      setStep(steps - 1);
    }
  }

  /* Panel helpers ---------------------------------------------------------- */

  function setTeam(team: Team, patch: Partial<Board["home"]> & { shown?: boolean }) {
    change((b) => ({ ...b, [team]: { ...b[team], ...patch } }));
  }

  function pickFormation(e: React.MouseEvent<HTMLButtonElement>) {
    const { team, formation } = e.currentTarget.dataset;
    if ((team !== "home" && team !== "away") || !formation) return;
    change((b) => applyFormation(b, team, formation, step));
  }

  function toggleOverlay(key: keyof Overlays) {
    setBoard((b) => ({ ...b, overlays: { ...b.overlays, [key]: !b.overlays[key] } }));
  }

  function newBoard() {
    stop();
    change(defaultBoard());
    setStep(0);
    setSelected(null);
    window.history.replaceState(null, "", window.location.pathname);
  }

  const selectedPlayer = board.players.find((p) => p.id === selected) ?? null;
  const hint = TOOLS.find(([id]) => id === tool)?.[3] ?? "";
  const busy = recording !== null;
  const hasMarks = board.drawings.length > 0 || board.zones.length > 0 || board.marks.length > 0;

  return (
    <div className="studio">
      <div className="studio-head">
        <input
          className="board-title"
          value={board.title}
          placeholder="Name this move"
          maxLength={60}
          aria-label="Move name"
          onFocus={remember}
          onChange={(e) => setBoard((b) => ({ ...b, title: e.target.value }))}
        />
        <div className="head-actions">
          <button type="button" className="btn btn-quiet btn-icon-text" onClick={newBoard} disabled={busy} title="Start a new board">
            <NewBoardIcon size={18} />
            <span>New</span>
          </button>
          <button type="button" className="btn btn-line btn-icon-text" onClick={savePng} disabled={busy}>
            <ImageIcon size={18} />
            <span>Image</span>
          </button>
          <button
            type="button"
            className="btn btn-line btn-icon-text"
            onClick={saveVideo}
            disabled={busy || steps < 2}
            title={steps < 2 ? "Add a second step to make a video" : "Record the move as a video"}
          >
            <VideoIcon size={18} />
            <span>{busy ? `Recording ${Math.round((recording ?? 0) * 100)}%` : "Video"}</span>
          </button>
          <button type="button" className="btn btn-ink btn-icon-text" onClick={share} disabled={busy}>
            <LinkIcon size={18} />
            <span>Copy link</span>
          </button>
        </div>
      </div>

      <div className="board-layout">
        <section className="stage" aria-label="Tactics board">
          <nav className="rail" role="toolbar" aria-label="Tools" aria-orientation="vertical">
            {TOOLS.map(([id, label, key, , Glyph]) => (
              <button
                key={id}
                type="button"
                className="rail-btn"
                aria-pressed={tool === id}
                aria-label={`${label} (${key})`}
                onClick={() => setTool(id)}
                disabled={busy}
              >
                <Glyph size={21} />
                <span className="tip" role="tooltip">
                  {label}
                  <kbd>{key}</kbd>
                </span>
              </button>
            ))}
            <span className="rail-sep" aria-hidden="true" />
            <button type="button" className="rail-btn" onClick={undo} disabled={!canUndo || busy} aria-label="Undo (Ctrl+Z)">
              <UndoIcon size={21} />
              <span className="tip" role="tooltip">
                Undo
                <kbd>Ctrl Z</kbd>
              </span>
            </button>
            <button
              type="button"
              className="rail-btn"
              onClick={() => change((b) => ({ ...b, drawings: [], zones: [], marks: [] }))}
              disabled={!hasMarks || busy}
              aria-label="Clear runs, passes, zones and marking"
            >
              <CloseIcon size={21} />
              <span className="tip" role="tooltip">
                Clear drawings
              </span>
            </button>
          </nav>

          <div className="stage-main">
            <div className={`pitch-wrap tool-is-${tool}${playing ? " is-playing" : ""}`}>
              <Pitch
                board={board}
                frame={frame}
                prevFrame={prevFrame}
                step={shownStep}
                playing={playing}
                vertical={vertical}
                selected={selected}
                draftLine={draftLine}
                draftZone={draftZone}
                draftMark={draftMark}
                analysis={analysis}
                svgRef={svgRef}
                fieldRef={fieldRef}
                onPitchDown={onPitchDown}
                onPlayerDown={onPlayerDown}
                onBallDown={onBallDown}
                onErase={onErase}
                onMove={onMove}
                onUp={onUp}
              />
              <div className="scoreline" aria-hidden="true">
                <span className="score-team">
                  <i style={{ background: board.home.color }} />
                  {board.home.name}
                  <b>{board.home.formation}</b>
                </span>
                {board.away.shown && (
                  <span className="score-team">
                    <i style={{ background: board.away.color }} />
                    {board.away.name}
                    <b>{board.away.formation}</b>
                  </span>
                )}
                <span className="score-step">
                  {shownStep + 1}/{steps}
                </span>
              </div>
              {busy && (
                <div className="rec-badge" role="status">
                  <span className="rec-dot" aria-hidden="true" />
                  Recording {Math.round((recording ?? 0) * 100)}%
                </div>
              )}
            </div>

            <Timeline
              steps={steps}
              step={step}
              playT={playT}
              busy={busy}
              speed={speed}
              loop={loop}
              onPlay={play}
              onStop={stop}
              onGo={goTo}
              onAdd={newStep}
              onDelete={deleteStep}
              onSpeed={setSpeed}
              onLoop={setLoop}
            />

            <p className="board-hint">
              {playing
                ? "Playing. Tap the pitch or press Space to stop."
                : steps > 1 && step > 0 && tool === "move"
                  ? `Step ${step + 1}: drag players to where they go next. The trails show where they came from.`
                  : hint}
            </p>
          </div>
        </section>

        <aside className="panel" aria-label="Board settings">
          {selectedPlayer && (
            <div className="card card-player">
              <div className="card-head">
                <span className="kit-dot" style={{ background: board[selectedPlayer.team].color }} aria-hidden="true" />
                <h2>{board[selectedPlayer.team].name} player</h2>
                <button type="button" className="icon-btn" onClick={() => setSelected(null)} aria-label="Close">
                  <CloseIcon size={18} />
                </button>
              </div>
              <div className="field-row">
                <label className="field field-num">
                  <span>Number</span>
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
          )}

          <div className="panel-tabs" role="tablist" aria-label="Panel">
            <button type="button" role="tab" aria-selected={tab === "teams"} onClick={() => setTab("teams")}>
              <TeamsIcon size={18} />
              Teams
            </button>
            <button type="button" role="tab" aria-selected={tab === "analysis"} onClick={() => setTab("analysis")}>
              <AnalysisIcon size={18} />
              Analysis
              {Object.values(board.overlays).some(Boolean) && <span className="tab-dot" aria-label="Overlays on" />}
            </button>
          </div>

          {tab === "teams" &&
            (["home", "away"] as Team[]).map((team) => {
              const t = board[team];
              const shown = team === "home" || board.away.shown;
              return (
                <div key={team} className={`card card-team${shown ? "" : " is-off"}`}>
                  <div className="card-head">
                    <span className="kit-dot" style={{ background: t.color }} aria-hidden="true" />
                    <input
                      className="team-name"
                      value={t.name}
                      maxLength={24}
                      aria-label={`${team === "home" ? "Home" : "Away"} team name`}
                      onFocus={remember}
                      onChange={(e) => setBoard((b) => ({ ...b, [team]: { ...b[team], name: e.target.value } }))}
                    />
                    {team === "away" && (
                      <label className="switch" title={board.away.shown ? "Hide the away team" : "Show the away team"}>
                        <input type="checkbox" checked={board.away.shown} onChange={(e) => setTeam("away", { shown: e.target.checked })} />
                        <span className="switch-track" aria-hidden="true" />
                        <span className="sr-only">Show away team</span>
                      </label>
                    )}
                  </div>
                  <div className="formations" role="group" aria-label={`${t.name} formation`}>
                    {FORMATION_NAMES.map((f) => (
                      <button
                        key={f}
                        type="button"
                        className="formation"
                        aria-pressed={t.formation === f}
                        disabled={!shown || busy}
                        data-team={team}
                        data-formation={f}
                        onClick={pickFormation}
                      >
                        <FormationGlyph formation={f} color={t.color} />
                        <span>{f}</span>
                      </button>
                    ))}
                  </div>
                  <div className="swatches" role="radiogroup" aria-label={`${t.name} kit colour`}>
                    {TEAM_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        className="swatch"
                        style={{ background: c }}
                        aria-label={`Kit colour ${c}`}
                        aria-checked={t.color === c}
                        disabled={!shown}
                        onClick={() => setTeam(team, { color: c })}
                      />
                    ))}
                  </div>
                </div>
              );
            })}

          {tab === "analysis" && <AnalysisPanel board={board} analysis={analysis} onToggle={toggleOverlay} />}

          <p className="saved-note">Saved on this device as you go.</p>
        </aside>
      </div>

      <div className={`toast${toast ? " is-on" : ""}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  );
}
