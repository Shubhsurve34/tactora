/**
 * Tactora icon set. Drawn on a 24px grid with a 1.7 stroke, round caps and
 * joins, so every icon has the same weight next to the type.
 */

import type { ReactNode, SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function Icon({ size = 20, children, ...rest }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  );
}

/** Pointer with a player disc: pick up and move. */
export const MoveIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 3.5 L5 16.5 L8.6 13.2 L11 18.6 L13.2 17.6 L10.9 12.4 L15.6 12.2 Z" fill="currentColor" fillOpacity={0.12} />
    <circle cx="18" cy="17.5" r="3" />
  </Icon>
);

/** A player's run: one confident curve with a head. */
export const RunIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="18" r="1.8" fill="currentColor" stroke="none" />
    <path d="M6.8 16.6 C 10 11.5, 14 9.5, 18.6 8.6" />
    <path d="M15.6 6 L19.4 8.4 L16.6 11.8" />
  </Icon>
);

/** A pass: the ball's path, dotted, from foot to foot. */
export const PassIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="4.6" cy="17.2" r="2.2" />
    <g fill="currentColor" stroke="none">
      <circle cx="8.6" cy="13.9" r="1" />
      <circle cx="11.6" cy="11.6" r="1" />
      <circle cx="14.8" cy="9.6" r="1" />
    </g>
    <path d="M16.6 5.6 L20.6 7.4 L18.4 11.2" />
  </Icon>
);

/** Pressing trap: closing in on an area. */
export const PressIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="5.5" y="5.5" width="13" height="13" rx="2.5" fill="currentColor" fillOpacity={0.12} />
    <path d="M5.5 12 L2.5 12 M18.5 12 L21.5 12 M12 5.5 L12 2.5 M12 18.5 L12 21.5" />
    <path d="M9 15 L15 9 M9 11 L11 9 M13 15 L15 13" strokeWidth={1.3} />
  </Icon>
);

/** Space to attack: an open area, dashed. */
export const SpaceIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 8 V5.5 A1.5 1.5 0 0 1 5.5 4 H8 M16 4 H18.5 A1.5 1.5 0 0 1 20 5.5 V8 M20 16 V18.5 A1.5 1.5 0 0 1 18.5 20 H16 M8 20 H5.5 A1.5 1.5 0 0 1 4 18.5 V16" />
    <path d="M10 12 H14 M12 10 V14" strokeWidth={1.5} />
  </Icon>
);

/** Man-marking: two players tied together. */
export const MarkIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="6.5" cy="16.5" r="3" fill="currentColor" fillOpacity={0.12} />
    <circle cx="17.5" cy="7.5" r="3" />
    <path d="M9 14 L15 10" strokeDasharray="1.4 2.2" />
  </Icon>
);

export const EraseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M14.6 4.6 L19.4 9.4 A1.6 1.6 0 0 1 19.4 11.6 L11.6 19.4 H7.2 L4.6 16.8 A1.6 1.6 0 0 1 4.6 14.6 Z" />
    <path d="M9.4 9.8 L14.2 14.6" />
    <path d="M11.6 19.4 H20" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 5 L4.5 9 L8.5 13" />
    <path d="M4.5 9 H14.5 A5 5 0 0 1 14.5 19 H9" />
  </Icon>
);

export const PlayIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={0}>
    <path d="M8 5.2 C8 4.4 8.9 3.9 9.6 4.4 L19 10.9 C19.6 11.3 19.6 12.7 19 13.1 L9.6 19.6 C8.9 20.1 8 19.6 8 18.8 Z" fill="currentColor" />
  </Icon>
);

export const PauseIcon = (p: IconProps) => (
  <Icon {...p} strokeWidth={0}>
    <rect x="6.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" />
    <rect x="13.5" y="5" width="4" height="14" rx="1.3" fill="currentColor" />
  </Icon>
);

export const PlusIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M12 5 V19 M5 12 H19" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4.5 7 H19.5" />
    <path d="M9.5 7 V5 A1 1 0 0 1 10.5 4 H13.5 A1 1 0 0 1 14.5 5 V7" />
    <path d="M6.5 7 L7.4 18.6 A1.6 1.6 0 0 0 9 20 H15 A1.6 1.6 0 0 0 16.6 18.6 L17.5 7" />
  </Icon>
);

