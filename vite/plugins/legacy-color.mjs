/**
 * vite/plugins/legacy-color.mjs
 * --------------------------------------------------------------------------
 * Turn Tailwind v4's colour output into colour an old WebView can paint.
 *
 * Measured on the built stylesheet (2026-11-02):
 *
 *   --color-red-600: oklch(57.7% .245 27.325)      <- 101 occurrences
 *   .bg-red-600 { background-color: var(--color-red-600) }
 *   .text-stone-100 { color: var(--color-stone-100) }
 *   .bg-black\/80 { background-color: color-mix(in oklab, var(--color-black) 80%, transparent) }
 *
 * Chromium 91 - the WebView inside 雷电模拟器 - knows neither `oklch()` (Chrome 111) nor
 * `color-mix()` (111). An invalid colour value makes the whole declaration fall back, so every
 * HP bar rendered transparent, every HUD label rendered the initial black, and the panels went
 * grey. That is the "血条没颜色 / 字变黑" bug the owner reported.
 *
 * This module evaluates both at build time:
 *
 *   1. `oklch(L C H[/ A])` -> `rgb(r g b[/ A])`, via OKLab -> linear sRGB -> sRGB gamma.
 *   2. `color-mix(in oklab, X p%, transparent)` -> `rgba(X, p% * alpha)` - the shape Tailwind
 *      uses for every `/opacity` utility.
 *
 * What it will not do: mixed colours between two custom properties it cannot see, and mixes
 * involving `currentcolor` (a hover tint, resolved at runtime by the browser). Those are left
 * as written; on an old WebView they simply keep the fallback.
 */

const clamp01 = (value) => Math.min(1, Math.max(0, value));

/** sRGB transfer function, applied after the linear -> sRGB matrix. */
function encodeSrgb(linear) {
    const v = clamp01(linear);
    return v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055;
}

/**
 * OKLCH -> sRGB.
 *
 * @param {number} lightness 0..1 (a `%` in CSS is L/100)
 * @param {number} chroma
 * @param {number} hueDegrees
 * @returns {[number, number, number]} 0..255, rounded
 */
export function oklchToSrgb(lightness, chroma, hueDegrees) {
    const rad = (hueDegrees * Math.PI) / 180;
    const a = chroma * Math.cos(rad);
    const b = chroma * Math.sin(rad);

    const lPrime = lightness + 0.3963377774 * a + 0.2158037573 * b;
    const mPrime = lightness - 0.1055613458 * a - 0.0638541728 * b;
    const sPrime = lightness - 0.0894841775 * a - 1.291485548 * b;

    const l = lPrime ** 3;
    const m = mPrime ** 3;
    const s = sPrime ** 3;

    const red = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
    const green = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
    const blue = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

    return [
        Math.round(encodeSrgb(red) * 255),
        Math.round(encodeSrgb(green) * 255),
        Math.round(encodeSrgb(blue) * 255),
    ];
}

/** Parse the arguments of an `oklch(...)` call. Returns null when the shape is unexpected. */
function parseOklch(args) {
    const [channels, alphaText] = args.split('/');
    const parts = channels.trim().split(/\s+/);
    if (parts.length < 3) return null;

    // Tailwind writes achromatic colours as `oklch(97% 0 none)` - CSS allows `none` for a
    // missing channel, and `Number.parseFloat('none')` is NaN, which made every neutral colour
    // (all the stone/neutral greys) fall through unconverted.
    const channel = (text) => (text === 'none' ? 0 : Number.parseFloat(text));

    const lightnessText = parts[0];
    const lightness =
        lightnessText === 'none'
            ? 0
            : lightnessText.endsWith('%')
              ? Number.parseFloat(lightnessText) / 100
              : Number.parseFloat(lightnessText);
    const chroma = channel(parts[1]);
    const hue = channel(parts[2]);

    if ([lightness, chroma, hue].some((n) => Number.isNaN(n))) return null;

    const alpha = alphaText !== undefined ? Number.parseFloat(alphaText) : 1;
    return { lightness, chroma, hue, alpha: Number.isNaN(alpha) ? 1 : clamp01(alpha) };
}

const NAMED = {
    black: [0, 0, 0],
    white: [255, 255, 255],
    red: [255, 0, 0],
    transparent: null,
};

/**
 * Resolve one colour operand to `{ rgb, alpha }`, or null when this module cannot.
 *
 * @param {string} token a `var(--x)`, `#hex`, `rgb()/rgba()`, `oklch()`, or a plain name
 * @param {Map<string, string>} variables custom properties already lowered to rgb
 */
