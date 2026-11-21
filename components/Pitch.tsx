"use client";

import type { RefObject } from "react";
import type { Board, Drawing, Frame, XY, Zone } from "@/lib/board";
import { PITCH_H, PITCH_W } from "@/lib/board";
import { cometPath, curvePath, darken, lighten, passStroke, runStroke, textOn } from "@/lib/strokes";
import type { Analysis } from "./useAnalysis";

export const PAD = 4;

type Props = {
  board: Board;
  frame: Frame;
  prevFrame: Frame | null;
  step: number;
  playing: boolean;
  vertical: boolean;
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

const pts = (points: XY[]) => points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(" ");

const DISPLAY = "'Anybody Variable', Anybody, 'Arial Narrow', Arial, sans-serif";
const BODY = "'Hanken Grotesk', Arial, Helvetica, sans-serif";
const OFFSIDE = "#ffd60a";
const RUN = "#ffffff";
const PASS = "#d9ff5c";
const LINE = "rgba(255,255,255,0.88)";

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
  const teamKey = (id: string) => (id[0] === "h" ? "home" : "away");
  const color = (id: string) => board[teamKey(id)].color;
  const posOf = (id: string) => frame.pos[id];

  const lines = board.drawings.filter((d) => d.step === step);
  if (draftLine) lines.push(draftLine);
  const zones = draftZone ? [...board.zones, draftZone] : board.zones;
  const offsideIds = new Set(overlays.offside ? analysis.offside.flatMap((o) => o.offside) : []);

  const W = PITCH_W + PAD * 2;
  const H = PITCH_H + PAD * 2;

  return (
    <svg
      ref={svgRef}
      className="pitch"
      viewBox={vertical ? `${-PAD} ${-PAD} ${H} ${W}` : `${-PAD} ${-PAD} ${W} ${H}`}
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={`${board.home.name} ${board.home.formation}${board.away.shown ? ` against ${board.away.name} ${board.away.formation}` : ""}, step ${step + 1} of ${board.frames.length}`}
      onPointerDown={onPitchDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <defs>
        {/* Grass: mown stripes, fine texture and floodlight falloff */}
        <linearGradient id="turf" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#2b9159" />
          <stop offset="1" stopColor="#21804b" />
        </linearGradient>
        <radialGradient id="flood" cx="50%" cy="46%" r="70%">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.10" />
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#03160c" stopOpacity="0.42" />
        </radialGradient>
        <filter id="grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.6" numOctaves="2" seed="7" result="n" />
          <feColorMatrix in="n" values="0 0 0 0 0.05  0 0 0 0 0.25  0 0 0 0 0.12  0 0 0 0.55 -0.12" />
        </filter>
        <pattern id="net" width="0.6" height="0.6" patternUnits="userSpaceOnUse">
          <path d="M0 0 L0.6 0.6 M0.6 0 L0 0.6" stroke="rgba(255,255,255,0.45)" strokeWidth="0.06" />
        </pattern>

        {/* Kits: lit from the top left like a broadcast graphic */}
        {(["home", "away"] as const).map((t) => (
          <radialGradient key={t} id={`kit-${t}`} cx="34%" cy="28%" r="78%">
            <stop offset="0" stopColor={lighten(board[t].color, 0.32)} />
            <stop offset="0.55" stopColor={board[t].color} />
            <stop offset="1" stopColor={darken(board[t].color, 0.32)} />
          </radialGradient>
        ))}
        <radialGradient id="ball" cx="38%" cy="32%" r="70%">
          <stop offset="0" stopColor="#ffffff" />
          <stop offset="0.7" stopColor="#eef0ee" />
          <stop offset="1" stopColor="#b9c0bc" />
        </radialGradient>

        <filter id="lift" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0.28" dy="0.5" stdDeviation="0.38" floodColor="#021208" floodOpacity="0.55" />
        </filter>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="0.32" result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
        <filter id="soft" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur stdDeviation="0.7" />
        </filter>
        <filter id="haze" x="0" y="0" width="100%" height="100%">
          <feGaussianBlur stdDeviation="1.1" />
        </filter>

        <pattern id="hatch-press" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <rect width="1.6" height="1.6" fill="rgba(255,72,52,0.16)" />
          <rect width="0.42" height="1.6" fill="rgba(255,96,74,0.5)" />
        </pattern>
        <clipPath id="pitch-clip">
          <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
        </clipPath>

        {/* Trails from the previous step */}
        {prevFrame &&
          !playing &&
          visible.map((p) => {
            const a = prevFrame.pos[p.id];
            const b = posOf(p.id);
            if (!a || !b) return null;
            return (
              <linearGradient key={p.id} id={`trail-${p.id}`} gradientUnits="userSpaceOnUse" x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}>
                <stop offset="0" stopColor="#ffffff" stopOpacity="0" />
                <stop offset="1" stopColor={lighten(color(p.id), 0.6)} stopOpacity="0.6" />
              </linearGradient>
            );
          })}
      </defs>

      <g ref={fieldRef} data-field transform={vertical ? `translate(${PITCH_H} 0) rotate(90)` : undefined}>
        {/* Turf. Tagged so video export can render it once and reuse it. */}
        <g data-bg>
          <rect x={-PAD} y={-PAD} width={W} height={H} fill="url(#turf)" />
          {Array.from({ length: 14 }, (_, i) => (
            <rect key={i} x={-PAD + (W / 14) * i} y={-PAD} width={W / 14} height={H} fill={i % 2 ? "#ffffff" : "#000000"} opacity={i % 2 ? 0.045 : 0.035} />
          ))}
          <rect x={-PAD} y={-PAD} width={W} height={H} filter="url(#grain)" opacity={0.7} />
          <rect x={-PAD} y={-PAD} width={W} height={H} fill="url(#flood)" />
        </g>

        {/* Space control: soft-edged, like a heat map */}
        {overlays.control && analysis.control && (
          <g className="overlay-control" clipPath="url(#pitch-clip)" pointerEvents="none">
            {/* Knock the grass back first so team colours read true, not muddy. */}
            <rect x={0} y={0} width={PITCH_W} height={PITCH_H} fill="#0c2016" opacity={0.42} />
            <g filter="url(#haze)" opacity={0.62}>
              {analysis.control.cells.map((c) => (
                <polygon key={c.id} points={pts(c.points)} fill={lighten(color(c.id), 0.08)} />
              ))}
            </g>
            <g fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={0.12}>
              {analysis.control.cells.map((c) => (
                <polygon key={c.id} points={pts(c.points)} />
              ))}
            </g>
          </g>
        )}

        {/* Zones */}
        {zones.map((z) => {
          const press = z.kind === "press";
          const lx = z.x + 1.1;
          const ly = vertical ? z.y + z.h - 1.1 : z.y + 1.1;
          return (
            <g key={z.id} className="zone" onPointerDown={(e) => onErase(e, "zone", z.id)}>
              <rect
                x={z.x}
                y={z.y}
                width={z.w}
                height={z.h}
                rx={1.4}
                fill={press ? "url(#hatch-press)" : "rgba(217,255,92,0.14)"}
                stroke={press ? "rgba(255,110,88,0.95)" : "rgba(217,255,92,0.95)"}
                strokeWidth={0.28}
                strokeDasharray={press ? undefined : "1.2 0.8"}
              />
              {z.w > 7 && z.h > 4 && (
                <g transform={`translate(${lx} ${ly})${upright}`}>
                  <rect x={0} y={vertical ? -2.4 : 0} width={press ? 6.2 : 6.6} height={2.4} rx={1.2} fill={press ? "rgba(214,52,32,0.92)" : "rgba(22,32,27,0.82)"} />
                  <text
                    x={press ? 3.1 : 3.3}
                    y={vertical ? -1.2 : 1.2}
                    textAnchor="middle"
                    dominantBaseline="central"
                    fontSize={1.45}
                    fontWeight={700}
                    fontFamily={BODY}
                    fill={press ? "#ffffff" : PASS}
                  >
                    {press ? "Press" : "Space"}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Markings */}
        <g fill="none" stroke={LINE} strokeWidth={0.24} pointerEvents="none">
          <rect x={0} y={0} width={PITCH_W} height={PITCH_H} />
          <line x1={PITCH_W / 2} y1={0} x2={PITCH_W / 2} y2={PITCH_H} />
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={9.15} />
          {[0, 1].map((side) => {
            const box = (depth: number, width: number) => (
              <rect x={side ? PITCH_W - depth : 0} y={(PITCH_H - width) / 2} width={depth} height={width} />
            );
            const arcX = side ? PITCH_W - 16.5 : 16.5;
            const dy = Math.sqrt(9.15 ** 2 - 5.5 ** 2);
            const cx = side ? PITCH_W : 0;
            return (
              <g key={side}>
                {box(16.5, 40.32)}
                {box(5.5, 18.32)}
                <path d={`M ${arcX} ${PITCH_H / 2 - dy} A 9.15 9.15 0 0 ${side ? 0 : 1} ${arcX} ${PITCH_H / 2 + dy}`} />
                <path d={`M ${cx} 1 A 1 1 0 0 ${side ? 1 : 0} ${side ? cx - 1 : 1} 0`} />
                <path d={`M ${side ? cx - 1 : 1} ${PITCH_H} A 1 1 0 0 ${side ? 1 : 0} ${cx} ${PITCH_H - 1}`} />
                <rect
                  x={side ? PITCH_W : -1.8}
                  y={(PITCH_H - 7.32) / 2}
                  width={1.8}
                  height={7.32}
                  fill="url(#net)"
                  stroke="rgba(255,255,255,0.95)"
                  strokeWidth={0.22}
                />
              </g>
            );
          })}
        </g>
        <g fill={LINE} pointerEvents="none">
          <circle cx={PITCH_W / 2} cy={PITCH_H / 2} r={0.32} />
          <circle cx={11} cy={PITCH_H / 2} r={0.28} />
          <circle cx={PITCH_W - 11} cy={PITCH_H / 2} r={0.28} />
        </g>

        {/* Team shape */}
        {overlays.shape &&
          analysis.shapes.map((s) => (
            <g key={s.team} pointerEvents="none">
              <polygon
                points={pts(s.hull)}
                fill={board[s.team].color}
                fillOpacity={0.14}
                stroke={lighten(board[s.team].color, 0.3)}
                strokeOpacity={0.95}
                strokeWidth={0.26}
                strokeDasharray="1 0.6"
                strokeLinejoin="round"
              />
              {s.lines.map((l, i) => (
                <line key={i} x1={l.x} x2={l.x} y1={l.minY - 1.6} y2={l.maxY + 1.6} stroke="rgba(255,255,255,0.5)" strokeWidth={0.55} strokeLinecap="round" />
              ))}
              {s.gaps.map((g, i) => {
                const a = s.lines[i];
                const b = s.lines[i + 1];
                const x = (a.x + b.x) / 2;
                const y = Math.max(2.2, Math.min(a.minY, b.minY) - 2.4);
                const half = Math.abs(b.x - a.x) / 2 - 0.4;
                return (
                  <g key={`g${i}`}>
                    <line x1={x - half} x2={x + half} y1={y} y2={y} stroke="rgba(255,255,255,0.6)" strokeWidth={0.14} />
                    <line x1={x - half} x2={x - half} y1={y - 0.5} y2={y + 0.5} stroke="rgba(255,255,255,0.6)" strokeWidth={0.14} />
                    <line x1={x + half} x2={x + half} y1={y - 0.5} y2={y + 0.5} stroke="rgba(255,255,255,0.6)" strokeWidth={0.14} />
                    <g transform={`translate(${x} ${y})${upright}`}>
                      <rect x={-3} y={-1.3} width={6} height={2.6} rx={1.3} fill="rgba(12,24,17,0.88)" />
                      <text textAnchor="middle" dominantBaseline="central" fontSize={1.7} fontWeight={800} fontFamily={DISPLAY} fontStretch="75%" fill="#ffffff">
                        {Math.round(g)}m
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          ))}

        {/* Cover shadows */}
        {overlays.shadows && (
          <g clipPath="url(#pitch-clip)" pointerEvents="none" filter="url(#soft)">
            {analysis.shadows.map((s) => (
              <polygon key={s.id} points={pts(s.points)} fill="rgba(3,16,9,0.4)" />
            ))}
          </g>
        )}

        {/* Offside lines */}
        {overlays.offside &&
          analysis.offside.map((o) => (
            <g key={o.attacking} pointerEvents="none">
              <rect x={o.x - 0.7} y={0} width={1.4} height={PITCH_H} fill={OFFSIDE} opacity={0.14} />
              <line x1={o.x} x2={o.x} y1={0} y2={PITCH_H} stroke={OFFSIDE} strokeWidth={0.6} opacity={0.35} filter="url(#soft)" />
              <line x1={o.x} x2={o.x} y1={0} y2={PITCH_H} stroke={OFFSIDE} strokeWidth={0.22} />
              <g transform={`translate(${o.x} ${PITCH_H - 2.6})${upright}`}>
                <rect x={-4.6} y={-1.3} width={9.2} height={2.6} rx={1.3} fill={OFFSIDE} />
                <text textAnchor="middle" dominantBaseline="central" fontSize={1.45} fontWeight={700} fontFamily={BODY} fill="#16201b">
                  Offside line
                </text>
              </g>
            </g>
          ))}

        {/* Passing lanes */}
        {overlays.lanes && (
          <g pointerEvents="none">
            {analysis.lanes
              .filter((l) => !l.open)
              .map((l) => (
                <line key={l.to} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(255,96,74,0.85)" strokeWidth={0.2} strokeDasharray="0.5 0.55" strokeLinecap="round" />
              ))}
            <g filter="url(#glow)">
              {analysis.lanes
                .filter((l) => l.open)
                .map((l) => (
                  <line key={l.to} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke={PASS} strokeOpacity={0.85} strokeWidth={0.26} strokeLinecap="round" />
                ))}
            </g>
          </g>
        )}

        {/* Where everyone came from */}
        {prevFrame && !playing && (
          <g pointerEvents="none">
            {visible.map((p) => {
              const a = prevFrame.pos[p.id];
              const b = posOf(p.id);
              if (!a || !b || Math.hypot(b[0] - a[0], b[1] - a[1]) < 1) return null;
              return (
                <g key={p.id}>
                  <circle cx={a[0]} cy={a[1]} r={2.05} fill="rgba(255,255,255,0.08)" stroke="rgba(255,255,255,0.55)" strokeWidth={0.16} strokeDasharray="0.45 0.35" />
                  <path d={cometPath({ x: a[0], y: a[1] }, { x: b[0], y: b[1] }, 2.4)} fill={`url(#trail-${p.id})`} />
                </g>
              );
            })}
            {Math.hypot(frame.ball[0] - prevFrame.ball[0], frame.ball[1] - prevFrame.ball[1]) > 1 &&
              passStroke({ x: prevFrame.ball[0], y: prevFrame.ball[1] }, { x: frame.ball[0], y: frame.ball[1] }).dots.map((d, i) => (
                <circle key={i} cx={d.x} cy={d.y} r={0.16} fill="#ffffff" opacity={0.55} />
              ))}
          </g>
        )}

        {/* Runs and passes for this step */}
        <g filter="url(#glow)">
          {lines.map((d) => {
            const a = { x: d.x1, y: d.y1 };
            const b = { x: d.x2, y: d.y2 };
            const s = d.kind === "run" ? runStroke(a, b) : passStroke(a, b);
            const fill = d.kind === "run" ? RUN : PASS;
            return (
              <g key={d.id} className="drawing" onPointerDown={(e) => onErase(e, "drawing", d.id)}>
                <path d={curvePath(a, b, d.kind === "run" ? 0.12 : 0.08)} stroke="transparent" strokeWidth={2.6} fill="none" />
                {s.body && <path d={s.body} fill={fill} />}
                {s.dots.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r={0.3} fill={fill} />
                ))}
                <path d={s.head} fill={fill} />
              </g>
            );
          })}
        </g>

        {/* Marking links */}
        <g>
          {board.marks.map((m) => {
            const a = posOf(m.from);
            const b = posOf(m.to);
            if (!a || !b) return null;
            const path = curvePath({ x: a[0], y: a[1] }, { x: b[0], y: b[1] }, 0.16);
            return (
              <g key={m.id} className="mark" onPointerDown={(e) => onErase(e, "mark", m.id)}>
                <path d={path} stroke="transparent" strokeWidth={2.2} fill="none" />
                <path d={path} stroke="rgba(10,24,16,0.35)" strokeWidth={0.5} fill="none" />
                <path d={path} stroke="#ffffff" strokeWidth={0.22} fill="none" strokeDasharray="0.15 0.6" strokeLinecap="round" />
              </g>
            );
          })}
          {draftMark && posOf(draftMark.from) && (
            <path
              d={curvePath({ x: posOf(draftMark.from)[0], y: posOf(draftMark.from)[1] }, { x: draftMark.x, y: draftMark.y }, 0.16)}
              stroke="#ffffff"
              strokeWidth={0.22}
              fill="none"
              strokeDasharray="0.15 0.6"
              strokeLinecap="round"
              pointerEvents="none"
            />
          )}
        </g>

        {/* Players */}
        {visible.map((p) => {
          const at = posOf(p.id);
          if (!at) return null;
          const team = teamKey(p.id);
          const base = board[team].color;
          const isSel = p.id === selected;
          const flagged = offsideIds.has(p.id);
          const carrier = analysis.possession?.carrier === p.id && overlays.lanes;
          return (
            <g key={p.id} className="player" transform={`translate(${at[0]} ${at[1]})${upright}`} onPointerDown={(e) => onPlayerDown(e, p.id)}>
              <circle r={3.3} fill="transparent" />
              {flagged && (
                <>
                  <circle r={3.1} fill={OFFSIDE} opacity={0.22} />
                  <circle r={2.75} fill="none" stroke={OFFSIDE} strokeWidth={0.32} />
                </>
              )}
              {carrier && <circle r={2.85} fill="none" stroke={PASS} strokeWidth={0.26} strokeDasharray="0.55 0.4" />}
              {isSel && <circle data-ui r={3.05} fill="none" stroke={PASS} strokeWidth={0.38} className="select-ring" />}
              <g filter="url(#lift)">
                <circle r={2.15} fill={`url(#kit-${team})`} />
              </g>
              <circle r={2.02} fill="none" stroke="rgba(255,255,255,0.95)" strokeWidth={0.26} />
              <path d="M-1.35 -1.1 A1.75 1.75 0 0 1 1.1 -1.5" stroke="#ffffff" strokeOpacity={0.45} strokeWidth={0.3} fill="none" strokeLinecap="round" />
              <text y={0.05} textAnchor="middle" dominantBaseline="central" fontSize={2.35} fontWeight={850} fontFamily={DISPLAY} fontStretch="72%" fill={textOn(base)}>
                {p.num}
              </text>
              {p.name && (
                <g transform="translate(0 3.85)">
                  <rect x={-(p.name.length * 0.48 + 1.1)} y={-1.05} width={p.name.length * 0.96 + 2.2} height={2.1} rx={1.05} fill="rgba(10,22,15,0.82)" />
                  <text textAnchor="middle" dominantBaseline="central" fontSize={1.4} fontWeight={700} fontFamily={BODY} fill="#ffffff">
                    {p.name}
                  </text>
                </g>
              )}
            </g>
          );
        })}

        {/* Ball */}
        <g className="ball" transform={`translate(${frame.ball[0]} ${frame.ball[1]})`} onPointerDown={onBallDown}>
          <circle r={1.9} fill="transparent" />
          <ellipse cx={0.35} cy={0.7} rx={0.95} ry={0.55} fill="rgba(2,18,8,0.4)" filter="url(#soft)" />
          <circle r={0.92} fill="url(#ball)" stroke="#2b302d" strokeWidth={0.08} />
          <path d="M0 -0.38 L0.36 -0.12 L0.22 0.31 L-0.22 0.31 L-0.36 -0.12 Z" fill="#1d2320" />
          <path d="M0 -0.38 L0 -0.86 M0.36 -0.12 L0.82 -0.27 M0.22 0.31 L0.5 0.7 M-0.22 0.31 L-0.5 0.7 M-0.36 -0.12 L-0.82 -0.27" stroke="#1d2320" strokeWidth={0.09} />
        </g>
      </g>
    </svg>
  );
}
