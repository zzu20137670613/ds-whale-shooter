/**
 * Types for legacy-color.mjs, so the tests can import it under `strict`.
 */

export interface Rgba {
    rgb: [number, number, number];
    alpha: number;
}

/** OKLCH -> sRGB. `lightness` is 0..1; `hueDegrees` is degrees. */
export declare function oklchToSrgb(
    lightness: number,
    chroma: number,
    hueDegrees: number,
): [number, number, number];

/** Resolve `var(--x)`, `#hex`, `rgb()`, `oklch()`, or a plain name. Null when unknowable. */
export declare function resolveColorToken(
    token: string,
    variables: Map<string, string>,
): Rgba | null;

/** `{ rgb, alpha }` -> `rgb(r g b)` or `rgba(r, g, b, a)`. */
export declare function formatColor(color: Rgba): string;

/** Every `--name: value` pair in the sheet, first definition winning. */
export declare function collectVariables(css: string): Map<string, string>;

/** Lower `oklch()` and the resolvable `color-mix()` calls in one stylesheet. */
export declare function lowerColors(css: string): string;