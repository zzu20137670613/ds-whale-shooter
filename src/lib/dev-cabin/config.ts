/**
 * src/lib/dev-cabin/config.ts
 * --------------------------------------------------------------------------
 * The one place to edit when the cabin's letter route changes.
 *
 * `relay` is empty until the relay is reachable FROM THE PLAYER'S NETWORK.
 * That is not the same question as "is it deployed":
 *
 *   The Worker lives at dev-cabin-relay on workers.dev, but that hostname is
 *   dead on this network: local DNS answers 69.30.25.21 (a poisoning
 *   sinkhole), the real address via DoH is 128.242.245.244, and a TCP connect
 *   to it times out. So the Worker is published under a custom domain on the
 *   owner's own zone instead, which resolves to normal Cloudflare anycast and
 *   answers in about a second.
 *
 *   Measured, end to end: OPTIONS -> 204 with the CORS headers, POST -> a real
 *   issue in the repo (the integration test's issue was deleted afterwards).
 */

/** Where letters end up. */
export const DEV_CABIN_REPO = 'zzu20137670613/ds-whale-shooter';

/** The pinned guestbook issue — the dialog links to it read-only. */
export const DEV_CABIN_GUESTBOOK = `https://github.com/${DEV_CABIN_REPO}/issues/1`;

/**
 * The live relay: the Cloudflare Worker, published on the owner's own domain
 * because `*.workers.dev` is unreachable from here.
 *
 * Set this back to an empty string and the sender falls back to opening
 * GitHub's pre-filled new-issue page - no server involved, one extra click.
 */
export const DEV_CABIN_RELAY = 'https://cabin.kuaiyingai.cloud';
