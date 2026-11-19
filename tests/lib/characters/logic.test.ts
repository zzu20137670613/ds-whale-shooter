/**
 * tests/lib/characters/logic.test.ts
 * --------------------------------------------------------------------------
 * Pure roster helpers. The save file stores a character *id*, so the roster
 * is the only thing that can tell a live id from one that a rename or a
 * retired character left behind.
 */

import { describe, expect, it } from 'vitest';

import { resolveRosterCharacterId } from '@/lib/characters/logic';

const ROSTER = ['deepseek', 'claude', 'gpt', 'qwen', 'seed'];

describe('characters/logic — resolveRosterCharacterId', () => {
    it('keeps an id that is still on the roster', () => {
        expect(resolveRosterCharacterId('qwen', ROSTER)).toBe('qwen');
    });

    it('drops an id that no longer exists (a rename left it in the save)', () => {
        expect(resolveRosterCharacterId('whale-girl', ROSTER)).toBeNull();
    });

    it('returns null when nobody has picked yet', () => {
        expect(resolveRosterCharacterId(null, ROSTER)).toBeNull();
        expect(resolveRosterCharacterId(undefined, ROSTER)).toBeNull();
        expect(resolveRosterCharacterId('', ROSTER)).toBeNull();
    });

    it('returns null for any id when the roster is empty', () => {
        expect(resolveRosterCharacterId('claude', [])).toBeNull();
    });

    it('does not match a prefix or a case variant', () => {
        expect(resolveRosterCharacterId('deep', ROSTER)).toBeNull();
        expect(resolveRosterCharacterId('DeepSeek', ROSTER)).toBeNull();
    });
});