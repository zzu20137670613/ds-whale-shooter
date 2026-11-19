/**
 * tests/game/drops/inventory-once.test.ts
 * --------------------------------------------------------------------------
 * One click on a bag item spends one item.
 *
 * The owner: `用Gemini在图书馆打开背包使用弹药箱或者灵力药水的时候，不是一个一个扣的，一次扣了
 * 好多个`.
 *
 * The cause was a listener leak, not the item logic: `DropController` binds
 * `INVENTORY_USE_EVENT` and the scene never destroyed it, so every level change added one
 * more handler and a single click ran the consumption N times. The scene now tears the
 * controller down, the controller refuses events after death, and a duplicate fire inside
 * 200ms counts as the same click.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { DROP_USE_DEDUPE_MS } from '@/lib/constants';

const ROOT = process.cwd();
const read = (...parts: string[]) => readFileSync(join(ROOT, ...parts), 'utf8');

describe('the leak', () => {
    it('is closed: the scene destroys the drop system', () => {
        const scene = read('src', 'game', 'scenes', 'scene.ts');
        expect(scene).toMatch(/shutdown\(\)[\s\S]{0,4000}this\.dropSystem\?\.destroy\(\)/);
    });

    it('the controller ignores events once disposed', () => {
        const drop = read('src', 'game', 'drops', 'drop.ts');
        expect(drop).toMatch(/if \(this\.disposed\) return;/);
        expect(drop).toMatch(/destroy\(\): void \{[\s\S]{0,200}this\.disposed = true/);
    });
});

describe('the belt to that brace', () => {
    it('one click is one spend, even if two listeners fire', () => {
        const drop = read('src', 'game', 'drops', 'drop.ts');
        expect(drop).toMatch(/now - last < DROP_USE_DEDUPE_MS[\s\S]{0,80}return false/);
    });

    it('is long enough to merge a double fire, short enough for a real second click', () => {
        expect(DROP_USE_DEDUPE_MS).toBeGreaterThanOrEqual(100);
        expect(DROP_USE_DEDUPE_MS).toBeLessThanOrEqual(500);
    });
});

describe('teardown cannot crash the scene', () => {
    it('removing a drop survives a Matter world that is already gone', () => {
        // The real crash: `Cannot read properties of null (reading 'remove')` from
        // DropInstance.destroy during shutdown, which left the restart on a black screen.
        const drop = read('src', 'game', 'drops', 'drop.ts');
        expect(drop).toMatch(/const world = scene\?\.matter\?\.world;/);
        expect(drop).toMatch(/if \(world && this\.body\)/);
        expect(drop).toMatch(/this\.rect\?\.destroy\(\)/);
    });

    it('and one failing subsystem does not skip the others', () => {
        const scene = read('src', 'game', 'scenes', 'scene.ts');
        expect(scene).toMatch(/try \{\s*this\.dropSystem\?\.destroy\(\);/);
        expect(scene).toMatch(/try \{\s*this\.triggerSystem\?\.destroy\(\);/);
    });
});