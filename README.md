# ng-bits — workspace

Angular 22 workspace for **ng-bits**, a library of animated WebGL and canvas backgrounds
inspired by [ReactBits](https://reactbits.dev).

```
projects/
  ng-bits/   the publishable library  (see projects/ng-bits/README.md)
  demo/      the showcase app: gallery + live prop playground (SSR enabled)
```

## Commands

Run the showcase (SSR dev server on http://localhost:4200):

```bash
npm start
```

Build the library into `dist/ng-bits`:

```bash
npm run build:lib
```

Build the showcase:

```bash
npm run build:demo
```

## How it fits together

The demo imports the library through the `ng-bits` TypeScript path, mapped to
`projects/ng-bits/src/public-api.ts` — so editing a shader hot-reloads without a library rebuild.
`npm run build:lib` is what validates the actual packaged output (ng-packagr, partial-Ivy, FESM).

Backgrounds are registered once in [`projects/demo/src/app/registry.ts`](projects/demo/src/app/registry.ts):
name, engine, default props and the control schema the playground panel renders. Adding a background
means writing the component, exporting it from `public-api.ts`, and adding one entry there.

## Stack

- Angular 22 (standalone, zoneless, signal inputs, SSR)
- Tailwind CSS v4 (demo only, via `@tailwindcss/postcss`)
- [OGL](https://github.com/oframe/ogl) for full-screen shader backgrounds (~30 kB)
- [Three.js](https://threejs.org) for `NgbLiquidEther`, which needs render-target ping-pong
