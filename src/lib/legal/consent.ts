/**
 * src/lib/legal/consent.ts
 * --------------------------------------------------------------------------
 * First-launch privacy consent, stored on the device.
 *
 * China's app stores (TapTap included) require the app to show a privacy notice on first launch
 * and to start only after it is accepted. 第七世's checklist records the key the sibling project
 * uses — `privacy-consent-v1` — and keeping the same one makes both projects greppable together.
 *
 * The value is a timestamp rather than `true`: if a player ever asks "when did I agree", the answer
 * is on their own device instead of in a log we do not keep.
 *
 * Everything here takes the `Storage` as an argument instead of reaching for `window.localStorage`,
 * so the rules can be tested without a DOM, and so a private-mode browser (where access throws)
 * degrades to "not consented" rather than a crash.
 */

/** Where the consent timestamp lives. Deliberately outside the save, so wiping a run keeps it. */
export const PRIVACY_CONSENT_KEY = 'privacy-consent-v1';

/**
 * The policy page, hosted next to the game's web build.
 *
 * Both this app and its store listing are Chinese-only, so the page is written in Chinese; the URL
 * must be https and must actually answer — a store reviewer opens it.
 */
export const PRIVACY_POLICY_URL = 'https://api.kuaiyingai.cloud/download/privacy-shooter.html';

/** Has the player agreed on this device? Anything unreadable counts as "no". */
export function hasConsent(storage: Storage | null): boolean {
    if (!storage) return false;
    try {
        const raw = storage.getItem(PRIVACY_CONSENT_KEY);
        return typeof raw === 'string' && raw.length > 0;
    } catch {
        return false;
    }
}

/** Record agreement. A storage that refuses to write must not break the launch. */
export function grantConsent(storage: Storage | null, at: Date = new Date()): void {
    if (!storage) return;
    try {
        storage.setItem(PRIVACY_CONSENT_KEY, at.toISOString());
    } catch {
        // Quota or a locked-down WebView: the player simply sees the notice again next time.
    }
}

/** Forget agreement, so the notice is shown again (used by the dev tools and by tests). */
export function revokeConsent(storage: Storage | null): void {
    if (!storage) return;
    try {
        storage.removeItem(PRIVACY_CONSENT_KEY);
    } catch {
        // Same reasoning as grantConsent.
    }
}

/** `window.localStorage` when the runtime has one, otherwise null. */
export function defaultConsentStorage(): Storage | null {
    try {
        return typeof window !== 'undefined' && window.localStorage ? window.localStorage : null;
    } catch {
        return null;
    }
}
