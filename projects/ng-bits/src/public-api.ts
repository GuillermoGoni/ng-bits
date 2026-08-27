/*
 * Public API surface of ng-bits.
 *
 * Engine-specific backgrounds live in their own entry points so importing
 * one engine never pulls the other into the module graph:
 * `@guillermogoni/ng-bits/ogl` and `@guillermogoni/ng-bits/three`.
 */

// Core
export * from './lib/core/background-base';
export * from './lib/core/color';
export * from './lib/core/shader-chunks';

// Backgrounds (Canvas 2D — no WebGL engine dependency)
export * from './lib/backgrounds/dot-field/dot-field';
export * from './lib/backgrounds/dot-grid/dot-grid';
export * from './lib/backgrounds/embers/embers';
export * from './lib/backgrounds/letter-glitch/letter-glitch';
export * from './lib/backgrounds/shape-grid/shape-grid';
