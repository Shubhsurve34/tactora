/**
 * Turning the live SVG board into an image or a video.
 *
 * Video is encoded frame by frame at a fixed 30 fps with WebCodecs and
 * muxed into an MP4, so it plays smoothly however long each frame takes to
 * draw. Browsers without WebCodecs fall back to real-time MediaRecorder.
 */

import { ArrayBufferTarget, Muxer } from "mp4-muxer";

/** How long one step takes to play, at 1× speed. */
export const MOVE_MS = 1100;
export const HOLD_MS = 450;
export const END_HOLD_MS = 800;
const FPS = 30;

export function timelineLength(steps: number, speed: number): number {
  if (steps < 2) return 0;
  return ((steps - 1) * (MOVE_MS + HOLD_MS) + END_HOLD_MS) / speed;
}

/** Timeline position (0 … steps - 1) after `ms` of playback. */
export function timelineAt(ms: number, steps: number, speed: number): number {
  const scaled = ms * speed;
  const seg = MOVE_MS + HOLD_MS;
  const i = Math.floor(scaled / seg);
  if (i >= steps - 1) return steps - 1;
  const into = scaled - i * seg;
  return into < HOLD_MS ? i : i + (into - HOLD_MS) / MOVE_MS;
}

type Layer = "all" | "bg" | "fg";

/**
 * Renders the SVG to an image. "bg" keeps only the grass, "fg" drops the
 * grass, so the expensive texture can be drawn once and reused.
 */
