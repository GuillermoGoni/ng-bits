# ng-bits

Animated WebGL and canvas backgrounds for Angular 22, inspired by [ReactBits](https://reactbits.dev).
Standalone components, signal inputs, SSR-safe.

[English](#ng-bits) · [Español](#español)

```bash
npm i @guillermogoni/ng-bits ogl three
```

`ogl` and `three` are optional peer dependencies — install only what the backgrounds you use need
(the engine is listed per component below), and import from the matching entry point:

- `@guillermogoni/ng-bits` — the shared base classes and Canvas 2D backgrounds. No engine required.
- `@guillermogoni/ng-bits/ogl` — every OGL-powered background. Requires `ogl`.
- `@guillermogoni/ng-bits/three` — `NgbLiquidEther` and `NgbDottedForms`. Requires `three`.

Each entry point compiles to its own bundle, so `ogl` and `three` are never statically imported by
code you didn't ask for — importing from the wrong root would otherwise require both packages on
disk before a bundler can even start tree-shaking.

## Migrating from 0.2.1 or earlier

`0.2.2` split OGL and Three.js backgrounds into their own entry points (see above) so importing one
engine never pulls the other into your bundle. If you imported anything besides `NgbEmbers`,
`NgbShapeGrid`, `NgbDotField`, `NgbDotGrid` or `NgbLetterGlitch` from the package root, update the
import path:

```diff
- import { NgbAurora } from '@guillermogoni/ng-bits';
+ import { NgbAurora } from '@guillermogoni/ng-bits/ogl';

- import { NgbLiquidEther, NgbDottedForms } from '@guillermogoni/ng-bits';
+ import { NgbLiquidEther, NgbDottedForms } from '@guillermogoni/ng-bits/three';
```

`NgbOglBackgroundBase` and `NgbUniforms` moved to `@guillermogoni/ng-bits/ogl` too, if you extended
them directly. `NgbBackgroundBase` and the Canvas 2D components stay at the package root — nothing to
change for those.

This is a breaking change shipped as a patch release (`0.2.2`), which doesn't follow semver strictly.
If your `package.json` pins a caret range like `^0.2.1`, either pin an exact version or update your
imports before upgrading.

## Usage

Every background fills its parent, so position it and put your content above it:

```html
<section class="relative isolate overflow-hidden">
  <ngb-aurora class="absolute inset-0 -z-10" [colorStops]="['#5227ff', '#7cff67', '#5227ff']" />

  <h1>Your content</h1>
</section>
```

```ts
import { NgbAurora } from '@guillermogoni/ng-bits/ogl';

@Component({
  imports: [NgbAurora],
  // ...
})
export class Hero {}
```

## Backgrounds

| Component           | Selector              | Engine    | Notes                                                  |
| ------------------- | --------------------- | --------- | ------------------------------------------------------ |
| `NgbAurora`         | `ngb-aurora`          | OGL       | Soft curtain anchored to the top edge, transparent     |
| `NgbGradientWaves`  | `ngb-gradient-waves`  | OGL       | Perspective waves fading into coloured haze            |
| `NgbPrismaticCells` | `ngb-prismatic-cells` | OGL       | Dark glass Voronoi cells with spectral edges           |
| `NgbSoftAurora`     | `ngb-soft-aurora`     | OGL       | Blurred drifting blobs, transparent                    |
| `NgbIridescence`    | `ngb-iridescence`     | OGL       | Thin-film interference bands, opaque                   |
| `NgbOrb`            | `ngb-orb`             | OGL       | Spectral shell with a pointer-driven reveal            |
| `NgbSilk`           | `ngb-silk`            | OGL       | Satin weave, opaque                                    |
| `NgbPlasma`         | `ngb-plasma`          | OGL       | Interfering sine fronts                                |
| `NgbGrainient`      | `ngb-grainient`       | OGL       | Mesh gradient + film grain, opaque                     |
| `NgbLightRays`      | `ngb-light-rays`      | OGL       | God rays from a configurable origin                    |
| `NgbLightPillar`    | `ngb-light-pillar`    | OGL       | Vertical volumetric shafts                             |
| `NgbPrism`          | `ngb-prism`           | OGL       | Diffuse spectrum light with a prismatic caustic        |
| `NgbOrbitalAtlas`   | `ngb-orbital-atlas`   | OGL       | Interrupted orbital arcs with moving satellites        |
| `NgbFerrofluid`     | `ngb-ferrofluid`      | OGL       | Glowing iso-contours over two fused fluid layers       |
| `NgbPixel`          | `ngb-pixel`           | OGL       | Bayer-dithered pixel field, crisp on/off cells         |
| `NgbPixelBlast`     | `ngb-pixel-blast`     | OGL       | Softer sibling: glyphs scale instead of toggling       |
| `NgbThreads`        | `ngb-threads`         | OGL       | Fan of glowing filaments                               |
| `NgbLiquidEther`    | `ngb-liquid-ether`    | Three.js  | Real GPU fluid simulation                              |
| `NgbDottedForms`    | `ngb-dotted-forms`    | Three.js  | Rotating point-shell cube, sphere, torus or octahedron |
| `NgbEmbers`         | `ngb-embers`          | Canvas 2D | Rising sparks with wind, turbulence and glow           |
| `NgbShapeGrid`      | `ngb-shape-grid`      | Canvas 2D | Drifting tile grid that fills under the pointer        |
| `NgbDotField`       | `ngb-dot-field`       | Canvas 2D | Fine gradient dot grid with a cursor lens bulge        |
| `NgbDotGrid`        | `ngb-dot-grid`        | Canvas 2D | Springy dots, shockwave on click                       |
| `NgbLetterGlitch`   | `ngb-letter-glitch`   | Canvas 2D | Reshuffling character wall                             |

Each component's inputs are documented on the class — hover them in your editor.

### Embers

`NgbEmbers` is a transparent Canvas 2D layer of small rising sparks. It does not require `ogl` or
`three`, and can be used by itself or composed over another background.

```ts
import { NgbEmbers } from '@guillermogoni/ng-bits';

@Component({
  imports: [NgbEmbers],
  // ...
})
export class Hero {}
```

```html
<section class="relative isolate min-h-96 overflow-hidden bg-black">
  <ngb-embers
    class="absolute inset-0 -z-10"
    [colors]="['#ffb15c', '#ff6b2c', '#ffe1a8']"
    [count]="90"
    [speed]="1"
    [size]="1.6"
    [glow]="1.2"
    [turbulence]="0.8"
    [wind]="0.15"
    [spread]="0.8"
    [opacity]="0.9"
  />

  <h1 class="relative z-10">Your content</h1>
</section>
```

| Input        | Default                             | Description                                            |
| ------------ | ----------------------------------- | ------------------------------------------------------ |
| `colors`     | `['#ffb15c', '#ff6b2c', '#ffe1a8']` | Spark palette.                                         |
| `count`      | `90`                                | Number of live sparks, clamped to `0..500`.            |
| `speed`      | `1`                                 | Ascent and flicker speed.                              |
| `size`       | `1.6`                               | Base spark width in CSS pixels.                        |
| `glow`       | `1.2`                               | Strength of the additive halo.                         |
| `turbulence` | `0.8`                               | Amount of irregular horizontal movement.               |
| `wind`       | `0.15`                              | Horizontal drift; negative values move left.           |
| `spread`     | `0.8`                               | Source width: `0` is centred, `1` uses the full width. |
| `opacity`    | `0.9`                               | Layer opacity from `0` to `1`.                         |

## Shared inputs

Every background inherits these from `NgbBackgroundBase`:

| Input             | Default     | Description                                                   |
| ----------------- | ----------- | ------------------------------------------------------------- |
| `paused`          | `false`     | Freeze the loop without releasing GPU resources.              |
| `maxDpr`          | `2`         | Upper bound on `devicePixelRatio`. Lower it for framerate.    |
| `pauseWhenHidden` | `true`      | Stop rendering while the element is outside the viewport.     |
| `reducedMotion`   | `'respect'` | `'respect'` paints one static frame for reduced-motion users. |

## Behaviour you get for free

- **SSR-safe.** Nothing touches the DOM outside `afterNextRender`; the server emits a bare host
  element and the canvas appears on hydration.
- **Off-screen and background tabs pause.** An `IntersectionObserver` plus `visibilitychange` stop
  the rAF loop, and the loop runs outside the Angular zone.
- **Context-loss recovery.** A lost WebGL context is rebuilt automatically.
- **Resize tracking.** A `ResizeObserver` keeps the backing store matched to the element.

## Performance notes

Backgrounds are full-screen fragment shaders, so cost scales with pixel count, not element count.
If you need frames back:

1. Lower `maxDpr` (`1.5` or even `1` is usually invisible on a background).
2. For `NgbLiquidEther`, drop `simResolution` first — the simulation cost is independent of canvas size.
3. `NgbGradientWaves` raymarches; choose `detail="low"` for gallery grids and lower-end GPUs.
4. For `NgbDottedForms`, lower `density`; its point count grows quadratically for most shapes.

`NgbOrbitalAtlas` is a lighter geometric option for hero sections: a single
fragment pass with no textures, framebuffers, or raymarching.

## Building your own

The base classes are exported — `NgbBackgroundBase` and the shared helpers from the root entry
point, `NgbOglBackgroundBase` from `@guillermogoni/ng-bits/ogl`. A new full-screen shader background
is a fragment string plus a uniform map:

```ts
import { NgbOglBackgroundBase, NgbUniforms } from '@guillermogoni/ng-bits/ogl';

@Component({
  selector: 'ngb-my-thing',
  template: '',
  styles: NGB_BACKGROUND_STYLES,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NgbMyThing extends NgbOglBackgroundBase {
  readonly color = input('#ff0088');

  protected readonly fragment = MY_FRAGMENT; // declares `varying vec2 vUv;`

  protected buildUniforms(): NgbUniforms {
    return { uColor: { value: [1, 0, 0.5] } };
  }

  protected override syncUniforms(): void {
    this.setUniform('uColor', toRgb(this.color()));
  }
}
```

`uTime`, `uResolution` and `uAspect` are maintained for you. Set `trackPointer = true` to receive
`this.pointer`, and the `NGB_CHUNK_*` exports give you noise, colour ramps and dithering.

## Using with Astro

`ng-bits` components render inside Astro as Angular islands through
[`@analogjs/astro-angular`](https://www.npmjs.com/package/@analogjs/astro-angular). Install it
alongside the Angular peers it needs:

```bash
npm i @analogjs/astro-angular @angular/{common,core,compiler,compiler-cli,platform-browser,platform-server} rxjs
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import angular from '@analogjs/astro-angular';

export default defineConfig({
  integrations: [angular()],
  vite: {
    ssr: { noExternal: ['@guillermogoni/ng-bits'] },
  },
});
```

```astro
---
import { NgbAurora } from '@guillermogoni/ng-bits/ogl';
---

<section class="relative h-screen">
  <NgbAurora client:only="angular" colorStops={['#66a1ff', '#B497CF', '#5227FF']} />
</section>
```

Two things worth knowing:

- Use `client:only="angular"`, not `client:load` or `client:visible`. Backgrounds render nothing
  useful on the server anyway — the `isPlatformBrowser` guard skips canvas creation during SSR — so
  server-rendering them first just adds a hydration pass that replaces empty markup with more empty
  markup.
- Give the host element an explicit size. Astro's `<astro-island>` wrapper has no default height,
  and the background fills whatever box it's given (`h-screen`, a fixed height, etc.).

**This is not the same thing as AnalogJS.** [AnalogJS](https://analogjs.org) — the full-stack Angular
meta-framework, built on Vite with file-based routing — is a different project from the Astro
integration above, despite the shared name and maintainer. An AnalogJS app *is* a standard Angular
application, so `ng-bits` needs no adapter there at all: import and use components exactly as in any
Angular project, same as the rest of this README. `@analogjs/astro-angular` is specifically the piece
that lets Angular components run as islands *inside Astro* — that's the integration this section
documents.

## Inspiration and licensing

The catalogue takes visual cues from [ReactBits](https://reactbits.dev), but
each Angular component has an independently designed renderer and an API that
fits the effect instead of mirroring another project's implementation.

These are **independent implementations, not ports.** ReactBits is published under MIT _plus a
Commons Clause_ that forbids redistributing its components "whether alone, in a bundle, or as a
ported version", so none of its source is reused here. What the two projects share are the visual
ideas and the underlying techniques — raymarched SDFs, Bayer dithering, Jacobi pressure solves,
thin-film interference loops — which are long-standing public graphics practice, most of it
traceable to Shadertoy and Inigo Quilez's distance-function articles.

## License / Licencia

MIT

## Español

`ng-bits` es una librería de fondos animados para Angular 22. Incluye componentes standalone para
WebGL/OGL, Three.js y Canvas 2D, con inputs basados en signals y soporte seguro para SSR.

### Instalación

```bash
npm i @guillermogoni/ng-bits ogl three
```

`ogl` y `three` son peer dependencies opcionales. Instala `ogl` para los fondos OGL y `three` para
`NgbLiquidEther` o `NgbDottedForms`; no necesitas ambos si no utilizas sus respectivos componentes.
Importa desde el entry point que corresponda:

- `@guillermogoni/ng-bits` — clases base compartidas y fondos Canvas 2D. Sin motor.
- `@guillermogoni/ng-bits/ogl` — todos los fondos con OGL. Requiere `ogl`.
- `@guillermogoni/ng-bits/three` — `NgbLiquidEther` y `NgbDottedForms`. Requiere `three`.

### Migración desde 0.2.1 o anteriores

`0.2.2` separó los fondos OGL y Three.js en sus propios entry points (ver arriba) para que importar
un motor nunca arrastre el otro al bundle. Si importabas algo más allá de `NgbEmbers`,
`NgbShapeGrid`, `NgbDotField`, `NgbDotGrid` o `NgbLetterGlitch` desde la raíz del paquete, actualiza
la ruta de import:

```diff
- import { NgbAurora } from '@guillermogoni/ng-bits';
+ import { NgbAurora } from '@guillermogoni/ng-bits/ogl';

- import { NgbLiquidEther, NgbDottedForms } from '@guillermogoni/ng-bits';
+ import { NgbLiquidEther, NgbDottedForms } from '@guillermogoni/ng-bits/three';
```

`NgbOglBackgroundBase` y `NgbUniforms` también se movieron a `@guillermogoni/ng-bits/ogl`, si
extendías esas clases directamente. `NgbBackgroundBase` y los componentes Canvas 2D siguen en la
raíz del paquete — no requieren cambios.

Es un cambio breaking publicado como patch (`0.2.2`), que no sigue semver estrictamente. Si tu
`package.json` fija un rango caret como `^0.2.1`, fija una versión exacta o actualiza tus imports
antes de actualizar.

### Uso

Cada fondo ocupa todo su elemento host. El host debe tener tamaño y el contenido debe quedar por
encima mediante el contexto de capas del layout:

```html
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
```

```ts
import { NgbAurora } from '@guillermogoni/ng-bits/ogl';

@Component({
  imports: [NgbAurora],
  // ...
})
export class Hero {}
```

### Embers

`NgbEmbers` es una capa Canvas 2D transparente de pequeñas chispas ascendentes. No necesita `ogl`
ni `three`, y se puede usar sola o combinada con otro fondo.

```ts
import { NgbEmbers } from '@guillermogoni/ng-bits';

@Component({
  imports: [NgbEmbers],
  // ...
})
export class Hero {}
```

```html
<section class="relative isolate min-h-96 overflow-hidden bg-black">
  <ngb-embers
    class="absolute inset-0 -z-10"
    [colors]="['#ffb15c', '#ff6b2c', '#ffe1a8']"
    [count]="90"
    [speed]="1"
    [size]="1.6"
    [glow]="1.2"
    [turbulence]="0.8"
    [wind]="0.15"
    [spread]="0.8"
    [opacity]="0.9"
  />

  <h1 class="relative z-10">Tu contenido</h1>
</section>
```

| Input        | Valor inicial                       | Descripción                                                     |
| ------------ | ----------------------------------- | --------------------------------------------------------------- |
| `colors`     | `['#ffb15c', '#ff6b2c', '#ffe1a8']` | Paleta de las chispas.                                          |
| `count`      | `90`                                | Cantidad de chispas, limitada al rango `0..500`.                |
| `speed`      | `1`                                 | Velocidad de ascenso y titileo.                                 |
| `size`       | `1.6`                               | Ancho base de cada chispa en píxeles CSS.                       |
| `glow`       | `1.2`                               | Intensidad del halo aditivo.                                    |
| `turbulence` | `0.8`                               | Cantidad de movimiento horizontal irregular.                    |
| `wind`       | `0.15`                              | Deriva horizontal; los valores negativos mueven a la izquierda. |
| `spread`     | `0.8`                               | Ancho del origen: `0` lo centra y `1` ocupa todo el ancho.      |
| `opacity`    | `0.9`                               | Opacidad de la capa entre `0` y `1`.                            |

### Estructura

- `src/public-api.ts`: entry point primario — ciclo de vida compartido y fondos Canvas 2D.
- `src/lib/core/`: ciclo de vida, resize, visibilidad y chunks GLSL compartidos.
- `src/lib/backgrounds/`: componentes Canvas 2D, sin motor.
- `ogl/`: entry point secundario `@guillermogoni/ng-bits/ogl` — renderer OGL y sus componentes.
- `three/`: entry point secundario `@guillermogoni/ng-bits/three` — componentes con Three.js.
- `README.md`: API, inputs compartidos, rendimiento y ejemplos.

### Inputs compartidos

Todos los fondos heredan estos inputs de `NgbBackgroundBase`:

| Input             | Valor por defecto | Descripción                                                            |
| ----------------- | ----------------- | ---------------------------------------------------------------------- |
| `paused`          | `false`           | Congela el loop sin liberar recursos GPU.                              |
| `maxDpr`          | `2`               | Limita el `devicePixelRatio` para mejorar el rendimiento.              |
| `pauseWhenHidden` | `true`            | Detiene el renderizado fuera del viewport.                             |
| `reducedMotion`   | `'respect'`       | Renderiza un frame estático cuando el sistema pide reducir movimiento. |

### Uso con Astro

Los componentes de `ng-bits` se renderizan en Astro como islas Angular mediante
[`@analogjs/astro-angular`](https://www.npmjs.com/package/@analogjs/astro-angular). Instálalo junto
a los peers de Angular que necesita:

```bash
npm i @analogjs/astro-angular @angular/{common,core,compiler,compiler-cli,platform-browser,platform-server} rxjs
```

```js
// astro.config.mjs
import { defineConfig } from 'astro/config';
import angular from '@analogjs/astro-angular';

export default defineConfig({
  integrations: [angular()],
  vite: {
    ssr: { noExternal: ['@guillermogoni/ng-bits'] },
  },
});
```

```astro
---
import { NgbAurora } from '@guillermogoni/ng-bits/ogl';
---

<section class="relative h-screen">
  <NgbAurora client:only="angular" colorStops={['#66a1ff', '#B497CF', '#5227FF']} />
</section>
```

Dos cosas a tener en cuenta:

- Usa `client:only="angular"`, no `client:load` ni `client:visible`. Los fondos no renderizan nada
  útil en el servidor de todas formas — el guard `isPlatformBrowser` evita crear el canvas durante
  SSR —, así que renderizarlos primero en servidor solo agrega una hidratación que reemplaza marcado
  vacío por más marcado vacío.
- Dale al elemento host un tamaño explícito. El wrapper `<astro-island>` de Astro no tiene alto por
  defecto, y el fondo llena la caja que le den (`h-screen`, una altura fija, etc.).

**Esto no es lo mismo que AnalogJS.** [AnalogJS](https://analogjs.org) — el meta-framework fullstack
de Angular, construido sobre Vite con ruteo por archivos — es un proyecto distinto de la integración
de Astro de arriba, aunque compartan nombre y mantenedor. Una app de AnalogJS *es* una aplicación
Angular estándar, así que `ng-bits` no necesita ningún adaptador ahí: los componentes se importan y
usan igual que en cualquier proyecto Angular, como el resto de este README. `@analogjs/astro-angular`
es específicamente la pieza que permite que componentes Angular corran como islas *dentro de
Astro* — esa es la integración que documenta esta sección.

### Tecnologías y licencia

La librería usa Angular 22 y TypeScript 6. OGL proporciona los shaders WebGL, Three.js la simulación
de fluidos y las geometrías de puntos, y Canvas 2D los fondos ligeros. La demo usa Tailwind CSS 4,
Angular SSR y Express.

El proyecto se distribuye bajo la [Licencia MIT](../../LICENSE). Las implementaciones son propias;
ReactBits es solo una referencia visual y no se reutiliza su código fuente.
