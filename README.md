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
- Tree-shakable: OGL and Three.js are optional peer dependencies.

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

Install `ogl` for OGL backgrounds and `three` for `NgbLiquidEther`. Both are optional peer
dependencies; only install the engine required by the components you use.

```ts
import { Component } from '@angular/core';
import { NgbAurora } from '@guillermogoni/ng-bits';

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

### Library structure

```text
projects/
├─ ng-bits/                         Publishable Angular library
│  ├─ src/public-api.ts             Public exports
│  ├─ src/lib/core/
│  │  ├─ background-base.ts         Lifecycle, rAF loop, visibility and resize handling
│  │  ├─ ogl-background-base.ts     OGL renderer and shared uniforms
│  │  ├─ color.ts                   Color parsing helpers
│  │  └─ shader-chunks.ts           Shared GLSL noise, UV, color and dithering chunks
│  ├─ src/lib/backgrounds/           One standalone component per background
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

The demo imports the library through the workspace TypeScript path, so shader changes can be
previewed without rebuilding the package. `npm run build:lib` validates the publishable ng-packagr
output.

### Component catalogue

| Engine | Components |
| --- | --- |
| OGL | `NgbAurora`, `NgbSoftAurora`, `NgbIridescence`, `NgbSilk`, `NgbPlasma`, `NgbGrainient`, `NgbLightRays`, `NgbLightPillar`, `NgbPrism`, `NgbOrbitalAtlas`, `NgbFerrofluid`, `NgbPixel`, `NgbPixelBlast`, `NgbThreads` |
| Three.js | `NgbLiquidEther` |
| Canvas 2D | `NgbShapeGrid`, `NgbDotField`, `NgbDotGrid`, `NgbLetterGlitch` |

Selectors use the `ngb-` prefix, for example `NgbAurora` → `<ngb-aurora />`. The complete input
table for each component lives in [`projects/ng-bits/README.md`](projects/ng-bits/README.md) and
in the component source through typed Angular inputs.

### Shared inputs

All backgrounds inherit these lifecycle inputs from `NgbBackgroundBase`:

| Input | Default | Purpose |
| --- | --- | --- |
| `paused` | `false` | Freeze rendering without releasing GPU resources. |
| `maxDpr` | `2` | Cap `devicePixelRatio` to trade sharpness for performance. |
| `pauseWhenHidden` | `true` | Stop rendering while the host is outside the viewport. |
| `reducedMotion` | `'respect'` | Render one static frame when the OS requests reduced motion. |

### Technologies

| Area | Technology | Role |
| --- | --- | --- |
| Framework | Angular 22 | Standalone components, signal inputs, routing and SSR. |
| Language | TypeScript 6 | Typed component APIs and renderer code. |
| OGL | OGL 1.x | Full-screen WebGL fragment backgrounds. |
| 3D | Three.js 0.185.x | GPU fluid simulation for `NgbLiquidEther`. |
| 2D | Canvas 2D API | Lightweight dot, grid and glyph backgrounds. |
| Demo styling | Tailwind CSS 4 | Layout, tokens and responsive UI styling. |
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

1. Add a standalone component under `projects/ng-bits/src/lib/backgrounds/`.
2. Extend `NgbOglBackgroundBase` for a full-screen OGL shader, or `NgbBackgroundBase` for a custom
   Canvas/Three.js renderer.
3. Export the component from `projects/ng-bits/src/public-api.ts`.
4. Add its metadata, defaults and controls to `projects/demo/src/app/registry.ts`.
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
- Tree-shaking y motores opcionales: OGL y Three.js solo son necesarios para los componentes que los usan.

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

Instala `ogl` para los fondos OGL y `three` para `NgbLiquidEther`. Ambos son peer dependencies
opcionales: instala solamente el motor que necesiten los componentes elegidos.

```ts
import { Component } from '@angular/core';
import { NgbAurora } from '@guillermogoni/ng-bits';

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

### Estructura de la librería

La librería publicable está en `projects/ng-bits`. Sus piezas principales son `src/public-api.ts`
(exports públicos), `src/lib/core/` (ciclo de vida, resize, visibilidad, renderers y chunks GLSL)
y `src/lib/backgrounds/` (un componente standalone por fondo). La aplicación demo vive en
`projects/demo/src/app/`: `registry.ts` registra componentes y controles, `pages/` contiene galería
y preview, `shared/` contiene controles reutilizables e `i18n/` contiene las traducciones.

El catálogo actual incluye 14 fondos OGL, `NgbLiquidEther` con Three.js y cuatro fondos Canvas 2D.
La lista completa y los inputs de cada componente están en [`projects/ng-bits/README.md`](projects/ng-bits/README.md).

### Tecnologías

- Angular 22, componentes standalone, signals, router y SSR.
- TypeScript 6.
- OGL 1.x para shaders WebGL a pantalla completa.
- Three.js 0.185.x para la simulación de fluidos de `NgbLiquidEther`.
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

1. Añade un componente standalone en `projects/ng-bits/src/lib/backgrounds/`.
2. Extiende `NgbOglBackgroundBase` para un shader OGL a pantalla completa o `NgbBackgroundBase`
   para un renderer Canvas/Three.js propio.
3. Exporta el componente desde `projects/ng-bits/src/public-api.ts`.
4. Registra nombre, motor, defaults y controles en `projects/demo/src/app/registry.ts`.
5. Documenta sus inputs públicos y comprueba la ruta demo, reduced motion y resize.

### Inspiración y licencia

El proyecto explora técnicas conocidas de gráficos: SDF raymarched, campos de ruido, interferencia
de película delgada, dithering y simulación de fluidos en GPU. Toma inspiración visual de
[ReactBits](https://reactbits.dev), pero sus componentes Angular son implementaciones independientes
con renderers y APIs propios; no se reutiliza código fuente de ReactBits.

Este proyecto se distribuye bajo la [Licencia MIT](LICENSE).
