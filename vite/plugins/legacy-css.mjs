/**
 * vite/plugins/legacy-css.mjs
 * --------------------------------------------------------------------------
 * Make Tailwind v4's output survive an old Android WebView.
 *
 * Tailwind v4 wraps every utility in `@layer` and builds translucent colours with
 * `color-mix(in oklab, …)`. Cascade layers need Chromium 99 and `color-mix` needs 111, so a
 * WebView 91 - the one inside 雷电模拟器, which is where the mobile build gets tested - drops
 * the entire utilities layer. The page then renders unstyled: on the first mobile screenshot
 * that showed up as a 1051 px GitHub icon covering the game.
 *
 * 第七世 hit the same wall on her galgame and wrote a lightningcss pass
 * (`ds-galgame-mobile/vite.config.ts`, `LEGACY_BROWSER_TARGETS = { chrome: 91 << 16 }`). That
 * pass handles nesting and newer syntax, but lightningcss deliberately does **not** lower
 * `@layer` or `color-mix` - measured on our own bundle it left 5 `@layer`s and 268
 * `color-mix()`s in place. So this plugin does the one transform lightningcss will not:
 * it unwraps the layer blocks, keeping their order, which is what makes the rules apply at all.
 *
 * What is *not* fixed: `color-mix()` declarations still drop on 91, so a few translucent
 * backgrounds come out transparent. Layout, sizes and the game canvas are unaffected - and
 * this whole path only runs for the mobile build, never for desktop.
 */

import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { basename, join } from 'node:path';

import { lowerColors } from './legacy-color.mjs';

/** Cascade layers, `@layer a, b;` statement form. */
const LAYER_STATEMENT = '@layer';

/**
 * Remove `@layer` wrappers while keeping everything inside them, in place.
 *
 * Two forms appear in Tailwind's output:
 *
 *   - `@layer theme, base, components, utilities;` - an ordering statement, deleted outright;
 *   - `@layer utilities { … }` - a block; the wrapper goes, the contents stay.
 *
 * Order matters and is preserved: the layers are emitted in cascade order already, so unwrapping
 * in place leaves base before components before utilities, which is the order the browser would
 * have applied them in anyway.
 *
 * Scans character by character rather than with a regex: CSS braces nest, and a regex that tries
 * to match a balanced block is the classic way to corrupt a stylesheet.
 */
export function flattenLayers(css) {
    let out = '';
    let i = 0;

    /**
     * Brace depth of the *output*, and the depths a layer block has to return to.
     *
     * A layer's own `{` is never written, so its `}` must be skipped too. Tracking "we are
     * inside a layer" as a boolean is not enough: the first `}` after entering a layer closes
     * the layer's *first rule*, not the layer. That bug ate `.a{x:1}` -> `}` and left every
     * later rule one level too deep, which is why only 104 of ~1330 rules applied on WebView 91
     * while a modern browser recovered from the imbalance.
     */
    let depth = 0;
    const layerReturns = [];

    while (i < css.length) {
        const c = css[i];

        if (c === '/' && css[i + 1] === '*') {
            const close = css.indexOf('*/', i + 2);
            const stop = close === -1 ? css.length : close + 2;
            out += css.slice(i, stop);
            i = stop;
            continue;
        }

        if (c === '"' || c === "'") {
            const quote = c;
            let j = i + 1;
            while (j < css.length) {
                if (css[j] === '\\') {
                    j += 2;
                    continue;
                }
                if (css[j] === quote) {
                    j += 1;
                    break;
                }
                j += 1;
            }
            out += css.slice(i, j);
            i = j;
            continue;
        }

        if (css.startsWith(LAYER_STATEMENT, i)) {
            let j = i + LAYER_STATEMENT.length;
            let opensBlock = false;
            while (j < css.length) {
                const inner = css[j];
                if (inner === '{') {
                    opensBlock = true;
                    break;
                }
                if (inner === ';') break;
                j += 1;
            }
            if (opensBlock) {
                // Remember the depth this layer has to close back to, and drop its `{`.
                layerReturns.push(depth);
                i = j + 1;
            } else {
                i = j + 1;
            }
            continue;
        }

        if (c === '{') {
            out += c;
            depth += 1;
            i += 1;
            continue;
        }

        if (c === '}') {
            const closesLayer = layerReturns.length > 0 && layerReturns[layerReturns.length - 1] === depth;
            if (closesLayer) {
                layerReturns.pop();
                i += 1;
                continue;
            }
            out += c;
            depth -= 1;
            i += 1;
            continue;
        }

        out += c;
        i += 1;
    }

    return out;
}

/**
 * Vite plugin: flatten cascade layers in the emitted CSS.
 *
 * Writes on disk in `closeBundle` rather than mutating the bundle in `generateBundle`.
 * Two reasons, both learned the hard way:
 *
 *   1. Rollup hashes asset names **before** `generateBundle`, so an in-bundle mutation keeps the
 *      old file name and the WebView serves the unflattened file from its cache.
 *   2. Vite's own `vite:css-post` is also an `enforce: 'post'` plugin and appends the project's
 *      trailing `@layer base { … }` late; a `generateBundle` hook can therefore run before the
 *      stylesheet is complete. On disk, after everything, there is no such race.
 *
 * The stylesheet also goes through `lowerColors` here: layers are only half of what Chromium 91
 * rejects, and an `oklch()` colour makes the whole declaration fall back to transparent.
 */
export function legacyCssPlugin({ enabled = process.env.DSH_LEGACY_CSS === '1' } = {}) {
    // A closure, not `this`: `closeBundle` runs with the plugin *context* as `this`, so a field
    // written in `configResolved` is not visible there - which silently did nothing at first.
    let outDir;
    return {
        name: 'legacy-css-layers',
        apply: 'build',
        enforce: 'post',
        configResolved(config) {
            outDir = config.build.outDir;
        },
        closeBundle() {
            if (!enabled) return;

            if (!outDir || !existsSync(outDir)) return;

            const files = readdirSync(outDir, { recursive: true })
                .map((name) => String(name))
                .filter((name) => name.endsWith('.css'));

            const renames = new Map();
            for (const relative of files) {
                const full = join(outDir, relative);
                const source = readFileSync(full, 'utf8');
                const flattened = lowerColors(flattenLayers(source));
                if (flattened === source) continue;

                const stamp = createHash('sha256').update(flattened).digest('hex').slice(0, 8);
                const match = /-([A-Za-z0-9_-]{8})\.css$/.exec(relative);
                const nextRelative = match
                    ? relative.replace(`-${match[1]}.css`, `-${stamp}.css`)
                    : relative;

                writeFileSync(full, flattened, 'utf8');
                if (nextRelative !== relative) {
                    writeFileSync(join(outDir, nextRelative), flattened, 'utf8');
                    rmSync(full);
                    renames.set(basename(relative), basename(nextRelative));
                }
            }

            // Point the HTML (and any chunk that mentions the stylesheet) at the new name.
            if (renames.size === 0) return;
            for (const relative of readdirSync(outDir, { recursive: true }).map(String)) {
                if (!relative.endsWith('.html') && !relative.endsWith('.js')) continue;
                const full = join(outDir, relative);
                let source = readFileSync(full, 'utf8');
                let touched = false;
                for (const [before, after] of renames) {
                    if (source.includes(before)) {
                        source = source.split(before).join(after);
                        touched = true;
                    }
                }
                if (touched) writeFileSync(full, source, 'utf8');
            }
        },
    };
}
