# Tactora

A football tactics board that does more than arrows. Build a move step by step and play it back, read the shape of both teams in metres, and see who owns the space, all live as you drag players.

A [ShubhTechIN](https://shubham-portfolio-mu-puce.vercel.app) project, built with Next.js, React and SVG. Live at https://tactora-gray.vercel.app

## What it does

**Animated moves**
- Up to 12 steps per move. Add a step, drag players to where they go next, and Tactora animates between steps with easing.
- Faded rings and dotted arrows show where each player came from in the previous step.
- Play, pause, loop, 0.5× to 2× speed.
- Save the move as a smooth 30 fps MP4, encoded in the browser with WebCodecs (real-time recording as a fallback).

**Space control**
- A live Voronoi map of who reaches each patch of grass first, with each team's share of the pitch and of the third it attacks.

**Auto analysis** (all in metres on a 105 × 68 pitch)
- Defensive line height, team width and length, block area.
- Back, midfield and front lines found from the gaps in depth, with the distance between them drawn on the pitch.
- Live offside line for the team on the ball (second-last defender or the ball, never inside the attackers' half), with offside players flagged.

**Pressing and zones**
- Press and space zones, marking links between players.
- Cover shadows: the passing angles each defender blocks from the ball.
- Passing lanes from the ball carrier, open or cut out.

**Sharing**
- The whole board (every step, zone, mark and overlay) is packed, deflated and put in the URL hash. Nothing is stored on a server.
- Boards autosave on the device. PNG export with a caption strip.

## Keyboard

`V` move · `R` run · `P` pass · `Z` press zone · `S` space zone · `M` mark · `E` erase · `Space` play/pause · `←` `→` steps · `N` new step · `Ctrl/Cmd+Z` undo · `Esc` deselect

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # board model, share links and analysis
npm run lint
```

No environment variables are needed.

## Code map

- `lib/board.ts`: board model, formations, steps, interpolation, share-link encoding (v2, still opens v1 links)
- `lib/analysis.ts`: space control, team shape, offside, possession, cover shadows, passing lanes
- `lib/export.ts`: PNG and video export, playback timing
- `components/Pitch.tsx`: the SVG pitch and every overlay
- `components/TacticsBoard.tsx`: state, tools, timeline, panels
