# Tactora

A football tactics board. Pick a formation for each team, drag players and the ball, draw runs and passes, then share the whole board as a link or save it as an image.

A [ShubhTechIN](https://shubham-portfolio-mu-puce.vercel.app) project, built with Next.js, React and SVG.

## How it works

- **Board:** an SVG pitch measured in metres (105 × 68). On phones it turns upright so players are big enough to drag.
- **Formations:** 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3 and 5-3-2 for either team. Switching keeps player names and numbers.
- **Sharing:** the board is packed into compact JSON, deflated, and put in the URL hash (`#b=…`). Nothing is stored on a server, and the hash never reaches one.
- **Saving:** boards autosave to `localStorage` on the device.
- **Keyboard:** `V` move, `R` run, `P` pass, `E` erase, `Ctrl/Cmd+Z` undo, `Esc` deselect.

## Develop

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # board logic and share-link tests
npm run lint
```

No environment variables are needed.