export function resolveColorToken(token, variables) {
    const text = token.trim();
    if (!text) return null;

    if (text.startsWith('var(')) {
        const name = /^var\(\s*(--[\w-]+)/.exec(text)?.[1];
        if (!name) return null;
        const value = variables.get(name);
        if (!value) return null;
        return resolveColorToken(value, variables);
    }

    const named = NAMED[text.toLowerCase()];
    if (named !== undefined) {
        return named === null ? { rgb: [0, 0, 0], alpha: 0 } : { rgb: named, alpha: 1 };
    }

    const hex = /^#([0-9a-f]{3,8})$/i.exec(text);
    if (hex) {
        const raw = hex[1];
        const expand = (part) => Number.parseInt(part.length === 1 ? part + part : part, 16);
        if (raw.length === 3 || raw.length === 4) {
            return {
                rgb: [expand(raw[0]), expand(raw[1]), expand(raw[2])],
                alpha: raw.length === 4 ? expand(raw[3]) / 255 : 1,
            };
        }
        if (raw.length === 6 || raw.length === 8) {
            return {
                rgb: [expand(raw.slice(0, 2)), expand(raw.slice(2, 4)), expand(raw.slice(4, 6))],
                alpha: raw.length === 8 ? expand(raw.slice(6, 8)) / 255 : 1,
            };
        }
        return null;
    }

    const rgbCall = /^rgba?\(([^)]+)\)$/i.exec(text);
    if (rgbCall) {
        const parts = rgbCall[1].split(/[,/\s]+/).filter(Boolean);
        const channel = (part) =>
            part.endsWith('%') ? (Number.parseFloat(part) / 100) * 255 : Number.parseFloat(part);
        const alphaPart = parts[3];
        return {
            rgb: [channel(parts[0]), channel(parts[1]), channel(parts[2])].map((n) => Math.round(n)),
            alpha: alphaPart === undefined ? 1 : clamp01(Number.parseFloat(alphaPart)),
        };
    }

    const oklch = /^oklch\(([^)]+)\)$/i.exec(text);
    if (oklch) {
        const parsed = parseOklch(oklch[1]);
        if (!parsed) return null;
        return {
            rgb: oklchToSrgb(parsed.lightness, parsed.chroma, parsed.hue),
            alpha: parsed.alpha,
        };
    }

    return null;
}

/** `{ rgb, alpha }` -> the shortest `rgb()/rgba()` string that means it. */
export function formatColor({ rgb, alpha }) {
    const [r, g, b] = rgb;
    if (alpha >= 1) return `rgb(${r} ${g} ${b})`;
    return `rgba(${r}, ${g}, ${b}, ${Math.round(alpha * 1000) / 1000})`;
}

/** Collect `--name: value` pairs. Later definitions do not win: Tailwind emits one `:root`. */
export function collectVariables(css) {
    const map = new Map();
    const pattern = /(--[\w-]+)\s*:\s*([^;{}]+)/g;
    let match;
    while ((match = pattern.exec(css)) !== null) {
        const [, name, value] = match;
        if (!map.has(name)) map.set(name, value.trim());
    }
    return map;
}

/**
 * Evaluate one `color-mix(in <space>, A p%, B)` call, when both ends are knowable.
 *
 * Only the two shapes Tailwind emits are handled: mixing towards `transparent` (the `/opacity`
 * utilities) and a 50/50 or weighted mix of two resolvable colours.
 */
function evalColorMix(args, variables) {
    const inner = /^in\s+(?:oklab|lab|srgb|oklch)\s*,\s*(.+)$/i.exec(args.trim());
    if (!inner) return null;

    const stops = inner[1].split(',');
    if (stops.length !== 2) return null;

    const read = (stop) => {
        const percentMatch = /^(.*?)\s+([\d.]+)%$/.exec(stop.trim());
        const token = percentMatch ? percentMatch[1] : stop.trim();
        const percent = percentMatch ? Number.parseFloat(percentMatch[2]) : null;
        return { token, percent };
    };

    const left = read(stops[0]);
    const right = read(stops[1]);
    const leftColor = resolveColorToken(left.token, variables);
    const rightColor = resolveColorToken(right.token, variables);
    if (!leftColor && !rightColor) return null;

    // `A p%, transparent` -> A at p% of its own alpha.
    const rightAlphaZero = rightColor !== null && rightColor.alpha === 0;
    const leftAlphaZero = leftColor !== null && leftColor.alpha === 0;

    if (rightAlphaZero && leftColor && left.percent !== null) {
        return formatColor({ rgb: leftColor.rgb, alpha: leftColor.alpha * (left.percent / 100) });
    }
    if (leftAlphaZero && rightColor && right.percent !== null) {
        return formatColor({ rgb: rightColor.rgb, alpha: rightColor.alpha * (right.percent / 100) });
    }
    if (leftColor && rightColor) {
        const leftWeight = left.percent ?? right.percent === null ? 0.5 : 1 - right.percent / 100;
        const weight = left.percent !== null ? left.percent / 100 : leftWeight;
        const mix = [0, 1, 2].map((i) => Math.round(leftColor.rgb[i] * weight + rightColor.rgb[i] * (1 - weight)));
        return formatColor({
            rgb: mix,
            alpha: leftColor.alpha * weight + rightColor.alpha * (1 - weight),
        });
    }

    return null;
}

/**
 * The whole pass: lower `oklch()` and the resolvable `color-mix()` calls in one stylesheet.
 *
 * Runs to a fixed point (three passes at most) because evaluating a mix can expose another
 * `oklch()` inside a custom property.
 */
export function lowerColors(css) {
    let current = css;

    for (let pass = 0; pass < 3; pass += 1) {
        const variables = collectVariables(current);
        let changed = false;

        current = current.replace(/oklch\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi, (whole, args) => {
            const parsed = parseOklch(args);
            if (!parsed) return whole;
            changed = true;
            return formatColor({
                rgb: oklchToSrgb(parsed.lightness, parsed.chroma, parsed.hue),
                alpha: parsed.alpha,
            });
        });

        current = current.replace(
            /color-mix\(([^()]*(?:\([^()]*\)[^()]*)*)\)/gi,
            (whole, args) => {
                const evaluated = evalColorMix(args, variables);
                if (!evaluated) return whole;
                changed = true;
                return evaluated;
            },
        );

        if (!changed) break;
    }

    return current;
}