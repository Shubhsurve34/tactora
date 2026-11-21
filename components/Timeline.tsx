"use client";

import { MAX_STEPS } from "@/lib/board";
import { LoopIcon, PauseIcon, PlayIcon, PlusIcon, TrashIcon } from "./Icons";

type Props = {
  steps: number;
  step: number;
  playT: number | null;
  busy: boolean;
  speed: number;
  loop: boolean;
  onPlay: () => void;
  onStop: () => void;
  onGo: (i: number) => void;
  onAdd: () => void;
  onDelete: () => void;
  onSpeed: (s: number) => void;
  onLoop: (on: boolean) => void;
};

const SPEEDS = [0.5, 1, 1.5, 2];

/**
 * Keyframe timeline, as in a video editor: each step is a keyframe on one
 * track, and the playhead travels along it during playback.
 */
export function Timeline(p: Props) {
  const playing = p.playT !== null;
  const last = Math.max(1, p.steps - 1);
  const head = playing ? (p.playT as number) / last : p.steps > 1 ? p.step / last : 0;
  const current = playing ? Math.min(p.steps - 1, Math.floor(p.playT as number)) : p.step;

  return (
    <div className="timeline">
      <button
        type="button"
        className={`play${playing ? " is-on" : ""}`}
        onClick={playing ? p.onStop : p.onPlay}
        disabled={p.busy || p.steps < 2}
        aria-label={playing ? "Pause" : "Play the move"}
        title={p.steps < 2 ? "Add a step to play the move" : "Play or pause (Space)"}
      >
        {playing ? <PauseIcon size={18} /> : <PlayIcon size={18} />}
      </button>

      <div className={`track${p.steps < 2 ? " is-single" : ""}`}>
        <div className="track-rail" aria-hidden="true">
          <div className="track-fill" style={{ width: `${head * 100}%` }} />
        </div>
        {playing && <div className="playhead" style={{ left: `${head * 100}%` }} aria-hidden="true" />}
        <div className="keys" role="tablist" aria-label="Steps">
          {Array.from({ length: p.steps }, (_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              className={`key${i < current || (i === current && !playing) ? " is-past" : ""}`}
              style={{ left: p.steps > 1 ? `${(i / last) * 100}%` : "0%" }}
              aria-selected={current === i}
              aria-label={`Step ${i + 1}`}
              onClick={() => p.onGo(i)}
              disabled={p.busy}
            >
              <span>{i + 1}</span>
            </button>
          ))}
        </div>
        {p.steps < 2 && <p className="track-hint">Add a step, move players, and press play.</p>}
      </div>

      <div className="timeline-tools">
        <button type="button" className="tl-btn tl-add" onClick={p.onAdd} disabled={p.busy || p.steps >= MAX_STEPS} title="Add a step after this one (N)">
          <PlusIcon size={17} />
          <span>Step</span>
        </button>
        <div className="speed" role="radiogroup" aria-label="Playback speed">
          {SPEEDS.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={p.speed === s} onClick={() => p.onSpeed(s)} disabled={p.busy}>
              {s}
              <span className="x">×</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="tl-btn tl-icon"
          aria-pressed={p.loop}
          onClick={() => p.onLoop(!p.loop)}
          disabled={p.busy}
          title={p.loop ? "Loop is on" : "Loop is off"}
          aria-label="Loop playback"
        >
          <LoopIcon size={18} />
        </button>
        <button
          type="button"
          className="tl-btn tl-icon tl-danger"
          onClick={p.onDelete}
          disabled={p.busy || p.steps <= 1}
          title={`Delete step ${p.step + 1}`}
          aria-label={`Delete step ${p.step + 1}`}
        >
          <TrashIcon size={18} />
        </button>
      </div>
    </div>
  );
}