export async function svgToImage(svg: SVGSVGElement, width: number, height: number, layer: Layer = "all"): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.querySelectorAll("[data-ui]").forEach((n) => n.remove());
  if (layer === "fg") clone.querySelectorAll("[data-bg]").forEach((n) => n.remove());
  if (layer === "bg") {
    const field = clone.querySelector("[data-field]");
    field?.querySelectorAll(":scope > :not([data-bg])").forEach((n) => n.remove());
  }
  const xml = new XMLSerializer().serializeToString(clone);
  const url = URL.createObjectURL(new Blob([xml], { type: "image/svg+xml" }));
  try {
    const img = new Image();
    img.decoding = "sync";
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("render failed"));
      img.src = url;
    });
    return img;
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Title strip along the bottom of exported images and videos. */
export function drawCaption(ctx: CanvasRenderingContext2D, width: number, height: number, title: string, right: string) {
  const bar = Math.round(height * 0.072);
  const grad = ctx.createLinearGradient(0, height - bar * 1.8, 0, height);
  grad.addColorStop(0, "rgba(9,22,14,0)");
  grad.addColorStop(0.45, "rgba(9,22,14,0.82)");
  grad.addColorStop(1, "rgba(9,22,14,0.92)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, height - bar * 1.8, width, bar * 1.8);
  const size = Math.round(bar * 0.4);
  const pad = Math.round(bar * 0.5);
  const mid = height - bar / 2;
  ctx.textBaseline = "middle";

  // Brand chip
  ctx.font = `800 ${size}px Arial, Helvetica, sans-serif`;
  const brand = "Tactora";
  const bw = ctx.measureText(brand).width + size * 1.1;
  const bh = size * 1.7;
  ctx.fillStyle = "#c8f53c";
  roundRect(ctx, pad, mid - bh / 2, bw, bh, bh / 2);
  ctx.fill();
  ctx.fillStyle = "#16201b";
  ctx.textAlign = "center";
  ctx.fillText(brand, pad + bw / 2, mid + 1);

  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = `700 ${size * 1.05}px Arial, Helvetica, sans-serif`;
  if (title) ctx.fillText(title, pad + bw + pad * 0.7, mid + 1);

  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
  ctx.fillText(right, width - pad, mid + 1);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function download(blob: Blob, name: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

export function slug(title: string): string {
  return (title || "tactora-board").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tactora-board";
}

/** Real-time fallback format. MP4 first, so it plays everywhere. */
function recorderFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options = [
    { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}

export function canRecordVideo(): boolean {
  return typeof VideoEncoder !== "undefined" || recorderFormat() !== null;
}

/** First H.264 profile this browser can encode at this size. */
async function pickAvc(width: number, height: number): Promise<VideoEncoderConfig | null> {
  if (typeof VideoEncoder === "undefined") return null;
  for (const codec of ["avc1.640033", "avc1.640032", "avc1.4d0033", "avc1.42e033", "avc1.42003e"]) {
    const config: VideoEncoderConfig = { codec, width, height, bitrate: 9_000_000, framerate: FPS };
    try {
      const { supported } = await VideoEncoder.isConfigSupported(config);
      if (supported) return config;
    } catch {
      // try the next one
    }
  }
  return null;
}

type RecordOpts = {
  svg: () => SVGSVGElement | null;
  width: number;
  height: number;
  steps: number;
  speed: number;
  title: string;
  show: (t: number) => void;
  onProgress: (fraction: number) => void;
};

/** Plays the timeline through `show(t)` and turns the SVG into a video. `show` must update the SVG synchronously. */
export async function recordVideo(opts: RecordOpts): Promise<{ blob: Blob; ext: string }> {
  const canvas = document.createElement("canvas");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas.");

  const first = opts.svg();
  if (!first) throw new Error("Nothing to record.");
  const bg = await svgToImage(first, opts.width, opts.height, "bg");

  const paint = async (t: number) => {
    opts.show(t);
    const svg = opts.svg();
    if (!svg) return;
    const fg = await svgToImage(svg, opts.width, opts.height, "fg");
    ctx.drawImage(bg, 0, 0, opts.width, opts.height);
    ctx.drawImage(fg, 0, 0, opts.width, opts.height);
    drawCaption(ctx, opts.width, opts.height, opts.title, `Step ${Math.min(opts.steps, Math.floor(t + 0.001) + 1)} of ${opts.steps}`);
  };

  const total = timelineLength(opts.steps, opts.speed) + 500;
  const config = await pickAvc(opts.width, opts.height);

  if (config) {
    const target = new ArrayBufferTarget();
    const muxer = new Muxer({
      target,
      video: { codec: "avc", width: opts.width, height: opts.height, frameRate: FPS },
      fastStart: "in-memory",
    });
    let failure: unknown = null;
    const encoder = new VideoEncoder({
      output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
      error: (e) => {
        failure = e;
      },
    });
    encoder.configure(config);

    const frames = Math.ceil((total / 1000) * FPS);
    for (let i = 0; i < frames; i++) {
      if (failure) break;
      await paint(Math.min(opts.steps - 1, timelineAt((i * 1000) / FPS, opts.steps, opts.speed)));
      const frame = new VideoFrame(canvas, { timestamp: Math.round((i * 1_000_000) / FPS), duration: Math.round(1_000_000 / FPS) });
      encoder.encode(frame, { keyFrame: i % (FPS * 2) === 0 });
      frame.close();
      // Don't let the encoder queue grow without bound on slow machines.
      while (encoder.encodeQueueSize > 4) await new Promise((r) => setTimeout(r, 4));
      opts.onProgress((i + 1) / frames);
    }
    await encoder.flush();
    encoder.close();
    if (failure) throw failure instanceof Error ? failure : new Error("Video encoding failed.");
    muxer.finalize();
    return { blob: new Blob([target.buffer], { type: "video/mp4" }), ext: "mp4" };
  }

  // Fallback: record in real time.
  const format = recorderFormat();
  if (!format) throw new Error("This browser can't record video.");
  const stream = canvas.captureStream(FPS);
  const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));
  await paint(0);
  recorder.start(250);
  const start = performance.now();
  for (;;) {
    const elapsed = performance.now() - start;
    if (elapsed >= total) break;
    await paint(timelineAt(elapsed, opts.steps, opts.speed));
    opts.onProgress(Math.min(1, elapsed / total));
    await new Promise((r) => requestAnimationFrame(r));
  }
  await paint(opts.steps - 1);
  await new Promise((r) => setTimeout(r, 120));
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  await stopped;
  return { blob: new Blob(chunks, { type: format.mime.split(";")[0] }), ext: format.ext };
}
