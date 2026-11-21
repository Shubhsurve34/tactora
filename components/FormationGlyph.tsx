import { FORMATIONS, slotPosition } from "@/lib/board";

/** A tiny pitch with the formation's shape, attacking right. */
export function FormationGlyph({ formation, color }: { formation: string; color: string }) {
  const slots = FORMATIONS[formation] ?? [];
  return (
    <svg className="formation-glyph" viewBox="-3 -3 61 74" aria-hidden="true" focusable="false">
      <rect x={0} y={0} width={55} height={68} rx={3} className="fg-turf" />
      <line x1={0} y1={0.5} x2={55} y2={0.5} className="fg-line" />
      <rect x={13.8} y={52} width={27.4} height={16} className="fg-line" fill="none" />
      {slots.map(([depth, width], i) => {
        // Draw upright: own goal at the bottom, attacking up.
        const [x, y] = slotPosition("home", depth, width);
        const cx = 68 - y;
        const cy = 68 - (x / 52.5) * 66;
        return <circle key={i} cx={(cx / 68) * 55} cy={cy} r={i === 0 ? 3.4 : 4.4} fill={i === 0 ? "currentColor" : color} className={i === 0 ? "fg-keeper" : undefined} />;
      })}
    </svg>
  );
}
