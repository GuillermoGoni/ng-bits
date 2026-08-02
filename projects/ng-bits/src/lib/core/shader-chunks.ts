/**
 * GLSL snippets shared across the shader backgrounds. They are plain strings so
 * a background can compose exactly the helpers it needs and nothing else.
 */

/** Full-screen triangle vertex shader matching OGL's `Triangle` geometry. */
export const NGB_FULLSCREEN_VERTEX = /* glsl */ `
attribute vec2 uv;
attribute vec2 position;

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position, 0.0, 1.0);
}
`;

/** 2D rotation matrix + aspect-corrected uv helpers. */
export const NGB_CHUNK_UV = /* glsl */ `
mat2 ngbRotate(float a) {
  float s = sin(a);
  float c = cos(a);
  return mat2(c, -s, s, c);
}

// Centres uv on 0 and removes the stretch introduced by non-square viewports.
vec2 ngbAspectUv(vec2 uv, vec2 resolution) {
  vec2 p = uv - 0.5;
  p.x *= resolution.x / max(resolution.y, 1.0);
  return p;
}
`;

/** iq-style 2D gradient noise plus fbm. */
export const NGB_CHUNK_NOISE2 = /* glsl */ `
vec2 ngbHash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return -1.0 + 2.0 * fract(sin(p) * 43758.5453123);
}

float ngbNoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(dot(ngbHash2(i + vec2(0.0, 0.0)), f - vec2(0.0, 0.0)),
        dot(ngbHash2(i + vec2(1.0, 0.0)), f - vec2(1.0, 0.0)), u.x),
    mix(dot(ngbHash2(i + vec2(0.0, 1.0)), f - vec2(0.0, 1.0)),
        dot(ngbHash2(i + vec2(1.0, 1.0)), f - vec2(1.0, 1.0)), u.x),
    u.y);
}

float ngbFbm(vec2 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * ngbNoise(p);
    p = ngbRotate(0.5) * p * 2.02;
    amp *= 0.5;
  }
  return sum;
}
`;

/** 3D value noise plus fbm — the cheap way to animate 2D noise over time. */
export const NGB_CHUNK_NOISE3 = /* glsl */ `
float ngbHash13(vec3 p) {
  p = fract(p * 0.1031);
  p += dot(p, p.zyx + 31.32);
  return fract((p.x + p.y) * p.z);
}

float ngbNoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 u = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(mix(ngbHash13(i + vec3(0.0, 0.0, 0.0)), ngbHash13(i + vec3(1.0, 0.0, 0.0)), u.x),
        mix(ngbHash13(i + vec3(0.0, 1.0, 0.0)), ngbHash13(i + vec3(1.0, 1.0, 0.0)), u.x), u.y),
    mix(mix(ngbHash13(i + vec3(0.0, 0.0, 1.0)), ngbHash13(i + vec3(1.0, 0.0, 1.0)), u.x),
        mix(ngbHash13(i + vec3(0.0, 1.0, 1.0)), ngbHash13(i + vec3(1.0, 1.0, 1.0)), u.x), u.y),
    u.z) * 2.0 - 1.0;
}

float ngbFbm3(vec3 p, int octaves) {
  float sum = 0.0;
  float amp = 0.5;
  for (int i = 0; i < 8; i++) {
    if (i >= octaves) break;
    sum += amp * ngbNoise3(p);
    p *= 2.03;
    amp *= 0.5;
  }
  return sum;
}
`;

/** Ordered-ish dithering, used to kill banding in smooth gradients. */
export const NGB_CHUNK_DITHER = /* glsl */ `
// Interleaved gradient noise: one cheap tap, no texture needed.
float ngbDither(vec2 fragCoord) {
  return fract(52.9829189 * fract(dot(fragCoord, vec2(0.06711056, 0.00583715)))) - 0.5;
}
`;

/** Colour-space helpers. */
export const NGB_CHUNK_COLOR = /* glsl */ `
vec3 ngbHueShift(vec3 color, float hue) {
  const vec3 k = vec3(0.57735, 0.57735, 0.57735);
  float c = cos(hue);
  return color * c + cross(k, color) * sin(hue) + k * dot(k, color) * (1.0 - c);
}

vec3 ngbSaturate(vec3 color, float amount) {
  float l = dot(color, vec3(0.2126, 0.7152, 0.0722));
  return mix(vec3(l), color, amount);
}

// Ramp across up to four stops; "count" selects how many are live.
vec3 ngbRamp(vec3 c0, vec3 c1, vec3 c2, vec3 c3, int count, float t) {
  t = clamp(t, 0.0, 1.0);
  // max() has no integer overload in GLSL ES 1.00, so convert first.
  float segments = max(float(count - 1), 1.0);
  float scaled = t * segments;
  float idx = floor(scaled);
  float f = smoothstep(0.0, 1.0, scaled - idx);
  vec3 a = idx < 0.5 ? c0 : (idx < 1.5 ? c1 : c2);
  vec3 b = idx < 0.5 ? c1 : (idx < 1.5 ? c2 : c3);
  return mix(a, b, f);
}
`;
