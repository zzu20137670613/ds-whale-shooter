/**
 * src/lib/dev-cabin/config.ts
 * --------------------------------------------------------------------------
 * The one place to edit when the cabin's letter route changes.
 *
 * `relay` is empty until the relay is reachable FROM THE PLAYER'S NETWORK.
 * That is not the same question as "is it deployed":
 *
 *   The Worker is deployed and its logic works (it created, and we then
 *   deleted, issue #2 during integration). But `*.workers.dev` is blocked on
 *   this network: local DNS answers 69.30.25.21 (a poisoning sinkhole), the
 *   real address via DoH is 128.242.245.244, and a TCP connect to that address
 *   times out. The hostname is dead here even though the code behind it is fine.
 *
 * Fill `relay` in once it answers on a hostname that resolves and connects from
 * where the game is played - a Cloudflare custom domain on a normal zone, or a
 * domestic function URL. Nothing else has to change.
 */

/** Where letters end up. */
export const DEV_CABIN_REPO = 'zzu20137670613/ds-whale-shooter';

/** The pinned guestbook issue — the dialog links to it read-only. */
export const DEV_CABIN_GUESTBOOK = `https://github.com/${DEV_CABIN_REPO}/issues/1`;

/**
 * Deployed, but unreachable from here — see the note above:
 * https://dev-cabin-relay.ds-whale-shooter.workers.dev
 *
 * Empty string means "open GitHub's pre-filled new-issue page instead", which
 * needs no server at all and is a supported state, not an error.
 */
export const DEV_CABIN_RELAY = '';
