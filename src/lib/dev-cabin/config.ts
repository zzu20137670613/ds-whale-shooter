/**
 * src/lib/dev-cabin/config.ts
 * --------------------------------------------------------------------------
 * The one place to edit when the cabin's letter route changes.
 *
 * `relay` is empty until the Worker is deployed: the sender then falls back to
 * opening a pre-filled "new issue" page, which needs no server at all. Fill it
 * in and the same code starts delivering letters with zero clicks - nothing
 * else has to change.
 */

/** Where letters end up. */
export const DEV_CABIN_REPO = 'zzu20137670613/ds-whale-shooter';

/** The pinned guestbook issue — the dialog links to it read-only. */
export const DEV_CABIN_GUESTBOOK = `https://github.com/${DEV_CABIN_REPO}/issues/1`;

/**
 * Optional relay (see art-source/dev-cabin/relay/). Empty string = not
 * deployed yet, which is a supported state, not an error.
 */
export const DEV_CABIN_RELAY = '';
