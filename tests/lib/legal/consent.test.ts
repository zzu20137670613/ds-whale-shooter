/**
 * tests/lib/legal/consent.test.ts
 * --------------------------------------------------------------------------
 * First-launch privacy consent.
 *
 * 第七世's TapTap checklist, item 5: `首启要有隐私弹窗，同意才进游戏，并记账（我们用的 key 是
 * privacy-consent-v1）`. A store reviewer opens the app, sees a dialog, and expects the game not to
 * start before it is accepted.
 *
 * The bookkeeping lives here rather than in the component so the rules are testable without a DOM:
 *   - absent key            -> not consented
 *   - any non-empty value   -> consented (the value is a timestamp, for support questions)
 *   - storage unavailable   -> not consented, and writing must not throw (private mode, quota)
 */

import { describe, expect, it } from 'vitest';

import {
    PRIVACY_CONSENT_KEY,
    PRIVACY_POLICY_URL,
    grantConsent,
    hasConsent,
    revokeConsent,
} from '@/lib/legal/consent';

function memoryStorage(): Storage {
    const map = new Map<string, string>();
    return {
        get length() {
            return map.size;
        },
        clear: () => map.clear(),
        getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
        key: (i: number) => Array.from(map.keys())[i] ?? null,
        removeItem: (k: string) => void map.delete(k),
        setItem: (k: string, v: string) => void map.set(k, v),
    } as Storage;
}

describe('hasConsent', () => {
    it('is false before anything is stored', () => {
        expect(hasConsent(memoryStorage())).toBe(false);
    });

    it('is true once a consent value is stored', () => {
        const storage = memoryStorage();
        grantConsent(storage, new Date('2026-11-04T12:00:00Z'));
        expect(hasConsent(storage)).toBe(true);
    });

    it('treats an empty value as no consent', () => {
        const storage = memoryStorage();
        storage.setItem(PRIVACY_CONSENT_KEY, '');
        expect(hasConsent(storage)).toBe(false);
    });

    it('says no when storage is missing or throws', () => {
        expect(hasConsent(null)).toBe(false);
        const hostile = {
            getItem: () => {
                throw new Error('security error');
            },
        } as unknown as Storage;
        expect(hasConsent(hostile)).toBe(false);
    });
});

describe('grantConsent', () => {
    it('records a timestamp under the agreed key', () => {
        const storage = memoryStorage();
        grantConsent(storage, new Date('2026-11-04T12:34:56Z'));
        expect(storage.getItem(PRIVACY_CONSENT_KEY)).toBe('2026-11-04T12:34:56.000Z');
    });

    it('does not throw when writing is impossible', () => {
        const hostile = {
            setItem: () => {
                throw new Error('quota exceeded');
            },
        } as unknown as Storage;
        expect(() => grantConsent(hostile)).not.toThrow();
        expect(() => grantConsent(null)).not.toThrow();
    });
});

describe('revokeConsent', () => {
    it('clears a stored consent', () => {
        const storage = memoryStorage();
        grantConsent(storage);
        revokeConsent(storage);
        expect(hasConsent(storage)).toBe(false);
    });
});

describe('the key', () => {
    it('matches the one 第七世 recorded, so the two projects are greppable together', () => {
        expect(PRIVACY_CONSENT_KEY).toBe('privacy-consent-v1');
    });
});

describe('the policy link', () => {
    it('points at the page that actually resolves', () => {
        // The first submission shipped a link to forest.firetable.tech/privacy.html, which 404s:
        // the domain answered 200 but the path never existed. A reviewer opened it, saw the 404 and
        // wrote it up. Pinning the exact URL is the only way to stop that regressing.
        expect(PRIVACY_POLICY_URL).toBe(
            'https://api.kuaiyingai.cloud/download/privacy-shooter.html',
        );
    });

    it('is https, so the link works from inside the app', () => {
        expect(PRIVACY_POLICY_URL.startsWith('https://')).toBe(true);
    });
});
