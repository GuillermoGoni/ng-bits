# ng-bits

Animated WebGL and canvas backgrounds for Angular 22, inspired by [ReactBits](https://reactbits.dev).
Standalone components, signal inputs, SSR-safe.

[English](#ng-bits) · [Español](#español)

```bash
npm i @guillermogoni/ng-bits ogl three
```

`ogl` and `three` are optional peer dependencies — install only what the backgrounds you use need
(the engine is listed per component below). Tree-shaking keeps the one you skip out of your bundle.

## Usage

Every background fills its parent, so position it and put your content above it:

```html
<section class="relative isolate overflow-hidden">
  <ngb-aurora class="absolute inset-0 -z-10" [colorStops]="['#5227ff', '#7cff67', '#5227ff']" />

  <h1>Your content</h1>
</section>
```

```ts
import { NgbAurora } from '@guillermogoni/ng-bits';

@Component({
  imports: [NgbAurora],
  // ...
})
export class Hero {}
```

## Backgrounds

| Component         | Selector            | Engine    | Notes                                              |
| ----------------- | ------------------- | --------- | -------------------------------------------------- |
| `NgbAurora`       | `ngb-aurora`        | OGL       | Soft curtain anchored to the top edge, transparent |
| `NgbSoftAurora`   | `ngb-soft-aurora`   | OGL       | Blurred drifting blobs, transparent                |
| `NgbIridescence`  | `ngb-iridescence`   | OGL       | Thin-film interference bands, opaque               |
| `NgbSilk`         | `ngb-silk`          | OGL       | Satin weave, opaque                                |
| `NgbPlasma`       | `ngb-plasma`        | OGL       | Interfering sine fronts                            |
| `NgbGrainient`    | `ngb-grainient`     | OGL       | Mesh gradient + film grain, opaque                 |
| `NgbLightRays`    | `ngb-light-rays`    | OGL       | God rays from a configurable origin                |
| `NgbLightPillar`  | `ngb-light-pillar`  | OGL       | Vertical volumetric shafts                         |
| `NgbPrism`        | `ngb-prism`         | OGL       | Diffuse spectrum light with a prismatic caustic    |
| `NgbOrbitalAtlas` | `ngb-orbital-atlas` | OGL       | Interrupted orbital arcs with moving satellites    |
| `NgbFerrofluid`   | `ngb-ferrofluid`    | OGL       | Glowing iso-contours over two fused fluid layers   |
| `NgbPixel`        | `ngb-pixel`         | OGL       | Bayer-dithered pixel field, crisp on/off cells     |
| `NgbPixelBlast`   | `ngb-pixel-blast`   | OGL       | Softer sibling: glyphs scale instead of toggling   |
| `NgbThreads`      | `ngb-threads`       | OGL       | Fan of glowing filaments                           |
| `NgbLiquidEther`  | `ngb-liquid-ether`  | Three.js  | Real GPU fluid simulation                          |
| `NgbShapeGrid`    | `ngb-shape-grid`    | Canvas 2D | Drifting tile grid that fills under the pointer    |
| `NgbDotField`     | `ngb-dot-field`     | Canvas 2D | Fine gradient dot grid with a cursor lens bulge    |
| `NgbDotGrid`      | `ngb-dot-grid`      | Canvas 2D | Springy dots, shockwave on click                   |
| `NgbLetterGlitch` | `ngb-letter-glitch` | Canvas 2D | Reshuffling character wall                         |

Each component's inputs are documented on the class — hover them in your editor.

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
3. `NgbFerrofluid` raymarches and is the most demanding background on low-end GPUs.

`NgbOrbitalAtlas` is a lighter geometric option for hero sections: a single
fragment pass with no textures, framebuffers, or raymarching.

## Building your own

The base classes are exported. A new full-screen shader background is a fragment string plus a
uniform map:

```ts
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

## Inspiration and licensing

The catalogue takes visual cues from [ReactBits](https://reactbits.dev), but
each Angular component has an independently designed renderer and an API that
fits the effect instead of mirroring another project's implementation.

These are **independent implementations, not ports.** ReactBits is published under MIT *plus a
Commons Clause* that forbids redistributing its components "whether alone, in a bundle, or as a
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
`NgbLiquidEther`; no necesitas ambos si no utilizas sus respectivos componentes.

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
import { NgbAurora } from '@guillermogoni/ng-bits';

@Component({
  imports: [NgbAurora],
  // ...
})
export class Hero {}
```

### Estructura

- `src/public-api.ts`: exports públicos de la librería.
- `src/lib/core/`: ciclo de vida, resize, visibilidad, renderers OGL y chunks GLSL compartidos.
- `src/lib/backgrounds/`: un componente standalone por fondo.
- `README.md`: API, inputs compartidos, rendimiento y ejemplos.

### Inputs compartidos

Todos los fondos heredan estos inputs de `NgbBackgroundBase`:

| Input | Valor por defecto | Descripción |
| --- | --- | --- |
| `paused` | `false` | Congela el loop sin liberar recursos GPU. |
| `maxDpr` | `2` | Limita el `devicePixelRatio` para mejorar el rendimiento. |
| `pauseWhenHidden` | `true` | Detiene el renderizado fuera del viewport. |
| `reducedMotion` | `'respect'` | Renderiza un frame estático cuando el sistema pide reducir movimiento. |

### Tecnologías y licencia

La librería usa Angular 22 y TypeScript 6. OGL proporciona los shaders WebGL, Three.js la simulación
de fluidos de `NgbLiquidEther` y Canvas 2D los fondos ligeros. La demo usa Tailwind CSS 4, Angular
SSR y Express.

El proyecto se distribuye bajo la [Licencia MIT](../../LICENSE). Las implementaciones son propias;
ReactBits es solo una referencia visual y no se reutiliza su código fuente.
