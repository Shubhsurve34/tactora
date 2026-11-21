"use client";

import type { RefObject } from "react";
import type { Board, Drawing, Frame, Tool, XY, Zone } from "@/lib/board";
import { PITCH_H, PITCH_W } from "@/lib/board";
import type { Analysis } from "./useAnalysis";

export const PAD = 4;

type Props = {
  board: Board;
  frame: Frame;
  prevFrame: Frame | null;
  step: number;
  playing: boolean;
  vertical: boolean;
  tool: Tool;
  selected: string | null;
  draftLine: Drawing | null;
  draftZone: Zone | null;
  draftMark: { from: string; x: number; y: number } | null;
  analysis: Analysis;
  svgRef: RefObject<SVGSVGElement | null>;
  fieldRef: RefObject<SVGGElement | null>;
  onPitchDown: (e: React.PointerEvent) => void;
  onPlayerDown: (e: React.PointerEvent, id: string) => void;
  onBallDown: (e: React.PointerEvent) => void;
  onErase: (e: React.PointerEvent, kind: "drawing" | "zone" | "mark", id: string) => void;
  onMove: (e: React.PointerEvent) => void;
  onUp: (e: React.PointerEvent) => void;
};

/** Ink or white text, whichever reads better on a shirt colour. */
export function textOn(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? "#16201b" : "#ffffff";
}

