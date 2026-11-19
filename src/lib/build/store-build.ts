/**
 * src/lib/build/store-build.ts
 * --------------------------------------------------------------------------
 * The one switch that turns the game into a store build.
 *
 * A TapTap build must be provably single-player: two features in the game reach out of the
 * device - the repo chip in the top-right chrome and the developer cabin's letter form - and a
 * reviewer reads 「纯单机」 literally. Hiding them behind a runtime toggle would not be enough
 * (the code is still in the bundle, and a toggle is one dev-tools session away from coming back),
 * so this is a **build-time** flag: `vite build` inlines `import.meta.env.VITE_STORE_BUILD`, and a
 * store bundle simply contains neither the chip nor the form.
 *
 * The parsing lives in its own function because the build flag arrives as a string from the shell
 * (`"1"`) but as a boolean from a test or a `define`d constant, and "off" has to be the default:
 * a missing variable must never silently ship a build that talks to the network.
 */

/** True only for an explicit on-value; anything else (including undefined) is off. */
export function readStoreBuild(env: Record<string, unknown> | undefined | null): boolean {
    if (!env) return false;
    const raw = env.VITE_STORE_BUILD;
    return raw === '1' || raw === 1 || raw === true || raw === 'true';
}

/**
 * Replaced by `vite/config.prod.mjs` with a boolean literal, so the bundler can fold every
 * `STORE_BUILD ? ... : ...` and drop the store-only branches - URL strings included - out of a
 * store build. Undefined everywhere else (tests, dev server), where the env fallback applies.
 */
declare const __STORE_BUILD__: boolean | undefined;

/** Baked in at build time. False for a normal dev/web/desktop build. */
export const STORE_BUILD: boolean =
    typeof __STORE_BUILD__ !== 'undefined'
        ? __STORE_BUILD__
        : readStoreBuild((import.meta as unknown as { env?: Record<string, unknown> }).env ?? null);
