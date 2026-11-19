/**
 * Types for legacy-css.mjs, so the test can import it under `strict`.
 *
 * The implementation stays plain ESM (Vite loads it directly, no build step), but TypeScript
 * refuses to type an untyped `.mjs` import and the pre-commit hook runs `tsc --noEmit`.
 */

/** Remove `@layer` wrappers, keeping their contents and order. */
export declare function flattenLayers(css: string): string;

/** Vite plugin: run `flattenLayers` over the emitted CSS when `DSH_LEGACY_CSS=1`. */
export declare function legacyCssPlugin(options?: { enabled?: boolean }): {
    name: string;
    apply: 'build';
    enforce: 'post';
    configResolved(config: { build: { outDir: string } }): void;
    closeBundle(): void;
};