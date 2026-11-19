/**
 * tests/lib/physics/safe-remove.test.ts
 * --------------------------------------------------------------------------
 * Teardown must not throw, even when the world it points at is already destroyed.
 */

import { describe, expect, it, vi } from 'vitest';

import { safeRemoveBody } from '@/lib/physics/safe-remove';

describe('safeRemoveBody', () => {
    it('removes the body when the world is alive', () => {
        const remove = vi.fn();
        expect(safeRemoveBody({ remove }, { id: 1 })).toBe(true);
        expect(remove).toHaveBeenCalledWith({ id: 1 });
    });

    it('does nothing when the world is null - the black-screen case', () => {
        expect(() => safeRemoveBody(null, { id: 1 })).not.toThrow();
        expect(safeRemoveBody(null, { id: 1 })).toBe(false);
    });

    it('does nothing when the world has no remove()', () => {
        expect(safeRemoveBody({}, { id: 1 })).toBe(false);
    });

    it('does nothing when the body is missing', () => {
        const remove = vi.fn();
        expect(safeRemoveBody({ remove }, null)).toBe(false);
        expect(remove).not.toHaveBeenCalled();
    });

    it('swallows a throwing world so shutdown can finish', () => {
        const remove = vi.fn(() => {
            throw new Error('world destroyed');
        });
        expect(safeRemoveBody({ remove }, { id: 1 })).toBe(false);
    });
});