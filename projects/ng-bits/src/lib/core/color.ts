/** Linear RGB-ish triplet in 0..1, the form every shader uniform expects. */
export type Rgb = [number, number, number];

const HEX_SHORT = /^#?([a-f\d])([a-f\d])([a-f\d])$/i;
const HEX_LONG = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i;
const RGB_FN = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/i;

/**
 * Parse `#rgb`, `#rrggbb` or `rgb()/rgba()` into 0..1 components.
 * Unparseable input falls back to `fallback` so a typo never blanks the canvas.
 */
export function toRgb(input: string, fallback: Rgb = [1, 1, 1]): Rgb {
  const value = input?.trim() ?? '';

  const long = HEX_LONG.exec(value);
  if (long) {
    return [
      parseInt(long[1], 16) / 255,
      parseInt(long[2], 16) / 255,
      parseInt(long[3], 16) / 255,
    ];
  }

  const short = HEX_SHORT.exec(value);
  if (short) {
    return [
      parseInt(short[1] + short[1], 16) / 255,
      parseInt(short[2] + short[2], 16) / 255,
      parseInt(short[3] + short[3], 16) / 255,
    ];
  }

  const fn = RGB_FN.exec(value);
  if (fn) {
    return [Number(fn[1]) / 255, Number(fn[2]) / 255, Number(fn[3]) / 255];
  }

  return fallback;
}

/** Parse a list of colours, padding with the last valid entry when short. */
export function toRgbList(inputs: readonly string[], length: number, fallback: Rgb = [1, 1, 1]): Rgb[] {
  const parsed = inputs.map((color) => toRgb(color, fallback));
  if (parsed.length === 0) parsed.push(fallback);
  while (parsed.length < length) parsed.push(parsed[parsed.length - 1]);
  return parsed.slice(0, length);
}

/** `rgb()` string for canvas-2d backgrounds, with an optional alpha override. */
export function rgbToCss([r, g, b]: Rgb, alpha = 1): string {
  const to255 = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return alpha >= 1
    ? `rgb(${to255(r)}, ${to255(g)}, ${to255(b)})`
    : `rgba(${to255(r)}, ${to255(g)}, ${to255(b)}, ${alpha})`;
}

/** Component-wise mix, `t` clamped to 0..1. */
export function mixRgb(a: Rgb, b: Rgb, t: number): Rgb {
  const k = Math.max(0, Math.min(1, t));
  return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k];
}
