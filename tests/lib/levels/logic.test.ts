import { describe, it, expect } from 'vitest';

import { isPortalArmed } from '@/lib/levels/logic';

describe('isPortalArmed', () => {
    it('arms a gated portal only once the monsters are cleared', () => {
        expect(isPortalArmed({ requiresClear: true }, false)).toBe(false);
        expect(isPortalArmed({ requiresClear: true }, true)).toBe(true);
    });

    it('arms a portal with no flag once the monsters are cleared', () => {
        expect(isPortalArmed({}, false)).toBe(false);
        expect(isPortalArmed({}, true)).toBe(true);
    });

    it('arms an always-on portal whatever the monsters are doing', () => {
        expect(isPortalArmed({ requiresClear: false }, false)).toBe(true);
        expect(isPortalArmed({ requiresClear: false }, true)).toBe(true);
    });
});
