# ng-bits

Animated WebGL and Canvas 2D backgrounds for Angular 22. `ng-bits` is a collection of standalone,
signal-driven components designed to bring GPU-powered atmosphere to hero sections, dashboards,
landing pages, and experiments.

[English](#english) · [Español](#español)

## English

### What it is

`ng-bits` provides reusable Angular components for animated backgrounds. Each background owns its
renderer and exposes typed signal inputs, so it can be composed like any other standalone Angular
component:

- SSR-safe: browser-only work starts after the first client render.
- Efficient by default: rendering pauses off-screen, in hidden tabs, or when reduced motion is respected.
- Responsive: `ResizeObserver` keeps the canvas and shader resolution in sync.
- Resilient: WebGL context loss is detected and the renderer is rebuilt automatically.
- Tree-shakable: OGL and Three.js backgrounds live in separate entry points
  (`@guillermogoni/ng-bits/ogl`, `@guillermogoni/ng-bits/three`), so importing one engine never
  pulls the other's module into your bundle.

### Quick start

```bash
npm install
npm start
```

The showcase runs at <http://localhost:4200>. It includes the component catalogue, live controls,
copyable Angular snippets, responsive layouts, and English/Spanish interface translations.

To use the library in an Angular application:

```bash
npm install @guillermogoni/ng-bits ogl three
```

Install `ogl` for OGL backgrounds and `three` for `NgbLiquidEther` or `NgbDottedForms`. Both are
optional peer dependencies; only install the engine required by the components you use, and import
from the matching entry point:

- `@guillermogoni/ng-bits` — Canvas 2D backgrounds and the shared base classes, no engine required.
- `@guillermogoni/ng-bits/ogl` — OGL-powered backgrounds. Requires `ogl`.
- `@guillermogoni/ng-bits/three` — Three.js-powered backgrounds (`NgbLiquidEther`, `NgbDottedForms`). Requires `three`.

Each entry point compiles to its own bundle, so `ogl` and `three` are never statically imported by
code you didn't ask for — critical for bundlers (Vite, esbuild) that resolve modules on disk before
tree-shaking, which would otherwise require both packages installed regardless of which one you use.

```ts
import { Component } from '@angular/core';
import { NgbAurora } from '@guillermogoni/ng-bits/ogl';

@Component({
  standalone: true,
  imports: [NgbAurora],
  template: `
    <section class="relative isolate min-h-96 overflow-hidden">
      <ngb-aurora
        class="absolute inset-0 -z-10"
        [colorStops]="['#66a1ff', '#B497CF', '#5227FF']"
        [amplitude]="1.2"
        [blend]="0.5"
        [speed]="1.5"
      />
      <h1 class="relative z-10">Content above the background</h1>
    </section>
  `,
})
export class Hero {}
```

Every background fills its host element. Give the host a size and position the component yourself;
the `-z-10` pattern is safe when the parent creates the intended stacking context.

### Migrating from 0.2.1 or earlier

`0.2.2` split OGL and Three.js backgrounds into their own entry points (`@guillermogoni/ng-bits/ogl`,
`@guillermogoni/ng-bits/three`) so importing one engine never pulls the other into your bundle. If
you imported anything besides `NgbEmbers`, `NgbShapeGrid`, `NgbDotField`, `NgbDotGrid` or
`NgbLetterGlitch` from the package root, update the import path — full diff and details in the
[migration note](projects/ng-bits/README.md#migrating-from-021-or-earlier). This is a breaking
change shipped as a patch release, so pin an exact version if you can't update right away.

### Using with Astro

`ng-bits` components run in Astro as Angular islands via
[`@analogjs/astro-angular`](https://www.npmjs.com/package/@analogjs/astro-angular) — the same
renderer AnalogJS uses internally, though AnalogJS itself (the full Angular meta-framework) is a
separate project where `ng-bits` needs no adapter at all, since an AnalogJS app is just a standard
Angular app. Config, caveats and a working snippet are in the
[Astro section](projects/ng-bits/README.md#using-with-astro) of the package README.

### Library structure

```text
projects/
├─ ng-bits/                         Publishable Angular library, three entry points
│  ├─ src/public-api.ts             Primary entry: core lifecycle + Canvas 2D backgrounds
│  ├─ src/lib/core/
│  │  ├─ background-base.ts         Lifecycle, rAF loop, visibility and resize handling
│  │  ├─ color.ts                   Color parsing helpers
│  │  └─ shader-chunks.ts           Shared GLSL noise, UV, color and dithering chunks
│  ├─ src/lib/backgrounds/           Canvas 2D components (no WebGL engine)
│  ├─ ogl/                           Secondary entry: @guillermogoni/ng-bits/ogl
│  │  └─ src/lib/
│  │     ├─ core/ogl-background-base.ts  OGL renderer and shared uniforms
│  │     └─ backgrounds/             OGL-powered components
│  ├─ three/                         Secondary entry: @guillermogoni/ng-bits/three
│  │  └─ src/lib/backgrounds/        Three.js-powered components
│  ├─ package.json
│  └─ README.md                      Package-level API documentation
└─ demo/                             CSR-by-default showcase with optional SSR
   └─ src/app/
      ├─ registry.ts                 Component catalogue, defaults and control schemas
      ├─ pages/gallery.*              Home/gallery page
      ├─ pages/preview.*              Live background preview and prop controls
      ├─ layout/                     Demo shell and navigation
      ├─ shared/                     Copy button and language switcher
      └─ i18n/                        English and Spanish translations
```

Engine-specific components physically live inside the entry point that owns them (`ogl/`, `three/`),
not in the shared `src/lib/backgrounds/` tree — that separation is what keeps each published bundle
from statically importing an engine it doesn't use. They still reach the shared core (lifecycle,
color helpers, shader chunks) by importing `@guillermogoni/ng-bits` itself, the same way an external
consumer would.

The demo imports the library through the workspace TypeScript path, so shader changes can be
previewed without rebuilding the package. `npm run build:lib` validates the publishable ng-packagr
output.

### Component catalogue

| Engine    | Components                                                                                                                                                                                                                                                             |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| OGL       | `NgbAurora`, `NgbGradientWaves`, `NgbPrismaticCells`, `NgbSoftAurora`, `NgbIridescence`, `NgbOrb`, `NgbSilk`, `NgbPlasma`, `NgbGrainient`, `NgbLightRays`, `NgbLightPillar`, `NgbPrism`, `NgbOrbitalAtlas`, `NgbFerrofluid`, `NgbPixel`, `NgbPixelBlast`, `NgbThreads` |
| Three.js  | `NgbLiquidEther`, `NgbDottedForms`                                                                                                                                                                                                                                     |
| Canvas 2D | `NgbEmbers`, `NgbShapeGrid`, `NgbDotField`, `NgbDotGrid`, `NgbLetterGlitch`                                                                                                                                                                                            |

Selectors use the `ngb-` prefix, for example `NgbAurora` → `<ngb-aurora />`. The complete input
table for each component lives in [`projects/ng-bits/README.md`](projects/ng-bits/README.md) and
in the component source through typed Angular inputs.

### Shared inputs

All backgrounds inherit these lifecycle inputs from `NgbBackgroundBase`:

| Input             | Default     | Purpose                                                      |
| ----------------- | ----------- | ------------------------------------------------------------ |
| `paused`          | `false`     | Freeze rendering without releasing GPU resources.            |
| `maxDpr`          | `2`         | Cap `devicePixelRatio` to trade sharpness for performance.   |
| `pauseWhenHidden` | `true`      | Stop rendering while the host is outside the viewport.       |
| `reducedMotion`   | `'respect'` | Render one static frame when the OS requests reduced motion. |

### Technologies

| Area         | Technology                          | Role                                                                            |
| ------------ | ----------------------------------- | ------------------------------------------------------------------------------- |
| Framework    | Angular 22                          | Standalone components, signal inputs, routing and SSR.                          |
| Language     | TypeScript 6                        | Typed component APIs and renderer code.                                         |
| OGL          | OGL 1.x                             | Full-screen WebGL fragment backgrounds.                                         |
| 3D           | Three.js 0.185.x                    | GPU fluid simulation and point-shell geometry.                                  |
| 2D           | Canvas 2D API                       | Lightweight dot, grid and glyph backgrounds.                                    |
| Demo styling | Tailwind CSS 4                      | Layout, tokens and responsive UI styling.                                       |
| Demo runtime | Angular CSR; optional SSR + Express | Client-only development by default, with server rendering available explicitly. |

### Development commands

```bash
npm start              # Run the client-only showcase at http://localhost:4200
npm run start:ssr      # Run the showcase with SSR
npm run build:lib      # Build the publishable ng-bits library
npm run build:demo     # Build the client-only showcase
npm run build:demo:ssr # Build the SSR showcase
npm run serve:ssr      # Serve the previously built SSR output on port 4000
npm test               # Run the workspace test targets
```

### Creating a background

1. Add a standalone component under the entry point that owns its engine:
   `projects/ng-bits/ogl/src/lib/backgrounds/` for OGL, `projects/ng-bits/three/src/lib/backgrounds/`
   for Three.js, or `projects/ng-bits/src/lib/backgrounds/` for a plain Canvas 2D renderer.
2. Extend `NgbOglBackgroundBase` for a full-screen OGL shader, or `NgbBackgroundBase` for a custom
   Canvas/Three.js renderer. Import shared core symbols (`NgbBackgroundBase`, `NGB_BACKGROUND_STYLES`,
   color helpers, shader chunks) from `@guillermogoni/ng-bits`, not by relative path — the entry
   point's own `rootDir` can't reach outside its folder.
3. Export the component from that entry point's `public-api.ts`.
4. Add its metadata, defaults and controls to `projects/demo/src/app/registry.ts`, importing it from
   `ng-bits`, `ng-bits/ogl`, or `ng-bits/three` to match.
5. Document the public inputs and verify the demo route, reduced-motion behavior and resize behavior.

### Inspiration and licensing

The catalogue explores familiar graphics techniques such as raymarched SDFs, noise fields,
thin-film interference, dithering and GPU fluid simulation. It takes visual inspiration from
[ReactBits](https://reactbits.dev), but the Angular components are independent implementations
with their own renderers and APIs; no ReactBits source code is reused.

This project is released under the [MIT License](LICENSE).

## Español

### Qué es

`ng-bits` es una colección de fondos animados para Angular 22, implementados con WebGL, Three.js y
Canvas 2D. Cada fondo es un componente standalone con inputs basados en signals y una API tipada.

Incluye:

- Compatibilidad con SSR: el trabajo que depende del navegador empieza después del primer render del cliente.
- Pausa automática fuera del viewport, en pestañas ocultas y con `prefers-reduced-motion`.
- Seguimiento responsive mediante `ResizeObserver`.
- Recuperación automática cuando se pierde el contexto WebGL.
- Tree-shaking real: los fondos OGL y Three.js viven en entry points separados
  (`@guillermogoni/ng-bits/ogl`, `@guillermogoni/ng-bits/three`), así que importar un motor nunca
  arrastra el módulo del otro a tu bundle.

### Inicio rápido

```bash
npm install
npm start
```

La galería queda disponible en <http://localhost:4200>. Incluye el catálogo de componentes, controles
en vivo, snippets copiables, diseño responsive y traducciones en inglés y español.

Para usar la librería en una aplicación Angular:

```bash
npm install @guillermogoni/ng-bits ogl three
```

Instala `ogl` para los fondos OGL y `three` para `NgbLiquidEther` o `NgbDottedForms`. Ambos son peer
dependencies opcionales: instala solamente el motor que necesiten los componentes elegidos, e
importa desde el entry point correspondiente:

- `@guillermogoni/ng-bits` — fondos Canvas 2D y las clases base compartidas, sin motor necesario.
- `@guillermogoni/ng-bits/ogl` — fondos con OGL. Requiere `ogl`.
- `@guillermogoni/ng-bits/three` — fondos con Three.js (`NgbLiquidEther`, `NgbDottedForms`). Requiere `three`.

```ts
import { Component } from '@angular/core';
import { NgbAurora } from '@guillermogoni/ng-bits/ogl';

@Component({
  standalone: true,
  imports: [NgbAurora],
  template: `
    <section class="relative isolate min-h-96 overflow-hidden">
      <ngb-aurora
        class="absolute inset-0 -z-10"
        [colorStops]="['#66a1ff', '#B497CF', '#5227FF']"
        [amplitude]="1.2"
        [blend]="0.5"
        [speed]="1.5"
      />
      <h1 class="relative z-10">Contenido sobre el fondo</h1>
    </section>
  `,
})
export class Hero {}
```

Cada fondo ocupa todo el elemento host. Define el tamaño del host y posiciona el componente desde
tu layout; el patrón `-z-10` funciona cuando el padre crea el contexto de capas adecuado.

### Migración desde 0.2.1 o anteriores

`0.2.2` separó los fondos OGL y Three.js en sus propios entry points (`@guillermogoni/ng-bits/ogl`,
`@guillermogoni/ng-bits/three`) para que importar un motor nunca arrastre el otro al bundle. Si
importabas algo más allá de `NgbEmbers`, `NgbShapeGrid`, `NgbDotField`, `NgbDotGrid` o
`NgbLetterGlitch` desde la raíz del paquete, actualiza la ruta de import — el diff completo está en
la [nota de migración](projects/ng-bits/README.md#migración-desde-021-o-anteriores) del README del
paquete. Es un cambio breaking publicado como patch, así que fija una versión exacta si no puedes
actualizar de inmediato.

### Uso con Astro

Los componentes de `ng-bits` corren en Astro como islas Angular mediante
[`@analogjs/astro-angular`](https://www.npmjs.com/package/@analogjs/astro-angular) — el mismo
renderer que usa AnalogJS internamente, aunque AnalogJS en sí (el meta-framework Angular completo)
es un proyecto separado donde `ng-bits` no necesita ningún adaptador, ya que una app de AnalogJS es
simplemente una app Angular estándar. La configuración, las advertencias y un snippet funcional
están en la [sección de Astro](projects/ng-bits/README.md#uso-con-astro) del README del paquete.

### Estructura de la librería

La librería publicable está en `projects/ng-bits` y tiene tres entry points. El primario
(`src/public-api.ts`) expone el ciclo de vida compartido (`src/lib/core/`) y los fondos Canvas 2D
(`src/lib/backgrounds/`), sin depender de ningún motor. `ogl/` y `three/` son entry points
secundarios — cada uno con su propio `public-api.ts` y sus propios componentes bajo `src/lib/` —
que compilan a bundles separados y solo importan el motor que usan. Los componentes de motor
acceden al núcleo compartido importando `@guillermogoni/ng-bits`, igual que lo haría cualquier
consumidor externo. La aplicación demo vive en
`projects/demo/src/app/`: `registry.ts` registra componentes y controles, `pages/` contiene galería
y preview, `shared/` contiene controles reutilizables e `i18n/` contiene las traducciones.

El catálogo actual incluye 17 fondos OGL, dos fondos Three.js y cinco fondos Canvas 2D.
La lista completa y los inputs de cada componente están en [`projects/ng-bits/README.md`](projects/ng-bits/README.md).

### Tecnologías

- Angular 22, componentes standalone, signals, router y SSR.
- TypeScript 6.
- OGL 1.x para shaders WebGL a pantalla completa.
- Three.js 0.185.x para la simulación de fluidos y las geometrías de puntos.
- Canvas 2D para fondos ligeros de puntos, grillas y glifos.
- Tailwind CSS 4 para la interfaz de la demo.
- Angular CSR por defecto; SSR + Express opcional para renderizado en servidor e hidratación.

### Comandos de desarrollo

```bash
npm start              # Ejecuta la demo solo cliente en http://localhost:4200
npm run start:ssr      # Ejecuta la demo con SSR
npm run build:lib      # Compila la librería publicable
npm run build:demo     # Compila la demo solo cliente
npm run build:demo:ssr # Compila la demo SSR
npm run serve:ssr      # Sirve el build SSR previo en el puerto 4000
npm test               # Ejecuta los tests del workspace
```

### Crear un fondo nuevo

1. Añade un componente standalone en el entry point de su motor:
   `projects/ng-bits/ogl/src/lib/backgrounds/` para OGL, `projects/ng-bits/three/src/lib/backgrounds/`
   para Three.js, o `projects/ng-bits/src/lib/backgrounds/` para Canvas 2D puro.
2. Extiende `NgbOglBackgroundBase` para un shader OGL a pantalla completa o `NgbBackgroundBase`
   para un renderer Canvas/Three.js propio. Importa el núcleo compartido desde
   `@guillermogoni/ng-bits`, no por ruta relativa — el `rootDir` del entry point no puede salir de
   su propia carpeta.
3. Exporta el componente desde el `public-api.ts` de ese entry point.
4. Registra nombre, motor, defaults y controles en `projects/demo/src/app/registry.ts`, importándolo
   desde `ng-bits`, `ng-bits/ogl` o `ng-bits/three` según corresponda.
5. Documenta sus inputs públicos y comprueba la ruta demo, reduced motion y resize.

### Inspiración y licencia

El proyecto explora técnicas conocidas de gráficos: SDF raymarched, campos de ruido, interferencia
de película delgada, dithering y simulación de fluidos en GPU. Toma inspiración visual de
[ReactBits](https://reactbits.dev), pero sus componentes Angular son implementaciones independientes
con renderers y APIs propios; no se reutiliza código fuente de ReactBits.

Este proyecto se distribuye bajo la [Licencia MIT](LICENSE).