export const LoopIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M17 3.5 L20 6.5 L17 9.5" />
    <path d="M4 12 V10.5 A4 4 0 0 1 8 6.5 H20" />
    <path d="M7 20.5 L4 17.5 L7 14.5" />
    <path d="M20 12 V13.5 A4 4 0 0 1 16 17.5 H4" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14 A4.2 4.2 0 0 0 16 14 L19 11 A4.2 4.2 0 0 0 13 5 L11.8 6.2" />
    <path d="M14 10 A4.2 4.2 0 0 0 8 10 L5 13 A4.2 4.2 0 0 0 11 19 L12.2 17.8" />
  </Icon>
);

export const ImageIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2.2" />
    <circle cx="9" cy="10" r="1.6" />
    <path d="M20.5 15.5 L15.5 11 L6 19" />
  </Icon>
);

export const VideoIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3" y="6" width="13" height="12" rx="2.2" />
    <path d="M16 10.2 L20.4 7.6 A0.6 0.6 0 0 1 21.3 8.1 V15.9 A0.6 0.6 0 0 1 20.4 16.4 L16 13.8" />
  </Icon>
);

export const NewBoardIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5.5" width="17" height="13" rx="1.8" />
    <path d="M12 5.5 V18.5" />
    <circle cx="12" cy="12" r="2.4" />
  </Icon>
);

export const CloseIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M6 6 L18 18 M18 6 L6 18" />
  </Icon>
);

/* Panel and overlay icons ---------------------------------------------------- */

export const TeamsIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M8.5 4 L5 5.6 L3 9.4 L5.6 10.8 L6.4 9.6 V20 H17.6 V9.6 L18.4 10.8 L21 9.4 L19 5.6 L15.5 4 C15 5.6 13.7 6.6 12 6.6 C10.3 6.6 9 5.6 8.5 4 Z" />
  </Icon>
);

export const AnalysisIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20 V4" />
    <path d="M4 20 H20" />
    <path d="M7 15 L11 10.5 L14 13 L19.5 6.5" />
    <circle cx="19.5" cy="6.5" r="1.3" fill="currentColor" stroke="none" />
  </Icon>
);

export const ControlIcon = (p: IconProps) => (
  <Icon {...p}>
    <rect x="3.5" y="5" width="17" height="14" rx="2" />
    <path d="M9 5 L11 11 L7.5 19 M11 11 L16.5 9 L20.5 12 M16.5 9 L15 5" />
    <path d="M3.5 5 H11 L11 11 L7.5 19 H5.5 A2 2 0 0 1 3.5 17 Z" fill="currentColor" fillOpacity={0.18} stroke="none" />
  </Icon>
);

export const ShapeIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 8 L12 4.5 L19.5 8.5 L18 17 L8 19.5 Z" strokeDasharray="2.2 2" />
    <g fill="currentColor" stroke="none">
      <circle cx="5" cy="8" r="1.6" />
      <circle cx="12" cy="4.5" r="1.6" />
      <circle cx="19.5" cy="8.5" r="1.6" />
      <circle cx="18" cy="17" r="1.6" />
      <circle cx="8" cy="19.5" r="1.6" />
    </g>
  </Icon>
);

export const OffsideIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M13.5 3 V21" strokeDasharray="2.4 2" />
    <circle cx="8" cy="9" r="2.4" />
    <circle cx="18" cy="15" r="2.4" fill="currentColor" fillOpacity={0.2} />
    <path d="M5 4 V8" strokeWidth={1.4} />
    <path d="M5 4 L8.5 5.2 L5 6.4" fill="currentColor" strokeWidth={1.2} />
  </Icon>
);

export const ShadowIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="12" r="1.8" fill="currentColor" stroke="none" />
    <circle cx="11.5" cy="12" r="2.4" />
    <path d="M13.6 10.6 L21 6.5 V17.5 L13.6 13.4" fill="currentColor" fillOpacity={0.2} />
  </Icon>
);

export const LanesIcon = (p: IconProps) => (
  <Icon {...p}>
    <circle cx="5" cy="17" r="2.2" fill="currentColor" fillOpacity={0.2} />
    <circle cx="19" cy="5" r="1.8" />
    <circle cx="19.5" cy="15" r="1.8" />
    <path d="M7 15.6 L17.4 6.2" />
    <path d="M7.2 17 L17.6 15.2" strokeDasharray="1.2 2" />
  </Icon>
);
