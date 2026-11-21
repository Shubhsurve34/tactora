/**
 * Turning the live SVG board into an image or a video. The video is
 * recorded in real time from a canvas while the move plays, so it matches
 * what the coach sees on screen.
 */

/** How long one step takes to play, at 1× speed. */
export const MOVE_MS = 1100;
export const HOLD_MS = 450;
export const END_HOLD_MS = 800;

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

export async function svgToImage(svg: SVGSVGElement, width: number, height: number): Promise<HTMLImageElement> {
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("width", String(width));
  clone.setAttribute("height", String(height));
  clone.querySelectorAll("[data-ui]").forEach((n) => n.remove());
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
    // The decoded image stays usable after the URL is released.
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

/** Title strip along the bottom of exported images and videos. */
export function drawCaption(ctx: CanvasRenderingContext2D, width: number, height: number, title: string, right: string) {
  const bar = Math.round(height * 0.075);
  ctx.fillStyle = "rgba(22,32,27,0.88)";
  ctx.fillRect(0, height - bar, width, bar);
  const size = Math.round(bar * 0.42);
  ctx.textBaseline = "middle";
  ctx.font = `800 ${size}px Arial, Helvetica, sans-serif`;
  ctx.fillStyle = "#c8f53c";
  ctx.textAlign = "left";
  const pad = Math.round(bar * 0.45);
  ctx.fillText("TACTORA", pad, height - bar / 2);
  const brandW = ctx.measureText("TACTORA").width;
  ctx.fillStyle = "#f7f9f6";
  ctx.font = `600 ${size}px Arial, Helvetica, sans-serif`;
  if (title) ctx.fillText(title, pad + brandW + pad * 0.8, height - bar / 2);
  ctx.textAlign = "right";
  ctx.fillStyle = "rgba(247,249,246,0.7)";
  ctx.fillText(right, width - pad, height - bar / 2);
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

/** Best video format this browser can record. MP4 first, so it plays everywhere. */
export function videoFormat(): { mime: string; ext: string } | null {
  if (typeof MediaRecorder === "undefined") return null;
  const options = [
    { mime: "video/mp4;codecs=avc1.42E01E", ext: "mp4" },
    { mime: "video/mp4", ext: "mp4" },
    { mime: "video/webm;codecs=vp9", ext: "webm" },
    { mime: "video/webm", ext: "webm" },
  ];
  return options.find((o) => MediaRecorder.isTypeSupported(o.mime)) ?? null;
}

const nextFrame = () => new Promise<number>((r) => requestAnimationFrame(r));

/**
 * Plays the timeline through `show(t)` and records the SVG into a video.
 * `show` must update the SVG synchronously.
 */
export async function recordVideo(opts: {
  svg: () => SVGSVGElement | null;
  width: number;
  height: number;
  steps: number;
  speed: number;
  title: string;
  show: (t: number) => void;
  onProgress: (fraction: number) => void;
}): Promise<{ blob: Blob; ext: string }> {
  const format = videoFormat();
  if (!format) throw new Error("This browser can't record video.");

  const canvas = document.createElement("canvas");
  canvas.width = opts.width;
  canvas.height = opts.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("No canvas.");

  const stream = canvas.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType: format.mime, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  const stopped = new Promise<void>((r) => (recorder.onstop = () => r()));

  const total = timelineLength(opts.steps, opts.speed) + 400;

  const paint = async (t: number) => {
    opts.show(t);
    const svg = opts.svg();
    if (!svg) return;
    const img = await svgToImage(svg, opts.width, opts.height);
    ctx.drawImage(img, 0, 0, opts.width, opts.height);
    drawCaption(ctx, opts.width, opts.height, opts.title, `Step ${Math.min(opts.steps, Math.floor(t) + 1)} of ${opts.steps}`);
  };

  // First frame before recording starts, so the video never opens blank.
  await paint(0);
  recorder.start(250);
  const start = performance.now();
  for (;;) {
    const elapsed = performance.now() - start;
    if (elapsed >= total) break;
    await paint(timelineAt(elapsed, opts.steps, opts.speed));
    opts.onProgress(Math.min(1, elapsed / total));
    await nextFrame();
  }
  await paint(opts.steps - 1);
  await new Promise((r) => setTimeout(r, 120));
  recorder.stop();
  stream.getTracks().forEach((t) => t.stop());
  await stopped;
  return { blob: new Blob(chunks, { type: format.mime.split(";")[0] }), ext: format.ext };
}