const pts = (points: XY[]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

const FONT = "Arial, Helvetica, sans-serif";
const OFFSIDE = "#ffd60a";

export function Pitch({
  board,
  frame,
  prevFrame,
  step,
  playing,
  vertical,
  selected,
  draftLine,
  draftZone,
  draftMark,
  analysis,
  svgRef,
  fieldRef,
  onPitchDown,
  onPlayerDown,
  onBallDown,
  onErase,
  onMove,
  onUp,
}: Props) {
  const { overlays } = board;
  const upright = vertical ? " rotate(-90)" : "";

  const visible = board.players.filter((p) => p.team === "home" || board.away.shown);
  const color = (id: string) => board[id[0] === "h" ? "home" : "away"].color;
  const posOf = (id: string) => frame.pos[id];

  const lines = board.drawings.filter((d) => d.step === step);
  if (draftLine) lines.push(draftLine);
  const zones = draftZone ? [...board.zones, draftZone] : board.zones;

  const offsideIds = new Set(overlays.offside ? analysis.offside.flatMap((o) => o.offside) : []);

  return (
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
      aria-label={`${board.home.name} ${board.home.formation}${board.away.shown ? ` against ${board.away.name} ${board.away.formation}` : ""}, step ${step + 1} of ${board.frames.length}`}
      onPointerDown={onPitchDown}
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
        <marker id="head-trail" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="4" markerHeight="4" orient="auto">
          <path d="M0 0 L10 5 L0 10 z" fill="rgba(255,255,255,0.75)" />
        </marker>
        <pattern id="hatch-press" width="2" height="2" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="2" height="2" fill="rgba(255,64,48,0.2)" />
          <line x1="0" y1="0" x2="0" y2="2" stroke="rgba(255,90,70,0.65)" strokeWidth="0.5" />
        </pattern>
        <clipPath id="pitch-clip">
          <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
        </clipPath>
      </defs>

      <g ref={fieldRef} transform={vertical ? `translate(${PITCH_H} 0) rotate(90)` : undefined}>
        {/* Turf */}
        <rect x={-PAD} y={-PAD} width={PITCH_W + PAD * 2} height={PITCH_H + PAD * 2} fill="#1d7a4c" />
        {Array.from({ length: 12 }, (_, i) => (
          <rect key={i} x={(PITCH_W / 12) * i} y={0} width={PITCH_W / 12} height={PITCH_H} fill={i % 2 ? "#228a56" : "#1f8050"} />
        ))}

        {/* Space control */}
        {overlays.control && analysis.control && (
          <g className="overlay-control" opacity={0.34}>
            {analysis.control.cells.map((c) => (
              <polygon key={c.id} points={pts(c.points)} fill={color(c.id)} stroke="rgba(255,255,255,0.35)" strokeWidth={0.12} />
            ))}
          </g>
        )}

        {/* Zones */}
        {zones.map((z) => (
          <g key={z.id} className="zone" onPointerDown={(e) => onErase(e, "zone", z.id)}>
            <rect
              x={z.x}
              y={z.y}
              width={z.w}
              height={z.h}
              rx={1.2}
              fill={z.kind === "press" ? "url(#hatch-press)" : "rgba(200,245,60,0.18)"}
              stroke={z.kind === "press" ? "rgba(255,95,75,0.95)" : "rgba(200,245,60,0.95)"}
              strokeWidth={0.3}
              strokeDasharray={z.kind === "space" ? "1 0.7" : undefined}
            />
            {z.w > 7 && z.h > 4 && (
              <text
                x={vertical ? z.x + 1 : z.x + 1}
                y={vertical ? z.y + z.h - 1 : z.y + 1}
                transform={vertical ? `rotate(-90 ${z.x + 1} ${z.y + z.h - 1})` : undefined}
                textAnchor="start"
                dominantBaseline="hanging"
                fontSize={1.7}
                fontWeight={800}
                fontFamily={FONT}
                letterSpacing={0.2}
                fill={z.kind === "press" ? "rgba(255,225,220,0.95)" : "rgba(230,255,170,0.95)"}
              >
                {z.kind === "press" ? "PRESS" : "SPACE"}
              </text>
            )}
          </g>
        ))}

        {/* Markings */}
        <g fill="none" stroke="rgba(255,255,255,0.85)" strokeWidth={0.3} pointerEvents="none">
          <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
          <line x1={PITCH_W / 2} y1={0} x2={PITCH_W / 2} y2={PITCH_H} />
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={9.15} />
          {[0, 1].map((side) => {
            const box = (depth: number, width: number) => (
              <rect x={side ? PITCH_W - depth : 0} y={(PITCH_H - width) / 2} width={depth} height={width} />
            );
            const arcX = side ? PITCH_W - 16.5 : 16.5;
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
        <g fill="rgba(255,255,255,0.85)" pointerEvents="none">
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={0.35} />
          <circle cx={11} cy={PITCH_H / 2} r={0.3} />
          <circle cx={PITCH_W - 11} cy={PITCH_H / 2} r={0.3} />
        </g>

        {/* Team shape: block outline and lines */}
        {overlays.shape &&
          analysis.shapes.map((s) => (
            <g key={s.team} pointerEvents="none">
              <polygon
                points={pts(s.hull)}
                fill={board[s.team].color}
                fillOpacity={0.13}
                stroke={board[s.team].color}
                strokeOpacity={0.9}
                strokeWidth={0.28}
                strokeDasharray="1.1 0.6"
                strokeLinejoin="round"
              />
              {s.lines.map((l, i) => (
                <line
                  key={i}
                  x1={l.x}
                  x2={l.x}
                  y1={l.minY - 1.5}
                  y2={l.maxY + 1.5}
                  stroke="rgba(255,255,255,0.55)"
                  strokeWidth={0.5}
                  strokeLinecap="round"
                />
              ))}
              {s.gaps.map((g, i) => {
                const a = s.lines[i];
                const b = s.lines[i + 1];
                const x = (a.x + b.x) / 2;
                const y = Math.max(2.2, Math.min(a.minY, b.minY) - 2.2);
                return (
                  <g key={`g${i}`} transform={`translate(${x} ${y})${upright}`}>
                    <rect x={-3.1} y={-1.25} width={6.2} height={2.5} rx={1.25} fill="rgba(22,32,27,0.82)" />
                    <text textAnchor="middle" dominantBaseline="central" fontSize={1.55} fontWeight={700} fontFamily={FONT} fill="#ffffff">
                      {Math.round(g)}m
                    </text>
                  </g>
                );
              })}
            </g>
          ))}

        {/* Cover shadows */}
        {overlays.shadows && (
          <g clipPath="url(#pitch-clip)" pointerEvents="none">
            {analysis.shadows.map((s) => (
              <polygon key={s.id} points={pts(s.points)} fill="rgba(8,24,16,0.32)" />
            ))}
          </g>
        )}

        {/* Offside lines */}
        {overlays.offside &&
          analysis.offside.map((o) => (
            <g key={o.attacking} pointerEvents="none">
              <line x1={o.x} x2={o.x} y1={0} y2={PITCH_H} stroke={OFFSIDE} strokeWidth={0.35} strokeDasharray="1.4 0.8" />
              <g transform={`translate(${o.x} ${PITCH_H - 2.4})${upright}`}>
                <rect x={-4.4} y={-1.2} width={8.8} height={2.4} rx={1.2} fill={OFFSIDE} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={1.4} fontWeight={800} fontFamily={FONT} fill="#16201b">
                  OFFSIDE
                </text>
              </g>
            </g>
          ))}

        {/* Passing lanes */}
        {overlays.lanes && (
          <g pointerEvents="none">
            {analysis.lanes.map((l) => (
              <line
                key={l.to}
                x1={l.x1}
                y1={l.y1}
                x2={l.x2}
                y2={l.y2}
                stroke={l.open ? "rgba(200,245,60,0.9)" : "rgba(255,92,70,0.8)"}
                strokeWidth={l.open ? 0.32 : 0.22}
                strokeDasharray={l.open ? undefined : "0.7 0.6"}
              />
            ))}
          </g>
        )}

        {/* Movement since the previous step */}
        {prevFrame && !playing && (
          <g pointerEvents="none">
            {visible.map((p) => {
              const a = prevFrame.pos[p.id];
              const b = posOf(p.id);
              if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) return null;
              return (
                <g key={p.id}>
                  <circle cx={a[0]} cy={a[1]} r={1.9} fill="none" stroke={color(p.id)} strokeOpacity={0.7} strokeWidth={0.25} strokeDasharray="0.5 0.4" />
                  <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="rgba(255,255,255,0.6)" strokeWidth={0.22} strokeDasharray="0.6 0.5" markerEnd="url(#head-trail)" />
                </g>
              );
            })}
            {Math.hypot(frame.ball[0] - prevFrame.ball[0], frame.ball[1] - prevFrame.ball[1]) > 1 && (
              <line
                x1={prevFrame.ball[0]}
                y1={prevFrame.ball[1]}
                x2={frame.ball[0]}
                y2={frame.ball[1]}
                stroke="rgba(200,245,60,0.8)"
                strokeWidth={0.25}
                strokeDasharray="0.4 0.5"
              />
            )}
          </g>
        )}

        {/* Runs and passes for this step */}
        <g>
          {lines.map((d) => (
            <g key={d.id} className="drawing" onPointerDown={(e) => onErase(e, "drawing", d.id)}>
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

        {/* Marking links */}
        <g>
          {board.marks.map((m) => {
            const a = posOf(m.from);
            const b = posOf(m.to);
            if (!a || !b) return null;
            return (
              <g key={m.id} className="mark" onPointerDown={(e) => onErase(e, "mark", m.id)}>
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="transparent" strokeWidth={2} />
                <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#ffffff" strokeWidth={0.3} strokeDasharray="0.3 0.55" strokeLinecap="round" />
              </g>
            );
          })}
          {draftMark && posOf(draftMark.from) && (
            <line
              x1={posOf(draftMark.from)[0]}
              y1={posOf(draftMark.from)[1]}
              x2={draftMark.x}
              y2={draftMark.y}
              stroke="#ffffff"
              strokeWidth={0.3}
              strokeDasharray="0.3 0.55"
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}
        </g>

        {/* Players */}
        {visible.map((p) => {
          const at = posOf(p.id);
          if (!at) return null;
          const fill = color(p.id);
          const isSel = p.id === selected;
          const flagged = offsideIds.has(p.id);
          const carrier = analysis.possession?.carrier === p.id;
          return (
            <g key={p.id} className="player" transform={`translate(${at[0]} ${at[1]})${upright}`} onPointerDown={(e) => onPlayerDown(e, p.id)}>
              <circle r={3.2} fill="transparent" />
              {flagged && <circle r={2.95} fill="none" stroke={OFFSIDE} strokeWidth={0.4} />}
              {carrier && overlays.lanes && <circle r={2.9} fill="none" stroke="#c8f53c" strokeWidth={0.3} strokeDasharray="0.6 0.4" />}
              {isSel && <circle data-ui r={3.1} fill="none" stroke="#c8f53c" strokeWidth={0.45} />}
              <circle r={2.1} fill={fill} stroke="rgba(255,255,255,0.9)" strokeWidth={0.3} />
              <text y={0.75} textAnchor="middle" fontSize={2.1} fontWeight={800} fontFamily={FONT} fill={textOn(fill)}>
                {p.num}
              </text>
              {p.name && (
                <text
                  y={4.3}
                  textAnchor="middle"
                  fontSize={1.6}
                  fontWeight={700}
                  fontFamily={FONT}
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
        <g className="ball" transform={`translate(${frame.ball[0]} ${frame.ball[1]})`} onPointerDown={onBallDown}>
          <circle r={1.8} fill="transparent" />
          <circle r={0.9} fill="#ffffff" stroke="#16201b" strokeWidth={0.22} />
          <path d="M0 -0.42 L0.4 -0.13 L0.25 0.34 L-0.25 0.34 L-0.4 -0.13 Z" fill="#16201b" />
        </g>

      </g>
    </svg>
  );
}
